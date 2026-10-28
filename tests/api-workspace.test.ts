import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unzipSync } from "fflate";
import { createApp } from "../server/app.js";
import { restoreBackup } from "../server/backup.js";
import { Store } from "../server/store.js";
import type {
  AuditReport,
  AuditTask,
  Project,
  Scan,
  SearchDataset,
  SearchImportMetadata,
} from "../shared/types.js";

/** Actual Fastify routes and SQLite, no HTTP/model mocks and no browser jobs. */
async function workspace() {
  const directory = await mkdtemp(join(tmpdir(), "sitefenn-api-workspace-"));
  const runtime = await createApp({
    port: 4327,
    dataDir: join(directory, "source"),
    runJobs: false,
  });
  const host = "127.0.0.1:4327";
  const home = await runtime.app.inject({ url: "/", headers: { host } });
  assert.equal(home.statusCode, 200);
  const cookie = String(home.headers["set-cookie"]).split(";")[0]!;
  const headers = {
    host,
    cookie,
    origin: `http://${host}`,
    "x-hub-request": "1",
  };
  const project = runtime.store.createProject(
    "API workspace fixture",
    "https://example.test/",
    "production",
  );
  return {
    ...runtime,
    directory,
    headers,
    project,
    async close() {
      await runtime.app.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}

const metadata = (
  startDate = "2026-01-01",
  endDate = "2026-01-02",
  filters: Record<string, string> | null = {},
): SearchImportMetadata => ({
  property: "sc-domain:example.test",
  startDate,
  endDate,
  dimension: "date",
  filters,
});
const csv = (date: string, clicks = 10, impressions = 100) =>
  `Date,Clicks,Impressions,CTR,Position\n${date},${clicks},${impressions},10%,3.5`;

test("Search Console API persists CSV imports and compares only declared matching periods/filters", async () => {
  const hub = await workspace();
  try {
    const url = `/api/projects/${hub.project.id}/search`;
    const importDataset = async (
      csvText: string,
      meta: SearchImportMetadata,
    ) => {
      const response = await hub.app.inject({
        method: "POST",
        url,
        headers: hub.headers,
        payload: { csv: csvText, metadata: meta },
      });
      assert.equal(response.statusCode, 200, response.body);
      return response.json<{ dataset: SearchDataset }>().dataset;
    };
    const before = await importDataset(csv("2026-01-01"), metadata());
    const after = await importDataset(
      csv("2026-01-03", 20, 200),
      metadata("2026-01-03", "2026-01-04"),
    );
    assert.equal(
      before.summary.position,
      null,
      "The API must not invent an aggregate Google position.",
    );
    assert.equal(before.rows[0]?.position, 3.5);
    const compareUrl = `${url}/compare?before=${before.id}&after=${after.id}`;
    const compared = await hub.app.inject({
      url: compareUrl,
      headers: hub.headers,
    });
    assert.equal(compared.statusCode, 200, compared.body);
    assert.deepEqual(compared.json(), {
      compatible: true,
      reason:
        "Comparison of exported daily rows only; no causal or ranking guarantee.",
      clicksDelta: 10,
      impressionsDelta: 100,
      ctrDelta: 0,
    });
    const unknown = await importDataset(
      csv("2026-01-05"),
      metadata("2026-01-05", "2026-01-06", null),
    );
    const incompatible = await hub.app.inject({
      url: `${url}/compare?before=${before.id}&after=${unknown.id}`,
      headers: hub.headers,
    });
    assert.equal(incompatible.statusCode, 200);
    assert.equal(incompatible.json().compatible, false);
    assert.equal(incompatible.json().clicksDelta, null);
    assert.equal(incompatible.json().impressionsDelta, null);
    assert.equal(incompatible.json().ctrDelta, null);
    const listed = await hub.app.inject({ url, headers: hub.headers });
    assert.equal(listed.statusCode, 200);
    assert.equal(
      listed.json<{ datasets: SearchDataset[] }>().datasets.length,
      3,
    );
    const invalid = await hub.app.inject({
      method: "POST",
      url,
      headers: hub.headers,
      payload: { csv: "Unexpected,Columns\na,b", metadata: metadata() },
    });
    assert.equal(invalid.statusCode, 400);
    assert.equal(
      hub.store.searchDatasets(hub.project.id).length,
      3,
      "A failed import must not create a dataset.",
    );
    const wrongProject = hub.store.createProject(
      "Other",
      "https://other.test/",
      "production",
    );
    const crossProject = await hub.app.inject({
      url: `/api/projects/${wrongProject.id}/search/compare?before=${before.id}&after=${after.id}`,
      headers: hub.headers,
    });
    assert.equal(
      crossProject.statusCode,
      400,
      "Imports cannot be borrowed from a different project.",
    );
  } finally {
    await hub.close();
  }
});

test("settings API disables speech and rejects invalid model names without altering settings", async () => {
  const hub = await workspace();
  try {
    hub.store.updateSettings({ speechEnabled: true });
    const disabled = await hub.app.inject({
      method: "PATCH",
      url: "/api/settings",
      headers: hub.headers,
      payload: { speechEnabled: false },
    });
    assert.equal(disabled.statusCode, 200, disabled.body);
    assert.deepEqual(disabled.json(), {
      settings: { model: "", speechEnabled: false },
    });
    for (const model of ["model;untrusted-command", "../ model", 12]) {
      const rejected = await hub.app.inject({
        method: "PATCH",
        url: "/api/settings",
        headers: hub.headers,
        payload: { model },
      });
      assert.equal(rejected.statusCode, 400, rejected.body);
      assert.deepEqual(hub.store.settings(), {
        model: "",
        speechEnabled: false,
      });
    }
    const wrongSpeechType = await hub.app.inject({
      method: "PATCH",
      url: "/api/settings",
      headers: hub.headers,
      payload: { speechEnabled: "yes" },
    });
    assert.equal(wrongSpeechType.statusCode, 400);
    const unknownSetting = await hub.app.inject({
      method: "PATCH",
      url: "/api/settings",
      headers: hub.headers,
      payload: { cloudEndpoint: "https://example.test/" },
    });
    assert.equal(unknownSetting.statusCode, 400);
  } finally {
    await hub.close();
  }
});

function audit(project: Project, id: string): AuditReport {
  const pageUrl = project.url;
  return {
    schemaVersion: 1,
    ruleVersion: "fixture-rules-v1",
    profileVersion: "fixture-desktop-v1",
    browserVersion: "fixture-no-browser",
    options: {
      pages: [pageUrl],
      maxPages: 1,
      maxDepth: 0,
      excludedPaths: [],
      viewports: [{ id: "desktop", width: 1440, height: 900 }],
      performance: false,
      performanceRuns: 1,
    },
    pages: [
      {
        id: "page",
        pageUrl,
        finalUrl: pageUrl,
        viewportId: "desktop",
        state: "initial",
        title: "API fixture",
        statusCode: 200,
        status: "completed",
        durationMs: 1,
        evidenceId: "proof",
      },
    ],
    rules: [
      {
        id: "layout-instance",
        ruleId: "covered-control",
        category: "layout",
        status: "fail",
        weight: 1,
        pageUrl,
        viewportId: "desktop",
        state: "initial",
        detail: "Fixture observation",
        findingIds: ["finding"],
      },
    ],
    findings: [
      {
        id: "finding",
        fingerprint: "fixture-fingerprint",
        ruleId: "covered-control",
        category: "layout",
        priority: "critical",
        title: "Fixture button blocked",
        detail: "A stored test observation, not a real website measurement.",
        pageUrl,
        viewportId: "desktop",
        state: "initial",
        evidenceId: "proof",
        selector: "#button",
        evidenceStatus: "measured",
        recommendation: "Inspect the source project.",
        acceptance: "A matching recheck must explicitly pass.",
      },
    ],
    evidence: [
      {
        id: "proof",
        path: `evidence/${id}-proof.png`,
        pageUrl,
        viewportId: "desktop",
        width: 1440,
        height: 900,
        scrollX: 0,
        scrollY: 0,
        state: "initial",
        capturedAt: project.createdAt,
      },
    ],
    discoveredUrls: [pageUrl],
    coverage: { planned: 1, completed: 1, skipped: [] },
    startedAt: project.createdAt,
    finishedAt: project.createdAt,
    durationMs: 1,
    performance: [],
    warnings: ["Injected test fixture; browser jobs disabled."],
  };
}
function seedFinishedScan(hub: Awaited<ReturnType<typeof workspace>>): Scan {
  const scan = hub.store.createScan(hub.project.id);
  const report = audit(hub.project, scan.id);
  hub.store.finish(scan.id, {
    title: "API fixture",
    url: hub.project.url,
    statusCode: 200,
    viewport: { width: 1440, height: 900 },
    screenshotPath: report.evidence[0]!.path,
    checks: [],
    durationMs: 1,
    audit: report,
  });
  return hub.store.scan(scan.id)!;
}

test("task API permits review but refuses manually verified completion and preserves state on report reload", async () => {
  const hub = await workspace();
  try {
    const scan = seedFinishedScan(hub);
    const detail = await hub.app.inject({
      url: `/api/scans/${scan.id}`,
      headers: hub.headers,
    });
    assert.equal(detail.statusCode, 200, detail.body);
    const task = detail.json<{ tasks: AuditTask[] }>().tasks[0]!;
    assert.equal(task.status, "open");
    const review = await hub.app.inject({
      method: "PATCH",
      url: `/api/tasks/${task.id}`,
      headers: hub.headers,
      payload: { status: "review" },
    });
    assert.equal(review.statusCode, 200);
    assert.equal(review.json().task.status, "review");
    const verified = await hub.app.inject({
      method: "PATCH",
      url: `/api/tasks/${task.id}`,
      headers: hub.headers,
      payload: { status: "verified" },
    });
    assert.equal(verified.statusCode, 400);
    assert.match(verified.json().error, /Nachtest/);
    assert.equal(hub.store.task(task.id)?.status, "review");
    const reloaded = await hub.app.inject({
      url: `/api/scans/${scan.id}/report`,
      headers: hub.headers,
    });
    assert.equal(reloaded.statusCode, 200);
    assert.equal(
      reloaded.json<{ tasks: AuditTask[] }>().tasks[0]?.status,
      "review",
      "Rebuilding a report must not reset the user checklist.",
    );
  } finally {
    await hub.close();
  }
});

test("backup API produces a portable archive restoring report, checklist, CSV data and evidence", async () => {
  const hub = await workspace();
  let restored: Store | undefined;
  try {
    const scan = seedFinishedScan(hub);
    const evidence = scan.result!.audit!.evidence[0]!;
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aO1sAAAAASUVORK5CYII=",
      "base64",
    );
    await writeFile(join(hub.store.dataDir, evidence.path), png);
    const detail = await hub.app.inject({
      url: `/api/scans/${scan.id}`,
      headers: hub.headers,
    });
    const task = detail.json<{ tasks: AuditTask[] }>().tasks[0]!;
    await hub.app.inject({
      method: "PATCH",
      url: `/api/tasks/${task.id}`,
      headers: hub.headers,
      payload: { status: "review" },
    });
    const imported = await hub.app.inject({
      method: "POST",
      url: `/api/projects/${hub.project.id}/search`,
      headers: hub.headers,
      payload: { csv: csv("2026-01-01"), metadata: metadata() },
    });
    assert.equal(imported.statusCode, 200);
    const response = await hub.app.inject({
      url: "/api/data/backup",
      headers: hub.headers,
    });
    assert.equal(
      response.statusCode,
      200,
      response.statusCode === 200 ? "" : response.body,
    );
    assert.match(String(response.headers["content-type"]), /application\/zip/);
    assert.match(
      String(response.headers["content-disposition"]),
      /attachment; filename="sitefenn-backup-/,
    );
    const archive = new Uint8Array(response.rawPayload);
    const entries = unzipSync(archive);
    assert.ok(entries["backup-manifest.json"]);
    assert.ok(entries["hub.sqlite"]);
    assert.deepEqual(Buffer.from(entries[evidence.path]!), png);
    const destination = join(hub.directory, "restored");
    await restoreBackup(archive, destination);
    restored = new Store(destination);
    assert.deepEqual({ ...restored.project(hub.project.id) }, hub.project);
    assert.equal(
      restored.scan(scan.id)?.result?.audit?.findings[0]?.id,
      "finding",
    );
    assert.equal(restored.task(task.id)?.status, "review");
    assert.equal(
      restored.searchDatasets(hub.project.id)[0]?.id,
      imported.json().dataset.id,
    );
    assert.deepEqual(await readFile(join(destination, evidence.path)), png);
    assert.equal(
      hub.store.scan(scan.id)?.status,
      "completed",
      "Taking a backup must not mutate the live source scan.",
    );
  } finally {
    restored?.close();
    await hub.close();
  }
});
