import { randomUUID } from "node:crypto";
import type { Store } from "./store.js";
import { activeJob, type WorkspaceJob } from "../shared/jobs.js";

export class Jobs {
  private volatile = new Map<string, WorkspaceJob>();
  constructor(private store: Store) {
    store.db.exec(`CREATE TABLE IF NOT EXISTS workspace_jobs (
      id TEXT PRIMARY KEY, updatedAt TEXT NOT NULL, active INTEGER NOT NULL, payload TEXT NOT NULL
    )`);
    for (const job of this.list().filter((job) => activeJob(job.phase))) {
      const scan = job.kind === "browser" ? store.scan(job.id) : undefined;
      this.update(job.id, {
        phase:
          scan?.status === "queued"
            ? "queued"
            : scan?.status === "completed"
              ? "completed"
              : "interrupted",
        reason:
          scan?.status === "queued"
            ? "Wartet auf den Browser-Worker"
            : undefined,
        failure:
          scan?.status === "queued" || scan?.status === "completed"
            ? undefined
            : "interrupted",
      });
    }
    for (const scan of store.queuedScans())
      this.browser(scan.id, scan.projectId, "queued");
  }
  private save(job: WorkspaceJob, required = false) {
    try {
      this.store.db
        .prepare(
          `INSERT INTO workspace_jobs VALUES (?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET updatedAt=excluded.updatedAt,active=excluded.active,payload=excluded.payload`,
        )
        .run(
          job.id,
          job.updatedAt,
          Number(activeJob(job.phase)),
          JSON.stringify(job),
        );
      this.volatile.delete(job.id);
      if (!activeJob(job.phase))
        this.store.db.exec(`DELETE FROM workspace_jobs WHERE id IN
        (SELECT id FROM workspace_jobs WHERE active=0 ORDER BY updatedAt DESC,rowid DESC LIMIT -1 OFFSET 150)`);
    } catch (error) {
      if (required) throw error;
      this.volatile.set(job.id, job);
      if (this.volatile.size > 150)
        this.volatile.delete(this.volatile.keys().next().value!);
    }
    return job;
  }
  start(
    kind: WorkspaceJob["kind"],
    context: Partial<
      Pick<WorkspaceJob, "id" | "projectId" | "scanId" | "phase">
    > = {},
  ) {
    const now = new Date().toISOString();
    return this.save(
      {
        id: randomUUID(),
        kind,
        phase: "running",
        createdAt: now,
        updatedAt: now,
        ...context,
      },
      true,
    );
  }
  get(id: string): WorkspaceJob | undefined {
    const row = this.store.db
      .prepare("SELECT payload FROM workspace_jobs WHERE id=?")
      .get(id);
    return (
      this.volatile.get(id) ??
      (row ? JSON.parse(String(row.payload)) : undefined)
    );
  }
  update(id: string, patch: Partial<WorkspaceJob>) {
    const job = this.get(id);
    if (job)
      return this.save({
        ...job,
        ...patch,
        updatedAt: new Date().toISOString(),
      });
  }
  browser(
    id: string,
    projectId: string,
    phase: WorkspaceJob["phase"],
    patch: Partial<WorkspaceJob> = {},
  ) {
    if (!this.get(id))
      this.start("browser", { id, scanId: id, projectId, phase });
    return this.update(id, { phase, ...patch });
  }
  list(): WorkspaceJob[] {
    const rows = this.store.db
      .prepare(
        "SELECT payload FROM workspace_jobs ORDER BY active DESC,updatedAt DESC,rowid DESC LIMIT 160",
      )
      .all();
    const jobs = new Map<string, WorkspaceJob>(
      rows.map((row) => {
        const job = JSON.parse(String(row.payload));
        return [job.id, job];
      }),
    );
    for (const [id, job] of this.volatile) jobs.set(id, job);
    return [...jobs.values()].sort(
      (a, b) =>
        Number(activeJob(b.phase)) - Number(activeJob(a.phase)) ||
        b.updatedAt.localeCompare(a.updatedAt),
    );
  }
}

export function failureCode(error: unknown): WorkspaceJob["failure"] {
  const value = error as { code?: string; errcode?: number } | undefined;
  return value?.code === "ENOSPC" || value?.errcode === 13
    ? "disk-full"
    : "operation";
}
