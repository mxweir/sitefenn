import { validateReport } from "../shared/report-contract.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { PNG } from "pngjs";
import { createServer } from "node:http";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  diffPng,
  visualPairs,
  validateMasks,
} from "../server/services/visual.js";
import { createApp } from "../server/app.js";
import { compareScans } from "../server/services/comparison.js";
import { buildJsonReport } from "../server/services/reports.js";
import { Store } from "../server/store.js";
import { createBackup, restoreBackup } from "../server/backup.js";
import type { Scan } from "../shared/types.js";
function png(width = 64, height = 64) {
  const p = new PNG({ width, height });
  p.data.fill(255);
  return p;
}
test("pixel differences respect tolerance and explicit masks; all-masked, oversize and invalid inputs are refused", () => {
  const a = png(),
    b = png();
  b.data.set([200, 0, 0, 255], (10 * 64 + 12) * 4);
  const raw = diffPng(PNG.sync.write(a), PNG.sync.write(b));
  assert.equal(raw.changedPixels, 1);
  assert.equal(raw.regions.length, 1);
  assert.equal(raw.comparedPixels, 4096);
  const masked = diffPng(PNG.sync.write(a), PNG.sync.write(b), [
    { x: 12, y: 10, width: 1, height: 1 },
  ]);
  assert.equal(masked.changedPixels, 0);
  assert.equal(masked.maskedPixels, 1);
  assert.equal(masked.comparedPixels, 4095);
  assert.throws(
    () =>
      diffPng(PNG.sync.write(a), PNG.sync.write(b), [
        { x: 0, y: 0, width: 64, height: 64 },
      ]),
    /gesamte/,
  );
  assert.throws(
    () => diffPng(PNG.sync.write(a), PNG.sync.write(png(2, 2))),
    /Bildgrößen/,
  );
  assert.throws(() => diffPng(new Uint8Array(2), PNG.sync.write(b)), /PNG/);
  assert.throws(
    () =>
      validateMasks(
        [{ evidenceId: "unknown", rect: { x: 0, y: 0, width: 1, height: 1 } }],
        [],
      ),
    /Maske/,
  );
});

