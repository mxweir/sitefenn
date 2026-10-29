/** Optional real local-model integration. Synthetic demo by default; no model downloads. */
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import assert from "node:assert/strict";
import { createApp } from "../server/app.js";
import { pageAnalysisMarkdown } from "../server/services/page-analysis.js";
import type { ScanResult } from "../shared/types.js";

const directory = resolve(`.local-data/page-ai-${Date.now()}`);
await mkdir(directory, { recursive: true, mode: 0o700 });
const reservation = createServer();
await new Promise<void>((done) => reservation.listen(0, "127.0.0.1", done));
const address = reservation.address();
assert.ok(address && typeof address !== "string");
const port = address.port;
await new Promise<void>((done) => reservation.close(() => done()));
const { app, store } = await createApp({ port, dataDir: directory });
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
  let scanId: string;
  if (process.argv[3]) {
    const result = JSON.parse(
      await readFile(resolve(process.argv[3]), "utf8"),
    ) as ScanResult;
    assert.ok(result.audit);
    const project = store.createProject(
        "Authorized stored report",
        result.url,
        "production",
      ),
      scan = store.createScan(project.id, result.audit.options);
    store.finish(scan.id, result);
    scanId = scan.id;
  } else {
    const demo = await app.inject({
      method: "POST",
      url: "/api/demo",
      headers,
    });
    assert.equal(demo.statusCode, 201);
    scanId = demo.json().scan.id;
    for (let i = 0; i < 600; i++) {
      const scan = store.scan(scanId)!;
      if (scan.status === "completed") break;
      if (scan.status === "failed")
        throw new Error(scan.error ?? "Demo failed");
      await delay(150);
    }
  }
  const scan = store.scan(scanId)!;
  assert.equal(scan.status, "completed");
  const report = scan.result!.audit!,
    page = report.options.pages[0]!;
  const response = await app.inject({
    method: "POST",
    url: `/api/scans/${scanId}/page-analyses`,
    headers,
    payload: { pageUrl: page, model: process.argv[2] ?? "qwen2.5:3b" },
  });
  assert.equal(response.statusCode, 202, response.body);
  const id = response.json().analysis.id;
  let last = "";
  for (let i = 0; i < 7200; i++) {
    const job = store.pageAnalysis(id)!;
    const progress = JSON.stringify({
      status: job.status,
      stage: job.stage,
      parts: job.parts.map((part) => part.status),
    });
    if (progress !== last) {
      console.log(progress);
      last = progress;
    }
    if (!["queued", "running"].includes(job.status)) {
      await writeFile(
        join(directory, "analysis.json"),
        JSON.stringify(job, null, 2),
        { mode: 0o600 },
      );
      await writeFile(
        join(directory, "analysis.md"),
        pageAnalysisMarkdown(job, report),
        { mode: 0o600 },
      );
      console.log(
        JSON.stringify({
          directory,
          status: job.status,
          parts: job.parts.length,
          completed: job.parts.filter((part) => part.status === "completed")
            .length,
          findings: report.findings.filter((f) => f.pageUrl === page).length,
          unexplained: job.unexplainedFindingIds,
          omitted: job.omitted,
          errors: job.parts.flatMap((part) => (part.error ? [part.error] : [])),
        }),
      );
      assert.equal(
        job.status,
        "completed",
        "Real model did not produce a complete validated interpretation; inspect private analysis.json",
      );
      break;
    }
    await delay(100);
  }
  assert.equal(store.pageAnalysis(id)?.status, "completed");
} finally {
  await app.close();
}
