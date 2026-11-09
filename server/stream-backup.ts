import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  open,
  opendir,
  rm,
  type FileHandle,
} from "node:fs/promises";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  BACKUP_BYTES,
  BACKUP_IMAGES,
  BACKUP_CHUNK,
} from "../shared/backup-limits.js";
import { prepareRestoredDatabase } from "./backup.js";

export const backupMagic = Buffer.from("SITEFENN-BACKUP-2\n");
const evidencePath = /^evidence\/[a-zA-Z0-9_-]{1,160}\.png$/;
const allowed = (name: string) =>
  name === "hub.sqlite" || evidencePath.test(name);

function selectProject(snapshot: DatabaseSync, projectId: string): Set<string> {
  if (!snapshot.prepare("SELECT id FROM projects WHERE id=?").get(projectId))
    throw Error("Projekt fehlt.");
  snapshot.exec(
    "PRAGMA secure_delete=ON; PRAGMA foreign_keys=ON; BEGIN IMMEDIATE",
  );
  try {
    for (const table of [
      "tasks",
      "search_datasets",
      "visual_references",
      "baseline_changes",
      "problem_occurrences",
    ])
      snapshot
        .prepare(`DELETE FROM ${table} WHERE projectId<>?`)
        .run(projectId);
    snapshot
      .prepare(
        "DELETE FROM ai_plans WHERE scanId IN (SELECT id FROM scans WHERE projectId<>?)",
      )
      .run(projectId);
    snapshot.prepare("DELETE FROM scans WHERE projectId<>?").run(projectId);
    snapshot.prepare("DELETE FROM projects WHERE id<>?").run(projectId);
    snapshot
      .prepare(
        "DELETE FROM scan_trash WHERE json_extract(payload,'$.scan.projectId') IS NOT ?",
      )
      .run(projectId);
    snapshot
      .prepare("DELETE FROM workspace_preferences WHERE key NOT IN (?,?)")
      .run(`schedule:${projectId}`, `priority:${projectId}`);
    snapshot.exec("DELETE FROM settings; COMMIT; VACUUM");
  } catch (error) {
    if (snapshot.isTransaction) snapshot.exec("ROLLBACK");
    throw error;
  }
  const names = new Set<string>();
  const sources = [
    "SELECT result AS payload FROM scans WHERE result IS NOT NULL",
    "SELECT payload FROM scan_trash",
    "SELECT payload FROM visual_references",
  ];
  for (const sql of sources) {
    const rows = snapshot
      .prepare(
        `SELECT DISTINCT j.value AS path FROM (${sql}) s, json_tree(s.payload) j WHERE j.type='text' AND j.key IN ('path','screenshotPath') AND j.value LIKE 'evidence/%'`,
      )
      .iterate();
    for (const row of rows)
      if (evidencePath.test(String(row.path))) {
        names.add(String(row.path));
        if (names.size > BACKUP_IMAGES) throw Error("Bildlimit überschritten.");
      }
  }
  return names;
}

export async function writeStreamBackup(input: {
  dataDir: string;
  snapshotPath: string;
  archivePath: string;
  projectId?: string;
  progress: (completed: number, total: number) => void;
}) {
  const source = new DatabaseSync(join(input.dataDir, "hub.sqlite"), {
    readOnly: true,
  });
  try {
    source.exec("PRAGMA busy_timeout=5000; PRAGMA cache_size=-8192");
    source.prepare("VACUUM INTO ?").run(input.snapshotPath);
  } finally {
    source.close();
  }
  const snapshot = new DatabaseSync(input.snapshotPath);
  let names: Set<string> | undefined;
  try {
    snapshot.exec(
      "PRAGMA cache_size=-8192; PRAGMA secure_delete=ON; DROP TABLE IF EXISTS workspace_jobs; DELETE FROM maintenance_operations; DELETE FROM runtime_lock;",
    );
    if (input.projectId) names = selectProject(snapshot, input.projectId);
  } finally {
    snapshot.close();
  }
  const files = [{ name: "hub.sqlite", path: input.snapshotPath, size: 0 }];
  if (!names) {
    names = new Set();
    for await (const entry of await opendir(join(input.dataDir, "evidence"))) {
      const name = `evidence/${entry.name}`;
      if (evidencePath.test(name)) names.add(name);
      if (names.size > BACKUP_IMAGES) throw Error("Bildlimit überschritten.");
    }
  }
  if (names.size > BACKUP_IMAGES) throw Error("Bildlimit überschritten.");
  for (const name of names)
    files.push({ name, path: join(input.dataDir, name), size: 0 });
  let total = 0;
  for (const file of files) {
    const stat = await lstat(file.path);
    if (!stat.isFile() || stat.isSymbolicLink())
      throw Error("Ungültige Sicherungsdatei.");
    file.size = stat.size;
    total += file.size;
    if (total > BACKUP_BYTES) throw Error("Sicherung überschreitet 2 GiB.");
  }
  const output = await open(input.archivePath, "wx", 0o600);
  try {
    const count = Buffer.alloc(4);
    count.writeUInt32BE(files.length);
    await output.writeFile(Buffer.concat([backupMagic, count]));
    const archiveHash = createHash("sha256").update(count);
    const buffer = Buffer.allocUnsafe(BACKUP_CHUNK);
    let completed = 0;
    input.progress(0, total);
    let lastProgress = 0;
    for (const file of files) {
      const name = Buffer.from(file.name),
        header = Buffer.alloc(6);
      header.writeUInt16BE(name.length);
      header.writeUInt32BE(file.size, 2);
      await output.writeFile(Buffer.concat([header, name]));
      const hash = createHash("sha256").update(header).update(name);
      const source = await open(file.path, "r");
      try {
        for (let offset = 0; offset < file.size; ) {
          const bytes = await readExact(
            source,
            buffer.subarray(0, Math.min(buffer.length, file.size - offset)),
            offset,
          );
          hash.update(bytes);
          await output.writeFile(bytes);
          offset += bytes.length;
          completed += bytes.length;
          if (completed - lastProgress >= 4 * 1024 * 1024) {
            input.progress(completed, total);
            lastProgress = completed;
          }
        }
        if ((await source.stat()).size !== file.size)
          throw Error("Datei während der Sicherung verändert.");
      } finally {
        await source.close();
      }
      const digest = hash.digest();
      archiveHash.update(digest);
      await output.writeFile(digest);
    }
    await output.writeFile(archiveHash.digest());
    await output.sync();
    input.progress(total, total);
  } finally {
    await output.close();
  }
}

