import { syncFile } from "./operations.js";
import { fork } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, renameSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Jobs } from "./jobs.js";
import { failureCode } from "./jobs.js";

const artifactName =
  /^[a-f0-9-]{36}\.(?:sitefenn|part|sqlite(?:-journal|-wal|-shm)?)$/;
export class BackupJobs {
  readonly folder: string;
  private active?: {
    id: string;
    cancel: (interrupted?: boolean) => void;
    done: Promise<void>;
  };
  constructor(
    private dataDir: string,
    private jobs: Jobs,
  ) {
    this.folder = join(dataDir, "job-backups");
    mkdirSync(this.folder, { recursive: true, mode: 0o700 });
    for (const name of readdirSync(this.folder)) {
      if (!artifactName.test(name)) continue;
      const job = jobs.get(name.split(".")[0]!);
      if (
        !name.endsWith(".sitefenn") ||
        job?.phase !== "completed" ||
        !job.downloadable
      )
        rmSync(join(this.folder, name), { force: true });
    }
  }
  start(projectId?: string) {
    if (this.active) throw Error("Eine Sicherung läuft bereits.");
    const job = this.jobs.start("backup", { projectId });
    this.jobs.update(job.id, {
      reason: "SQLite-Snapshot wird vorbereitet",
      cancellable: true,
    });
    const archivePath = join(this.folder, `${job.id}.part`);
    const snapshotPath = join(this.folder, `${job.id}.sqlite`);
    const source = import.meta.url.endsWith(".ts");
    let child;
    try {
      child = fork(
        fileURLToPath(
          new URL(
            source ? "./backup-worker.ts" : "./backup-worker.js",
            import.meta.url,
          ),
        ),
        [],
        {
          execArgv: source ? ["--import", "tsx"] : [],
          stdio: ["ignore", "ignore", "ignore", "ipc"],
        },
      );
    } catch (error) {
      this.jobs.update(job.id, {
        phase: "failed",
        failure: failureCode(error),
        cancellable: false,
        reason: undefined,
      });
      throw error;
    }
    let interrupted = false;
    let cancelled = false,
      written = false;
    let failure: ReturnType<typeof failureCode>;
    const done = new Promise<void>((resolve) => {
      child.on("error", () => {
        failure = "worker";
      });
      child.on(
        "message",
        (message: {
          completed?: number;
          total?: number;
          done?: boolean;
          failure?: typeof failure;
        }) => {
          if (cancelled) return;
          if (message.failure) failure = message.failure;
          else if (message.done) {
            written = true;
            this.jobs.update(job.id, {
              phase: "cleaning-up",
              reason: "Sicherungsdatei wird abgeschlossen",
              cancellable: false,
            });
          } else if (
            message.completed !== undefined &&
            message.total !== undefined
          )
            this.jobs.update(job.id, {
              progress: {
                completed: message.completed,
                total: message.total,
                unit: "bytes",
              },
              reason: undefined,
            });
        },
      );
      child.once("close", (code) => {
        let completed = false;
        try {
          if (!cancelled && written && code === 0 && !failure) {
            renameSync(archivePath, join(this.folder, `${job.id}.sitefenn`));
            syncFile(this.folder);
            completed = true;
          }
          for (const path of [
            archivePath,
            snapshotPath,
            `${snapshotPath}-journal`,
            `${snapshotPath}-wal`,
            `${snapshotPath}-shm`,
          ])
            rmSync(path, { force: true });
          if (completed)
            for (const old of this.jobs.list()) {
              if (old.id === job.id || !old.downloadable) continue;
              rmSync(join(this.folder, `${old.id}.sitefenn`), { force: true });
              this.jobs.update(old.id, { downloadable: false });
            }
        } catch (error) {
          failure = failureCode(error);
        } finally {
          this.jobs.update(job.id, {
            phase: completed
              ? "completed"
              : interrupted
                ? "interrupted"
                : cancelled
                  ? "cancelled"
                  : "failed",
            failure: interrupted
              ? "interrupted"
              : completed || cancelled
                ? undefined
                : (failure ?? "worker"),
            reason: undefined,
            cancellable: false,
            downloadable: completed,
          });
          this.active = undefined;
          resolve();
        }
      });
    });
    this.active = {
      id: job.id,
      done,
      cancel: (onShutdown = false) => {
        interrupted = onShutdown;
        cancelled = true;
        this.jobs.update(job.id, {
          phase: "cancelling",
          reason: "Sicherungs-Worker wird beendet",
          cancellable: false,
        });
        child.kill("SIGKILL");
      },
    };
    child.send(
      { dataDir: this.dataDir, archivePath, snapshotPath, projectId },
      (error) => {
        if (error) {
          failure = "worker";
          child.kill();
        }
      },
    );
    return { job: this.jobs.get(job.id)!, done };
  }
  cancel(id: string) {
    if (this.active?.id !== id || !this.jobs.get(id)?.cancellable) return false;
    this.active.cancel();
    return true;
  }
  async close() {
    const active = this.active;
    if (active) {
      active.cancel(true);
      await active.done;
    }
  }
}
