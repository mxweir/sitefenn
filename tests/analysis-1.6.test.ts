import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { performScan } from "../server/scan-worker.js";
import {
  preparePage,
  validatePagePart,
} from "../server/services/page-analysis.js";
import { analysisContext } from "../server/services/analysis-context.js";
import { normalizeScanOptions } from "../server/options.js";
import type { AuditReport, Finding, Scan } from "../shared/types.js";
const corpus = JSON.parse(
  await readFile(
    new URL("./fixtures/page-eval-1.6.json", import.meta.url),
    "utf8",
  ),
);
for (const c of corpus.cases)
  test(`page-eval-1.6 / ${c.id} / ${c.expected}`, () => {
    const run = () =>
      validatePagePart(c.output, [c.finding], [], c.counts, {
        units: [
          { id: `finding:${c.finding.id}`, value: c.finding },
          { id: "rule:unknown", value: { status: "not_run" } },
        ],
      });
    if (c.expected === "rejected") assert.throws(run);
    else assert.equal(run().solutions[0]?.findingId, c.finding.id);
  });
test(
  "real captured layout styles exclude form values, raw HTML and text; contextual chunks retain the related observation",
  { timeout: 30000 },
  async () => {
    const secret = "PRIVATE-FORM-VALUE-NOT-FOR-MODEL";
    const fixture = createServer((req, res) => {
      res.setHeader("content-type", "text/html");
      res.end(
        `<!doctype html><html lang="de"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Owned context fixture</title><meta name="description" content="Owned synthetic fixture"><style>body{margin:0}#wide{width:680px;min-height:120px}#fixed{height:20px;overflow:hidden}</style></head><body><main><h1>Owned fixture</h1><div id="wide"><input type="password" value="${secret}" aria-label="Private field"><p>${secret}</p></div><div id="fixed">Small example</div></main></body></html>`,
      );
    });
    await new Promise<void>((r) => fixture.listen(0, "127.0.0.1", r));
    const address = fixture.address();
    assert.ok(address && typeof address !== "string");
    const url = `http://127.0.0.1:${address.port}/`,
      dir = await mkdtemp(join(tmpdir(), "sitefenn-context-"));
    try {
      const options = normalizeScanOptions(
        { pages: [url], viewports: ["mobile"], performance: false },
        url,
      );
      const result = await performScan({
        id: "context",
        url,
        allowedLocalOrigin: new URL(url).origin,
        dataDir: dir,
        options,
      });
      const report = result.audit!;
      const f = report.findings.find(
        (f) => f.ruleId === "horizontal-overflow" && f.selector === "#wide",
      )!;
      assert.equal(f.elementContext?.status, "captured");
      assert.equal(f.elementContext?.styles?.width, "680px");
      assert.ok(f.elementContext?.dimensions!.scrollWidth! >= 680);
      const contexts = JSON.stringify(
        report.findings.map((f) => f.elementContext),
      );
      assert.ok(!contexts.includes(secret));
      assert.ok(!contexts.includes("<input"));
      assert.ok(!contexts.includes("password"));
      const prepared = preparePage(report, url, undefined, {
        purpose: "Leistungen erklären",
        goal: "Passende Information finden",
      });
      const chunk = prepared.chunks.find((p) =>
        p.some((u) => u.findingId === f.id),
      )!;
      assert.ok(chunk.some((u) => u.id === `evidence:${f.evidenceId}`));
      assert.ok(chunk.some((u) => u.id.startsWith("rule:")));
      assert.equal(prepared.header.pagePurpose, "Leistungen erklären");
      const expected = new Set(prepared.units.map((u) => u.id)),
        accounted = new Set([
          ...prepared.chunks.flat().map((u) => u.id),
          ...prepared.omitted.map((o) => o.unitId),
        ]);
      assert.deepEqual([...accounted].sort(), [...expected].sort());
      const context = analysisContext(
        { purpose: "Klarheit", focusFindingId: f.id },
        report,
        url,
      );
      assert.equal(context.focusFindingId, f.id);
      assert.throws(() =>
        analysisContext({ purpose: "x".repeat(501) }, report, url),
      );
      assert.throws(() =>
        analysisContext({ focusFindingId: "foreign" }, report, url),
      );
      assert.throws(() => analysisContext({ script: "x" }, report, url));
      const before: Scan = {
        id: "before",
        projectId: "p",
        status: "completed",
        createdAt: "2026-10-29T10:00:00Z",
        finishedAt: "2026-10-29T10:01:00Z",
        error: null,
        result,
        options,
      };
      const after: Scan = {
        ...structuredClone(before),
        id: "after",
        createdAt: "2026-10-30T10:00:00Z",
        finishedAt: "2026-10-30T10:01:00Z",
      };
      assert.equal(
        analysisContext({}, report, url, [], { before, after }).comparison
          ?.scanId,
        "before",
      );
      assert.throws(() =>
        analysisContext({}, report, url, [], { before: after, after: before }),
      );
      const changed = structuredClone(before);
      changed.result!.audit!.browserVersion = "different";
      assert.throws(() =>
        analysisContext({}, report, url, [], { before: changed, after }),
      );
      const withStates = structuredClone(report);
      withStates.pages.push({
        ...withStates.pages[0]!,
        id: "state",
        state: "journey:fixture",
        status: "completed",
      });
      assert.equal(
        (preparePage(withStates, url).header.scope as { completed: number })
          .completed,
        1,
      );
    } finally {
      await new Promise<void>((r) => fixture.close(() => r()));
      await rm(dir, { recursive: true, force: true });
    }
  },
);

const releaseCorpus = JSON.parse(
  await readFile(
    new URL("./fixtures/page-eval-2.0.json", import.meta.url),
    "utf8",
  ),
);
for (const c of releaseCorpus.cases)
  test(`page-eval-2.0 / ${c.id} / ${c.expected}`, () => {
    const run = () =>
      validatePagePart(c.output, [c.finding], [], c.counts, {
        units: [
          { id: `finding:${c.finding.id}`, value: c.finding },
          { id: "rule:unknown", value: { status: "not_run" } },
        ],
      });
    if (c.expected === "rejected") assert.throws(run);
    else assert.equal(run().solutions[0]?.findingId, c.finding.id);
  });
