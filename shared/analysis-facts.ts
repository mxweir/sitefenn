import type { AuditReport, Finding } from "./types.js";
import { validateReport, ruleInstanceKey } from "./report-contract.js";
export const FACTS_VERSION = "analysis-facts-2.3";
const sorted = <T>(items: T[], key: (item: T) => string) =>
  [...items].sort((a, b) => key(a).localeCompare(key(b), "en"));
export function observationFacts(report: AuditReport, finding: Finding) {
  const viewport = report.options.viewports.find(
    (v) => v.id === finding.viewportId,
  );
  const evidence = report.evidence.find((e) => e.id === finding.evidenceId);
  return {
    ref: `finding:${finding.id}`,
    findingId: finding.id,
    pageUrl: finding.pageUrl,
    viewportId: finding.viewportId,
    state: finding.state,
    selector: finding.selector ?? null,
    viewport: viewport
      ? { width: viewport.width, height: viewport.height }
      : null,
    evidenceId: evidence?.id ?? null,
    evidenceStatus: finding.evidenceStatus,
    detail: finding.detail,
    rect: finding.rect ?? null,
    elementContext: finding.elementContext ?? null,
    ruleId: finding.ruleId,
    category: finding.category,
    acceptance: finding.acceptance,
    meaning:
      "Recorded observation; no source mapping, performed repair or inferred root cause.",
  };
}
export function analysisFacts(report: AuditReport, pageUrl?: string) {
  const contract = validateReport(report);
  const rules = new Map(report.rules.map((r) => [ruleInstanceKey(r), r]));
  const groups = new Map<
    string,
    {
      pageUrl: string;
      viewportId: string;
      state: string;
      pass: number;
      fail: number;
      unknown: number;
      notApplicable: number;
    }
  >();
  for (const expected of contract.expected.filter(
    (r) => !pageUrl || r.pageUrl === pageUrl,
  )) {
    const key = JSON.stringify([
      expected.pageUrl,
      expected.viewportId,
      expected.state,
    ]);
    const group = groups.get(key) ?? {
      pageUrl: expected.pageUrl,
      viewportId: expected.viewportId,
      state: expected.state,
      pass: 0,
      fail: 0,
      unknown: 0,
      notApplicable: 0,
    };
    const row = rules.get(ruleInstanceKey(expected));
    const invalid = contract.issues.some(
      (i) => !i.category || i.category === expected.category,
    );
    const status = invalid ? "not_run" : (row?.status ?? "not_run");
    if (status === "pass") group.pass++;
    else if (status === "fail") group.fail++;
    else if (status === "not_applicable") group.notApplicable++;
    else group.unknown++;
    groups.set(key, group);
  }
  const matrix = sorted([...groups.values()], (r) =>
    JSON.stringify([r.pageUrl, r.viewportId, r.state]),
  );
  const findings = sorted(
    report.findings.filter((f) => !pageUrl || f.pageUrl === pageUrl),
    (f) => f.id,
  ).map((f) => observationFacts(report, f));
  const totals = matrix.reduce(
    (t, r) => ({
      pass: t.pass + r.pass,
      fail: t.fail + r.fail,
      unknown: t.unknown + r.unknown,
      notApplicable: t.notApplicable + r.notApplicable,
    }),
    { pass: 0, fail: 0, unknown: 0, notApplicable: 0 },
  );
  const instances = sorted(
    contract.expected.filter((r) => !pageUrl || r.pageUrl === pageUrl),
    ruleInstanceKey,
  ).map((expected) => {
    const row = rules.get(ruleInstanceKey(expected));
    const invalid = contract.issues.some(
      (i) => !i.category || i.category === expected.category,
    );
    return {
      ...expected,
      status: invalid ? "not_run" : (row?.status ?? "not_run"),
      findingIds: invalid ? [] : sorted(row?.findingIds ?? [], (id) => id),
    };
  });
  return {
    instances,
    version: FACTS_VERSION,
    pageUrl: pageUrl ?? null,
    measurementValid: contract.valid,
    issues: sorted(contract.issues, (i) =>
      JSON.stringify([i.code, i.category ?? "", i.detail]),
    ),
    viewports: sorted(report.options.viewports, (v) => v.id),
    matrix,
    findings,
    totals,
    summary: `${findings.length} dokumentierte Befunde. ${totals.pass} Regelinstanzen bestanden, ${totals.fail} fehlgeschlagen, ${totals.unknown} unbekannt, ${totals.notApplicable} nicht anwendbar. Messvertrag ${contract.valid ? "gültig" : "ungültig/unvollständig"}. Keine Aussage über eine erfolgte Reparatur.`,
    performance: sorted(
      report.performance.filter((p) => !pageUrl || p.pageUrl === pageUrl),
      (p) => JSON.stringify([p.pageUrl, p.device]),
    ).map((p) => ({
      pageUrl: p.pageUrl,
      device: p.device,
      runs: p.runs,
      metrics: p.metrics,
      error: p.error ?? null,
    })),
  };
}
