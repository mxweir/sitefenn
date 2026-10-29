import { createServer } from "node:http";
import { fork } from "node:child_process";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join, dirname } from "node:path";
import { cpus, totalmem, platform, arch } from "node:os";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  baselineCases,
  baselineHtml,
  DATASET_VERSION,
} from "../tests/fixtures/baseline-pages.js";
import {
  observeLabel,
  evaluateObservations,
  percentile,
} from "../server/services/evaluation.js";
import { discoverPages, type WorkerJob } from "../server/audit-engine.js";
import type { ScanResult, WorkerEvent } from "../shared/types.js";
import type { EvaluationObservation } from "../server/services/evaluation.js";
import { VIEWPORTS } from "../shared/types.js";
import { APP_VERSION } from "../shared/version.js";
import { buildMarkdownReport } from "../server/services/reports.js";

const exec = promisify(execFile);
const args = process.argv.slice(2);
const value = (flag: string, fallback: string) =>
  args.includes(flag) ? (args[args.indexOf(flag) + 1] ?? fallback) : fallback;
if (
  args.some(
    (arg, i) =>
      i % 2 === 0 && !["--repeats", "--targets", "--output"].includes(arg),
  )
)
  throw new Error(
    "Options: --repeats 1..5 --targets AUTHORIZED.json --output NEW-DIRECTORY",
  );
const repeats = Number(value("--repeats", "3"));
if (!Number.isInteger(repeats) || repeats < 1 || repeats > 5)
  throw new Error("Repeats must be 1..5.");
const output = resolve(
  value(
    "--output",
    `.local-data/benchmarks/${new Date().toISOString().replace(/[:.]/g, "-")}`,
  ),
);
await mkdir(dirname(output), { mode: 0o700, recursive: true });
await mkdir(output, { mode: 0o700 });
await mkdir(join(output, "evidence"), { mode: 0o700 });

async function sampledRss(root: number): Promise<number | null> {
  if (process.platform === "win32") return null;
  const { stdout } = await exec("ps", ["-axo", "pid=,ppid=,rss="], {
    maxBuffer: 4 * 1024 * 1024,
  });
  const rows = stdout
    .trim()
    .split("\n")
    .map((line) => line.trim().split(/\s+/).map(Number));
  const included = new Set([root]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [pid, parent] of rows)
      if (included.has(parent!) && !included.has(pid!)) {
        included.add(pid!);
        changed = true;
      }
  }
  return (
    rows.reduce(
      (sum, [pid, , rss]) => sum + (included.has(pid!) ? rss! : 0),
      0,
    ) / 1024
  );
}
async function measure(job: WorkerJob) {
  const started = Date.now();
  const child = fork(
    fileURLToPath(new URL("../server/scan-worker.ts", import.meta.url)),
    [],
    {
      execArgv: ["--import", "tsx"],
      stdio: ["ignore", "ignore", "ignore", "ipc"],
    },
  );
  let peakRssMiB: number | null = null,
    samples = 0,
    sampling = false;
  const frameAges: number[] = [];
  const timer = setInterval(() => {
    if (!sampling && child.pid) {
      sampling = true;
      void sampledRss(child.pid)
        .then((rss) => {
          if (rss !== null) {
            peakRssMiB = Math.max(peakRssMiB ?? 0, rss);
            samples++;
          }
        })
        .catch(() => {})
        .finally(() => {
          sampling = false;
        });
    }
  }, 200);
  let killTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await new Promise<{
      result: ScanResult;
      durationMs: number;
      peakSummedProcessRssMiB: number | null;
      rssSamples: number;
      frameCaptureToIpcP95Ms: number | null;
      frameSamples: number;
    }>((resolveRun, reject) => {
      let result: ScanResult | undefined, failure: string | undefined;
      killTimer = setTimeout(() => {
        failure = "Benchmark exceeded 10 minute budget";
        child.kill("SIGTERM");
      }, 600000);
      child.on(
        "message",
        (message: WorkerEvent | { result?: ScanResult; error?: string }) => {
          if ("type" in message) {
            if (message.type === "frame")
              frameAges.push(
                Math.max(0, Date.now() - Date.parse(message.frame.capturedAt)),
              );
          } else {
            result = message.result;
            failure = message.error;
          }
        },
      );
      child.once("error", reject);
      child.once("exit", () =>
        result && !failure
          ? resolveRun({
              result,
              durationMs: Date.now() - started,
              peakSummedProcessRssMiB: peakRssMiB,
              rssSamples: samples,
              frameCaptureToIpcP95Ms: percentile(frameAges, 0.95),
              frameSamples: frameAges.length,
            })
          : reject(new Error(failure ?? "Worker exited without report")),
      );
      child.send(job);
    });
  } finally {
    clearInterval(timer);
    clearTimeout(killTimer);
    if (child.exitCode === null && child.signalCode === null)
      child.kill("SIGTERM");
  }
}
const fixtureServer = createServer((req, res) => {
  const id = new URL(req.url || "/", "http://fixture").pathname.slice(1);
  if (id === "denied-redirect") {
    res.writeHead(302, { location: "https://outside-scope.invalid/" });
    res.end();
    return;
  }
  const html = baselineHtml(id);
  res.writeHead(html ? 200 : 404, {
    "content-type": "text/html; charset=utf-8",
  });
  res.end(html ?? "Missing fixture");
});
await new Promise<void>((done) => fixtureServer.listen(0, "127.0.0.1", done));
const address = fixtureServer.address();
if (!address || typeof address === "string")
  throw new Error("Fixture listener missing");
