import { fork, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import type {
  ScanResult,
  WorkerEvent,
  LiveFrame,
  Finding,
} from "../shared/types.js";
import type { WorkerJob } from "./scan-worker.js";
import type { Store } from "./store.js";
import { buildTasks } from "./services/reports.js";
import { compareScans } from "./services/comparison.js";

export class Runner {
  private active?: ChildProcess;
  private activeId?: string;
  private hardStop?: ReturnType<typeof setTimeout>;
  private closing = false;
  private cancelled = new Set<string>();
  private frames = new Map<string, LiveFrame>();
  private findings = new Map<string, Finding[]>();
  constructor(
    private store: Store,
    private origin: string,
  ) {}
  enqueue() {
    void this.next();
  }
  isBusy() {
    return !!this.active || this.store.queuedScans().length > 0;
  }
  readiness() {
    return {
      active: !!this.active,
      scanId: this.activeId,
      resultsSaved:
        !!this.activeId &&
        !["running", "paused", "queued"].includes(
          this.store.scan(this.activeId)?.status ?? "running",
        ),
      queued: this.store.queuedScans().length > 0,
    };
  }
  live(id: string) {
    return {
      frame: this.frames.get(id) ?? null,
      findings: this.findings.get(id) ?? [],
      progress: this.store.scan(id)?.progress ?? null,
    };
  }
  private persistTasks(id: string) {
    const scan = this.store.scan(id);
    if (!scan?.result?.audit) return;
    const project = this.store.project(scan.projectId)!;
    const tasks = buildTasks(project, scan);
    this.store.saveTasks(tasks);
    if (scan.status !== "completed") return;
    const before = scan.options?.retest
      ? this.store.scan(scan.options.retest.sourceScanId)
      : this.store
          .scans()
          .find(
            (item) =>
              item.id !== id &&
              item.projectId === scan.projectId &&
              item.result?.audit &&
              !item.options?.retest &&
              item.status === "completed",
          );
    if (!before) return;
    const comparison = compareScans(before, scan);
    const resolved = new Set(
      comparison.entries
        .filter((entry) => entry.state === "resolved")
        .map((entry) => entry.beforeFindingId),
    );
    for (const task of this.store.tasks(before.id)) {
      if (
        task.status !== "verified" &&
        (!scan.options?.retest || task.id === scan.options.retest.taskId) &&
        task.findingIds.length &&
        task.findingIds.every((findingId) => resolved.has(findingId))
      )
        this.store.updateTask(task.id, "verified", scan.id);
    }
    // Preserve deliberate task workflow for unchanged groups in the latest report.
    for (const task of tasks) {
      const related = scan.result.audit.findings.filter((finding) =>
        task.findingIds.includes(finding.id),
      );
      const old = this.store
        .tasks(before.id)
        .find(
          (previous) =>
            previous.title === task.title &&
            previous.category === task.category &&
            previous.status !== "verified" &&
            related.some((finding) =>
              before.result!.audit!.findings.some(
                (f) =>
                  previous.findingIds.includes(f.id) &&
                  f.fingerprint === finding.fingerprint,
              ),
            ),
        );
      if (old && ["in-progress", "review", "accepted"].includes(old.status))
        this.store.updateTask(task.id, old.status);
    }
  }
  private async next() {
    if (this.active || this.closing) return;
    const scan = this.store.queuedScans()[0];
    if (!scan) return;
    const project = this.store.project(scan.projectId)!;
    this.store.running(scan.id);
    this.cancelled.delete(scan.id);
    const workerPath = new URL(
      import.meta.url.endsWith(".ts") ? "./scan-worker.ts" : "./scan-worker.js",
      import.meta.url,
    );
    const child = fork(fileURLToPath(workerPath), [], {
      execArgv: workerPath.pathname.endsWith(".ts") ? ["--import", "tsx"] : [],
      stdio: ["ignore", "ignore", "pipe", "ipc"],
    });
    this.active = child;
    this.activeId = scan.id;
    let settled = false;
    const count =
      (scan.options?.pages.length || 1) * (scan.options?.viewports.length || 3);
    const duration = Math.min(
      30 * 60_000,
      Math.max(
        120_000,
        count * 30_000 +
          (scan.options?.performance ? 300_000 : 0) +
          60_000 +
          (scan.options?.technicalSeo ? 90_000 : 0) +
          (scan.options?.journeys ?? []).reduce(
            (n, j) => n + j.viewportIds.length * 45_000,
            0,
          ),
      ),
    );
    let remaining = duration,
      tick = Date.now();
    const timeout = setInterval(() => {
      const now = Date.now();
      if (this.store.scan(scan.id)?.status !== "paused")
        remaining -= now - tick;
      tick = now;
      if (remaining <= 0) {
        settle("Das dokumentierte Gesamtzeitlimit der Prüfung wurde erreicht.");
        this.stop(child);
      }
    }, 1000);
    const settle = (error?: string, result?: ScanResult) => {
      if (settled || this.closing) return;
      settled = true;
      clearTimeout(timeout);
      if (result)
        this.store.finish(
          scan.id,
          result,
          this.cancelled.has(scan.id) ? "cancelled" : "completed",
        );
      else
        this.store.fail(
          scan.id,
          error || "Die Prüfung wurde nicht abgeschlossen.",
          this.cancelled.has(scan.id) ? "cancelled" : "failed",
        );
      this.persistTasks(scan.id);
    };
    child.on(
      "message",
      (message: WorkerEvent | { result?: ScanResult; error?: string }) => {
        if (this.closing || settled) return;
        if ("type" in message) {
          if (message.type === "progress") {
            this.store.progress(scan.id, message.progress);
            if (message.progress.phase === "paused")
              this.store.setStatus(scan.id, "paused");
            else if (this.store.scan(scan.id)?.status === "paused")
              this.store.setStatus(scan.id, "running");
          } else if (
            message.type === "frame" &&
            message.frame.image.length < 1_500_000
          )
            this.frames.set(scan.id, message.frame);
          else if (message.type === "finding")
            this.findings.set(
              scan.id,
              [
                ...(this.findings.get(scan.id) || []).filter(
                  (f) => f.id !== message.finding.id,
                ),
                message.finding,
              ].slice(-2000),
            );
          else if (message.type === "checkpoint")
            this.store.checkpoint(scan.id, message.result);
        } else settle(message.error, message.result);
      },
    );
    child.on("error", (error) => settle(error.message));
    child.on("exit", () => {
      if (!this.closing)
        settle(
          "Der Prüf-Browser wurde beendet. Gespeicherte Zwischenstände bleiben erhalten.",
        );
      clearTimeout(timeout);
      clearTimeout(this.hardStop);
      this.active = undefined;
      this.activeId = undefined;
      if (this.frames.size > 5) {
        const first = this.frames.keys().next().value;
        if (first) {
          this.frames.delete(first);
          this.findings.delete(first);
        }
      }
      if (!this.closing) void this.next();
    });
    child.stderr?.on("data", () => {});
    const demo = this.store.isDemo(project.id);
    const job: WorkerJob = {
      id: scan.id,
      url: demo ? `${this.origin}/demo-site` : project.url,
      dataDir: this.store.dataDir,
      demoOrigin: demo ? this.origin : undefined,
      hubOrigin: this.origin,
      allowedLocalOrigin:
        project.environment === "local" && !demo
          ? new URL(project.url).origin
          : undefined,
      environment: project.environment,
      options: scan.options!,
      resumeReport: scan.result?.audit,
    };
    child.send(job);
  }
  control(id: string, action: "pause" | "resume" | "cancel") {
    const scan = this.store.scan(id);
    if (!scan)
      throw Object.assign(new Error("Prüfung nicht gefunden."), {
        statusCode: 404,
      });
    if (action === "cancel") {
      if (!["queued", "running", "paused"].includes(scan.status))
        throw Object.assign(new Error("Diese Prüfung ist nicht aktiv."), {
          statusCode: 409,
        });
      this.cancelled.add(id);
      if (this.activeId === id) {
        this.active?.send({ type: "control", action });
        this.stop(this.active!);
      } else this.store.fail(id, "Vom Nutzer abgebrochen.", "cancelled");
    } else if (action === "pause") {
      if (scan.status === "queued") this.store.setStatus(id, "paused");
      else if (this.activeId === id && scan.status === "running")
        this.active?.send({ type: "control", action });
      else
        throw Object.assign(
          new Error("Diese Prüfung kann gerade nicht pausiert werden."),
          { statusCode: 409 },
        );
    } else {
      if (this.activeId === id && scan.status === "paused") {
        this.store.setStatus(id, "running");
        this.active?.send({ type: "control", action });
      } else if (
        ["paused", "interrupted", "failed", "cancelled"].includes(
          scan.status,
        ) &&
        scan.options &&
        !this.activeId
      ) {
        this.store.setStatus(id, "queued");
        this.enqueue();
      } else
        throw Object.assign(
          new Error(
            "Fortsetzen ist gerade nicht möglich. Starte gegebenenfalls eine neue Prüfung.",
          ),
          { statusCode: 409 },
        );
    }
    return this.store.scan(id)!;
  }
  private stop(child: ChildProcess) {
    child.kill("SIGTERM");
    this.hardStop = setTimeout(() => child.kill("SIGKILL"), 5000);
  }
  async close() {
    this.closing = true;
    if (this.active) {
      const child = this.active;
      const exited = new Promise<void>((resolve) =>
        child.once("exit", () => resolve()),
      );
      this.stop(child);
      await exited;
    }
  }
}
