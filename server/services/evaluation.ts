import type { AuditReport } from "../../shared/types.js";

export type ExpectedOutcome = "pass" | "fail" | "unknown";
export interface EvaluationLabel {
  caseId: string;
  ruleId: string;
  expected: ExpectedOutcome;
}
export interface EvaluationObservation extends EvaluationLabel {
  pageUrl: string;
  viewportId: string;
  actual: ExpectedOutcome;
}
export interface RuleEvaluation {
  ruleId: string;
  total: number;
  truePositive: number;
  trueNegative: number;
  falsePositive: number;
  falseNegative: number;
  unknown: number;
  expectedUnknown: number;
  precision: number | null;
  recall: number | null;
}
/** Absence of a finding is not a pass unless its page/profile completed and the rule ran. */
export function observeLabel(
  report: AuditReport,
  label: EvaluationLabel,
  pageUrl: string,
  viewportId: string,
): EvaluationObservation {
  const page = report.pages.find(
    (item) => item.pageUrl === pageUrl && item.viewportId === viewportId,
  );
  const rules = report.rules.filter(
    (item) =>
      item.pageUrl === pageUrl &&
      item.viewportId === viewportId &&
      (item.ruleId === label.ruleId ||
        (item.ruleId === "layout-measured" &&
          ["covered-control", "horizontal-overflow"].includes(label.ruleId))),
  );
  const known =
    page?.status === "completed" &&
    rules.length > 0 &&
    rules.every((item) => item.status === "pass" || item.status === "fail");
  const failed = report.findings.some(
    (item) =>
      item.pageUrl === pageUrl &&
      item.viewportId === viewportId &&
      item.ruleId === label.ruleId &&
      item.evidenceStatus === "measured",
  );
  return {
    ...label,
    pageUrl,
    viewportId,
    actual: !known ? "unknown" : failed ? "fail" : "pass",
  };
}
export function evaluateObservations(
  observations: EvaluationObservation[],
): RuleEvaluation[] {
  const rows = new Map<string, RuleEvaluation>();
  for (const item of observations) {
    const row = rows.get(item.ruleId) ?? {
      ruleId: item.ruleId,
      total: 0,
      truePositive: 0,
      trueNegative: 0,
      falsePositive: 0,
      falseNegative: 0,
      unknown: 0,
      expectedUnknown: 0,
      precision: null,
      recall: null,
    };
    row.total++;
    if (item.expected === "unknown") row.expectedUnknown++;
    if (item.actual === "unknown" || item.expected === "unknown") row.unknown++;
    else if (item.expected === "fail")
      item.actual === "fail" ? row.truePositive++ : row.falseNegative++;
    else item.actual === "fail" ? row.falsePositive++ : row.trueNegative++;
    rows.set(item.ruleId, row);
  }
  return [...rows.values()]
    .sort((a, b) => a.ruleId.localeCompare(b.ruleId))
    .map((row) => ({
      ...row,
      precision:
        row.truePositive + row.falsePositive
          ? row.truePositive / (row.truePositive + row.falsePositive)
          : null,
      recall:
        row.truePositive + row.falseNegative
          ? row.truePositive / (row.truePositive + row.falseNegative)
          : null,
    }));
}

export function percentile(values: number[], quantile: number): number | null {
  if (!values.length) return null;
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  return sorted.length
    ? sorted[
        Math.max(
          0,
          Math.ceil(Math.min(1, Math.max(0, quantile)) * sorted.length) - 1,
        )
      ]!
    : null;
}
