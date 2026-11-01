/** Actual local browser/service acceptance. Only this owned fixture is scanned. */
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import assert from "node:assert/strict";
import { createApp } from "../server/app.js";
import { performScan } from "../server/scan-worker.js";
import { normalizeScanOptions } from "../server/options.js";
import { compareHistory } from "../server/services/baselines.js";
import { problemId } from "../server/services/problem-identity.js";
const preview = process.argv.includes("--preview"),
  directory = resolve(`.local-data/changes-2.4-${Date.now()}`);
await mkdir(directory, { recursive: true, mode: 0o700 });
let bad = true;
const fixture = createServer((_req, res) => {
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.end(
    `<!doctype html><html lang="de"><head><title>Northstar Studio</title><meta name="viewport" content="width=device-width,initial-scale=1">${bad ? "" : '<meta name="description" content="Kontrollierte lokale Referenz für den Änderungsverlauf.">'}<style>body{font:18px system-ui;color:#29233c;background:#faf7f2;margin:0;padding:32px;min-height:1700px}#wide{width:${bad ? "680px" : "100%"};box-sizing:border-box;padding:24px;border:2px solid #29233c;background:#e4def4}h1{font-size:32px}p{line-height:1.6}</style></head><body><main><h1>Northstar Studio</h1><p>Eigene lokale Testseite für nachvollziehbare Messungen.</p><div id="wide">Ein klarer Blick auf Veränderungen.</div></main></body></html>`,
  );
});
await new Promise<void>((done) => fixture.listen(0, "127.0.0.1", done));
const address = fixture.address();
assert.ok(address && typeof address !== "string");
const url = `http://127.0.0.1:${address.port}/`;
const reservation = createServer();
await new Promise<void>((done) => reservation.listen(0, "127.0.0.1", done));
const reserved = reservation.address();
assert.ok(reserved && typeof reserved !== "string");
const port = preview ? 4328 : reserved.port;
await new Promise<void>((done) => reservation.close(() => done()));
const { app, store } = await createApp({
  port,
  dataDir: directory,
  runJobs: false,
});
try {
  const project = store.createProject(
      "Northstar Studio · Änderungsverlauf",
      url,
      "local",
    ),
    options = normalizeScanOptions(
      { pages: [url], viewports: ["mobile"], performance: false },
      url,
    );
  const scans = [];
  for (const [index, broken] of [true, false, false, true].entries()) {
    bad = broken;
    const scan = store.createScan(project.id, options);
    const result = await performScan({
      id: scan.id,
      url,
      dataDir: directory,
      environment: "local",
      allowedLocalOrigin: new URL(url).origin,
      hubOrigin: `http://127.0.0.1:${port}`,
      options,
    });
    store.finish(scan.id, result);
    store.annotateScan(scan.id, {
      name: [
        "1 · Ausgangscheck",
        "2 · Korrektur",
        "3 · Kontrollmessung",
        "4 · Wieder aufgetreten",
      ][index]!,
      profileName: "Mobile QA · 390 × 844",
    });
    scans.push(store.scan(scan.id)!);
    console.log(
      JSON.stringify({
        step: index + 1,
        findings: result.audit!.findings.length,
        status: "completed",
      }),
    );
  }
  const fixed = compareHistory(store, scans[0]!, scans[1]!),
    recur = compareHistory(store, scans[2]!, scans[3]!);
  assert.equal(fixed.level, "exact");
  assert.ok(
    fixed.entries.length > 0 &&
      fixed.entries.some((e) => e.state === "resolved") &&
      fixed.entries.every((e) =>
        ["resolved", "not-retested"].includes(e.state),
      ),
  );
  for (const entry of fixed.entries) {
    const returned = recur.entries.find(
      (e) => e.problemId === entry.problemId,
    )!;
    assert.ok(returned);
    assert.equal(
      returned.state,
      entry.state === "resolved" ? "recurrent" : "history-uncertain",
    );
  }
  for (const old of scans[0]!.result!.audit!.findings) {
    const current = scans[3]!.result!.audit!.findings.find(
      (f) => problemId(project.id, f) === problemId(project.id, old),
    );
    assert.ok(current);
    assert.notEqual(current.id, old.id);
  }
  const summary = {
    kind: "actual-owned-browser-acceptance-2.4",
    measurementIdentity: scans[0]!.result!.audit!.provenance!.measurement,
    scope: { pages: 1, profiles: options.viewports },
    steps: scans.map((s, i) => ({
      step: i + 1,
      findings: s.result!.audit!.findings.length,
    })),
    fixStates: fixed.entries.map((e) => e.state),
    recurrentStates: recur.entries.map((e) => e.state),
    comparisonLevels: [fixed.level, recur.level],
    scoreDeltas: [fixed.scoreDelta, recur.scoreDelta],
    meaning:
      "Actual owned local fixture, browser measurements and persisted service data; no customer sites, model inference or independent human qualification.",
  };
  await writeFile(
    join(directory, "acceptance.json"),
    JSON.stringify(summary, null, 2) + "\n",
  );
  if (preview) {
    await app.listen({ host: "127.0.0.1", port });
    console.log(
      JSON.stringify({
        preview: `http://127.0.0.1:${port}/?project=${project.id}&scan=${scans[3]!.id}&view=compare`,
        directory,
        scans: scans.map((s) => s.id),
      }),
    );
    for (const signal of ["SIGINT", "SIGTERM"] as const)
      process.once(signal, () => {
        void app.close().finally(() => fixture.close(() => process.exit(0)));
      });
  } else {
    console.log(JSON.stringify(summary));
    await app.close();
    fixture.close();
  }
} catch (e) {
  await app.close();
  fixture.close();
  throw e;
}
