import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runAudit } from "../server/audit-engine.js";
import { baselineCases, baselineHtml } from "./fixtures/baseline-pages.js";
import {
  observeLabel,
  evaluateObservations,
  percentile,
} from "../server/services/evaluation.js";
import { VIEWPORTS, type AuditReport } from "../shared/types.js";

test("evaluation keeps unknown execution out of passing counts and precision/recall", () => {
  const base = {
    caseId: "fixture",
    ruleId: "rule",
    pageUrl: "https://example.test/",
    viewportId: "desktop",
  };
  const [row] = evaluateObservations([
    { ...base, expected: "fail", actual: "fail" },
    { ...base, expected: "pass", actual: "pass" },
    { ...base, expected: "pass", actual: "fail" },
    { ...base, expected: "fail", actual: "pass" },
    { ...base, expected: "fail", actual: "unknown" },
    { ...base, expected: "unknown", actual: "unknown" },
  ]);
  assert.deepEqual(row, {
    ruleId: "rule",
    total: 6,
    truePositive: 1,
    trueNegative: 1,
    falsePositive: 1,
    falseNegative: 1,
    unknown: 2,
    expectedUnknown: 1,
    precision: 0.5,
    recall: 0.5,
  });
  assert.equal(
    evaluateObservations([{ ...base, expected: "pass", actual: "pass" }])[0]
      ?.precision,
    null,
  );
  assert.equal(percentile([], 0.95), null);
  assert.equal(percentile([8, 1, 2, 3], 0.5), 2);
  const missing = observeLabel(
    { pages: [], rules: [], findings: [] } as unknown as AuditReport,
    { ...base, expected: "fail" },
    base.pageUrl,
    base.viewportId,
  );
  assert.equal(missing.actual, "unknown");
});

test(
  "supplemental layout corpus: inert/transparent ancestors, visible/hidden dialogs and positive controls across all profiles",
  { timeout: 90000 },
  async () => {
    const server = createServer((req, res) => {
      const id = new URL(req.url || "/", "http://fixture").pathname.slice(1);
      if (id === "denied-redirect") {
        res.writeHead(302, { location: "https://outside-scope.invalid/" });
        res.end();
        return;
      }
      const html = baselineHtml(id);
      res.writeHead(html ? 200 : 404, {
        "content-type": "text/html; charset=utf-8",
      });
      res.end(html ?? "Missing");
    });
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const origin = `http://127.0.0.1:${address.port}`;
    const directory = await mkdtemp(join(tmpdir(), "sitefenn-eval-"));
    try {
      const result = await runAudit({
        id: "regression",
        url: origin,
        allowedLocalOrigin: origin,
        environment: "local",
        dataDir: directory,
        options: {
          pages: baselineCases.map((item) => `${origin}/${item.id}`),
          maxPages: baselineCases.length,
          maxDepth: 0,
          excludedPaths: [],
          viewports: VIEWPORTS,
          performance: false,
          performanceRuns: 1,
        },
      });
      assert.match(result.audit!.provenance!.engineSha256, /^[a-f0-9]{64}$/);
      const observations = baselineCases.flatMap((item) =>
        item.labels.flatMap((label) =>
          VIEWPORTS.map((viewport) =>
            observeLabel(
              result.audit!,
              label,
              `${origin}/${item.id}`,
              viewport.id,
            ),
          ),
        ),
      );
      assert.equal(observations.length, 120);
      for (const observation of observations)
        assert.equal(
          observation.actual,
          observation.expected,
          JSON.stringify(observation),
        );
      const scrolled = result.audit!.findings.find(
        (item) =>
          item.pageUrl.endsWith("/scroll-only-blocker") &&
          item.ruleId === "covered-control" &&
          item.viewportId === "desktop",
      );
      assert.ok(scrolled?.rect);
      assert.equal(
        Math.round(scrolled.rect.y),
        1100,
        "Stored rectangles must use document coordinates",
      );
      const capture = result.audit!.evidence.find(
        (item) => item.id === scrolled.evidenceId,
      )!;
      assert.ok(capture.scrollY > 0);
      assert.ok(
        scrolled.rect.y - capture.scrollY >= 0 &&
          scrolled.rect.y - capture.scrollY < capture.height,
      );
      for (const row of evaluateObservations(observations)) {
        assert.equal(row.falsePositive, 0);
        assert.equal(row.falseNegative, 0);
        assert.equal(row.unknown, row.ruleId === "covered-control" ? 6 : 3);
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
      await new Promise<void>((done) => server.close(() => done()));
    }
  },
);
