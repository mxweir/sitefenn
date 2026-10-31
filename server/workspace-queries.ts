import type { Store } from "./store.js";
import type { AuditTask, ScanResult } from "../shared/types.js";
import type {
  CursorPage,
  ProjectStats,
  ScanSummary,
} from "../shared/workspace.js";
import { calculateScore } from "./services/scoring.js";
export function summaryPayload(result: ScanResult | null) {
  if (!result) return null;
  const audit = result.audit;
  let score;
  try {
    if (audit) score = calculateScore(audit);
  } catch {
    /* Malformed historical report stays readable. */
  }
  return JSON.stringify({
    result: {
      title: result.title,
      url: result.url,
      statusCode: result.statusCode,
      viewport: result.viewport,
      screenshotPath: "",
      checks: [],
      durationMs: result.durationMs,
    },
    ...(audit
      ? {
          counts: {
            completed: audit.coverage.completed,
            planned: audit.coverage.planned,
            findings: audit.findings.length,
          },
        }
      : {}),
    ...(score
      ? { score: { ...score, warnings: score.warnings.slice(0, 20) } }
      : {}),
  });
}
const columns =
  "s.id,s.projectId,s.status,s.createdAt,s.finishedAt,s.error,s.options,s.progress,s.summary";
function decode(row: Record<string, unknown>): ScanSummary {
  const { summary, options, progress, ...plain } = row;
  return {
    ...plain,
    result: null,
    ...(summary ? JSON.parse(String(summary)) : {}),
    ...(options ? { options: JSON.parse(String(options)) } : {}),
    ...(progress ? { progress: JSON.parse(String(progress)) } : {}),
  } as ScanSummary;
}
export function scanHeads(store: Store): ScanSummary[] {
  return store.db
    .prepare(
      `SELECT ${columns} FROM scans s WHERE s.rowid IN (SELECT max(rowid) FROM scans GROUP BY projectId) OR s.rowid IN (SELECT max(rowid) FROM scans WHERE options IS NULL OR json_extract(options,'$.retest') IS NULL GROUP BY projectId) OR s.status IN ('queued','running','paused') ORDER BY s.rowid DESC`,
    )
    .all()
    .map(decode);
}
export function projectStats(store: Store): Record<string, ProjectStats> {
  return Object.fromEntries(
    store.db
      .prepare(
        `SELECT p.id, (SELECT count(*) FROM scans s WHERE s.projectId=p.id) scans, (SELECT count(*) FROM tasks t WHERE t.projectId=p.id) tasks, (SELECT count(*) FROM tasks t WHERE t.projectId=p.id AND json_extract(t.payload,'$.status')='verified' AND json_extract(t.payload,'$.verifiedByScanId') IS NOT NULL) verified FROM projects p`,
      )
      .all()
      .map((r) => [
        String(r.id),
        {
          scans: Number(r.scans),
          tasks: Number(r.tasks),
          verified: Number(r.verified),
        },
      ]),
  );
}
export interface PageQuery {
  cursor?: string;
  limit?: number;
  q?: string;
  status?: string;
  scanId?: string;
}
function queryParts(projectId: string, query: PageQuery, kind: string) {
  const limit = query.limit ?? 50,
    q = (query.q ?? "").trim(),
    status = query.status ?? "all",
    scanId = query.scanId ?? "";
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || q.length > 120)
    throw Error("Ungültige Seitengröße oder Suche.");
  let after: number | undefined;
  if (query.cursor) {
    if (query.cursor.length > 2000) throw Error("Ungültiger Verlaufscursor.");
    let value;
    try {
      value = JSON.parse(
        Buffer.from(query.cursor, "base64url").toString("utf8"),
      );
    } catch {
      throw Error("Ungültiger Verlaufscursor.");
    }
    if (
      !value ||
      value.kind !== kind ||
      value.projectId !== projectId ||
      value.q !== q ||
      value.status !== status ||
      value.scanId !== scanId ||
      !Number.isSafeInteger(value.after) ||
      value.after < 1
    )
      throw Error("Cursor passt nicht zu Projekt oder Filtern.");
    after = value.after;
  }
  const cursor = (rowid: number) =>
    Buffer.from(
      JSON.stringify({ kind, projectId, q, status, scanId, after: rowid }),
    ).toString("base64url");
  return { limit, q, status, scanId, after, cursor };
}
export function scanPage(
  store: Store,
  projectId: string,
  query: PageQuery = {},
): CursorPage<ScanSummary> {
  const p = queryParts(projectId, query, "scans");
  if (
    ![
      "all",
      "queued",
      "running",
      "paused",
      "completed",
      "failed",
      "interrupted",
      "cancelled",
    ].includes(p.status)
  )
    throw Error("Unbekannter Prüfstatus.");
  const where = ["s.projectId=?"],
    args: (string | number)[] = [projectId];
  if (p.status !== "all") {
    where.push("s.status=?");
    args.push(p.status);
  }
  if (p.q) {
    where.push(
      "(instr(lower(coalesce(json_extract(s.summary,'$.result.title'),'')),lower(?))>0 OR instr(lower(s.id),lower(?))>0 OR instr(lower(coalesce(json_extract(s.summary,'$.result.url'),'')),lower(?))>0)",
    );
    args.push(p.q, p.q, p.q);
  }
  const total = Number(
    store.db
      .prepare(`SELECT count(*) n FROM scans s WHERE ${where.join(" AND ")}`)
      .get(...args)!.n,
  );
  if (p.after) {
    where.push("s.rowid<?");
    args.push(p.after);
  }
  const rows = store.db
    .prepare(
      `SELECT s.rowid cursorRow,${columns} FROM scans s WHERE ${where.join(" AND ")} ORDER BY s.rowid DESC LIMIT ?`,
    )
    .all(...args, p.limit + 1);
  const items = rows
    .slice(0, p.limit)
    .map(({ cursorRow, ...row }) => decode(row));
  return {
    items,
    total,
    nextCursor:
      rows.length > p.limit
        ? p.cursor(Number(rows[p.limit - 1]!.cursorRow))
        : null,
  };
}
export function taskPage(
  store: Store,
  projectId: string,
  query: PageQuery = {},
): CursorPage<AuditTask> {
  const p = queryParts(projectId, query, "tasks");
  if (
    !["all", "open", "in-progress", "review", "verified", "accepted"].includes(
      p.status,
    )
  )
    throw Error("Unbekannter Aufgabenstatus.");
  const where = ["projectId=?"],
    args: (string | number)[] = [projectId];
  if (p.scanId) {
    where.push("scanId=?");
    args.push(p.scanId);
  }
  if (p.status !== "all") {
    where.push("json_extract(payload,'$.status')=?");
    args.push(p.status);
  }
  if (p.q) {
    where.push(
      "(instr(lower(json_extract(payload,'$.title')),lower(?))>0 OR instr(lower(id),lower(?))>0)",
    );
    args.push(p.q, p.q);
  }
  const total = Number(
    store.db
      .prepare(`SELECT count(*) n FROM tasks WHERE ${where.join(" AND ")}`)
      .get(...args)!.n,
  );
  if (p.after) {
    where.push("rowid<?");
    args.push(p.after);
  }
  const rows = store.db
    .prepare(
      `SELECT rowid cursorRow,payload FROM tasks WHERE ${where.join(" AND ")} ORDER BY rowid DESC LIMIT ?`,
    )
    .all(...args, p.limit + 1);
  return {
    items: rows.slice(0, p.limit).map((r) => JSON.parse(String(r.payload))),
    total,
    nextCursor:
      rows.length > p.limit
        ? p.cursor(Number(rows[p.limit - 1]!.cursorRow))
        : null,
  };
}
