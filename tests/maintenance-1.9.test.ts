import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm, access } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import { Store } from "../server/store.js";
import { performScan } from "../server/scan-worker.js";
import { normalizeScanOptions } from "../server/options.js";
import { buildTasks } from "../server/services/reports.js";
import {
  retentionPreview,
  protectedScans,
  purgeTrash,
  beforeUpdateBackup,
  checkUpdate,
} from "../server/services/maintenance.js";
import { Scheduler } from "../server/services/scheduler.js";
import { restoreBackup } from "../server/backup.js";
test(
  "real captured history safely previews, trashes, restores, backs up and purges; schedules stay bounded and restored schedules disabled",
  { timeout: 30000 },
  async () => {
    const root = await mkdtemp(join(tmpdir(), "sitefenn-maintenance-")),
      store = new Store(join(root, "workspace"));
    const fixture = createServer((_req, res) => {
      res.setHeader("content-type", "text/html");
      res.end(
        '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Owned maintenance</title><meta name="description" content="Owned fixture"><style>#wide{width:680px}</style></head><body><main><h1>Owned</h1><div id="wide">Owned fixture</div></main></body></html>',
      );
    });
    await new Promise<void>((r) => fixture.listen(0, "127.0.0.1", r));
    const address = fixture.address();
    assert.ok(address && typeof address !== "string");
    const url = `http://127.0.0.1:${address.port}/`;
    let restored: Store | undefined;
    try {
      const options = normalizeScanOptions(
          { pages: [url], viewports: ["mobile"], performance: false },
          url,
        ),
        project = store.createProject("Owned maintenance", url, "local");
      const result = await performScan({
        id: "owned-maintenance",
        url,
        dataDir: store.dataDir,
        allowedLocalOrigin: new URL(url).origin,
        options,
      });
      const old = store.createScan(project.id, options),
        middle = store.createScan(project.id, options),
        latest = store.createScan(project.id, options);
      const oldResult = structuredClone(result);
      const unique = "evidence/unique-owned-trash.png";
      await writeFile(
        join(store.dataDir, unique),
        await readFile(join(store.dataDir, result.audit!.evidence[0]!.path)),
      );
      oldResult.audit!.evidence[0]!.path = unique;
      store.finish(old.id, oldResult);
      store.finish(middle.id, result);
      store.finish(latest.id, result);
      store.saveTasks(buildTasks(project, store.scan(old.id)!));
      const tasks = store.tasks(old.id);
      assert.ok(tasks.length > 0);
      store.saveVisualReference({
        id: "owned-reference",
        projectId: project.id,
        scanId: middle.id,
        approvedAt: new Date().toISOString(),
        masks: [],
      });
      assert.ok(protectedScans(store).has(middle.id));
      assert.ok(protectedScans(store).has(latest.id));
      assert.deepEqual(
        retentionPreview(store, 1).candidates.map((c) => c.id),
        [old.id],
      );
      let now = Date.parse("2026-10-30T12:00:00Z"),
        busy = true,
        starts = 0;
      const scheduler = new Scheduler(
        store,
        () => busy,
        () => ({ id: `scheduled-${++starts}` }),
        () => now,
      );
      scheduler.configure(project.id, latest.id, 24, true);
      now += 24 * 3600000;
      scheduler.tick();
      assert.equal(starts, 0);
      assert.equal(
        scheduler.list()[0]?.lastState,
        "Wartet auf freie Ressourcen",
      );
      busy = false;
      scheduler.tick();
      assert.equal(starts, 1);
      scheduler.tick();
      assert.equal(starts, 1);
      now += 3 * 24 * 3600000;
      scheduler.tick();
      assert.equal(starts, 1);
      assert.equal(scheduler.list()[0]?.missed, 3);
      store.trashScan(old.id);
      assert.equal(store.scan(old.id), undefined);
      assert.equal(store.tasks(old.id).length, 0);
      assert.equal(store.trashSummaries().length, 1);
      await access(join(store.dataDir, unique));
      const backup = await beforeUpdateBackup(store);
      await restoreBackup(
        await readFile(join(store.dataDir, "backups", backup.name)),
        join(root, "restored"),
      );
      restored = new Store(join(root, "restored"));
      assert.equal(restored.trashSummaries().length, 1);
      assert.equal(
        (restored.preference(`schedule:${project.id}`) as { enabled: boolean })
          .enabled,
        false,
      );
      restored.restoreTrash(old.id);
      assert.equal(restored.tasks(old.id).length, tasks.length);
      assert.deepEqual(
        restored.scan(old.id)?.result,
        JSON.parse(JSON.stringify(oldResult)),
      );
      assert.equal(store.scan(old.id), undefined);
      store.restoreTrash(old.id);
      assert.equal(store.tasks(old.id).length, tasks.length);
      store.trashScan(old.id);
      const purged = await purgeTrash(store, [old.id]);
      assert.equal(purged.deletedRecords, 1);
      assert.equal(purged.deletedFiles, 1);
      await assert.rejects(access(join(store.dataDir, unique)));
      await access(join(store.dataDir, result.audit!.evidence[1]!.path));
      assert.equal(store.trashSummaries().length, 0);
      assert.equal(store.scan(latest.id)?.status, "completed");
    } finally {
      restored?.close();
      store.close();
      await new Promise<void>((r) => fixture.close(() => r()));
      await rm(root, { recursive: true, force: true });
    }
  },
);
test("update check normalizes a fixed release URL, rejects malformed/draft data and never installs code", async () => {
  const request: typeof fetch = async (input, init) => {
    assert.equal(
      input,
      "https://api.github.com/repos/mxweir/sitefenn/releases/latest",
    );
    assert.equal(init?.redirect, "error");
    return Response.json({
      tag_name: "v99.0.0",
      html_url: "https://evil.test/",
      draft: false,
      prerelease: false,
    });
  };
  const value = await checkUpdate(request);
  assert.equal(value.available, true);
  assert.equal(
    value.url,
    "https://github.com/mxweir/sitefenn/releases/tag/v99.0.0",
  );
  await assert.rejects(
    checkUpdate(async () =>
      Response.json({ tag_name: "evil", draft: false, prerelease: false }),
    ),
  );
  await assert.rejects(
    checkUpdate(async () => new Response("", { status: 429 })),
  );
});

