import { compareScans } from "./comparison.js";
import type { Scan, ScanComparison } from "../../shared/types.js";
export function changeEvidence(
  before: Scan,
  after: Scan,
  id: string,
  precomputed?: ScanComparison,
) {
  const comparison = precomputed ?? compareScans(before, after),
    entry = comparison.entries.find((e) => e.problemId === id);
  if (!entry) throw Error("Problem gehört nicht zu diesem Vergleich.");
  const origin =
    before.result!.audit!.findings.find(
      (f) => f.id === entry.beforeFindingId,
    ) ??
    after.result!.audit!.findings.find((f) => f.id === entry.afterFindingId)!;
  const side = (scan: Scan, ids: string[]) => {
    const r = scan.result!.audit!,
      same = (x: { pageUrl: string; viewportId: string }) =>
        x.pageUrl === origin.pageUrl && x.viewportId === origin.viewportId;
    const ruleId = origin.ruleId.startsWith("axe-")
      ? "axe-automated"
      : origin.ruleId;
    const state =
      origin.category === "layout" && !origin.state.startsWith("journey:")
        ? "initial"
        : origin.state;
    return {
      scanId: scan.id,
      createdAt: scan.createdAt,
      labels: scan.labels ?? null,
      pages: r.pages.filter(same),
      observations: r.findings.filter((f) => ids.includes(f.id)),
      rules: r.rules.filter(
        (rule) => same(rule) && rule.ruleId === ruleId && rule.state === state,
      ),
      performance: r.performance.filter(
        (p) => p.pageUrl === origin.pageUrl && p.device === origin.viewportId,
      ),
      evidence: r.evidence
        .filter((e) => same(e) && e.state === origin.state)
        .map(({ path, ...metadata }) => metadata),
      provenance: r.provenance ?? null,
    };
  };
  return {
    level: comparison.level,
    state: entry.state,
    observation: {
      ruleId: origin.ruleId,
      pageUrl: origin.pageUrl,
      viewportId: origin.viewportId,
      state: origin.state,
      selector: origin.selector ?? null,
    },
    before: side(
      before,
      entry.beforeFindingIds ??
        (entry.beforeFindingId ? [entry.beforeFindingId] : []),
    ),
    after: side(
      after,
      entry.afterFindingIds ??
        (entry.afterFindingId ? [entry.afterFindingId] : []),
    ),
    meaning:
      "Originalmessungen und eng begrenzte Vergleichsentscheidung. Standortidentität beweist keine gemeinsame Ursache; diagnostische Daten bestätigen keine Behebung.",
  };
}
