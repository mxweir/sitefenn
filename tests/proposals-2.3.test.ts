import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { analysisFacts, observationFacts } from "../shared/analysis-facts.js";
import { expectedRules, validateReport } from "../shared/report-contract.js";
import { normalizeScanOptions } from "../server/options.js";
import {
  makeReview,
  assertReviewCurrent,
  proposalIssues,
  parseEdits,
} from "../server/services/proposal-review.js";
import {
  preparePage,
  newPageAnalysis,
} from "../server/services/page-analysis.js";
import { Store } from "../server/store.js";
import { createBackup, restoreBackup } from "../server/backup.js";
import { validReviewReport } from "./helpers/review-report.js";
import type { AuditReport, Finding, PageSolution } from "../shared/types.js";
import type { ProposalEdits } from "../shared/proposal-review.js";
const fixture = JSON.parse(
  await readFile(
    new URL("./fixtures/proposal-eval-2.3.json", import.meta.url),
    "utf8",
  ),
);
function report(): AuditReport {
  const finding = structuredClone(fixture.cases[0].finding) as Finding,
    url = finding.pageUrl;
  return validReviewReport({
    schemaVersion: 1,
    ruleVersion: "rules-2.1.0",
    profileVersion: "responsive-1.0.0",
    browserVersion: "fixture",
    options: normalizeScanOptions(
      { pages: [url], viewports: ["mobile"], performance: false },
      url,
    ),
    pages: [
      {
        id: "p",
        pageUrl: url,
        finalUrl: url,
        viewportId: "mobile",
        state: "initial",
        title: "Owned",
        statusCode: 200,
        status: "completed",
        durationMs: 1,
      },
    ],
    rules: [],
    findings: [finding],
    evidence: [],
    performance: [],
    discoveredUrls: [url],
    coverage: { planned: 1, completed: 1, skipped: [] },
    startedAt: "2026-10-31T00:00:00Z",
    finishedAt: "2026-10-31T00:00:01Z",
    durationMs: 1,
    warnings: [],
  });
}
const base: PageSolution = {
  findingId: "owned-overflow",
  explanation: "Gemessene Breite 680 px bei 390 px Ansichtsbreite.",
  cause: "Ursache noch unbekannt.",
  steps: ["Breite und Elternlayout prüfen."],
  acceptance: "Dieselbe mobile Ansicht nach Änderung prüfen.",
  code: { language: "none", text: "" },
  uncertainty: "Quellcode fehlt.",
};
const edits: ProposalEdits = {
  steps: base.steps,
  acceptance: base.acceptance,
  code: base.code,
  codeMode: "none",
};
function job(r: AuditReport, scanId = "scan") {
  const j = newPageAnalysis(
    scanId,
    r.options.pages[0]!,
    "local:test",
    "",
    preparePage(r, r.options.pages[0]!),
  );
  j.status = "completed";
  j.parts[0]!.status = "completed";
  j.parts[0]!.solutions = [structuredClone(base)];
  return j;
}
test("fact cards are stable under array reorder and model partition, with exact measured scope", () => {
  const r = report();
  assert.equal(validateReport(r).valid, true);
  const expected = analysisFacts(r);
  const reordered = structuredClone(r);
  reordered.rules.reverse();
  reordered.pages.reverse();
  reordered.findings.reverse();
  reordered.options.viewports.reverse();
  assert.deepEqual(analysisFacts(reordered), expected);
  assert.equal(
    expected.findings.find((f) => f.findingId === "owned-overflow")!.selector,
    "#wide",
  );
  assert.equal(
    expected.findings.find((f) => f.findingId === "owned-overflow")!.viewport
      ?.width,
    390,
  );
  const j = job(r);
  j.summary = "Desktop .wide gemessen 999 px. Alle Prüfungen bestanden.";
  j.parts.push({ ...structuredClone(j.parts[0]!), id: "other", solutions: [] });
  assert.deepEqual(analysisFacts(r), expected);
  const invalid = structuredClone(r);
  invalid.rules = invalid.rules.filter(
    (x) => x.ruleId !== "horizontal-overflow",
  );
  const missing = analysisFacts(invalid);
  assert.equal(missing.measurementValid, false);
  assert.equal(
    missing.instances.find((x) => x.ruleId === "horizontal-overflow")?.status,
    "not_run",
  );
  assert.ok(missing.totals.unknown > expected.totals.unknown);
});
test("known device, number and ID/class errors cannot enter reviewed steps", () => {
  const r = report(),
    f = r.findings[0]!;
  for (const [text, code] of [
    ["Desktop prüfen.", "wrong-device"],
    ["Gemessene Breite beträgt 999 px.", "unknown-number"],
    ["Die Klasse .wide anpassen.", "wrong-selector"],
  ])
    assert.ok(
      proposalIssues({ ...base, steps: [text!] }, f, r).some(
        (i) => i.code === code,
      ),
    );
  assert.deepEqual(
    proposalIssues(
      {
        ...base,
        steps: ["https://owned.example/ prüfen, danach #wide untersuchen."],
      },
      f,
      r,
    ),
    [],
  );
  assert.deepEqual(
    proposalIssues(
      {
        ...base,
        steps: ["Vorschlag: Breite testweise auf 350 px ändern und prüfen."],
      },
      f,
      r,
    ),
    [],
  );
});
test("code origin is explicit; malformed length values and unsupported fixes stay out", () => {
  const r = report(),
    f = r.findings[0]!;
  const check = (
    language: PageSolution["code"]["language"],
    text: string,
    mode: ProposalEdits["codeMode"] = "captured",
  ) =>
    proposalIssues({ ...base, code: { language, text } }, f, r, mode).map(
      (i) => i.code,
    );
  assert.ok(check("css", ".wide {max-width:100%}").includes("wrong-selector"));
  assert.deepEqual(check("css", "#wide {max-width:100%}"), []);
  assert.deepEqual(
    check("css", ".sf-example-wide {max-width:100%}", "illustrative"),
    [],
  );
  assert.ok(
    check("css", ".sf-example-wide {max-width:#wide}", "illustrative").includes(
      "invalid-css-value",
    ),
  );
  assert.ok(
    check("html", '<div id="wide">Example</div>', "illustrative").includes(
      "unmarked-example",
    ),
  );
  assert.deepEqual(
    check("html", '<div class="sf-example-wide">Example</div>', "illustrative"),
    [],
  );
  assert.ok(
    check("css", "#wide {overflow:hidden}").includes("layout-fix-unproven"),
  );
  assert.ok(
    check("javascript", "console.log('x')").includes("unsupported-code"),
  );
});
test("only curated content transfers; originals, measurements and review identities are immutable", () => {
  const r = report(),
    j = job(r),
    f = r.findings[0]!,
    s = j.parts[0]!.solutions[0]!;
  s.explanation = "Desktop .wide 999 px";
  s.code = { language: "javascript", text: "bad()" };
  const before = JSON.stringify({ r, j });
  const review = makeReview(j, r, f, s, edits, "approved");
  assert.deepEqual(review.issues, []);
  assert.equal(JSON.stringify({ r, j }), before);
  assert.equal(review.binding.selector, "#wide");
  assertReviewCurrent(review, j, r, f, s);
  assert.throws(() =>
    assertReviewCurrent({ ...review, status: "needs-context" }, j, r, f, s),
  );
  assert.throws(() =>
    assertReviewCurrent(review, { ...j, id: "foreign" }, r, f, s),
  );
  assert.throws(() =>
    assertReviewCurrent(review, j, r, { ...f, selector: ".wide" }, s),
  );
  assert.throws(() =>
    assertReviewCurrent(review, j, r, f, { ...s, explanation: "changed" }),
  );
  const invalid = structuredClone(r);
  invalid.rules = [];
  assert.throws(
    () => makeReview(j, invalid, f, s, edits, "approved"),
    /Messvertrag/,
  );
  const needs = makeReview(
    j,
    r,
    f,
    s,
    { ...edits, steps: ["Gemessen 999 px."] },
    "needs-context",
  );
  assert.ok(needs.issues.some((i) => i.code === "unknown-number"));
  assert.throws(
    () => makeReview(j, r, f, s, needs.edits, "approved"),
    /Messwert/,
  );
});
test("draft shape rejects unexpected fields, oversized steps and code without origin", () => {
  assert.deepEqual(parseEdits(edits), edits);
  for (const value of [
    { ...edits, confirmed: true },
    { ...edits, steps: [] },
    { ...edits, steps: ["x".repeat(601)] },
    { ...edits, codeMode: "automatic" },
  ])
    assert.throws(() => parseEdits(value));
});
test("review revisions and classified local feedback survive restart, trash and portable restore", async () => {
  const root = await mkdtemp(join(tmpdir(), "sitefenn23-review-"));
  let store = new Store(join(root, "source"));
  let restored: Store | undefined;
  try {
    const r = report(),
      project = store.createProject("Owned", r.options.pages[0]!, "production"),
      scan = store.createScan(project.id, r.options);
    store.finish(scan.id, {
      title: "Owned",
      url: project.url,
      statusCode: 200,
      viewport: { width: 390, height: 844 },
      screenshotPath: "",
      checks: [],
      durationMs: 1,
      audit: r,
    });
    const j = job(r, scan.id);
    store.savePageAnalysis(j);
    const review = makeReview(j, r, r.findings[0]!, base, edits, "approved");
    store.saveProposalReview(review);
    store.saveAnalysisFeedback({
      id: "feedback",
      analysisId: j.id,
      scanId: scan.id,
      findingId: base.findingId,
      reviewId: review.id,
      createdAt: review.createdAt,
      category: "bad-code",
      note: "Beispiel verworfen, nur Schritte übernommen.",
    });
    assert.throws(() => store.saveProposalReview(review));
    store.close();
    store = new Store(join(root, "source"));
    assert.deepEqual(store.proposalReview(review.id), review);
    store.trashScan(scan.id);
    assert.equal(store.proposalReview(review.id), undefined);
    const archive = await createBackup(store);
    await restoreBackup(archive, join(root, "restored"));
    restored = new Store(join(root, "restored"));
    restored.restoreTrash(scan.id);
    assert.deepEqual(restored.analysisReviews(j.id), [review]);
    assert.equal(restored.analysisFeedback(j.id)[0]!.category, "bad-code");
    assert.equal(
      restored.pageAnalysis(j.id)!.parts[0]!.solutions[0]!.code.language,
      "none",
    );
    assertReviewCurrent(
      review,
      restored.pageAnalysis(j.id)!,
      restored.scan(scan.id)!.result!.audit!,
      r.findings[0]!,
      base,
    );
    assert.deepEqual(
      observationFacts(r, r.findings[0]!),
      observationFacts(restored.scan(scan.id)!.result!.audit!, r.findings[0]!),
    );
  } finally {
    store.close();
    restored?.close();
    await rm(root, { recursive: true, force: true });
  }
});
