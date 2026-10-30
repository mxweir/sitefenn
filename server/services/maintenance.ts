import { readdir, lstat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import type { Store } from "../store.js";
import type { Scan } from "../../shared/types.js";
import { createBackup } from "../backup.js";
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
  const protectedIds = new Set<string>();
  const scans = store.scans(-1);
  for (const p of store.projects()) {
    const latest = scans.find(
      (s) =>
        s.projectId === p.id && s.status === "completed" && !s.options?.retest,
    );
    if (latest) protectedIds.add(latest.id);
    for (const ref of store.visualReferences(p.id))
      protectedIds.add(ref.scanId);
    const schedule = store.preference(`schedule:${p.id}`) as
      | { sourceScanId?: string }
      | undefined;
    if (schedule?.sourceScanId) protectedIds.add(schedule.sourceScanId);
  }
  for (const task of store.tasks()) {
    if (task.verifiedByScanId) protectedIds.add(task.verifiedByScanId);
  }
  for (const scan of scans) {
    if (scan.options?.retest)
      protectedIds.add(scan.options.retest.sourceScanId);
    if (["running", "paused", "queued"].includes(scan.status))
      protectedIds.add(scan.id);
    for (const analysis of store.pageAnalyses(scan.id)) {
      if (analysis.context?.comparison)
        protectedIds.add(analysis.context.comparison.scanId);
    }
  }
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
    candidates: candidates
      .slice(0, 20)
      .map((s) => ({
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
export async function purgeTrash(store: Store, ids: string[]) {
  const activePaths = new Set(
    store
      .scans(-1)
      .flatMap((s) => s.result?.audit?.evidence.map((e) => e.path) ?? []),
  );
  const otherTrash = store
    .trashSummaries()
    .filter((t) => !ids.includes(t.id))
    .flatMap(
      (t) =>
        store
          .trashedScan(t.id)
          ?.scan.result?.audit?.evidence.map((e) => e.path) ?? [],
    );
  for (const p of otherTrash) activePaths.add(p);
  const records = ids.map((id) => {
    const value = store.trashedScan(id);
    if (!value) throw Error("Papierkorbeintrag fehlt.");
    return value;
  });
  let deletedFiles = 0;
  for (const record of records)
    for (const e of record.scan.result?.audit?.evidence ?? []) {
      if (activePaths.has(e.path)) continue;
      const match = /^evidence\/([a-zA-Z0-9_-]+\.png)$/.exec(
        e.path.replace(/\\/g, "/"),
      );
      if (!match) continue;
      try {
        const path = join(store.dataDir, "evidence", match[1]!);
        const s = await lstat(path);
        if (!s.isFile() || s.isSymbolicLink())
          throw Error("Ungültige Nachweisdatei.");
        await unlink(path);
        deletedFiles++;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
  for (const id of ids) store.removeTrash(id);
  return {
    deletedRecords: ids.length,
    deletedFiles,
    notice:
      "Endgültig entfernt. Bereits vorhandene externe Backups werden nicht gelöscht.",
  };
}
export async function beforeUpdateBackup(store: Store) {
  const bytes = await createBackup(store);
  const name = `before-update-${APP_VERSION}-${randomUUID()}.zip`;
  await writeFile(join(store.dataDir, "backups", name), bytes, {
    flag: "wx",
    mode: 0o600,
  });
  return {
    name,
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    notice:
      "Vorsicherung erstellt. Update erfolgt manuell in einem neuen Programmordner, bestehender Datenpfad bleibt gleich. Keine automatische Programmausführung.",
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
