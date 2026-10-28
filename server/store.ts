import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Project, Scan, ScanResult, Environment } from '../shared/types.js';

export class Store {
  readonly db: DatabaseSync;
  constructor(readonly dataDir: string) {
    mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    mkdirSync(join(dataDir, 'evidence'), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(join(dataDir, 'hub.sqlite'));
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    const schema = Number(this.db.prepare('PRAGMA user_version').get()?.user_version || 0);
    if (schema > 1) { this.db.close(); throw new Error('Database is newer than this app. Refusing to modify it.'); }
    this.db.exec('CREATE TABLE IF NOT EXISTS runtime_lock (id INTEGER PRIMARY KEY CHECK(id=1), pid INTEGER NOT NULL)');
    // Serialize stale-owner recovery: a competing startup cannot delete a newly acquired lock.
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const owner = this.db.prepare('SELECT pid FROM runtime_lock WHERE id=1').get();
      if (owner) {
        let alive = true;
        try { process.kill(Number(owner.pid), 0); }
        catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') alive = false; }
        if (alive) throw new Error('This data directory is already in use by a running Hub.');
      }
      this.db.prepare('INSERT OR REPLACE INTO runtime_lock (id,pid) VALUES (1,?)').run(process.pid);
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); this.db.close(); throw error; }
    this.db.exec(`CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL, environment TEXT NOT NULL,
      createdAt TEXT NOT NULL, demo INTEGER NOT NULL DEFAULT 0
    ); CREATE TABLE IF NOT EXISTS scans (
      id TEXT PRIMARY KEY, projectId TEXT NOT NULL REFERENCES projects(id), status TEXT NOT NULL,
      createdAt TEXT NOT NULL, finishedAt TEXT, error TEXT, result TEXT
    ); PRAGMA user_version=1;`);
    this.db.prepare("UPDATE scans SET status='interrupted', finishedAt=?, error=? WHERE status IN ('queued','running')")
      .run(new Date().toISOString(), 'Die App wurde während der Prüfung beendet. Bitte starte eine neue Prüfung.');
  }
  projects(): Project[] {
    return this.db.prepare('SELECT id,name,url,environment,createdAt FROM projects ORDER BY createdAt DESC,rowid DESC').all() as unknown as Project[];
  }
  project(id: string): Project | undefined { return this.projects().find(p => p.id === id); }
  isDemo(id: string) { return this.db.prepare('SELECT demo FROM projects WHERE id=?').get(id)?.demo === 1; }
  createProject(name: string, url: string, environment: Environment, demo = false): Project {
    const project: Project = { id: randomUUID(), name, url, environment, createdAt: new Date().toISOString() };
    this.db.prepare('INSERT INTO projects (id,name,url,environment,createdAt,demo) VALUES (?,?,?,?,?,?)')
      .run(project.id, name, url, environment, project.createdAt, demo ? 1 : 0);
    return project;
  }
  scans(): Scan[] {
    return this.db.prepare('SELECT * FROM scans ORDER BY createdAt DESC,rowid DESC').all().map(row => ({
      ...row, result: row.result ? JSON.parse(String(row.result)) : null,
    })) as Scan[];
  }
  scan(id: string) { return this.scans().find(s => s.id === id); }
  createScan(projectId: string): Scan {
    const scan: Scan = { id: randomUUID(), projectId, status: 'queued', createdAt: new Date().toISOString(), finishedAt: null, error: null, result: null };
    this.db.prepare('INSERT INTO scans (id,projectId,status,createdAt) VALUES (?,?,?,?)').run(scan.id, projectId, scan.status, scan.createdAt);
    return scan;
  }
  running(id: string) { this.db.prepare("UPDATE scans SET status='running' WHERE id=?").run(id); }
  finish(id: string, result: ScanResult) {
    this.db.prepare("UPDATE scans SET status='completed',result=?,finishedAt=? WHERE id=?")
      .run(JSON.stringify(result), new Date().toISOString(), id);
  }
  fail(id: string, error: string) {
    this.db.prepare("UPDATE scans SET status='failed',error=?,finishedAt=? WHERE id=?").run(error.slice(0, 1200), new Date().toISOString(), id);
  }
  close() { this.db.prepare('DELETE FROM runtime_lock WHERE id=1 AND pid=?').run(process.pid); this.db.close(); }
}
