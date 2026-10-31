import type { AuditReport, PageAnalysis } from "./types.js";
import { validateReport } from "./report-contract.js";
export function analysisReview(job: PageAnalysis, report: AuditReport) {
  const contract = validateReport(report);
  return {
    processing:
      job.status === "completed"
        ? ("complete" as const)
        : ("incomplete" as const),
    measurementContract: contract.valid
      ? ("valid" as const)
      : ("invalid" as const),
    semanticFactCheck: "not_performed" as const,
    humanApproval: "not_recorded" as const,
    meaning:
      "Verarbeitete Modellteile sind keine sachlich geprüfte oder menschlich freigegebene Beratung.",
  };
}