test("maintenance API requires a fresh preview and explicit confirmations before trash or purge", async () => {
  const { createApp } = await import("../server/app.js");
  const root = await mkdtemp(join(tmpdir(), "sitefenn-maintenance-api-"));
  const { app, store } = await createApp({
    port: 4310,
    dataDir: root,
    runJobs: false,
  });
  const host = "127.0.0.1:4310";
  try {
    const home = await app.inject({ url: "/", headers: { host } });
    const headers = {
      host,
      cookie: String(home.headers["set-cookie"]).split(";")[0],
      origin: "http://127.0.0.1:4310",
      "x-hub-request": "1",
    };
    const post = (url: string, payload: Record<string, unknown>) =>
      app.inject({ url, method: "POST", headers, payload });
    const p = store.createProject(
      "Owned API",
      "https://example.org/",
      "production",
    );
    const old = store.createScan(p.id);
    store.fail(old.id, "Owned failed fixture");
    const latest = store.createScan(p.id);
    store.fail(latest.id, "Owned newest fixture");
    assert.equal(
      (await post("/api/storage/trash", { token: "invented", confirmed: true }))
        .statusCode,
      400,
    );
    const preview = await post("/api/storage/preview", { keepPerProject: 1 });
    assert.equal(preview.statusCode, 200);
    const token = preview.json().token;
    assert.equal(
      (await post("/api/storage/trash", { token, confirmed: false }))
        .statusCode,
      400,
    );
    assert.ok(store.scan(old.id));
    assert.equal(
      (await post("/api/storage/trash", { token, confirmed: true })).statusCode,
      200,
    );
    assert.equal(store.scan(old.id), undefined);
    assert.equal(
      (await post("/api/storage/trash", { token, confirmed: true })).statusCode,
      400,
    );
    assert.equal(
      (
        await post("/api/storage/purge", {
          ids: [old.id],
          confirmation: "wrong",
        })
      ).statusCode,
      400,
    );
    assert.ok(store.trashedScan(old.id));
    assert.equal(
      (await post("/api/storage/restore", { id: old.id })).statusCode,
      200,
    );
    assert.ok(store.scan(old.id));
    assert.equal(
      (
        await post("/api/schedules", {
          projectId: p.id,
          sourceScanId: latest.id,
          intervalHours: 24,
          enabled: true,
          acknowledged: true,
        })
      ).statusCode,
      400,
    );
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});
