import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { createApp } from "../server/app.js";
import { Store } from "../server/store.js";
import { restoreBackup } from "../server/backup.js";
const exec = promisify(execFile);
test(
  "2.0 actual service closes measured finding → scoped source handoff → fixed retest → compatible full check → portable restore",
  { timeout: 45000 },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), "sitefenn-release-2-")),
      source = join(dir, "source");
    await mkdir(source);
    await exec("git", ["init", "--quiet", source]);
    const file = join(source, "App.html");
    const html = (width: string) =>
      `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="Owned release fixture"><title>Owned release fixture</title><style>body{margin:0}main{padding:20px}#menu{box-sizing:border-box;width:${width}}</style></head><body><main><h1>Owned release fixture</h1><nav id="menu">Services · Work · Contact</nav></main></body></html>`;
    await writeFile(file, html("680px"));
    const fixture = createServer(async (_req, res) => {
      res.setHeader("content-type", "text/html");
      res.end(await readFile(file));
    });
    await new Promise<void>((r) => fixture.listen(0, "127.0.0.1", r));
    const address = fixture.address();
    assert.ok(address && typeof address !== "string");
    const url = `http://127.0.0.1:${address.port}/`;
    const { app, store } = await createApp({
      port: 4310,
      dataDir: join(dir, "workspace"),
    });
    let restored: Store | undefined;
    const host = "127.0.0.1:4310";
    try {
      const home = await app.inject({ url: "/", headers: { host } }),
        headers = {
          host,
          cookie: String(home.headers["set-cookie"]).split(";")[0],
          origin: "http://127.0.0.1:4310",
          "x-hub-request": "1",
        };
      const post = (url: string, payload: Record<string, unknown>) =>
        app.inject({ url, method: "POST", headers, payload });
      const p = (
        await post("/api/projects", {
          name: "Owned 2.0 fixture",
          url,
          environment: "local",
          acknowledged: true,
        })
      ).json().project;
      const raw = { pages: [url], viewports: ["mobile"], performance: false };
      const wait = async (id: string) => {
        for (let i = 0; i < 250; i++) {
          const s = store.scan(id)!;
          if (!["queued", "running", "paused"].includes(s.status)) {
            assert.equal(s.status, "completed", s.error ?? "");
            return s;
          }
          await delay(100);
        }
        throw Error("Worker timeout");
      };
      const initial = (await post(`/api/projects/${p.id}/scans`, raw)).json()
        .scan;
      const before = await wait(initial.id);
      const finding = before.result!.audit!.findings.find(
        (f) => f.ruleId === "horizontal-overflow" && f.selector === "#menu",
      )!;
      assert.ok(finding);
      const task = store
        .tasks(before.id)
        .find((t) => t.findingIds.includes(finding.id))!;
      assert.ok(task);
      const denied = await post(`/api/scans/${before.id}/source-preview`, {
        root: source,
        findingIds: [finding.id],
      });
      assert.equal(denied.statusCode, 400);
      const preview = await post(`/api/scans/${before.id}/source-preview`, {
        root: source,
        acknowledged: true,
        findingIds: [finding.id],
      });
      assert.equal(preview.statusCode, 200);
      const candidate = preview.json().candidates[0];
      assert.equal(candidate.status, "literal-candidate");
      const handoff = await post(`/api/scans/${before.id}/handoff`, {
        findingIds: [finding.id],
        includeSource: true,
        root: source,
        acknowledged: true,
        sourceSelection: [candidate],
      });
      assert.equal(handoff.statusCode, 200);
      assert.ok(handoff.json().markdown.includes(finding.id));
      assert.ok(handoff.json().markdown.includes("App.html:1"));
      assert.ok(!handoff.json().markdown.includes(source));
      assert.equal(await readFile(file, "utf8"), html("680px"));
      await writeFile(file, html("100%"));
      assert.equal(
        (
          await post(`/api/scans/${before.id}/handoff`, {
            findingIds: [finding.id],
            includeSource: true,
            root: source,
            acknowledged: true,
            sourceSelection: [candidate],
          })
        ).statusCode,
        400,
      );
      const retest = await post(`/api/tasks/${task.id}/retest`, {});
      assert.equal(retest.statusCode, 202);
      const next = await wait(retest.json().scan.id);
      assert.equal(
        store.tasks(before.id).find((t) => t.id === task.id)?.status,
        "verified",
      );
      assert.equal(
        store.tasks(before.id).find((t) => t.id === task.id)?.verifiedByScanId,
        next.id,
      );
      assert.ok(
        before.result!.audit!.findings.some((f) => f.id === finding.id),
      );
      const full = await post(`/api/projects/${p.id}/scans`, raw);
      const after = await wait(full.json().scan.id);
      const { compareScans } = await import("../server/services/comparison.js");
      const compared = compareScans(before, after);
      assert.equal(compared.comparable, true);
      assert.ok(
        compared.entries.some(
          (e) => e.state === "resolved" && e.beforeFindingId === finding.id,
        ),
      );
      assert.ok(
        after.result!.audit!.findings.every(
          (f) => f.ruleId !== "horizontal-overflow",
        ),
      );
      const backup = await app.inject({ url: "/api/data/backup", headers });
      assert.equal(backup.statusCode, 200);
      await restoreBackup(backup.rawPayload, join(dir, "restored"));
      restored = new Store(join(dir, "restored"));
      assert.equal(
        restored.tasks(before.id).find((t) => t.id === task.id)?.status,
        "verified",
      );
      assert.equal(
        restored.scan(after.id)?.result?.audit?.findings.length,
        after.result!.audit!.findings.length,
      );
      assert.equal(
        restored
          .scan(before.id)
          ?.result?.audit?.findings.find((f) => f.id === finding.id)?.selector,
        "#menu",
      );
    } finally {
      restored?.close();
      await app.close();
      await new Promise<void>((r) => fixture.close(() => r()));
      await rm(dir, { recursive: true, force: true });
    }
  },
);
