import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Store } from "../server/store.js";
import {
  scanHeads,
  scanPage,
  taskPage,
  projectStats,
} from "../server/workspace-queries.js";
import { seedWorkspaceScale } from "./fixtures/workspace-scale.js";
import {
  parseWorkspaceRoute,
  workspaceSearch,
} from "../shared/workspace-route.js";

test("1000 checks and 10000 tasks remain fully reachable with bounded project pages and lightweight heads", async () => {
  const root = await mkdtemp(join(tmpdir(), "sitefenn-scale22-"));
  const store = new Store(root);
  try {
    const { project, old } = seedWorkspaceScale(store);
    const heads = scanHeads(store);
    assert.ok(heads.some((s) => s.projectId === old.id));
    assert.equal(heads.length, 2);
    assert.ok(!JSON.stringify(heads).includes("FULL-REPORT-ONLY"));
    assert.deepEqual(projectStats(store)[project.id], {
      scans: 1000,
      tasks: 10000,
      verified: 0,
    });
    const scanIds = new Set<string>(),
      taskIds = new Set<string>();
    let cursor: string | undefined;
    do {
      const p = scanPage(store, project.id, { limit: 100, cursor });
      assert.equal(p.total, 1000);
      assert.ok(p.items.length <= 100);
      for (const item of p.items) {
        assert.ok(!scanIds.has(item.id));
        scanIds.add(item.id);
        assert.equal(item.result?.audit, undefined);
        assert.deepEqual(item.result?.checks, []);
      }
      cursor = p.nextCursor ?? undefined;
    } while (cursor);
    assert.equal(scanIds.size, 1000);
    do {
      const p = taskPage(store, project.id, { limit: 100, cursor });
      assert.equal(p.total, 10000);
      for (const item of p.items) {
        assert.ok(!taskIds.has(item.id));
        taskIds.add(item.id);
      }
      cursor = p.nextCursor ?? undefined;
    } while (cursor);
    assert.equal(taskIds.size, 10000);
    assert.equal(scanPage(store, project.id, { q: "scan 0000" }).total, 1);
    assert.equal(taskPage(store, project.id, { q: "task 00000" }).total, 1);
    const first = scanPage(store, project.id, { limit: 5 });
    assert.throws(() => scanPage(store, old.id, { cursor: first.nextCursor! }));
    assert.throws(() =>
      scanPage(store, project.id, { cursor: first.nextCursor!, q: "changed" }),
    );
    assert.throws(() =>
      taskPage(store, project.id, { cursor: first.nextCursor! }),
    );
    assert.throws(() => scanPage(store, project.id, { limit: 101 }));
    assert.throws(() => scanPage(store, project.id, { cursor: "null" }));
    const inserted = store.createScan(project.id);
    assert.ok(
      !scanPage(store, project.id, {
        cursor: first.nextCursor!,
        limit: 100,
      }).items.some((s) => s.id === inserted.id),
    );
  } finally {
    store.close();
    await rm(root, { recursive: true, force: true });
  }
});
test("summary backfill preserves full reports and restored archived checks regain their lightweight summary", async () => {
  const root = await mkdtemp(join(tmpdir(), "sitefenn-summary22-"));
  let store = new Store(root);
  try {
    const { project, scanIds } = seedWorkspaceScale(store, 3, 3);
    const original = store.scan(scanIds[0]!)!.result;
    store.db.exec("ALTER TABLE scans DROP COLUMN summary");
    store.close();
    store = new Store(root);
    assert.deepEqual(store.scan(scanIds[0]!)!.result, original);
    assert.equal(scanPage(store, project.id).items.length, 3);
    assert.ok(
      !JSON.stringify(scanPage(store, project.id)).includes("FULL-REPORT-ONLY"),
    );
    store.trashScan(scanIds[0]!);
    assert.equal(scanPage(store, project.id).total, 2);
    store.restoreTrash(scanIds[0]!);
    assert.equal(scanPage(store, project.id).total, 3);
    assert.equal(
      scanPage(store, project.id).items.find((s) => s.id === scanIds[0])?.result
        ?.title,
      original?.title,
    );
  } finally {
    store.close();
    await rm(root, { recursive: true, force: true });
  }
});
test("stable project/check/task/finding URLs round-trip without restoring any consent", () => {
  const route = {
    projectId: "project-ui",
    scanId: "older-scan",
    taskId: "task-ui",
    findingId: "finding-ui",
    tab: "tasks" as const,
    screen: "projects" as const,
    panel: "handoff" as const,
  };
  const url = workspaceSearch(route);
  assert.deepEqual(parseWorkspaceRoute(url), { ...route, page: undefined });
  assert.ok(!url.includes("ack"));
  assert.ok(!url.includes("root"));
  assert.equal(
    parseWorkspaceRoute("?project=../../bad&view=execute&panel=approve")
      .projectId,
    null,
  );
  assert.equal(parseWorkspaceRoute("?view=execute").tab, "overview");
});
test("bootstrap and project APIs use summaries rather than full-report list access", async () => {
  const { createApp } = await import("../server/app.js");
  const root = await mkdtemp(join(tmpdir(), "sitefenn-summary-api22-"));
  const { app, store } = await createApp({
    port: 4310,
    dataDir: root,
    runJobs: false,
  });
  try {
    const { project } = seedWorkspaceScale(store, 5, 10);
    const home = await app.inject({
      url: "/",
      headers: { host: "127.0.0.1:4310" },
    });
    const headers = {
      host: "127.0.0.1:4310",
      cookie: String(home.headers["set-cookie"]).split(";")[0],
    };
    store.scans = () => {
      throw Error("Full report listing must not run");
    };
    const boot = await app.inject({ url: "/api/bootstrap", headers });
    assert.equal(boot.statusCode, 200, boot.body);
    assert.deepEqual(boot.json().tasks, []);
    assert.ok(!boot.body.includes("FULL-REPORT-ONLY"));
    const page = await app.inject({
      url: `/api/projects/${project.id}/scans?limit=2`,
      headers,
    });
    assert.equal(page.statusCode, 200);
    assert.equal(page.json().total, 5);
    assert.equal(page.json().items.length, 2);
    assert.equal(
      (
        await app.inject({
          url: `/api/projects/${project.id}/tasks?limit=3`,
          headers,
        })
      ).json().total,
      10,
    );
    assert.equal(
      (
        await app.inject({
          url: `/api/projects/${project.id}/scans?limit=200`,
          headers,
        })
      ).statusCode,
      400,
    );
    assert.equal(
      (await app.inject({ url: "/api/projects/missing/scans", headers }))
        .statusCode,
      404,
    );
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});
