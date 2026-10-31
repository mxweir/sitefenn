import {
  readdir,
  lstat,
  readFile,
  writeFile,
  mkdtemp,
  rm,
} from "node:fs/promises";
import { join } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import type { Store } from "../store.js";
import type { Scan } from "../../shared/types.js";
import { createBackup } from "../backup.js";
import { tmpdir } from "node:os";
import {
  recoverOperations,
  journal,
  syncFile,
  type OperationCheckpoint,
} from "../operations.js";
import { restoreBackup } from "../backup.js";
import { APP_VERSION } from "../../shared/version.js";
export async function storageSummary(store: Store) {
  let evidenceBytes = 0,
    files = 0;
  for (const name of await readdir(join(store.dataDir, "evidence"))) {
    if (!/^[a-zA-Z0-9_-]+\.png$/.test(name)) continue;
    const s = await lstat(join(store.dataDir, "evidence", name));
    if (s.isFile() && !s.isSymbolicLink()) {
      evidenceBytes += s.size;
      files++;
    }
  }
  const db = await lstat(join(store.dataDir, "hub.sqlite"));
  return {
    pendingOperations: store.pendingOperations(),
    evidenceBytes,
    evidenceFiles: files,
    databaseBytes: db.size,
    scans: store.scans(-1).length,
    trash: store.trashSummaries(),
    retention: store.preference("retention") ?? { keepPerProject: 10 },
    notice:
      "Papierkorb ist wiederherstellbar und belegt weiterhin Speicher. Backups, WAL und andere Dateien sind in diesen Teilgrößen nicht enthalten.",
  };
}
export function protectedScans(store: Store) {
  const protectedIds = store.referencedScanIds();
  const scans = store.scans(-1);
  for (const p of store.projects()) {
    const latest = scans.find(
      (s) =>
        s.projectId === p.id && s.status === "completed" && !s.options?.retest,
    );
    if (latest) protectedIds.add(latest.id);
  }
  for (const scan of scans)
    if (["running", "paused", "queued"].includes(scan.status))
      protectedIds.add(scan.id);
  return protectedIds;
}
export function retentionPreview(store: Store, keepPerProject: number) {
  if (
    !Number.isInteger(keepPerProject) ||
    keepPerProject < 1 ||
    keepPerProject > 100
  )
    throw Error("Aufbewahrung: 1–100 Checks pro Projekt.");
  const protectedIds = protectedScans(store),
    candidates: Scan[] = [];
  for (const p of store.projects()) {
    const scans = store.scans(-1).filter((s) => s.projectId === p.id);
    candidates.push(
      ...scans.slice(keepPerProject).filter((s) => !protectedIds.has(s.id)),
    );
  }
  return {
    keepPerProject,
    protectedCount: protectedIds.size,
    candidates: candidates.slice(0, 20).map((s) => ({
      id: s.id,
      projectId: s.projectId,
      createdAt: s.createdAt,
      status: s.status,
    })),
    limited: candidates.length > 20,
    notice:
      "Nur Vorschlag, keine automatische Löschung. Aktive Checks, neuester vollständiger Check, Referenzen, verifizierende Nachtests und gespeicherte Vergleichs-/Zeitplanquellen bleiben geschützt.",
  };
}
function evidencePaths(scan: Scan): string[] {
  return [
    ...(scan.result?.audit?.evidence.map((e) => e.path) ?? []),
    ...(scan.result?.screenshotPath ? [scan.result.screenshotPath] : []),
  ];
}
export async function purgeTrash(
  store: Store,
  ids: string[],
  checkpoint: OperationCheckpoint = () => {},
) {
  recoverOperations(store);
  if (!ids.length || new Set(ids).size !== ids.length)
    throw Error("Ungültige Papierkorbauswahl.");
  const protectedIds = protectedScans(store);
  if (ids.some((id) => protectedIds.has(id)))
    throw Error("Referenzierte Checks bleiben geschützt.");
  const activePaths = new Set(store.scans(-1).flatMap(evidencePaths));
  for (const t of store.trashSummaries().filter((t) => !ids.includes(t.id)))
    for (const path of evidencePaths(store.trashedScan(t.id)!.scan))
      activePaths.add(path);
  const files = new Set<string>();
  for (const id of ids) {
    const record = store.trashedScan(id);
    if (!record) throw Error("Papierkorbeintrag fehlt.");
    for (const path of evidencePaths(record.scan)) {
      if (activePaths.has(path)) continue;
      const match = /^evidence\/([a-zA-Z0-9_-]+\.png)$/.exec(path);
      if (match) {
        try {
          const stat = await lstat(join(store.dataDir, "evidence", match[1]!));
          if (!stat.isFile() || stat.isSymbolicLink())
            throw Error("Ungültige Nachweisdatei.");
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
        }
        files.add(match[1]!);
      }
    }
  }
  checkpoint("purge:prepared");
  store.db.exec("BEGIN IMMEDIATE");
  try {
    journal(store, randomUUID(), { kind: "purge", files: [...files] });
    for (const id of ids) store.removeTrash(id);
    checkpoint("purge:transaction");
    store.db.exec("COMMIT");
  } catch (e) {
    store.db.exec("ROLLBACK");
    throw e;
  }
  checkpoint("purge:committed");
  const deletedFiles = recoverOperations(store, checkpoint);
  return {
    deletedRecords: ids.length,
    deletedFiles,
    notice:
      "Endgültig entfernt. Bereits vorhandene externe Backups werden nicht gelöscht.",
  };
}
export async function beforeUpdateBackup(
  store: Store,
  checkpoint: OperationCheckpoint = () => {},
) {
  recoverOperations(store);
  const name = `before-update-${APP_VERSION}-${randomUUID()}.zip`,
    id = randomUUID();
  const op = {
    kind: "backup" as const,
    temporary: `${name}.partial`,
    final: name,
  };
  journal(store, id, op);
  checkpoint("backup:journaled");
  const bytes = await createBackup(store);
  const path = join(store.dataDir, "backups", op.temporary);
  await writeFile(path, bytes, { flag: "wx", mode: 0o600 });
  syncFile(path);
  syncFile(join(store.dataDir, "backups"));
  checkpoint("backup:written");
  // Validate the actual archive, manifest checksums and SQLite integrity before publication.
  const written = await readFile(path);
  if (!Buffer.from(bytes).equals(written))
    throw Error("Sicherungsdatei wurde während der Prüfung verändert.");
  const validationRoot = await mkdtemp(join(tmpdir(), "sitefenn-verify-"));
  try {
    await restoreBackup(written, join(validationRoot, "restored"));
  } finally {
    await rm(validationRoot, { recursive: true, force: true });
  }
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  journal(store, id, { ...op, sha256 });
  checkpoint("backup:verified");
  recoverOperations(store, checkpoint);
  return {
    name,
    bytes: bytes.byteLength,
    sha256,
    notice:
      "Vorsicherung geprüft und atomar veröffentlicht. Update manuell in einem neuen Programmordner; bestehender Datenpfad bleibt gleich.",
  };
}
export async function checkUpdate(request: typeof fetch = fetch) {
  const r = await request(
    "https://api.github.com/repos/mxweir/sitefenn/releases/latest",
    {
      headers: { Accept: "application/vnd.github+json" },
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!r.ok)
    throw Error(`GitHub-Updateprüfung fehlgeschlagen (HTTP ${r.status}).`);
  const text = await r.text();
  if (text.length > 1000000) throw Error("Updateantwort zu groß.");
  const data = JSON.parse(text);
  if (
    typeof data.tag_name !== "string" ||
    !/^v\d+\.\d+\.\d+$/.test(data.tag_name) ||
    data.draft ||
    data.prerelease
  )
    throw Error("Keine überprüfbaren stabilen Release-Metadaten.");
  const version = data.tag_name.slice(1);
  const numbers = (v: string) => v.split(".").map(Number);
  const a = numbers(version),
    b = numbers(APP_VERSION);
  const newer = a.some(
    (n, i) =>
      n !== b[i] && a.slice(0, i).every((v, j) => v === b[j]) && n > b[i]!,
  );
  return {
    current: APP_VERSION,
    latest: version,
    available: newer,
    url: `https://github.com/mxweir/sitefenn/releases/tag/${data.tag_name}`,
    checkedAt: new Date().toISOString(),
    notice:
      "Metadaten von GitHub, keine unabhängige Signaturprüfung. Kein automatischer Download oder Code-Austausch.",
  };
}
