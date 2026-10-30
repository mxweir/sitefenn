import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { normalizeScanOptions } from "../server/options.js";
import { performScan } from "../server/scan-worker.js";
import { createApp } from "../server/app.js";
import { journeyState } from "../server/services/journeys.js";
import { compareScans } from "../server/services/comparison.js";
import { visualPairs } from "../server/services/visual.js";
import {
  buildJsonReport,
  buildMarkdownReport,
} from "../server/services/reports.js";
import { preparePage } from "../server/services/page-analysis.js";
import type { Journey, JourneyStep, Scan } from "../shared/types.js";
const click = (
  selector: string,
  target: string,
  condition: JourneyStep["expect"]["condition"] = "visible",
): JourneyStep => ({
  action: "click",
  selector,
  expect: { selector: target, condition },
});
const recipe = (
  url: string,
  id = "menu",
  steps: JourneyStep[] = [click("#toggle", "#menu")],
): Journey => ({
  id,
  name: id === "menu" ? "Mobilmenü öffnen" : id,
  pageUrl: url,
  viewportIds: ["mobile"],
  confirmed: true,
  steps,
});
test("explicit recipes validate approval, action/selector scope, selected pages/devices and bounded workload", () => {
  const url = "https://example.test/",
    j = recipe(url);
  const options = { pages: [url], viewports: ["mobile"], journeys: [j] };
  assert.equal(
    normalizeScanOptions(options, url).journeys?.[0]?.confirmed,
    true,
  );
  for (const patch of [
    { confirmed: false },
    { steps: [{ action: "script", code: "x" }] },
    { pageUrl: "https://other.test/" },
    { viewportIds: ["desktop"] },
    { id: "bad:id" },
    { steps: [click("#buy-now", "#menu")] },
    { timeoutMs: 300000 },
    { steps: [click("button >> iframe", "#menu")] },
    { steps: Array.from({ length: 6 }, () => click("#toggle", "#menu")) },
  ])
    assert.throws(() =>
      normalizeScanOptions({ ...options, journeys: [{ ...j, ...patch }] }, url),
    );
  assert.throws(() =>
    normalizeScanOptions({ ...options, journeys: [j, j] }, url),
  );
  assert.throws(() =>
    normalizeScanOptions(
      {
        pages: ["https://example.test/checkout"],
        viewports: ["mobile"],
        journeys: [recipe("https://example.test/checkout")],
      },
      url,
    ),
  );
  assert.throws(() =>
    normalizeScanOptions(
      {
        pages: [url],
        viewports: ["desktop", "tablet", "mobile"],
        journeys: [
          {
            ...j,
            viewportIds: ["desktop", "tablet", "mobile"],
            steps: Array.from({ length: 5 }, () => click("#toggle", "#menu")),
          },
          {
            ...j,
            id: "next",
            viewportIds: ["desktop", "tablet", "mobile"],
            steps: [click("#toggle", "#menu"), click("#toggle", "#menu")],
          },
        ],
      },
      url,
    ),
  );
});
async function fixture() {
  let fixed = false;
  const requests: { url: string; method: string }[] = [];
  const server = createServer((req, res) => {
    requests.push({ url: req.url!, method: req.method! });
    res.setHeader("content-type", "text/html");
    res.end(
      `<!doctype html><html lang="de"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Eigene Zustands-Fixture</title><meta name="description" content="Eigener kontrollierter Interaktionstest"><style>*{box-sizing:border-box}body{margin:16px;color:#182820;background:#f6f4ed;font:18px Arial}main{min-height:1800px}button,summary{padding:12px;margin:6px 0}#menu{width:${fixed ? "100%" : "680px"};padding:22px;background:#ded5ed}#menu[hidden]{display:none}dialog{max-width:80%;padding:30px}#faq{margin:20px 0}</style></head><body><main><h1>Seitenzustände</h1><button type="button" id="toggle" aria-expanded="false" aria-controls="menu" onclick="menu.hidden=!menu.hidden;this.setAttribute('aria-expanded',String(!menu.hidden))">Menü öffnen/schließen</button><section id="menu" hidden><h2>Geöffnetes Menü</h2><p>Kontrollierter Überlauf nur im offenen Zustand.</p></section><details id="faq"><summary id="faq-toggle">Mehr erfahren</summary><p>Ausdrücklich geöffneter Inhalt.</p></details><button type="button" id="show-dialog" aria-controls="info" aria-haspopup="dialog" onclick="info.showModal()">Info öffnen</button><dialog id="info" aria-labelledby="info-title"><h2 id="info-title">Ein Dialog</h2><button type="button" aria-controls="info" onclick="info.close()">Schließen</button></dialog><form action="/mutation"><button type="button" id="unsafe" aria-controls="menu" aria-expanded="false" onclick="fetch('/mutation')">Formularaktion</button></form><button type="button" id="network" aria-controls="menu" aria-expanded="false" onclick="menu.hidden=false;fetch('/mutation',{method:'POST'}).catch(()=>{})">Netzwerk-Fixture</button><button type="button" id="navigation" aria-controls="menu" aria-expanded="false" onclick="menu.hidden=false;location.href='/destination'">Navigation-Fixture</button><button type="button" id="get-change" aria-controls="menu" aria-expanded="false" onclick="menu.hidden=false;fetch('/delete/item').catch(()=>{})">GET-Fixture</button><button type="button" id="spa" aria-controls="menu" aria-expanded="false" onclick="menu.hidden=false;history.pushState(null,'','/other')">SPA-Fixture</button></main></body></html>`,
    );
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return {
    url: `http://127.0.0.1:${address.port}/`,
    requests,
    fix: () => (fixed = true),
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}
async function reserve() {
  const s = createServer();
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
  const a = s.address();
  assert.ok(a && typeof a !== "string");
  await new Promise<void>((r) => s.close(() => r()));
  return a.port;
}
test(
  "real worker/API captures menu, accordion, scroll and dialog states; only a matching corrected-state retest verifies the action",
  { timeout: 120000 },
  async () => {
    const f = await fixture(),
      directory = await mkdtemp(join(tmpdir(), "sitefenn-journey-")),
      port = await reserve();
    const { app, store, runner } = await createApp({
      port,
      dataDir: directory,
    });
    await app.listen({ host: "127.0.0.1", port });
    try {
      const host = `127.0.0.1:${port}`,
        home = await app.inject({ url: "/", headers: { host } }),
        headers = {
          host,
          cookie: String(home.headers["set-cookie"]).split(";")[0],
          origin: `http://${host}`,
          "x-hub-request": "1",
        };
      const post = async (url: string, payload?: unknown) => {
        const r = await app.inject({
          url,
          method: "POST",
          headers,
          ...(payload
            ? {
                payload: JSON.stringify(payload),
                headers: { ...headers, "content-type": "application/json" },
              }
            : {}),
        });
        assert.ok(r.statusCode < 400, r.body);
        return r.json();
      };
      const project = store.createProject("Owned state test", f.url, "local");
      const journeys = [
        recipe(f.url, "menu", [
          click("#toggle", "#menu"),
          click("#toggle", "#menu", "hidden"),
        ]),
        recipe(f.url, "faq", [
          click("#faq-toggle", "#faq", "open"),
          {
            action: "scroll",
            y: 600,
            expect: { selector: "#faq", condition: "open" },
          },
        ]),
        recipe(f.url, "dialog", [click("#show-dialog", "#info", "open")]),
      ];
      const wait = async (id: string) => {
        for (let i = 0; i < 1000; i++) {
          const scan = store.scan(id)!;
          if (scan.status === "failed") throw Error(scan.error!);
          if (scan.status === "completed" && !runner.isBusy()) return scan;
          await delay(50);
        }
        throw Error("Timed out");
      };
      const started = await post(`/api/projects/${project.id}/scans`, {
        pages: [f.url],
        maxPages: 1,
        maxDepth: 0,
        viewports: ["mobile"],
        performance: false,
        journeys,
      });
      const before = await wait(started.scan.id),
        report = before.result!.audit!;
      assert.equal(report.coverage.completed, 1);
      assert.equal(report.coverage.planned, 1);
      assert.equal(report.journeyRuns?.length, 3);
      for (const run of report.journeyRuns!) {
        assert.equal(run.status, "completed", JSON.stringify(run));
        for (const step of run.steps) {
          assert.ok(step.beforeId && step.afterId);
          assert.equal(
            report.evidence.find((e) => e.id === step.afterId)?.capture
              ?.stateReady,
            true,
          );
        }
      }
      const state = journeyState(journeys[0]!, 0),
        closed = journeyState(journeys[0]!, 1);
      assert.equal(
        report.rules.find(
          (r) => r.ruleId === "horizontal-overflow" && r.state === "initial",
        )?.status,
        "pass",
      );
      assert.equal(
        report.rules.find(
          (r) => r.ruleId === "horizontal-overflow" && r.state === state,
        )?.status,
        "fail",
      );
      assert.equal(
        report.rules.find(
          (r) => r.ruleId === "horizontal-overflow" && r.state === closed,
        )?.status,
        "pass",
      );
      const finding = report.findings.find(
        (f) => f.ruleId === "horizontal-overflow" && f.state === state,
      )!;
      assert.ok(finding);
      const screenshot = report.evidence.find(
        (e) => e.id === finding.evidenceId,
      )!;
      assert.ok(
        (await readFile(join(directory, screenshot.path))).length > 100,
      );
      const prepared = preparePage(report, f.url);
      assert.ok(prepared.units.some((u) => u.id.startsWith("journey-step:")));
      const withImages = JSON.parse(
        buildJsonReport(project, before, undefined, { includeEvidence: true }),
      );
      assert.ok(withImages.journeys[0].steps[0].beforeId);
      assert.match(
        buildMarkdownReport(project, before, undefined, {
          includeEvidence: true,
        }),
        /Before screenshot/,
      );
      assert.ok(
        withImages.evidence.some(
          (e: { id: string }) =>
            e.id === report.journeyRuns![0]!.steps[0]!.beforeId,
        ),
      );
      const exported = JSON.parse(buildJsonReport(project, before));
      assert.equal(exported.journeys.length, 3);
      assert.equal(exported.journeys[0].steps[0].beforeId, undefined);
      assert.match(
        buildMarkdownReport(project, before),
        /Approved page states/,
      );
      await app.inject({ url: `/api/scans/${before.id}`, headers });
      const task = store
        .tasks(before.id)
        .find((t) => t.findingIds.includes(finding.id))!;
      assert.ok(task);
      f.fix();
      const next = await post(`/api/tasks/${task.id}/retest`),
        after = await wait(next.scan.id);
      assert.ok(after.options?.journeys?.some((j) => j.id === "menu"));
      assert.equal(after.options?.journeys?.length, 1);
      assert.equal(store.task(task.id)?.status, "verified");
      assert.equal(
        after.result?.audit?.rules.find(
          (r) => r.ruleId === "horizontal-overflow" && r.state === state,
        )?.status,
        "pass",
      );
      assert.equal(compareScans(before, after).comparable, false);
      const changed = structuredClone(after);
      changed.result!.audit!.journeyRuns![0]!.steps[0]!.status = "unknown";
      assert.ok(
        !compareScans(before, changed).entries.some(
          (item) =>
            item.beforeFindingId === finding.id && item.state === "resolved",
        ),
      );
      const altered = structuredClone(after);
      for (const e of altered.result!.audit!.evidence.filter(
        (e) => e.state === state,
      ))
        e.capture!.stateReady = false;
      assert.equal(
        visualPairs(before, altered).find((p) => p.before.state === state)
          ?.comparable,
        false,
      );
      const renamed = await post(`/api/projects/${project.id}/scans`, {
        pages: [f.url],
        viewports: ["mobile"],
        performance: false,
        journeys: [{ ...journeys[0]!, name: "Geänderter Ablauf" }],
      });
      const different = await wait(renamed.scan.id);
      assert.equal(
        visualPairs(before, different).find((p) => p.before.state === state)
          ?.comparable,
        false,
      );
      assert.ok(
        !compareScans(before, different).entries.some(
          (e) => e.beforeFindingId === finding.id && e.state === "resolved",
        ),
      );
      const pending = structuredClone(report);
      pending.journeyRuns![0]!.status = "not_run";
      const resumed = await performScan({
        id: "resumed",
        url: f.url,
        allowedLocalOrigin: new URL(f.url).origin,
        dataDir: directory,
        environment: "local",
        options: report.options,
        resumeReport: pending,
      });
      assert.equal(resumed.audit?.coverage.completed, 1);
      assert.equal(resumed.audit?.journeyRuns?.[0]?.status, "completed");
      assert.notEqual(
        resumed.audit?.journeyRuns?.[0]?.steps[0]?.afterId,
        report.journeyRuns?.[0]?.steps[0]?.afterId,
      );
    } finally {
      await app.close();
      await f.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
);
test(
  "actual forbidden form action, missing target and blocked POST leave steps unknown with no false pass or request",
  { timeout: 60000 },
  async () => {
    const f = await fixture(),
      directory = await mkdtemp(join(tmpdir(), "sitefenn-state-unknown-"));
    try {
      const journeys = [
        recipe(f.url, "form", [
          click("#unsafe", "#menu"),
          click("#toggle", "#menu"),
        ]),
        recipe(f.url, "missing", [click("#absent", "#menu")]),
        recipe(f.url, "network", [click("#network", "#menu")]),
      ];
      const options = normalizeScanOptions(
        { pages: [f.url], viewports: ["mobile"], performance: false, journeys },
        f.url,
      );
      const result = await performScan({
        id: "unknown",
        url: f.url,
        allowedLocalOrigin: new URL(f.url).origin,
        dataDir: directory,
        options,
      });
      for (const run of result.audit!.journeyRuns!) {
        assert.equal(run.status, "unknown");
        assert.equal(run.steps[0]?.status, "unknown");
        assert.equal(
          result.audit!.rules.find(
            (r) =>
              r.ruleId === "horizontal-overflow" &&
              r.state === run.steps[0]!.state,
          )?.status,
          "not_run",
        );
      }
      assert.equal(result.audit!.journeyRuns![0]!.steps[1]?.status, "not_run");
      assert.equal(
        f.requests.some((r) => r.url === "/mutation"),
        false,
      );
      assert.ok(
        result.audit!.evidence.some((e) => e.capture?.stateReady === false),
      );
    } finally {
      await f.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
);
test(
  "actual UI handlers cannot navigate to a new document or contact an obvious mutating GET during a journey",
  { timeout: 60000 },
  async () => {
    const f = await fixture(),
      directory = await mkdtemp(join(tmpdir(), "sitefenn-state-boundary-"));
    try {
      const options = normalizeScanOptions(
        {
          pages: [f.url],
          viewports: ["mobile"],
          performance: false,
          journeys: [
            recipe(f.url, "navigation", [click("#navigation", "#menu")]),
            recipe(f.url, "get", [click("#get-change", "#menu")]),
            recipe(f.url, "spa", [click("#spa", "#menu")]),
          ],
        },
        f.url,
      );
      const result = await performScan({
        id: "boundary",
        url: f.url,
        allowedLocalOrigin: new URL(f.url).origin,
        dataDir: directory,
        options,
      });
      assert.ok(
        result.audit!.journeyRuns!.every((r) => r.status === "unknown"),
      );
      assert.equal(
        f.requests.some(
          (r) => r.url === "/destination" || r.url === "/delete/item",
        ),
        false,
      );
    } finally {
      await f.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
);

test(
  "a real browser context closes at the recipe deadline and cannot report a completed state",
  { timeout: 15000 },
  async () => {
    const { chromium } = await import("playwright");
    const { executeJourney, plannedJourney } =
      await import("../server/services/journeys.js");
    const f = await fixture(),
      browser = await chromium.launch({ chromiumSandbox: true });
    try {
      const context = await browser.newContext(),
        page = await context.newPage();
      await page.goto(f.url);
      const j = recipe(f.url),
        run = plannedJourney(j, "mobile");
      await executeJourney(j, run, page, {
        timeoutMs: 150,
        checkpoint: async () => {},
        blocked: () => false,
        progress: () => {},
        settle: async () => {
          await page.waitForTimeout(2000);
        },
        capture: async (state, ready) => {
          await page.screenshot();
          return {
            id: state,
            path: "test-only.png",
            pageUrl: f.url,
            viewportId: "mobile",
            width: 1280,
            height: 720,
            scrollX: 0,
            scrollY: 0,
            state,
            capturedAt: new Date().toISOString(),
          };
        },
      });
      assert.equal(run.status, "unknown");
      assert.equal(run.steps[0]?.status, "unknown");
      assert.equal(page.isClosed(), true);
      assert.match(run.steps[0]?.detail ?? "", /Zeitlimit/);
    } finally {
      await browser.close();
      await f.close();
    }
  },
);
