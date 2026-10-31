import type { AuditReport } from "../../shared/types.js";
import {
  expectedRules,
  REPORT_CONTRACT_VERSION,
} from "../../shared/report-contract.js";
export function validReviewReport(source: AuditReport): AuditReport {
  const r = structuredClone(source),
    url = r.pages[0]!.pageUrl;
  r.contractVersion = REPORT_CONTRACT_VERSION;
  r.ruleVersion = "rules-2.1.0";
  r.profileVersion = "responsive-1.0.0";
  r.options.pages = [url];
  r.options.performance = false;
  r.performance = [];
  r.coverage = { planned: 1, completed: 1, skipped: [] };
  r.rules = expectedRules(r).map((e, i) => ({
    ...e,
    id: `valid-${i}`,
    status: e.ruleId.startsWith("performance-")
      ? "not_run"
      : r.findings.some(
            (f) =>
              f.ruleId === e.ruleId &&
              f.viewportId === e.viewportId &&
              f.state === e.state,
          )
        ? "fail"
        : "pass",
    detail: "Recorded test fixture",
    findingIds: r.findings
      .filter(
        (f) =>
          f.ruleId === e.ruleId &&
          f.viewportId === e.viewportId &&
          f.state === e.state,
      )
      .map((f) => f.id),
  }));
  return r;
}
