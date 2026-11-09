import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mkdtemp,
  open,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../server/app.js";
import { Store } from "../server/store.js";
import { Jobs, failureCode } from "../server/jobs.js";
import { normalizeScanOptions } from "../server/options.js";
import { Scheduler } from "../server/services/scheduler.js";
import {
  restoreStreamBackup,
  writeStreamBackup,
} from "../server/stream-backup.js";

test("persistent job restart distinguishes completed browser work from interrupted work", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sitefenn-jobs-"));
  let store = new Store(directory);
  try {
    const jobs = new Jobs(store),
      project = store.createProject(
        "Own",
        "https://owned.example/",
        "production",
      );
    const scan = store.createScan(
      project.id,
      normalizeScanOptions({}, project.url),
    );
    jobs.browser(scan.id, project.id, "queued");
    const analysis = jobs.start("ai", {
      projectId: project.id,
      scanId: scan.id,
    });
    const archive = jobs.start("backup");
    jobs.update(archive.id, { phase: "cleaning-up" });
    store.close();
    store = new Store(directory);
    const recovered = new Jobs(store);
    assert.equal(recovered.get(scan.id)?.phase, "queued");
    assert.equal(recovered.get(analysis.id)?.phase, "interrupted");
    assert.equal(recovered.get(archive.id)?.phase, "interrupted");
    assert.equal(failureCode({ code: "ENOSPC" }), "disk-full");
    assert.equal(failureCode({ errcode: 13 }), "disk-full");
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("24-hour scheduler clock exercise separates waiting from downtime and catches up once", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sitefenn-schedule-"));
  const store = new Store(directory);
  try {
    const project = store.createProject(
      "Own",
      "https://owned.example/",
      "production",
    );
    const source = store.createScan(
      project.id,
      normalizeScanOptions({}, project.url),
    );
    store.setStatus(source.id, "completed");
    let now = Date.parse("2026-11-09T00:00:00Z"),
      busy = false,
      starts = 0;
    const make = () =>
      new Scheduler(
        store,
        () => busy,
        () => ({ id: `scheduled-${++starts}` }),
        () => now,
      );
    let scheduler = make();
    scheduler.configure(project.id, source.id, 24, true, "once");
    for (let step = 0; step < 2880; step++) {
      scheduler.tick();
      now += 30000;
    }
    assert.equal(starts, 0);
    busy = true;
    for (let step = 0; step < 20; step++) {
      scheduler.tick();
      now += 30000;
    }
    assert.equal(scheduler.list()[0]?.missed, 0);
    assert.ok(scheduler.list()[0]?.waitingSince);
    busy = false;
    scheduler.tick();
    assert.equal(starts, 1);
    now += 3 * 24 * 3600000 + 30000;
    scheduler = make();
    scheduler.tick();
    scheduler.tick();
    assert.equal(starts, 2);
    assert.equal(scheduler.list()[0]?.missed, 3);
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("streamed project backup excludes other project rows and evidence, verifies bytes and disables schedules", async () => {
  const root = await mkdtemp(join(tmpdir(), "sitefenn-scoped-")),
    store = new Store(join(root, "source"));
  try {
    const add = async (name: string) => {
      const project = store.createProject(
        name,
        `https://${name}.example/`,
        "production",
      );
      const options = normalizeScanOptions({}, project.url),
        scan = store.createScan(project.id, options);
      const path = `evidence/${name}.png`;
      await writeFile(join(store.dataDir, path), name);
      store.finish(scan.id, {
        title: name,
        url: project.url,
        statusCode: 200,
        viewport: { width: 390, height: 844 },
        screenshotPath: path,
        checks: [],
        durationMs: 1,
      });
      return { project, scan };
    };
    const keep = await add("keep"),
      drop = await add("private-other");
    new Scheduler(
      store,
      () => false,
      () => ({ id: "unused" }),
    ).configure(keep.project.id, keep.scan.id, 24, true, "once");
    const archive = join(root, "archive.sitefenn");
    await writeStreamBackup({
      dataDir: store.dataDir,
      snapshotPath: join(root, "snapshot.sqlite"),
      archivePath: archive,
      projectId: keep.project.id,
      progress: () => {},
    });
    assert.equal((await readFile(archive)).includes("private-other"), false);
    await restoreStreamBackup(archive, join(root, "restored"));
    const restored = new Store(join(root, "restored"));
    try {
      assert.deepEqual(
        restored.projects().map((p) => p.name),
        ["keep"],
      );
      assert.deepEqual(await readdir(join(restored.dataDir, "evidence")), [
        "keep.png",
      ]);
      assert.equal(
        (
          restored.preference(`schedule:${keep.project.id}`) as {
            enabled: boolean;
          }
        ).enabled,
        false,
      );
      assert.ok(store.project(drop.project.id));
    } finally {
      restored.close();
    }
    const file = await open(archive, "r+");
    try {
      await file.write(Buffer.from([0]), 0, 1, (await file.stat()).size - 33);
    } finally {
      await file.close();
    }
    await assert.rejects(
      restoreStreamBackup(archive, join(root, "damaged")),
      /Integrität/,
    );
    assert.ok(!(await readdir(root)).includes("damaged"));
  } finally {
    store.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("backup API releases resources after worker cancellation and downloads a later verified artifact", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sitefenn-worker-backup-"));
  const { app } = await createApp({
    port: 4345,
    dataDir: directory,
    runJobs: false,
  });
  try {
    const host = "127.0.0.1:4345",
      home = await app.inject({ url: "/", headers: { host } });
    const headers = {
      host,
      origin: `http://${host}`,
      cookie: String(home.headers["set-cookie"]).split(";")[0],
      "x-hub-request": "1",
    };
    const start = () =>
      app.inject({
        method: "POST",
        url: "/api/jobs/backup",
        headers,
        payload: {},
      });
    const first = await start();
    assert.equal(first.statusCode, 202);
    const id = first.json().job.id;
    const blocked = await start();
    assert.equal(blocked.statusCode, 409);
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: `/api/jobs/${id}/cancel`,
          headers,
          payload: {},
        })
      ).statusCode,
      200,
    );
    const wait = async (id: string, phase: string) => {
      for (let attempt = 0; attempt < 200; attempt++) {
        const state = (await app.inject({ url: "/api/jobs", headers })).json();
        const job = state.jobs.find((entry: { id: string }) => entry.id === id);
        if (job?.phase === phase && state.readiness.resourcesFree) return;
        if (job?.phase === "failed") assert.fail(JSON.stringify(job));
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      assert.fail(`Backup did not reach ${phase}`);
    };
    await wait(id, "cancelled");
    const second = await start();
    assert.equal(second.statusCode, 202);
    const next = second.json().job.id;
    await wait(next, "completed");
    const download = await app.inject({
      url: `/api/jobs/${next}/backup`,
      headers,
    });
    assert.equal(download.statusCode, 200);
    assert.ok(download.rawPayload.length > 100);
    const diag = (
      await app.inject({ url: "/api/jobs/diagnostics", headers })
    ).json();
    assert.ok(diag.jobs.some((job: { id: string }) => job.id === next));
    assert.ok(!JSON.stringify(diag).includes(directory));
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});
