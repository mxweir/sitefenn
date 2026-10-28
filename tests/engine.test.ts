import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, request } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  runAudit,
  discoverPages,
  inScope,
  normalizeAuditUrl,
} from "../server/audit-engine.js";
import { startAuditProxy } from "../server/network-proxy.js";
import { validateTarget } from "../server/security.js";
import { fixtures, fixtureHTML } from "./fixtures/audit-pages.js";
import type { WorkerEvent, RuleResult, Finding } from "../shared/types.js";

test("scope matching is origin-exact, fragments normalized and query retained", () => {
  assert.equal(
    normalizeAuditUrl("/page?lang=de#section", "https://example.com"),
    "https://example.com/page?lang=de",
  );
  assert.equal(
    inScope("https://example.com.evil.test/page", "https://example.com"),
    false,
  );
  assert.equal(
    inScope("https://example.com/private/test", "https://example.com", [
      "/private",
    ]),
    false,
  );
  assert.equal(
    inScope("https://example.com:8443/page", "https://example.com"),
    false,
  );
});

test("private targets require exact opt-in and cannot point to the hub itself", async () => {
  const url = new URL("http://127.0.0.1:55221/");
  await assert.rejects(validateTarget(url));
  await validateTarget(url, { allowedLocalOrigin: url.origin });
  await assert.rejects(
    validateTarget(url, { allowedLocalOrigin: "http://127.0.0.1:55222" }),
  );
  await assert.rejects(
    validateTarget(url, {
      allowedLocalOrigin: url.origin,
      hubOrigin: url.origin,
    }),
  );
  await assert.rejects(
    validateTarget(new URL("http://127.0.0.1:55221/api/bootstrap"), {
      demoOrigin: url.origin,
    }),
  );
});

test("authenticated DNS-pinning proxy refuses private destinations and forwards an explicit origin only", async () => {
  const destination = createServer((_req, res) => res.end("fixture"));
  await new Promise<void>((resolve) =>
    destination.listen(0, "127.0.0.1", resolve),
  );
  const address = destination.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  const proxy = await startAuditProxy({ allowedLocalOrigin: origin });
  const ask = (target: string, authenticate = true) =>
    new Promise<number>((resolve) => {
      const req = request(
        proxy.server,
        {
          path: target,
          headers: authenticate
            ? {
                "Proxy-Authorization": `Basic ${Buffer.from(`${proxy.username}:${proxy.password}`).toString("base64")}`,
              }
            : {},
        },
        (res) => {
          res.resume();
          res.on("end", () => resolve(res.statusCode!));
        },
      );
      req.end();
    });
  try {
    assert.equal(await ask(origin), 200);
    assert.equal(await ask(origin, false), 407);
    assert.equal(await ask("http://127.0.0.1:9/"), 403);
    assert.ok(proxy.blockedRequests() >= 1);
  } finally {
    await proxy.close();
    await new Promise<void>((resolve) => destination.close(() => resolve()));
  }
});

