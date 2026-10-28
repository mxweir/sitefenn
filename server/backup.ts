import {
  readFile,
  readdir,
  mkdtemp,
  rm,
  mkdir,
  writeFile,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import type { Store } from "./store.js";

const MAX_BYTES = 250 * 1024 * 1024;
const hash = (data: Uint8Array) =>
  createHash("sha256").update(data).digest("hex");
const safePath = (name: string) =>
  name === "hub.sqlite" || /^evidence\/[a-zA-Z0-9_-]+\.png$/.test(name);
export async function createBackup(store: Store): Promise<Uint8Array> {
  const folder = await mkdtemp(join(tmpdir(), "sitefenn-backup-"));
  const dbPath = join(folder, "hub.sqlite");
  const files: Record<string, Uint8Array> = {};
  let size = 0;
  try {
    store.backup(dbPath);
    files["hub.sqlite"] = await readFile(dbPath);
    size += files["hub.sqlite"].byteLength;
    if (size > MAX_BYTES)
      throw new Error("Die Datenbank überschreitet das portable Backup-Limit.");
    const names = await readdir(join(store.dataDir, "evidence"));
    if (names.length > 2000)
      throw new Error(
        "Zu viele Evidenzdateien für das portable Backup. Nutze eine Dateisicherung bei gestoppter App.",
      );
    for (const name of names) {
      if (!safePath(`evidence/${name}`)) continue;
      const bytes = await readFile(join(store.dataDir, "evidence", name));
      size += bytes.byteLength;
      if (size > MAX_BYTES)
        throw new Error(
          "Das portable Backup überschreitet 250 MiB. Nutze eine Dateisicherung bei gestoppter App.",
        );
      files[`evidence/${name}`] = bytes;
    }
    const manifest = {
      kind: "sitefenn-backup",
      schema: 1,
      createdAt: new Date().toISOString(),
      files: Object.fromEntries(
        Object.entries(files).map(([name, bytes]) => [
          name,
          { size: bytes.byteLength, sha256: hash(bytes) },
        ]),
      ),
    };
    files["backup-manifest.json"] = strToU8(JSON.stringify(manifest, null, 2));
    return zipSync(files, { level: 1 });
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}

/** Restores only into a NEW directory, never over a running or existing workspace. */
export async function restoreBackup(
  archive: Uint8Array,
  destination: string,
): Promise<void> {
  if (existsSync(destination))
    throw new Error(
      "Das Wiederherstellungsziel muss ein neues, noch nicht vorhandenes Verzeichnis sein.",
    );
  if (archive.byteLength > MAX_BYTES) throw new Error("Backup ist zu groß.");
  let total = 0,
    entries = 0;
  const files = unzipSync(archive, {
    filter(file) {
      if (
        ++entries > 2002 ||
        (!safePath(file.name) && file.name !== "backup-manifest.json")
      )
        throw new Error("Ungültiger Backup-Dateipfad.");
      total += file.originalSize;
      if (total > MAX_BYTES)
        throw new Error("Entpacktes Backup überschreitet das Speicherlimit.");
      return true;
    },
  });
  if (!files["hub.sqlite"] || !files["backup-manifest.json"])
    throw new Error("Backup ist unvollständig.");
  const manifest = JSON.parse(strFromU8(files["backup-manifest.json"])) as {
    kind: string;
    schema: number;
    files: Record<string, { size: number; sha256: string }>;
  };
  if (
    manifest.kind !== "sitefenn-backup" ||
    manifest.schema !== 1 ||
    !manifest.files ||
    typeof manifest.files !== "object"
  )
    throw new Error("Unbekanntes Backup-Format.");
  const names = Object.keys(files).filter(
    (name) => name !== "backup-manifest.json",
  );
  if (names.length !== Object.keys(manifest.files).length)
    throw new Error("Backup-Manifest und Dateien passen nicht zusammen.");
  for (const name of names)
    if (
      !manifest.files[name] ||
      manifest.files[name].size !== files[name].byteLength ||
      manifest.files[name].sha256 !== hash(files[name])
    )
      throw new Error("Backup-Integritätsprüfung fehlgeschlagen.");
  await mkdir(destination, { mode: 0o700 });
  try {
    await mkdir(join(destination, "evidence"), { mode: 0o700 });
    for (const name of names)
      await writeFile(join(destination, name), files[name], {
        flag: "wx",
        mode: 0o600,
      });
    const db = new DatabaseSync(join(destination, "hub.sqlite"));
    try {
      if (db.prepare("PRAGMA integrity_check").get()?.integrity_check !== "ok")
        throw new Error("Die wiederhergestellte Datenbank ist beschädigt.");
      const version = Number(
        db.prepare("PRAGMA user_version").get()?.user_version,
      );
      if (!Number.isInteger(version) || version < 1 || version > 2)
        throw new Error("Nicht unterstützte Datenbankversion.");
      if (
        db
          .prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='runtime_lock'",
          )
          .get()
      )
        db.exec("DELETE FROM runtime_lock");
    } finally {
      db.close();
    }
  } catch (error) {
    await rm(destination, { recursive: true, force: true });
    throw error;
  }
}
