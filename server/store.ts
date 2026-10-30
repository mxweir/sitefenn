import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { PageAnalysis, VisualReference } from "../shared/types.js";
import type {
  Project,
  Scan,
  ScanResult,
  ScanOptions,
  ScanProgress,
  Environment,
  AuditTask,
  TaskStatus,
  HubSettings,
  SearchDataset,
  AiPlan,
} from "../shared/types.js";

export class Store {
  readonly db: DatabaseSync;
  constructor(readonly dataDir: string) {
    mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    for (const directory of ["evidence", "backups"])
      mkdirSync(join(dataDir, directory), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(join(dataDir, "hub.sqlite"));
    this.db.exec(
      "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
    );
    const schema = Number(
      this.db.prepare("PRAGMA user_version").get()?.user_version || 0,
    );
    if (schema > 2) {
      this.db.close();
      throw new Error(
        "Database is newer than this app. Refusing to modify it.",
      );
    }
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS runtime_lock (id INTEGER PRIMARY KEY CHECK(id=1), pid INTEGER NOT NULL)",
    );
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const owner = this.db
        .prepare("SELECT pid FROM runtime_lock WHERE id=1")
        .get();
      if (owner) {
        let alive = true;
        try {
          process.kill(Number(owner.pid), 0);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ESRCH") alive = false;
        }
        if (alive)
          throw new Error(
            "This data directory is already in use by a running Hub.",
          );
      }
      this.db
        .prepare("INSERT OR REPLACE INTO runtime_lock (id,pid) VALUES (1,?)")
        .run(process.pid);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      this.db.close();
      throw error;
    }
    try {
      if (schema === 1)
        this.db
          .prepare("VACUUM INTO ?")
          .run(
            join(dataDir, "backups", `before-schema-2-${Date.now()}.sqlite`),
          );
      this.db.exec("BEGIN IMMEDIATE");
      this.db.exec(`CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL, environment TEXT NOT NULL,
        createdAt TEXT NOT NULL, demo INTEGER NOT NULL DEFAULT 0
      ); CREATE TABLE IF NOT EXISTS scans (
        id TEXT PRIMARY KEY, projectId TEXT NOT NULL REFERENCES projects(id), status TEXT NOT NULL,
        createdAt TEXT NOT NULL, finishedAt TEXT, error TEXT, result TEXT, options TEXT, progress TEXT
      );`);
      const columns = new Set(
        this.db
          .prepare("PRAGMA table_info(scans)")
          .all()
          .map((row) => row.name),
      );
      if (!columns.has("options"))
        this.db.exec("ALTER TABLE scans ADD COLUMN options TEXT");
      if (!columns.has("progress"))
        this.db.exec("ALTER TABLE scans ADD COLUMN progress TEXT");
      this.db
        .exec(`CREATE TABLE IF NOT EXISTS workspace_preferences (key TEXT PRIMARY KEY,payload TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, scanId TEXT NOT NULL REFERENCES scans(id), projectId TEXT NOT NULL REFERENCES projects(id), payload TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS search_datasets (id TEXT PRIMARY KEY, projectId TEXT NOT NULL REFERENCES projects(id), payload TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS ai_plans (id TEXT PRIMARY KEY, scanId TEXT NOT NULL REFERENCES scans(id), payload TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS visual_references (id TEXT PRIMARY KEY, projectId TEXT NOT NULL REFERENCES projects(id), payload TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS scans_project ON scans(projectId,createdAt);
        CREATE INDEX IF NOT EXISTS tasks_scan ON tasks(scanId);
        PRAGMA user_version=2;`);
      this.db.exec("COMMIT");
      this.db
        .prepare(
          "UPDATE scans SET status='interrupted', finishedAt=?, error=? WHERE status IN ('running','paused') OR (status='queued' AND options IS NULL)",
        )
        .run(
          new Date().toISOString(),
          "Die App wurde beendet. Gespeicherte Zwischenstände bleiben erhalten; du kannst die Prüfung fortsetzen.",
        );
      for (const row of this.db
        .prepare(
          "SELECT payload FROM ai_plans WHERE json_extract(payload,'$.kind')='page-analysis'",
        )
        .all()) {
        const job = JSON.parse(String(row.payload)) as PageAnalysis;
        if (["queued", "running"].includes(job.status)) {
          job.status = "interrupted";
          job.stage = "done";
          job.updatedAt = new Date().toISOString();
          job.parts = job.parts.map((part) =>
            ["queued", "running"].includes(part.status)
              ? {
                  ...part,
                  status: "cancelled",
                  error:
                    "App beendet; dieser Kontextteil wurde nicht abgeschlossen.",
                }
              : part,
          );
          job.warnings.push(
            "Die App wurde beendet. Vorhandene Teilantworten bleiben erhalten; für eine vollständige Erklärung neu analysieren.",
          );
          this.savePageAnalysis(job);
        }
      }
    } catch (error) {
      if (this.db.isTransaction) this.db.exec("ROLLBACK");
      this.close();
      throw error;
    }
  }
  preference(key: string): unknown {
    const row = this.db
      .prepare("SELECT payload FROM workspace_preferences WHERE key=?")
      .get(key);
    return row ? JSON.parse(String(row.payload)) : undefined;
  }
  savePreference(key: string, value: unknown) {
    this.db
      .prepare(
        "INSERT OR REPLACE INTO workspace_preferences(key,payload) VALUES (?,?)",
      )
      .run(key, JSON.stringify(value));
  }
  projects(): Project[] {
    return this.db
      .prepare(
        "SELECT id,name,url,environment,createdAt FROM projects ORDER BY createdAt DESC,rowid DESC",
      )
      .all() as unknown as Project[];
  }
  project(id: string): Project | undefined {
    return this.db
      .prepare(
        "SELECT id,name,url,environment,createdAt FROM projects WHERE id=?",
      )
      .get(id) as unknown as Project | undefined;
  }
  isDemo(id: string) {
    return (
      this.db.prepare("SELECT demo FROM projects WHERE id=?").get(id)?.demo ===
      1
    );
  }
  createProject(
    name: string,
    url: string,
    environment: Environment,
    demo = false,
  ): Project {
    const project: Project = {
      id: randomUUID(),
      name,
      url,
      environment,
      createdAt: new Date().toISOString(),
    };
    this.db
      .prepare(
        "INSERT INTO projects (id,name,url,environment,createdAt,demo) VALUES (?,?,?,?,?,?)",
      )
      .run(project.id, name, url, environment, project.createdAt, demo ? 1 : 0);
    return project;
  }
  private decodeScan(row: Record<string, unknown>): Scan {
    return {
      ...row,
      result: row.result ? JSON.parse(String(row.result)) : null,
      options: row.options ? JSON.parse(String(row.options)) : undefined,
      progress: row.progress ? JSON.parse(String(row.progress)) : undefined,
    } as Scan;
  }
  scans(): Scan[] {
    return this.db
      .prepare(
        "SELECT * FROM scans ORDER BY createdAt DESC,rowid DESC LIMIT 300",
      )
      .all()
      .map((row) => this.decodeScan(row));
  }
  scan(id: string) {
    const row = this.db.prepare("SELECT * FROM scans WHERE id=?").get(id);
    return row ? this.decodeScan(row) : undefined;
  }
  queuedScans() {
    return this.db
      .prepare(
        "SELECT * FROM scans WHERE status='queued' ORDER BY createdAt,rowid",
      )
      .all()
      .map((row) => this.decodeScan(row));
  }
  createScan(projectId: string, options?: ScanOptions): Scan {
    const scan: Scan = {
      id: randomUUID(),
      projectId,
      status: "queued",
      createdAt: new Date().toISOString(),
      finishedAt: null,
      error: null,
      result: null,
      options,
    };
    this.db
      .prepare(
        "INSERT INTO scans (id,projectId,status,createdAt,options) VALUES (?,?,?,?,?)",
      )
      .run(
        scan.id,
        projectId,
        scan.status,
        scan.createdAt,
        options ? JSON.stringify(options) : null,
      );
    return scan;
  }
  running(id: string) {
    this.db
      .prepare("UPDATE scans SET status='running',error=NULL WHERE id=?")
      .run(id);
  }
  setStatus(id: string, status: Scan["status"]) {
    this.db
      .prepare("UPDATE scans SET status=?,error=NULL WHERE id=?")
      .run(status, id);
  }
  progress(id: string, progress: ScanProgress) {
    this.db
      .prepare("UPDATE scans SET progress=? WHERE id=?")
      .run(JSON.stringify(progress), id);
  }
  checkpoint(id: string, result: ScanResult) {
    this.db
      .prepare("UPDATE scans SET result=? WHERE id=?")
      .run(JSON.stringify(result), id);
  }
  finish(
    id: string,
    result: ScanResult,
    status: "completed" | "cancelled" = "completed",
  ) {
    this.db
      .prepare(
        "UPDATE scans SET status=?,result=?,finishedAt=?,error=NULL WHERE id=?",
      )
      .run(status, JSON.stringify(result), new Date().toISOString(), id);
  }
  fail(id: string, error: string, status: "failed" | "cancelled" = "failed") {
    this.db
      .prepare("UPDATE scans SET status=?,error=?,finishedAt=? WHERE id=?")
      .run(status, error.slice(0, 1200), new Date().toISOString(), id);
  }
  settings(): HubSettings {
    const row = this.db
      .prepare("SELECT payload FROM settings WHERE id=1")
      .get();
    return row
      ? JSON.parse(String(row.payload))
      : { model: "", speechEnabled: false };
  }
  updateSettings(values: Partial<HubSettings>) {
    const settings = { ...this.settings(), ...values };
    this.db
      .prepare("INSERT OR REPLACE INTO settings (id,payload) VALUES (1,?)")
      .run(JSON.stringify(settings));
    return settings;
  }
  saveTasks(tasks: AuditTask[]) {
    const statement = this.db.prepare(
      "INSERT INTO tasks (id,scanId,projectId,payload) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",
    );
    for (const task of tasks) {
      const previous = this.task(task.id);
      const updated = previous
        ? {
            ...task,
            ...(previous.aiProposal ? { aiProposal: previous.aiProposal } : {}),
            status: previous.status,
            updatedAt: previous.updatedAt,
            verifiedByScanId: previous.verifiedByScanId,
          }
        : task;
      statement.run(
        task.id,
        task.scanId,
        task.projectId,
        JSON.stringify(updated),
      );
    }
  }
  tasks(scanId?: string): AuditTask[] {
    const rows = scanId
      ? this.db
          .prepare("SELECT payload FROM tasks WHERE scanId=? ORDER BY rowid")
          .all(scanId)
      : this.db
          .prepare("SELECT payload FROM tasks ORDER BY rowid DESC LIMIT 3000")
          .all();
    return rows.map((row) => JSON.parse(String(row.payload)));
  }
  activeTasks() {
    const latest = new Set<string>();
    const projects = new Set<string>();
    for (const scan of this.scans())
      if (
        scan.result?.audit &&
        !scan.options?.retest &&
        ["completed", "cancelled"].includes(scan.status) &&
        !projects.has(scan.projectId)
      ) {
        latest.add(scan.id);
        projects.add(scan.projectId);
      }
    return this.tasks().filter((task) => latest.has(task.scanId));
  }
  task(id: string): AuditTask | undefined {
    const row = this.db.prepare("SELECT payload FROM tasks WHERE id=?").get(id);
    return row ? JSON.parse(String(row.payload)) : undefined;
  }
  updateTask(id: string, status: TaskStatus, verifiedByScanId?: string) {
    const task = this.task(id);
    if (!task) throw new Error("Task not found");
    const updated = {
      ...task,
      status,
      updatedAt: new Date().toISOString(),
      verifiedByScanId,
    };
    this.db
      .prepare("UPDATE tasks SET payload=? WHERE id=?")
      .run(JSON.stringify(updated), id);
    return updated;
  }
  saveVisualReference(reference: VisualReference) {
    this.db
      .prepare(
        "INSERT INTO visual_references (id,projectId,payload) VALUES (?,?,?)",
      )
      .run(reference.id, reference.projectId, JSON.stringify(reference));
    return reference;
  }
  visualReferences(projectId: string): VisualReference[] {
    return this.db
      .prepare(
        "SELECT payload FROM visual_references WHERE projectId=? ORDER BY rowid DESC LIMIT 50",
      )
      .all(projectId)
      .map((row) => JSON.parse(String(row.payload)));
  }
  saveAiPlan(scanId: string, plan: AiPlan) {
    const saved = { ...plan, id: randomUUID() };
    this.db
      .prepare("INSERT INTO ai_plans (id,scanId,payload) VALUES (?,?,?)")
      .run(saved.id, scanId, JSON.stringify(saved));
    return saved;
  }
  aiPlan(scanId: string): AiPlan | undefined {
    const row = this.db
      .prepare(
        "SELECT payload FROM ai_plans WHERE scanId=? AND coalesce(json_extract(payload,'$.kind'),'legacy')!='page-analysis' ORDER BY rowid DESC LIMIT 1",
      )
      .get(scanId);
    return row ? JSON.parse(String(row.payload)) : undefined;
  }
  savePageAnalysis(job: PageAnalysis) {
    this.db
      .prepare(
        "INSERT INTO ai_plans (id,scanId,payload) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",
      )
      .run(job.id, job.scanId, JSON.stringify(job));
    return job;
  }
  pageAnalysis(id: string): PageAnalysis | undefined {
    const row = this.db
      .prepare(
        "SELECT payload FROM ai_plans WHERE id=? AND json_extract(payload,'$.kind')='page-analysis'",
      )
      .get(id);
    return row ? JSON.parse(String(row.payload)) : undefined;
  }
  pageAnalyses(scanId: string): PageAnalysis[] {
    return this.db
      .prepare(
        "SELECT payload FROM ai_plans WHERE scanId=? AND json_extract(payload,'$.kind')='page-analysis' ORDER BY rowid DESC LIMIT 50",
      )
      .all(scanId)
      .map((row) => JSON.parse(String(row.payload)));
  }
  putTask(task: AuditTask) {
    this.db
      .prepare(
        "INSERT INTO tasks (id,scanId,projectId,payload) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",
      )
      .run(task.id, task.scanId, task.projectId, JSON.stringify(task));
    return task;
  }
  searchDatasets(projectId: string): SearchDataset[] {
    return this.db
      .prepare(
        "SELECT payload FROM search_datasets WHERE projectId=? ORDER BY rowid DESC",
      )
      .all(projectId)
      .map((row) => JSON.parse(String(row.payload)));
  }
  saveSearchDataset(dataset: SearchDataset) {
    this.db
      .prepare(
        "INSERT INTO search_datasets (id,projectId,payload) VALUES (?,?,?)",
      )
      .run(dataset.id, dataset.projectId, JSON.stringify(dataset));
  }
  backup(destination: string) {
    this.db.prepare("VACUUM INTO ?").run(destination);
  }
  close() {
    this.db
      .prepare("DELETE FROM runtime_lock WHERE id=1 AND pid=?")
      .run(process.pid);
    this.db.close();
  }
}
