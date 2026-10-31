import { VIEWPORTS } from "./types.js";
import type { AuditReport, Category, RuleResult } from "./types.js";
export const REPORT_CONTRACT_VERSION = "report-contract-2.1";
export const TECHNICAL_RULES = [
  "seo-internal-links",
  "seo-redirects",
  "seo-canonical-target",
  "seo-robots-context",
  "seo-duplicate-title",
  "seo-duplicate-description",
  "seo-breadcrumb-profile",
] as const;
export const BASE_RULES: readonly (readonly [string, Category, number])[] = [
  ["horizontal-overflow", "layout", 2],
  ["covered-control", "layout", 2],
  ["document-title", "seo", 1],
  ["meta-description", "seo", 1],
  ["indexability", "seo", 1],
  ["canonical-valid", "seo", 1],
  ["structured-data-json", "seo", 1],
  ["http-status", "runtime", 2],
  ["script-errors", "runtime", 1],
  ["resource-errors", "runtime", 1],
  ["axe-automated", "accessibility", 3],
];
export type ExpectedRule = Pick<
  RuleResult,
  "ruleId" | "category" | "weight" | "pageUrl" | "viewportId" | "state"
>;
export const ruleInstanceKey = (
  r: Pick<ExpectedRule, "ruleId" | "pageUrl" | "viewportId" | "state">,
) => JSON.stringify([r.ruleId, r.pageUrl, r.viewportId, r.state]);
function safeUrl(value: string): string {
  try {
    const url = new URL(value);
    url.search = "";
    url.hash = "";
    url.username = "";
    url.password = "";
    return url.href;
  } catch {
    return "unbekannte URL";
  }
}
const ruleLabel = (r: ExpectedRule) =>
  JSON.stringify([r.ruleId, safeUrl(r.pageUrl), r.viewportId, r.state]);
