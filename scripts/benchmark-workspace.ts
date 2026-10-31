import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { Store } from "../server/store.js";
import { seedWorkspaceScale } from "../tests/fixtures/workspace-scale.js";
import {
  scanHeads,
  scanPage,
  taskPage,
  projectStats,
} from "../server/workspace-queries.js";
const root = await mkdtemp(join(tmpdir(), "sitefenn-workspace-bench-"));
let store = new Store(root);
try {
  const { project } = seedWorkspaceScale(store);
  store.db.exec("UPDATE scans SET summary=NULL");
  store.close();
  const start = performance.now();
  store = new Store(root);
  const backfillMs = performance.now() - start;
  const measure = (fn: () => unknown) => {
    const times: number[] = [];
    let maximumSampledRss = process.memoryUsage().rss;
    let bytes = 0;
    for (let i = 0; i < 35; i++) {
      const t = performance.now();
      const body = JSON.stringify(fn());
      const elapsed = performance.now() - t;
      if (i >= 5) times.push(elapsed);
      bytes = Buffer.byteLength(body);
      maximumSampledRss = Math.max(
        maximumSampledRss,
        process.memoryUsage().rss,
      );
    }
    times.sort((a, b) => a - b);
    return {
      samples: 30,
      p50Ms: times[14],
      p95Ms: times[28],
      responseBytes: bytes,
      maximumSampledProcessRssBytes: maximumSampledRss,
    };
  };
  const result = {
    kind: "internal-workspace-scale-2.2",
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    fixture: {
      checks: 1000,
      tasks: 10000,
      additionalOldQuietProjectChecks: 1,
      fullReportDetailBytesPerCheck: 16384,
    },
    backfillMs,
    overview: measure(() => ({
      heads: scanHeads(store),
      stats: projectStats(store),
    })),
    scanPage50: measure(() => scanPage(store, project.id)),
    taskPage50: measure(() => taskPage(store, project.id)),
    meaning:
      "Controlled local SQLite/query+JSON samples after five warmups; RSS sampled after calls, not whole-system/peak browser memory. Synthetic metadata, no website/AI accuracy or remote latency claim.",
  };
  const out = resolve(
    process.argv[2] ?? `.local-data/workspace-scale-2.2-${Date.now()}`,
  );
  await mkdir(out, { recursive: true });
  await writeFile(
    join(out, "summary.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result));
} finally {
  store.close();
  await rm(root, { recursive: true, force: true });
}
