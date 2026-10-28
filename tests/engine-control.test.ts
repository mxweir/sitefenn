import { test } from "node:test";
import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runAudit, type WorkerJob } from "../server/audit-engine.js";
import type { WorkerEvent, ScanResult } from "../shared/types.js";
import { fixtures, fixtureHTML } from "./fixtures/audit-pages.js";
import { calculateScore } from "../server/services/scoring.js";

test(
  "real worker pause, resume, cancellation and compatible checkpoint restart preserve completed pages",
  { timeout: 90_000 },
  async () => {
    const visits = new Map<string, number>();
    const server = createServer((req, res) => {
      visits.set(req.url || "/", (visits.get(req.url || "/") || 0) + 1);
      setTimeout(() => {
        res.writeHead(200, { "content-type": "text/html" });
        res.end(fixtureHTML(fixtures[0]!));
      }, 100);
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const origin = `http://127.0.0.1:${address.port}`;
    const directory = await mkdtemp(join(tmpdir(), "audit-control-test-"));
    const job: WorkerJob = {
      id: "control",
      url: origin,
      allowedLocalOrigin: origin,
      environment: "local",
      dataDir: directory,
      options: {
        pages: ["/a", "/b", "/c"].map((path) => origin + path),
        maxPages: 3,
        maxDepth: 0,
        excludedPaths: [],
        viewports: [{ id: "desktop", width: 1000, height: 700 }],
        performance: false,
        performanceRuns: 1,
      },
    };
    const child = fork(
      fileURLToPath(new URL("../server/scan-worker.ts", import.meta.url)),
      [],
      {
        execArgv: ["--import", "tsx"],
        stdio: ["ignore", "ignore", "pipe", "ipc"],
      },
    );
    let partial: ScanResult | undefined;
    let pauseRequested = false;
    let paused = false;
    let cancelled = false;
    let terminalError = "";
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          child.kill("SIGKILL");
          reject(new Error("Worker control test timed out"));
        }, 60_000);
        child.on("error", reject);
        child.on(
          "message",
          (event: WorkerEvent | { error?: string; result?: ScanResult }) => {
            if ("type" in event) {
              if (
                event.type === "progress" &&
                event.progress.phase === "browser" &&
                !pauseRequested
              ) {
                pauseRequested = true;
                child.send({ type: "control", action: "pause" });
              }
              if (
                event.type === "progress" &&
                event.progress.phase === "paused"
              ) {
                paused = true;
                child.send({ type: "control", action: "resume" });
              }
              if (event.type === "checkpoint") {
                partial = structuredClone(event.result);
                if (
                  paused &&
                  event.result.audit!.coverage.completed >= 2 &&
                  !cancelled
                ) {
                  cancelled = true;
                  child.send({ type: "control", action: "cancel" });
                }
              }
            } else if (event.error) terminalError = event.error;
          },
        );
        child.once("exit", () => {
          clearTimeout(timer);
          resolve();
        });
        child.send(job);
      });
      assert.equal(paused, true);
      assert.equal(cancelled, true);
      assert.match(terminalError, /abgebrochen/);
      assert.ok(partial?.audit);
      assert.ok(
        partial.audit.rules.some(
          (rule) => rule.pageUrl.endsWith("/c") && rule.status === "not_run",
        ),
        "Future checks must remain explicit unknowns in a partial report",
      );
      const partialScore = calculateScore(partial.audit);
      assert.equal(partialScore.final, false);
      assert.ok(
        partialScore.categories.find(
          (category) => category.category === "layout",
        )!.unknownWeight > 0,
      );
      const completedBefore = partial.audit.pages
        .filter((page) => page.status === "completed")
        .map((page) => new URL(page.pageUrl).pathname);
      const countsBefore = new Map(visits);
      const resumed = await runAudit({ ...job, resumeReport: partial.audit });
      assert.equal(resumed.audit!.coverage.completed, 3);
      for (const path of completedBefore)
        assert.equal(
          visits.get(path),
          countsBefore.get(path),
          `Completed ${path} must not be requested again`,
        );
      assert.equal(
        new Set(resumed.audit!.rules.map((rule) => rule.id)).size,
        resumed.audit!.rules.length,
      );
    } finally {
      if (child.exitCode === null && child.signalCode === null)
        child.kill("SIGTERM");
      await rm(directory, { recursive: true, force: true });
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  },
);