export function expectedRules(report: AuditReport): ExpectedRule[] {
  const expected: ExpectedRule[] = [];
  for (const pageUrl of report.options.pages)
    for (const viewport of report.options.viewports)
      for (const [ruleId, category, weight] of [
        ...BASE_RULES,
        ...(report.options.technicalSeo
          ? TECHNICAL_RULES.map((id) => [id, "seo", 1] as const)
          : []),
      ])
        expected.push({
          ruleId,
          category,
          weight,
          pageUrl,
          viewportId: viewport.id,
          state: "initial",
        });
  if (report.options.pages[0])
    for (const viewportId of ["desktop", "mobile"].filter(
      (id) =>
        !report.options.retest ||
        report.options.viewports.some((v) => v.id === id),
    ))
      for (const metric of ["lcp", "cls", "tbt"])
        expected.push({
          ruleId: `performance-${metric}`,
          category: "performance",
          weight: 1,
          pageUrl: report.options.pages[0],
          viewportId,
          state: "lighthouse",
        });
  for (const j of report.options.journeys ?? [])
    for (const viewportId of j.viewportIds) {
      const run = report.journeyRuns?.find(
        (r) => r.journeyId === j.id && r.viewportId === viewportId,
      );
      for (let i = 0; i < j.steps.length; i++) {
        const state =
          run?.steps[i]?.state ?? `journey:${j.id}:missing:${i + 1}`;
        for (const [ruleId, category, weight] of BASE_RULES.filter(
          ([, c]) => c === "layout" || c === "accessibility",
        ))
          expected.push({
            ruleId,
            category,
            weight,
            pageUrl: j.pageUrl,
            viewportId,
            state,
          });
      }
    }
  return expected;
}
export interface ContractIssue {
  code: string;
  category?: Category;
  detail: string;
}
export function validateReport(report: AuditReport): {
  version: string;
  valid: boolean;
  issues: ContractIssue[];
  expected: ExpectedRule[];
} {
  const issues: ContractIssue[] = [];
  const issue = (code: string, detail: string, category?: Category) =>
    issues.push({ code, detail, ...(category ? { category } : {}) });
  const expected = expectedRules(report);
  if (
    !["rules-2.0.0", "rules-2.1.0"].includes(report.ruleVersion) ||
    (report.contractVersion &&
      report.contractVersion !== REPORT_CONTRACT_VERSION)
  )
    issue(
      "unsupported-contract",
      "Unbekannter Messvertrag; erneute Prüfung erforderlich.",
    );
  if (
    report.profileVersion !== "responsive-1.0.0" ||
    report.options.viewports.some(
      (v) =>
        !VIEWPORTS.some(
          (known) =>
            known.id === v.id &&
            known.width === v.width &&
            known.height === v.height,
        ),
    )
  )
    issue(
      "unsupported-profile",
      "Geräteprofil oder Profilversion ist nicht im Messvertrag registriert.",
    );
  if (
    report.ruleVersion === "rules-2.1.0" &&
    report.contractVersion !== REPORT_CONTRACT_VERSION
  )
    issue("missing-contract", "Versionskennung des Messvertrags fehlt.");
  if (!report.options.pages.length || !report.options.viewports.length)
    issue("empty-scope", "Seiten-/Geräteumfang fehlt.");
  const unique = (values: { id: string }[], kind: string) => {
    const set = new Set<string>();
    for (const v of values) {
      if (!v.id || set.has(v.id))
        issue("duplicate-id", `Nicht eindeutige ${kind}-ID: ${v.id}`);
      set.add(v.id);
    }
    return set;
  };
  unique(report.rules, "Regel");
  const findingIds = unique(report.findings, "Befund"),
    evidenceIds = unique(report.evidence, "Nachweis");
  unique(report.pages, "Seitenlauf");
  const expectedKeys = new Set(expected.map(ruleInstanceKey));
  const keys = new Map<string, RuleResult[]>();
  for (const r of report.rules) {
    const categoryValid = [
      "layout",
      "accessibility",
      "seo",
      "runtime",
      "performance",
    ].includes(r.category);
    if (!categoryValid || !Number.isFinite(r.weight) || r.weight <= 0)
      issue(
        "invalid-rule-budget",
        `Ungültige Kategorie/Gewichtung: ${r.id}`,
        categoryValid ? r.category : undefined,
      );
    const key = ruleInstanceKey(r);
    if (!expectedKeys.has(key))
      issue(
        "unexpected-rule",
        `Ungeplante Regelinstanz: ${ruleLabel(r)}`,
        r.category,
      );
    if (r.status === "not_applicable" && !r.detail.trim())
      issue(
        "missing-applicability",
        `Anwendbarkeitsgrund fehlt: ${r.id}`,
        r.category,
      );
    if (
      !report.options.performance &&
      r.category === "performance" &&
      r.status !== "not_run"
    )
      issue(
        "disabled-measurement",
        `Deaktivierte Performance als Ergebnis: ${r.id}`,
        "performance",
      );
    keys.set(key, [...(keys.get(key) ?? []), r]);
    if (!["pass", "fail", "not_run", "not_applicable"].includes(r.status))
      issue("invalid-status", `Ungültiger Regelstatus: ${r.id}`, r.category);
    if (
      r.findingIds.some((id) => !findingIds.has(id)) ||
      (r.evidenceId && !evidenceIds.has(r.evidenceId))
    )
      issue(
        "dangling-reference",
        `Ungültiger Nachweis-/Befundverweis: ${r.id}`,
        r.category,
      );
    if (
      r.findingIds.some((id) => {
        const f = report.findings.find((f) => f.id === id);
        return (
          f &&
          (f.category !== r.category ||
            (f.ruleId !== r.ruleId &&
              !(r.ruleId === "axe-automated" && f.ruleId.startsWith("axe-"))) ||
            f.pageUrl !== r.pageUrl ||
            f.viewportId !== r.viewportId ||
            (f.state !== r.state &&
              !(
                r.category === "layout" &&
                r.state === "initial" &&
                /^scroll-\d+$/.test(f.state)
              )))
        );
      })
    )
      issue(
        "wrong-reference",
        `Befund gehört nicht zur Regelinstanz: ${r.id}`,
        r.category,
      );
  }
  for (const e of expected) {
    const rows = keys.get(ruleInstanceKey(e)) ?? [];
    if (rows.length !== 1)
      issue(
        "missing-or-duplicate-rule",
        `Erwartet genau eine Regel: ${ruleLabel(e)}`,
        e.category,
      );
    else if (rows[0]!.category !== e.category || rows[0]!.weight !== e.weight)
      issue(
        "invalid-rule-budget",
        `Falsche Kategorie/Gewichtung: ${ruleLabel(e)}`,
        e.category,
      );
  }
  for (const [key, rows] of keys)
    if (rows.length > 1)
      issue(
        "duplicate-instance",
        `Doppelte Regelinstanz: ${ruleLabel(rows[0]!)}`,
        rows[0]!.category,
      );
  for (const pageUrl of report.options.pages)
    for (const viewport of report.options.viewports) {
      const rows = report.pages.filter(
        (p) =>
          p.pageUrl === pageUrl &&
          p.viewportId === viewport.id &&
          p.state === "initial",
      );
      if (rows.length !== 1)
        issue(
          "missing-page",
          `Seitenlauf fehlt/mehrfach: ${safeUrl(pageUrl)} · ${viewport.id}`,
        );
    }
  for (const r of report.rules) {
    const e = report.evidence.find((e) => e.id === r.evidenceId);
    if (e && (e.pageUrl !== r.pageUrl || e.viewportId !== r.viewportId))
      issue(
        "wrong-evidence",
        `Nachweis gehört zu anderer Seite/Gerät: ${r.id}`,
        r.category,
      );
  }
  const planned = report.options.pages.length * report.options.viewports.length;
  const completed = report.pages.filter(
    (p) => p.state === "initial" && p.status === "completed",
  ).length;
  if (
    report.coverage.planned !== planned ||
    report.coverage.completed !== completed
  )
    issue(
      "invalid-coverage",
      "Abdeckungszähler stimmen nicht mit dem geplanten Umfang überein.",
    );
  if (report.pages.some((p) => p.status !== "completed"))
    issue("incomplete-page", "Mindestens ein Seitenlauf ist fehlgeschlagen.");
  for (const item of [...report.pages, ...report.findings]) {
    if (item.evidenceId && !evidenceIds.has(item.evidenceId))
      issue("dangling-reference", `Nachweis fehlt: ${item.id}`);
    const e = report.evidence.find((e) => e.id === item.evidenceId);
    if (
      e &&
      (e.pageUrl !== item.pageUrl ||
        e.viewportId !== item.viewportId ||
        e.state !== item.state)
    )
      issue(
        "wrong-evidence",
        `Nachweis gehört zu anderer Seite/Gerät/Zustand: ${item.id}`,
      );
  }
  for (const j of report.options.journeys ?? [])
    for (const viewportId of j.viewportIds) {
      const runs =
        report.journeyRuns?.filter(
          (r) => r.journeyId === j.id && r.viewportId === viewportId,
        ) ?? [];
      if (
        runs.length !== 1 ||
        runs[0]!.steps.length !== j.steps.length ||
        runs[0]!.steps.some(
          (step, i) =>
            step.state !== `journey:${j.id}:${runs[0]!.signature}:${i + 1}`,
        )
      )
        issue(
          "invalid-journey",
          `Geplanter Seitenzustand fehlt/ist ungültig: ${j.id} · ${viewportId}`,
        );
    }
  for (const j of report.options.journeys ?? [])
    for (const viewportId of j.viewportIds) {
      const run = report.journeyRuns?.find(
        (r) => r.journeyId === j.id && r.viewportId === viewportId,
      );
      if (run && run.pageUrl !== j.pageUrl)
        issue(
          "wrong-journey-page",
          `Seitenzustand gehört zur falschen Seite: ${j.id}`,
        );
      for (const step of run?.steps ?? [])
        if (
          step.status !== "completed" &&
          report.rules.some(
            (r) =>
              r.pageUrl === j.pageUrl &&
              r.viewportId === viewportId &&
              r.state === step.state &&
              r.status !== "not_run",
          )
        )
          issue(
            "unconfirmed-state",
            `Nicht bestätigter Zustand mit Messergebnis: ${step.state}`,
          );
    }
  return {
    version: REPORT_CONTRACT_VERSION,
    valid: !issues.length,
    issues,
    expected,
  };
}
// Facts are always projected from persisted measurements, never extracted from model prose.
export function pageFacts(report: AuditReport, pageUrl: string) {
  const contract = validateReport(report);
  return {
    contractVersion: contract.version,
    valid: contract.valid,
    issues: contract.issues,
    pageUrl,
    viewports: report.options.viewports,
    pages: report.pages.filter((p) => p.pageUrl === pageUrl),
    rules: report.rules.filter((r) => r.pageUrl === pageUrl),
    findings: report.findings.filter((f) => f.pageUrl === pageUrl),
    performance: report.performance.filter((p) => p.pageUrl === pageUrl),
  };
}
