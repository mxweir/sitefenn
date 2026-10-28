import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runAudit } from "../server/audit-engine.js";
import { fixtures, fixtureHTML } from "./fixtures/audit-pages.js";

test(
  "real isolated Lighthouse desktop/mobile reference runs produce lab metrics",
  { timeout: 180_000 },
  async () => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(fixtureHTML(fixtures[0]!));
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const origin = `http://127.0.0.1:${address.port}`;
    const directory = await mkdtemp(join(tmpdir(), "audit-performance-test-"));
    try {
      const result = await runAudit({
        id: "performance",
        url: origin,
        allowedLocalOrigin: origin,
        environment: "local",
        dataDir: directory,
        options: {
          pages: [origin],
          maxPages: 1,
          maxDepth: 0,
          excludedPaths: [],
          viewports: [{ id: "desktop", width: 1440, height: 900 }],
          performance: true,
          performanceRuns: 1,
        },
      });
      assert.equal(result.audit!.performance.length, 2);
      for (const sample of result.audit!.performance) {
        assert.equal(sample.error, undefined, sample.error);
        assert.equal(sample.runs, 1);
        assert.equal(typeof sample.metrics.lcp, "number");
        assert.equal(typeof sample.score, "number");
      }
      assert.ok(
        result
          .audit!.rules.filter((rule) => rule.category === "performance")
          .every((rule) => rule.status !== "not_run"),
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  },
);
