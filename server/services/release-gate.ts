import { validateReport } from "../../shared/report-contract.js";
import type { Scan, Category, Priority } from "../../shared/types.js";
import { compareScans } from "./comparison.js";
export interface GatePolicy {
  minimumPriority: "critical" | "important";
  categories: Category[];
}
export const DEFAULT_GATE: GatePolicy = {
  minimumPriority: "critical",
  categories: ["layout", "accessibility", "seo", "runtime"],
};
export function gateCoverage(after: Scan, policy = DEFAULT_GATE) {
  const unknown: string[] = [];
  const report = after.result?.audit;
  if (after.status !== "completed" || !report)
    unknown.push("Aktueller Check nicht vollständig abgeschlossen.");
  if (report) {
    const contract = validateReport(report);
    unknown.push(...contract.issues.map((i) => `${i.code}: ${i.detail}`));
    if (
      report.pages.some(
        (p) =>
          p.state === "initial" &&
          (p.statusCode === null || p.statusCode < 200 || p.statusCode >= 300),
      )
    )
      unknown.push(
        "Dokumentantwort fehlt oder ist kein erfolgreicher HTTP-Status; keine belastbare Layout-Freigabe.",
      );
    if (after.options?.pages.some((url) => !report.options.pages.includes(url)))
      unknown.push(
        "Mindestens eine ausgewählte URL fehlt im gemessenen Umfang.",
      );
    if (
      report.options.retest ||
      report.coverage.completed !== report.coverage.planned ||
      report.pages.some((p) => p.status !== "completed")
    )
      unknown.push("Unvollständige Seiten-/Geräteabdeckung oder Teillauf.");
    if (
      report.rules.some(
        (r) => policy.categories.includes(r.category) && r.status === "not_run",
      )
    )
      unknown.push(
        "Mindestens eine erforderliche Regel wurde nicht ausgeführt.",
      );
    if (
      report.journeyRuns?.some((r) =>
        r.steps.some((s) => s.status !== "completed"),
      )
    )
      unknown.push("Freigegebener Seitenzustand nicht bestätigt.");
  }
  return unknown;
}

export function releaseGate(after: Scan, before?: Scan, policy = DEFAULT_GATE) {
  const unknown = gateCoverage(after, policy);
  const report = after.result?.audit;
  if (!before) unknown.push("Keine kompatible Baseline ausgewählt.");
  let comparison: ReturnType<typeof compareScans> | undefined;
  if (before && report) {
    if (gateCoverage(before, policy).length)
      unknown.push("Baseline enthält fehlende erforderliche Messungen.");
    try {
      comparison = compareScans(before, after);
      if (!comparison.comparable)
        unknown.push(
          "Baseline und aktueller Check haben keine identische vollständige Messidentität.",
        );
    } catch {
      unknown.push("Baseline nicht vergleichbar.");
    }
  }
  const ranks: Record<Priority, number> = {
    critical: 0,
    important: 1,
    "nice-to-have": 2,
  };
  const eligible =
    report?.findings.filter(
      (f) =>
        f.evidenceStatus === "measured" &&
        policy.categories.includes(f.category) &&
        ranks[f.priority] <= ranks[policy.minimumPriority],
    ) ?? [];
  const eligibleIds = new Set(eligible.map((finding) => finding.id));
  if (
    comparison?.comparable &&
    comparison.entries.some(
      (entry) =>
        entry.state === "mapping-review" &&
        entry.afterFindingIds?.some((id) => eligibleIds.has(id)),
    )
  )
    unknown.push("Mindestens eine relevante Befundzuordnung ist mehrdeutig.");
  const ids = (state: "new" | "persistent") =>
    new Set(
      comparison?.entries
        .filter((e) => e.state === state)
        .map((e) => e.afterFindingId) ?? [],
    );
  const describe = (finding: (typeof eligible)[number]) => ({
    id: finding.id,
    ruleId: finding.ruleId,
    pageUrl: finding.pageUrl,
    viewportId: finding.viewportId,
    state: finding.state,
    priority: finding.priority,
    title: finding.title,
  });
  const newIds = ids("new"),
    persistentIds = ids("persistent");
  const blockers = eligible.filter((f) => newIds.has(f.id)).map(describe);
  const existing = eligible
    .filter((f) => persistentIds.has(f.id))
    .map(describe);
  const status: "inconclusive" | "regression" | "pass" = unknown.length
    ? "inconclusive"
    : blockers.length
      ? "regression"
      : "pass";
  return {
    version: "release-gate-2.1",
    status,
    exitCode: status === "pass" ? 0 : status === "regression" ? 1 : 2,
    policy,
    unknown,
    blockers,
    existing,
    comparison: comparison
      ? { comparable: comparison.comparable, entries: comparison.entries }
      : null,
    meaning:
      "Pass bedeutet keine neuen gemessenen Blocker im ausdrücklich geprüften kompatiblen Umfang, keine fehlerfreie Website.",
  };
}
