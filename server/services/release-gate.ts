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
export function releaseGate(after: Scan, before?: Scan, policy = DEFAULT_GATE) {
  const unknown: string[] = [];
  const report = after.result?.audit;
  if (after.status !== "completed" || !report)
    unknown.push("Aktueller Check nicht vollständig abgeschlossen.");
  if (report) {
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
  if (!before) unknown.push("Keine kompatible Baseline ausgewählt.");
  let comparison;
  if (before && report) {
    if (
      before.result?.audit &&
      (before.result.audit.pages.some(
        (p) =>
          p.state === "initial" &&
          (p.statusCode === null || p.statusCode < 200 || p.statusCode >= 300),
      ) ||
        before.result.audit.coverage.completed !==
          before.result.audit.coverage.planned ||
        before.result.audit.rules.some(
          (r) =>
            policy.categories.includes(r.category) && r.status === "not_run",
        ))
    )
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
  const newIds = new Set(
    comparison?.entries
      .filter((e) => e.state === "new")
      .map((e) => e.afterFindingId) ?? [],
  );
  const ranks: Record<Priority, number> = {
    critical: 0,
    important: 1,
    "nice-to-have": 2,
  };
  const blockers =
    report?.findings.filter(
      (f) =>
        newIds.has(f.id) &&
        f.evidenceStatus === "measured" &&
        policy.categories.includes(f.category) &&
        ranks[f.priority] <= ranks[policy.minimumPriority],
    ) ?? [];
  const status = unknown.length
    ? "inconclusive"
    : blockers.length
      ? "regression"
      : "pass";
  return {
    version: "release-gate-1.8",
    status,
    exitCode: status === "pass" ? 0 : status === "regression" ? 1 : 2,
    policy,
    unknown,
    blockers: blockers.map((f) => ({
      id: f.id,
      ruleId: f.ruleId,
      pageUrl: f.pageUrl,
      viewportId: f.viewportId,
      state: f.state,
      priority: f.priority,
      title: f.title,
    })),
    comparison: comparison
      ? { comparable: comparison.comparable, entries: comparison.entries }
      : null,
    meaning:
      "Pass bedeutet keine neuen gemessenen Blocker im ausdrücklich geprüften kompatiblen Umfang, keine fehlerfreie Website.",
  };
}