test(
  "twenty labelled browser fixtures, real axe, evidence and non-mutating bounded crawl",
  { timeout: 180_000 },
  async (t) => {
    let posts = 0;
    let excludedHits = 0;
    const server = createServer((req, res) => {
      if (req.method !== "GET") posts++;
      if (req.url === "/redirect-to-excluded") {
        res.writeHead(302, { location: "/never-visit" });
        return res.end();
      }
      if (req.url === "/never-visit") {
        excludedHits++;
        res.setHeader("content-type", "text/html");
        return res.end("<h1>Should not be reached</h1>");
      }
      if (req.url === "/") {
        res.setHeader("content-type", "text/html");
        return res.end(
          '<title>Index</title><a href="/clean">Clean</a><a href="/overflow#one">Overflow</a><a href="/overflow#two">Duplicate</a><a href="/logout">Logout</a><a href="https://other.invalid/">External</a><form method="post"><button>Submit</button></form>',
        );
      }
      const fixture = fixtures.find((item) => `/${item.name}` === req.url);
      if (!fixture) {
        res.writeHead(404);
        return res.end("Missing");
      }
      res.writeHead(fixture.status || 200, {
        "content-type": "text/html; charset=utf-8",
      });
      res.end(fixtureHTML(fixture));
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const origin = `http://127.0.0.1:${address.port}`;
    const directory = await mkdtemp(join(tmpdir(), "audit-engine-test-"));
    try {
      const events: WorkerEvent[] = [];
      const result = await runAudit(
        {
          id: "fixtures",
          url: origin,
          allowedLocalOrigin: origin,
          dataDir: directory,
          environment: "production",
          options: {
            pages: fixtures.map((item) => `${origin}/${item.name}`),
            maxPages: 20,
            maxDepth: 1,
            excludedPaths: [],
            viewports: [{ id: "desktop", width: 1000, height: 700 }],
            performance: false,
            performanceRuns: 1,
          },
        },
        (event) => events.push(event),
      );
      assert.equal(result.audit?.pages.length, 20);
      assert.equal(result.audit?.coverage.completed, 20);
      for (const fixture of fixtures) {
        const rule: RuleResult | undefined = result.audit!.rules.find(
          (item) =>
            item.pageUrl === `${origin}/${fixture.name}` &&
            item.ruleId === fixture.rule &&
            item.state === "initial",
        );
        assert.equal(
          rule?.status,
          fixture.expected,
          `${fixture.name}: ${fixture.rule}`,
        );
      }
      const matrix = {
        truePositive: 0,
        trueNegative: 0,
        falsePositive: 0,
        falseNegative: 0,
      };
      for (const fixture of fixtures.slice(0, 8))
        for (const ruleId of ["horizontal-overflow", "covered-control"]) {
          const expectedFailure =
            (fixture.name === "overflow" && ruleId === "horizontal-overflow") ||
            (fixture.name === "covered-button" && ruleId === "covered-control");
          const measuredFailure =
            result.audit!.rules.find(
              (item) =>
                item.pageUrl === `${origin}/${fixture.name}` &&
                item.ruleId === ruleId &&
                item.state === "initial",
            )?.status === "fail";
          if (expectedFailure && measuredFailure) matrix.truePositive++;
          else if (!expectedFailure && !measuredFailure) matrix.trueNegative++;
          else if (!expectedFailure && measuredFailure) matrix.falsePositive++;
          else matrix.falseNegative++;
        }
      assert.deepEqual(matrix, {
        truePositive: 2,
        trueNegative: 14,
        falsePositive: 0,
        falseNegative: 0,
      });
      t.diagnostic(
        `Internal layout regression matrix, NOT held-out real-world accuracy: ${JSON.stringify(matrix)}; 8 pages × 2 narrow rules.`,
      );
      assert.ok(
        result.audit!.findings.some(
          (item) =>
            item.ruleId === "clipped-text-candidate" &&
            item.evidenceStatus === "heuristic",
        ),
      );
      assert.equal(
        result.audit!.findings.some(
          (item) =>
            item.pageUrl.endsWith("/ellipsis") &&
            item.ruleId === "clipped-text-candidate",
        ),
        false,
      );
      assert.ok(
        result
          .audit!.rules.filter((item) => item.category === "performance")
          .every((item) => item.status === "not_run"),
      );
      assert.ok(events.some((item) => item.type === "frame"));
      assert.ok(events.some((item) => item.type === "checkpoint"));
      for (const event of events)
        if (event.type === "frame")
          for (const box of event.frame.rects) {
            const finding: Finding = result.audit!.findings.find(
              (item) => item.id === box.findingId,
            )!;
            assert.equal(finding.evidenceId, event.frame.id);
            assert.equal(finding.viewportId, event.frame.viewportId);
          }
      const discovered = await discoverPages({
        url: origin,
        allowedLocalOrigin: origin,
        maxPages: 3,
        maxDepth: 1,
      });
      assert.equal(discovered.urls.length, 3);
      assert.equal(
        discovered.urls.some(
          (url) => url.includes("logout") || url.includes("other.invalid"),
        ),
        false,
      );
      assert.equal(posts, 0);
      const redirectResult = await runAudit({
        id: "redirect-policy",
        url: origin,
        allowedLocalOrigin: origin,
        dataDir: directory,
        environment: "local",
        options: {
          pages: [`${origin}/clean`, `${origin}/redirect-to-excluded`],
          maxPages: 2,
          maxDepth: 0,
          excludedPaths: ["/never-visit"],
          viewports: [{ id: "desktop", width: 1000, height: 700 }],
          performance: false,
          performanceRuns: 1,
        },
      });
      assert.equal(
        redirectResult.audit!.pages.find((item) =>
          item.pageUrl.endsWith("/redirect-to-excluded"),
        )?.status,
        "failed",
      );
      assert.equal(
        excludedHits,
        0,
        "Redirect must be blocked before visiting an excluded document",
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  },
);