test(
  "actual local browser retest verifies a corrected finding, preserves an omitted page and saves a portable visual reference",
  { timeout: 90000 },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), "sitefenn-1.3-"));
    let fixed = false;
    const fixture = createServer((req, res) => {
      res.setHeader("content-type", "text/html");
      res.end(
        `<!doctype html><html lang="de"><head>${req.url === "/one" && !fixed ? "" : "<title>Eigene Nachtest-Website</title>"}${req.url === "/two" ? "" : '<meta name="description" content="Lokaler Test">'}<style>body{margin:20px;font:20px sans-serif;background:${fixed ? "#ddeeff" : "#fff"};color:#111}main{max-width:600px;padding:30px;border:3px solid #111}</style></head><body><main><h1>Eigene Nachtest-Website</h1><p>Kontrollierte lokale Inhalte, keine externen Dienste.</p></main></body></html>`,
      );
    });
    await new Promise<void>((done) => fixture.listen(0, "127.0.0.1", done));
    const address = fixture.address();
    assert.ok(address && typeof address !== "string");
    const origin = `http://127.0.0.1:${address.port}`;
    const reservation = createServer();
    await new Promise<void>((done) => reservation.listen(0, "127.0.0.1", done));
    const hub = reservation.address();
    assert.ok(hub && typeof hub !== "string");
    const port = hub.port;
    await new Promise<void>((done) => reservation.close(() => done()));
    const { app, store, runner } = await createApp({
      port,
      dataDir: directory,
    });
    await app.listen({ host: "127.0.0.1", port });
    try {
      const host = `127.0.0.1:${port}`,
        home = await app.inject({ url: "/", headers: { host } }),
        cookie = String(home.headers["set-cookie"]).split(";")[0];
      const headers = {
        host,
        cookie,
        origin: `http://${host}`,
        "x-hub-request": "1",
      };
      const project = store.createProject(
        "Owned retest fixture",
        origin + "/one",
        "local",
      );
      const started = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/scans`,
        headers,
        payload: {
          pages: [origin + "/one", origin + "/two"],
          viewports: ["mobile"],
          performance: false,
        },
      });
      assert.equal(started.statusCode, 202, started.body);
      const wait = async (id: string) => {
        for (let i = 0; i < 600; i++) {
          const scan = store.scan(id)!;
          if (["completed", "failed", "cancelled"].includes(scan.status)) {
            assert.equal(scan.status, "completed", scan.error ?? "");
            if (runner.isBusy()) {
              await delay(25);
              continue;
            }
            return scan;
          }
          await delay(100);
        }
        throw new Error("Scan timed out");
      };
      const before = await wait(started.json().scan.id),
        report = before.result!.audit!;
      await app.inject({ url: `/api/scans/${before.id}`, headers });
      const title = report.findings.find((f) => f.ruleId === "document-title")!;
      assert.ok(title);
      const task = store
        .tasks(before.id)
        .find((t) => t.findingIds.includes(title.id))!;
      const omitted = report.findings.find(
        (f) => f.ruleId === "meta-description" && f.pageUrl.endsWith("/two"),
      )!;
      assert.ok(omitted);
      const mask = {
        evidenceId: report.evidence[0]!.id,
        rect: { x: 0, y: 0, width: 10, height: 10 },
      };
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: `/api/projects/${project.id}/visual-references`,
            headers,
            payload: { scanId: before.id, masks: [mask] },
          })
        ).statusCode,
        400,
      );
      const approved = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/visual-references`,
        headers,
        payload: { scanId: before.id, masks: [mask], confirmed: true },
      });
      assert.equal(approved.statusCode, 201, approved.body);
      fixed = true;
      const next = await app.inject({
        method: "POST",
        url: `/api/tasks/${task.id}/retest`,
        headers,
      });
      assert.equal(next.statusCode, 202, next.body);
      assert.deepEqual(next.json().scan.options.pages, [origin + "/one"]);
      assert.equal(next.json().scan.options.viewports.length, 1);
      const after = await wait(next.json().scan.id);
      const comparison = compareScans(before, after);
      assert.equal(comparison.partial, true);
      assert.equal(comparison.comparable, false);
      assert.equal(comparison.scoreDelta, null);
      assert.equal(
        comparison.entries.find((e) => e.beforeFindingId === title.id)?.state,
        "resolved",
        JSON.stringify({
          before: validateReport(before.result!.audit!),
          after: validateReport(after.result!.audit!),
        }),
      );
      assert.equal(
        comparison.entries.find((e) => e.beforeFindingId === omitted.id)?.state,
        "not-retested",
      );
      assert.equal(store.task(task.id)?.status, "verified");
      assert.equal(store.task(task.id)?.verifiedByScanId, after.id);
      assert.equal(
        store.activeTasks().some((t) => t.scanId === after.id),
        false,
      );
      assert.ok(store.activeTasks().some((t) => t.scanId === before.id));
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: `/api/projects/${project.id}/visual-references`,
            headers,
            payload: { scanId: after.id, confirmed: true },
          })
        ).statusCode,
        400,
      );
      const pairs = visualPairs(before, after);
      const pair = pairs.find((p) => p.before.id === mask.evidenceId)!;
      assert.equal(pair.comparable, true, pair.reason);
      assert.ok(pairs.some((p) => !p.after));
      const response = await app.inject({
        method: "POST",
        url: "/api/visual-diff",
        headers,
        payload: {
          beforeId: before.id,
          afterId: after.id,
          evidenceId: pair.before.id,
          masks: [mask],
        },
      });
      assert.equal(response.statusCode, 200, response.body.slice(0, 200));
      assert.ok(response.json().diff.changedPixels > 0);
      assert.equal(response.json().diff.maskedPixels, 100);
      const changed = structuredClone(after);
      changed.result!.audit!.browserVersion = "changed";
      assert.equal(visualPairs(before, changed)[0]?.comparable, false);
      const noFonts = structuredClone(after);
      noFonts.result!.audit!.evidence.forEach((e) => {
        if (e.capture) e.capture.fontsReady = false;
      });
      assert.equal(visualPairs(before, noFonts)[0]?.comparable, false);
      const moved = structuredClone(after);
      moved.result!.audit!.evidence[0]!.scrollY += 100;
      assert.equal(visualPairs(before, moved)[0]?.comparable, false);
      const legacy = structuredClone(before);
      legacy.result!.audit!.evidence.forEach((e) => delete e.capture);
      assert.equal(visualPairs(legacy, after)[0]?.comparable, false);
      const redirect = structuredClone(after);
      redirect.result!.audit!.pages.forEach(
        (page) => (page.finalUrl = origin + "/other-document"),
      );
      assert.notEqual(
        compareScans(before, redirect).entries.find(
          (e) => e.beforeFindingId === title.id,
        )?.state,
        "resolved",
      );
      const stopped = structuredClone(after);
      stopped.status = "cancelled";
      assert.notEqual(
        compareScans(before, stopped).entries.find(
          (e) => e.beforeFindingId === title.id,
        )?.state,
        "resolved",
      );
      const exportResult = await app.inject({
        url: `/api/scans/${after.id}/export?format=markdown`,
        headers,
      });
      assert.match(exportResult.body, /PARTIAL RETEST/);
      const jsonExport = await app.inject({
        url: `/api/scans/${after.id}/export?format=json`,
        headers,
      });
      assert.equal(jsonExport.json().scan.retest.taskId, task.id);
      assert.equal(jsonExport.json().scan.scopeKind, "targeted-retest");
      const exportCopy = structuredClone(before);
      exportCopy.result!.audit!.evidence[0]!.capture!.documentUrl =
        origin + "/one?session=private#fragment";
      const safeJson = JSON.parse(
        buildJsonReport(project, exportCopy, store.tasks(before.id), {
          includeEvidence: true,
        }),
      );
      assert.equal(safeJson.evidence[0].capture.documentUrl, origin + "/one");
      assert.ok(!JSON.stringify(safeJson).includes("session=private"));
      const repeatFull = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/scans`,
        headers,
        payload: {
          pages: [origin + "/one", origin + "/two"],
          viewports: ["mobile"],
          performance: false,
        },
      });
      assert.equal(repeatFull.statusCode, 202, repeatFull.body);
      await wait(repeatFull.json().scan.id);
      assert.equal(
        store.task(task.id)?.verifiedByScanId,
        after.id,
        "A later full scan must not rewrite the original verification proof",
      );
      const zip = join(directory, "test-backup.zip"),
        restored = join(directory, "restored");
      await writeFile(zip, await createBackup(store));
      await restoreBackup(await readFile(zip), restored);
      const copy = new Store(restored);
      try {
        assert.deepEqual(
          copy.visualReferences(project.id),
          store.visualReferences(project.id),
        );
        assert.equal(
          copy.scan(after.id)?.options?.retest?.sourceScanId,
          before.id,
        );
      } finally {
        copy.close();
      }
    } finally {
      await app.close();
      await new Promise<void>((done) => fixture.close(() => done()));
      await rm(directory, { recursive: true, force: true });
    }
  },
);