async function readExact(file: FileHandle, target: Buffer, position: number) {
  let offset = 0;
  while (offset < target.length) {
    const { bytesRead } = await file.read(
      target,
      offset,
      target.length - offset,
      position + offset,
    );
    if (!bytesRead) throw Error("Sicherung ist unvollständig.");
    offset += bytesRead;
  }
  return target;
}

export async function restoreStreamBackup(
  archive: string,
  destination: string,
) {
  const file = await open(archive, "r");
  let created = false;
  let position = 0;
  const take = async (length: number) => {
    const result = await readExact(file, Buffer.allocUnsafe(length), position);
    position += length;
    return result;
  };
  try {
    if (!(await take(backupMagic.length)).equals(backupMagic))
      throw Error("Unbekanntes Sicherungsformat.");
    const countBytes = await take(4),
      count = countBytes.readUInt32BE();
    const archiveHash = createHash("sha256").update(countBytes);
    if (count < 1 || count > BACKUP_IMAGES + 1)
      throw Error("Ungültige Dateianzahl.");
    await mkdir(destination, { mode: 0o700 });
    created = true;
    await mkdir(join(destination, "evidence"), { mode: 0o700 });
    const seen = new Set<string>();
    const buffer = Buffer.allocUnsafe(BACKUP_CHUNK);
    let total = 0;
    for (let index = 0; index < count; index++) {
      const header = await take(6),
        length = header.readUInt16BE(),
        size = header.readUInt32BE(2);
      total += size;
      if (!length || length > 200 || total > BACKUP_BYTES)
        throw Error("Sicherungsgrenze überschritten.");
      const nameBytes = await take(length),
        name = nameBytes.toString("utf8");
      if (!allowed(name) || seen.has(name))
        throw Error("Ungültiger oder doppelter Dateipfad.");
      seen.add(name);
      const output = await open(join(destination, name), "wx", 0o600);
      const hash = createHash("sha256").update(header).update(nameBytes);
      try {
        for (let remaining = size; remaining > 0; ) {
          const bytes = await readExact(
            file,
            buffer.subarray(0, Math.min(remaining, buffer.length)),
            position,
          );
          position += bytes.length;
          hash.update(bytes);
          await output.writeFile(bytes);
          remaining -= bytes.length;
        }
      } finally {
        await output.close();
      }
      const digest = hash.digest();
      if (!(await take(32)).equals(digest))
        throw Error("Backup-Integritätsprüfung fehlgeschlagen.");
      archiveHash.update(digest);
    }
    if (!(await take(32)).equals(archiveHash.digest()))
      throw Error("Backup-Integritätsprüfung fehlgeschlagen.");
    if (!seen.has("hub.sqlite") || (await file.stat()).size !== position)
      throw Error("Ungültiger Sicherungsumfang.");
    prepareRestoredDatabase(destination);
  } catch (error) {
    if (created) await rm(destination, { recursive: true, force: true });
    throw error;
  } finally {
    await file.close();
  }
}
