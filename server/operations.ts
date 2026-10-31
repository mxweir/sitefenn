import {
  lstatSync,
  unlinkSync,
  readFileSync,
  renameSync,
  openSync,
  fsyncSync,
  closeSync,
} from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import type { Store } from "./store.js";

export type MaintenanceOperation =
  | { kind: "purge"; files: string[] }
  | { kind: "backup"; temporary: string; final: string; sha256?: string };
export type OperationCheckpoint = (step: string) => void;
export function journal(store: Store, id: string, value: MaintenanceOperation) {
  store.db
    .prepare(
      "INSERT OR REPLACE INTO maintenance_operations(id,payload) VALUES (?,?)",
    )
    .run(id, JSON.stringify(value));
}
function regular(path: string) {
  try {
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink())
      throw Error("Ungültige Wartungsdatei.");
    return true;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw e;
  }
}
export function syncFile(path: string) {
  let fd: number | undefined;
  try {
    fd = openSync(path, "r");
    fsyncSync(fd);
  } catch (error) {
    // Windows does not expose POSIX directory fsync; ordinary file flushes still apply.
    if (
      !(
        process.platform === "win32" &&
        lstatSync(path).isDirectory() &&
        ["EPERM", "EISDIR", "EINVAL", "EACCES"].includes(
          (error as NodeJS.ErrnoException).code ?? "",
        )
      )
    )
      throw error;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}
// Roll forward only: purge records are atomically removed with their durable intent.
// A failed cleanup remains journaled and is retried before the next startup serves data.
export function recoverOperations(
  store: Store,
  checkpoint: OperationCheckpoint = () => {},
) {
  let deletedFiles = 0;
  for (const row of store.db
    .prepare("SELECT id,payload FROM maintenance_operations ORDER BY rowid")
    .all()) {
    const op = JSON.parse(String(row.payload)) as MaintenanceOperation;
    if (op.kind === "purge") {
      for (const name of op.files) {
        if (!/^[a-zA-Z0-9_-]+\.png$/.test(name))
          throw Error("Ungültiger Löschauftrag.");
        const path = join(store.dataDir, "evidence", name);
        if (regular(path)) {
          unlinkSync(path);
          deletedFiles++;
        }
        checkpoint("purge:file");
      }
      syncFile(join(store.dataDir, "evidence"));
    } else if (op.kind === "backup") {
      if (
        !/^before-update-[a-zA-Z0-9.-]+\.zip$/.test(op.final) ||
        op.temporary !== `${op.final}.partial`
      )
        throw Error("Ungültiger Sicherungsauftrag.");
      const temp = join(store.dataDir, "backups", op.temporary),
        target = join(store.dataDir, "backups", op.final);
      if (regular(temp)) {
        if (
          op.sha256 &&
          createHash("sha256").update(readFileSync(temp)).digest("hex") ===
            op.sha256
        ) {
          if (regular(target)) throw Error("Sicherung existiert bereits.");
          renameSync(temp, target);
        } else unlinkSync(temp); // Interrupted before verification: never publish.
      } else if (
        op.sha256 &&
        (!regular(target) ||
          createHash("sha256").update(readFileSync(target)).digest("hex") !==
            op.sha256)
      )
        throw Error("Verifizierte Sicherung fehlt oder wurde verändert.");
      syncFile(join(store.dataDir, "backups"));
      checkpoint("backup:published");
    } else throw Error("Unbekannter Wartungsauftrag.");
    checkpoint("operation:complete");
    store.db
      .prepare("DELETE FROM maintenance_operations WHERE id=?")
      .run(row.id!);
  }
  return deletedFiles;
}