const origin = `http://127.0.0.1:${address.port}`;
const observations: EvaluationObservation[] = [];
const measurements: Record<string, unknown>[] = [];
const save = async () => {
  const result = {
    appVersion: APP_VERSION,
    createdAt: new Date().toISOString(),
    dataset: {
      version: DATASET_VERSION,
      sha256: createHash("sha256")
        .update(JSON.stringify(baselineCases))
        .digest("hex"),
      cases: baselineCases.length,
      labelsPerCase: 2,
      labelSource:
        "Synthetic implementation-agent labels. No independent human review or held-out accuracy claim.",
    },
    hardware: {
      platform: platform(),
      arch: arch(),
      cpu: cpus()[0]?.model,
      logicalCpus: cpus().length,
      memoryGiB: totalmem() / 1024 ** 3,
    },
    method: {
      repeats,
      viewports: VIEWPORTS,
      performance: false,
      ai: false,
      rssSamplingMs: 200,
      memoryBoundary:
        "Worker and observed descendant processes. Sum of RSS can double-count shared pages; sampled maximum is not exact total physical peak. Hub, Ollama and parent excluded.",
      latencyBoundary:
        "Capture timestamp to worker IPC receipt, not UI paint or HTTP polling latency.",
      realSitesHaveGroundTruth: false,
    },
    evaluation: evaluateObservations(observations),
    observations,
    measurements,
  };
  await writeFile(
    join(output, "summary.json"),
    JSON.stringify(result, null, 2),
    { mode: 0o600 },
  );
};
try {
  for (let run = 1; run <= repeats; run++) {
    process.stdout.write(`Synthetic reference ${run}/${repeats}\n`);
    const measured = await measure({
      id: `baseline-${run}`,
      url: origin,
      allowedLocalOrigin: origin,
      environment: "local",
      dataDir: output,
      options: {
        pages: baselineCases.map((item) => `${origin}/${item.id}`),
        maxPages: baselineCases.length,
        maxDepth: 0,
        excludedPaths: [],
        viewports: VIEWPORTS,
        performance: false,
        performanceRuns: 1,
      },
    });
    await writeFile(
      join(output, `synthetic-${run}.json`),
      JSON.stringify(measured.result, null, 2),
      { mode: 0o600 },
    );
    for (const item of baselineCases)
      for (const label of item.labels)
        for (const viewport of VIEWPORTS)
          observations.push(
            observeLabel(
              measured.result.audit!,
              label,
              `${origin}/${item.id}`,
              viewport.id,
            ),
          );
    const { result, ...metrics } = measured;
    measurements.push({
      kind: "synthetic",
      run,
      ...metrics,
      provenance: result.audit?.provenance,
      browser: result.audit?.browserVersion,
      coverage: result.audit?.coverage,
    });
    await save();
  }
  if (args.includes("--targets")) {
    const targets: unknown = JSON.parse(
      await readFile(resolve(value("--targets", "")), "utf8"),
    );
    if (!Array.isArray(targets) || targets.length > 5)
      throw new Error(
        "Expected at most 5 explicitly authorized target records.",
      );
    for (const [index, entry] of targets.entries()) {
      if (
        !entry ||
        typeof entry.url !== "string" ||
        entry.authorized !== true ||
        typeof entry.authorization !== "string" ||
        !entry.authorization.trim()
      )
        throw new Error(
          "Each real target needs url, authorized:true and authorization record.",
        );
      const url = new URL(entry.url);
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      )
        throw new Error(
          "Real-site baseline accepts clean public HTTPS URLs only.",
        );
      const found = await discoverPages({
        url: url.href,
        maxPages: 3,
        maxDepth: 1,
      });
      const pages = [...new Set([url.href, ...found.urls])].slice(0, 3);
      for (let run = 1; run <= repeats; run++) {
        process.stdout.write(
          `Authorized site ${index + 1}, run ${run}/${repeats}\n`,
        );
        const measured = await measure({
          id: `site-${index + 1}-${run}`,
          url: url.href,
          environment: "production",
          dataDir: output,
          options: {
            pages,
            maxPages: 3,
            maxDepth: 1,
            excludedPaths: [],
            viewports: VIEWPORTS,
            performance: false,
            performanceRuns: 1,
          },
        });
        await writeFile(
          join(output, `site-${index + 1}-${run}.json`),
          JSON.stringify(
            {
              authorization: entry.authorization,
              discovery: found,
              ...measured.result,
            },
            null,
            2,
          ),
          { mode: 0o600 },
        );
        await writeFile(
          join(output, `site-${index + 1}-${run}.md`),
          buildMarkdownReport(
            {
              id: `site-${index + 1}`,
              name: `Authorized site ${index + 1}`,
              url: url.href,
              environment: "production",
              createdAt: measured.result.audit!.startedAt,
            },
            {
              id: `site-${index + 1}-${run}`,
              projectId: `site-${index + 1}`,
              status: "completed",
              createdAt: measured.result.audit!.startedAt,
              finishedAt: measured.result.audit!.finishedAt,
              error: null,
              result: measured.result,
            },
          ),
          { mode: 0o600 },
        );
        const { result, ...metrics } = measured;
        measurements.push({
          kind: "authorized-real-site",
          site: index + 1,
          run,
          ...metrics,
          coverage: result.audit?.coverage,
          measuredFindings: result.audit?.findings.filter(
            (item) => item.evidenceStatus === "measured",
          ).length,
          provenance: result.audit?.provenance,
          browser: result.audit?.browserVersion,
        });
        await save();
      }
    }
  }
  process.stdout.write(
    `Saved private benchmark: ${join(output, "summary.json")}\n`,
  );
} finally {
  await new Promise<void>((done) => fixtureServer.close(() => done()));
}
