import type {
  AuditReport,
  Category,
  ScoreCategory,
  ScoreSummary,
  RuleResult,
} from "../../shared/types.js";

export const SCORE_VERSION = "audit-score-v1";
export const CATEGORY_WEIGHTS: Readonly<Record<Category, number>> =
  Object.freeze({
    layout: 25,
    accessibility: 20,
    seo: 25,
    runtime: 15,
    performance: 15,
  });

export function calculateScore(report: AuditReport): ScoreSummary {
  const warnings: string[] = [];
  const ids = new Set<string>();
  const findings = new Map(
    report.findings.map((finding) => [finding.id, finding]),
  );
  for (const rule of report.rules) {
    if (ids.has(rule.id))
      throw new Error(`Duplicate rule instance: ${rule.id}`);
    ids.add(rule.id);
    if (
      !Object.hasOwn(CATEGORY_WEIGHTS, rule.category) ||
      !Number.isFinite(rule.weight) ||
      rule.weight <= 0
    )
      throw new Error("Invalid category or rule weight.");
    if (rule.status === "not_applicable" && !rule.detail.trim())
      throw new Error("Not-applicable rules require an applicability reason.");
  }
  const effectiveStatus = (rule: RuleResult) => {
    if (
      rule.status === "fail" &&
      rule.findingIds.length &&
      rule.findingIds.every(
        (id) => findings.get(id)?.evidenceStatus !== "measured",
      )
    )
      return "not_run";
    return rule.status;
  };
  const categories: ScoreCategory[] = (
    Object.keys(CATEGORY_WEIGHTS) as Category[]
  ).map((category) => {
    const rules = report.rules.filter(
      (rule) => rule.category === category && rule.status !== "not_applicable",
    );
    const sum = (status: string) =>
      rules
        .filter((rule) => effectiveStatus(rule) === status)
        .reduce((total, rule) => total + rule.weight, 0);
    const passedWeight = sum("pass"),
      failedWeight = sum("fail"),
      unknownWeight = sum("not_run");
    const applicableWeight = passedWeight + failedWeight + unknownWeight;
    if (!applicableWeight)
      warnings.push(
        `${category}: no applicable measurements; category is unknown, not passed.`,
      );
    return {
      category,
      weight: CATEGORY_WEIGHTS[category],
      passedWeight,
      failedWeight,
      unknownWeight,
      applicableWeight,
      lower: applicableWeight ? (passedWeight / applicableWeight) * 100 : 0,
      upper: applicableWeight
        ? ((passedWeight + unknownWeight) / applicableWeight) * 100
        : 100,
      coverage: applicableWeight
        ? ((passedWeight + failedWeight) / applicableWeight) * 100
        : 0,
    };
  });
  const hasApplicable = categories.some(
    (category) => category.applicableWeight > 0,
  );
  const weighted = (key: "lower" | "upper" | "coverage") =>
    categories.reduce(
      (total, category) => total + (category[key] * category.weight) / 100,
      0,
    );
  const final = categories.every(
    (category) => category.applicableWeight > 0 && category.unknownWeight === 0,
  );
  if (!final)
    warnings.push(
      "Provisional bounds: unexecuted checks and missing categories are unknown. This is not a final website-wide grade.",
    );
  if (report.findings.some((finding) => finding.evidenceStatus !== "measured"))
    warnings.push(
      "Heuristic and AI suggestions do not independently determine the audit score.",
    );
  return {
    ...(report.options.retest ? { scope: "partial" as const } : {}),
    version: SCORE_VERSION,
    lower: hasApplicable ? weighted("lower") : null,
    upper: hasApplicable ? weighted("upper") : null,
    coverage: weighted("coverage"),
    final,
    categories,
    criticalCount: report.findings.filter(
      (finding) =>
        finding.priority === "critical" &&
        finding.evidenceStatus === "measured",
    ).length,
    warnings,
  };
}

export const computeScore = calculateScore;
