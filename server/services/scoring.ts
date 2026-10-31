import { validateReport } from "../../shared/report-contract.js";
import type {
  AuditReport,
  Category,
  ScoreCategory,
  ScoreSummary,
  RuleResult,
} from "../../shared/types.js";

export const SCORE_VERSION = "audit-score-v2.1";
export const CATEGORY_WEIGHTS: Readonly<Record<Category, number>> =
  Object.freeze({
    layout: 25,
    accessibility: 20,
    seo: 25,
    runtime: 15,
    performance: 15,
  });

export function calculateScore(report: AuditReport): ScoreSummary {
  const contract = validateReport(report);
  const warnings: string[] = contract.issues.map(
    (i) => `${i.code}: ${i.detail}`,
  );
  const findings = new Map(
    report.findings.map((finding) => [finding.id, finding]),
  );
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
    const invalid = contract.issues.some(
      (i) => !i.category || i.category === category,
    );
    const sum = (status: string) =>
      rules
        .filter((rule) => effectiveStatus(rule) === status)
        .reduce((total, rule) => total + rule.weight, 0);
    const passedWeight = invalid ? 0 : sum("pass"),
      failedWeight = invalid ? 0 : sum("fail"),
      unknownWeight = invalid
        ? Math.max(
            1,
            rules.reduce(
              (n, r) =>
                n + (Number.isFinite(r.weight) && r.weight > 0 ? r.weight : 0),
              0,
            ),
            contract.expected
              .filter((r) => r.category === category)
              .reduce((n, r) => n + r.weight, 0),
          )
        : sum("not_run");
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
  const hasApplicable =
    report.rules.length > 0 &&
    categories.some((category) => category.applicableWeight > 0);
  const weighted = (key: "lower" | "upper" | "coverage") =>
    categories.reduce(
      (total, category) => total + (category[key] * category.weight) / 100,
      0,
    );
  const final =
    contract.valid &&
    categories.every(
      (category) =>
        category.applicableWeight > 0 && category.unknownWeight === 0,
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
