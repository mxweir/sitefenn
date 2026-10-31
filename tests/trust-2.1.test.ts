import { execFile } from "node:child_process";
import { promisify } from "node:util";
import corpus from "./fixtures/report-contract-2.1.json" with { type: "json" };
import { analysisReview } from "../shared/analysis-review.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Store } from "../server/store.js";
import {
  protectedScans,
  purgeTrash,
  beforeUpdateBackup,
} from "../server/services/maintenance.js";
import { restoreBackup } from "../server/backup.js";
import { normalizeScanOptions } from "../server/options.js";
import {
  expectedRules,
  validateReport,
  REPORT_CONTRACT_VERSION,
  pageFacts,
} from "../shared/report-contract.js";
import { calculateScore } from "../server/services/scoring.js";
import { releaseGate } from "../server/services/release-gate.js";
import { compareScans } from "../server/services/comparison.js";
import { readiness } from "../shared/readiness.js";
import { preparePage } from "../server/services/page-analysis.js";
import type { AuditReport, Scan, PageAnalysis } from "../shared/types.js";
const url = "https://owned.example/";
function report(): AuditReport {
  const r: AuditReport = {
    contractVersion: REPORT_CONTRACT_VERSION,
    schemaVersion: 1,
    ruleVersion: "rules-2.1.0",
    profileVersion: "responsive-1.0.0",
    browserVersion: "fixture",
    provenance: {
      appVersion: "2.1.0",
      engineSha256: "a".repeat(64),
      playwrightVersion: "fixture",
      axeVersion: "fixture",
      lighthouseVersion: "fixture",
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    options: normalizeScanOptions(
      { pages: [url], viewports: ["mobile"], performance: true },
      url,
    ),
    pages: [
      {
        id: "page",
        pageUrl: url,
        finalUrl: url,
        viewportId: "mobile",
        state: "initial",
        title: "Owned",
        statusCode: 200,
        status: "completed",
        durationMs: 1,
      },
    ],
    rules: [],
    evidence: [],
    findings: [],
    performance: [],
    discoveredUrls: [url],
    coverage: { planned: 1, completed: 1, skipped: [] },
    startedAt: "2026-10-31T10:00:00Z",
    finishedAt: "2026-10-31T10:00:01Z",
    durationMs: 1000,
    warnings: [],
  };
  r.rules = expectedRules(r).map((e, i) => ({
    ...e,
    id: `rule-${i}`,
    status: "pass",
    detail: "Measured fixture",
    findingIds: [],
  }));
  return r;
}
function scan(audit: AuditReport, id = "scan"): Scan {
  return {
    id,
    projectId: "p",
    status: "completed",
    createdAt: audit.startedAt,
    finishedAt: audit.finishedAt,
    error: null,
    options: audit.options,
    result: {
      audit,
      title: "Owned",
      url,
      statusCode: 200,
      viewport: { width: 390, height: 844 },
      screenshotPath: "",
      checks: [],
      durationMs: 1,
    },
  };
}
test("shared contract rejects omitted rules/categories/pages, forged weights, duplicate instances and invalid references everywhere", () => {
  const original = report();
  assert.equal(validateReport(original).valid, true);
  assert.equal(calculateScore(original).final, true);
  assert.equal(
    releaseGate(scan(original), scan(original, "baseline")).status,
    "pass",
  );
  const mutations: Record<string, (r: AuditReport) => void> = {
    "missing-rule": (r) => {
      r.rules.splice(0, 1);
    },
    "missing-category": (r) => {
      r.rules = r.rules.filter((x) => x.category !== "seo");
    },
    "missing-page": (r) => {
      r.pages = [];
    },
    "foreign-finding": (r) => {
      r.rules[0]!.findingIds = ["missing"];
    },
    "foreign-evidence": (r) => {
      r.rules[0]!.evidenceId = "missing";
    },
    weight: (r) => {
      r.rules[0]!.weight = 999;
    },
    duplicate: (r) => {
      r.rules.push({ ...r.rules[0]!, id: "different-id" });
    },
  };
  for (const item of corpus.cases) {
    const mutate = mutations[item.mutation]!;
    const r = structuredClone(original);
    mutate(r);
    assert.equal(validateReport(r).valid ? "valid" : "invalid", item.expected);
    if (new Set(r.rules.map((x) => x.id)).size === r.rules.length)
      assert.equal(calculateScore(r).final, false);
    assert.equal(releaseGate(scan(r), scan(original, "baseline")).exitCode, 2);
    assert.equal(
      compareScans(scan(original, "baseline"), scan(r)).comparable,
      false,
    );
    assert.equal(pageFacts(r, url).valid, false);
    assert.equal(
      (preparePage(r, url).header.reportContract as { valid: boolean }).valid,
      false,
    );
  }
  const unsupported = report();
  unsupported.profileVersion = "unknown-profile";
  assert.equal(validateReport(unsupported).valid, false);
  assert.equal(
    releaseGate(scan(unsupported), scan(original, "baseline")).exitCode,
    2,
  );
  const missingJourney = report();
  missingJourney.options.journeys = [
    {
      id: "menu",
      name: "Menu",
      confirmed: true,
      pageUrl: url,
      viewportIds: ["mobile"],
      steps: [
        {
          action: "click",
          selector: "#menu",
          expect: { selector: "#panel", condition: "visible" },
        },
      ],
    },
  ];
  assert.equal(validateReport(missingJourney).valid, false);
});
test("readiness keeps saved results distinct from released resources", () => {
  const cleanup = readiness(
    { active: true, scanId: "done", resultsSaved: true, queued: false },
    null,
  );
  assert.equal(cleanup.phase, "cleaning-up");
  assert.equal(cleanup.resultsSaved, true);
  assert.equal(cleanup.allowed.startExclusive, false);
  assert.equal(cleanup.allowed.read, true);
  assert.equal(
    readiness({ active: false, resultsSaved: false, queued: false }, null)
      .allowed.startExclusive,
    true,
  );
  assert.equal(
    readiness({ active: false, resultsSaved: false, queued: false }, "backup")
      .resourcesFree,
    false,
  );
});
test("reference graph is complete beyond 3000 tasks and 50 visual/analysis records, including trash", async () => {
  const root = await mkdtemp(join(tmpdir(), "sitefenn-refs-")),
    store = new Store(root);
  try {
    const p = store.createProject("Owned", url, "production"),
      source = store.createScan(p.id);
    // The oldest verifier must survive all display limits.
    store.db.exec("BEGIN");
    for (let i = 0; i < 3010; i++)
      store.db.prepare("INSERT INTO tasks VALUES (?,?,?,?)").run(
        `task-${i}`,
        source.id,
        p.id,
        JSON.stringify({
          id: `task-${i}`,
          verifiedByScanId: i === 0 ? "old-verifier" : undefined,
        }),
      );
    for (let i = 0; i < 60; i++) {
      store.db
        .prepare("INSERT INTO visual_references VALUES (?,?,?)")
        .run(`ref-${i}`, p.id, JSON.stringify({ scanId: `visual-${i}` }));
      store.db.prepare("INSERT INTO ai_plans VALUES (?,?,?)").run(
        `analysis-${i}`,
        source.id,
        JSON.stringify({
          kind: "page-analysis",
          context: { comparison: { scanId: `comparison-${i}` } },
        }),
      );
    }
    store.db.exec("COMMIT");
    assert.equal(store.tasks().length, 3000);
    let ids = protectedScans(store);
    assert.ok(ids.has("old-verifier"));
    assert.ok(ids.has("visual-0"));
    assert.ok(ids.has("comparison-0"));
    store.trashScan(source.id);
    ids = protectedScans(store);
    assert.ok(ids.has("old-verifier"));
    assert.ok(ids.has("comparison-0"));
    const intact = store.createScan(p.id);
    assert.throws(() => store.trashScans([intact.id, "missing"]));
    assert.ok(store.scan(intact.id));
    assert.equal(store.trashedScan(intact.id), undefined);
    store.savePreference(`schedule:${p.id}`, {
      sourceScanId: "scheduled-source",
    });
    assert.ok(protectedScans(store).has("scheduled-source"));
  } finally {
    store.close();
    await rm(root, { recursive: true, force: true });
  }
});
for (const step of [
  "purge:prepared",
  "purge:transaction",
  "purge:committed",
  "purge:file",
  "operation:complete",
]) {
  test(`purge interruption ${step} recovers without restorable entries losing evidence`, async () => {
    const root = await mkdtemp(join(tmpdir(), "sitefenn-purge-"));
    let store = new Store(root);
    try {
      const p = store.createProject("Owned", url, "production"),
        s = store.createScan(p.id);
      const result = scan(report()).result!;
      result.screenshotPath = "evidence/owned.png";
      result.audit!.evidence = [
        {
          id: "e",
          path: "evidence/owned.png",
          pageUrl: url,
          viewportId: "mobile",
          state: "initial",
          width: 390,
          height: 844,
          scrollX: 0,
          scrollY: 0,
          capturedAt: new Date().toISOString(),
        },
      ];
      store.finish(s.id, result);
      store.trashScan(s.id);
      await writeFile(join(root, "evidence/owned.png"), "owned");
      await assert.rejects(
        purgeTrash(store, [s.id], (at) => {
          if (at === step) throw Error("injected");
        }),
        /injected/,
      );
      store.close();
      store = new Store(root);
      const files = await readdir(join(root, "evidence"));
      if (["purge:prepared", "purge:transaction"].includes(step)) {
        assert.ok(store.trashedScan(s.id));
        assert.ok(files.includes("owned.png"));
      } else {
        assert.equal(store.trashedScan(s.id), undefined);
        assert.ok(!files.includes("owned.png"));
      }
      assert.equal(
        store.db.prepare("SELECT count(*) n FROM maintenance_operations").get()!
          .n,
        0,
      );
    } finally {
      store.close();
      await rm(root, { recursive: true, force: true });
    }
  });
}
for (const step of [
  "backup:journaled",
  "backup:written",
  "backup:verified",
  "backup:published",
  "operation:complete",
]) {
  test(`backup interruption ${step} publishes only a verified restorable archive`, async () => {
    const root = await mkdtemp(join(tmpdir(), "sitefenn-backup21-"));
    let store = new Store(root);
    try {
      store.createProject("Preserved", url, "production");
      await assert.rejects(
        beforeUpdateBackup(store, (at) => {
          if (at === step) throw Error("injected");
        }),
        /injected/,
      );
      store.close();
      store = new Store(root);
      const names = await readdir(join(root, "backups"));
      assert.equal(
        names.some((n) => n.endsWith(".partial")),
        false,
      );
      const published = names.filter((n) => n.endsWith(".zip"));
      if (["backup:journaled", "backup:written"].includes(step))
        assert.equal(published.length, 0);
      else {
        assert.equal(published.length, 1);
        const restored = join(root, "restored");
        await restoreBackup(
          await readFile(join(root, "backups", published[0]!)),
          restored,
        );
        const opened = new Store(restored);
        try {
          assert.equal(opened.projects()[0]?.name, "Preserved");
          assert.equal(
            opened.db
              .prepare("SELECT count(*) n FROM maintenance_operations")
              .get()!.n,
            0,
          );
        } finally {
          opened.close();
        }
      }
    } finally {
      store.close();
      await rm(root, { recursive: true, force: true });
    }
  });
}

test("canonical facts ignore model device/selector/number claims and processing never implies approval", () => {
  const measured = report();
  const facts = pageFacts(measured, url);
  const job = {
    status: "completed",
    summary: "Desktop, .invented, 999px, all checks passed",
  } as PageAnalysis;
  assert.deepEqual(pageFacts(measured, url), facts);
  assert.deepEqual(analysisReview(job, measured), {
    processing: "complete",
    measurementContract: "valid",
    semanticFactCheck: "not_performed",
    humanApproval: "not_recorded",
    meaning:
      "Verarbeitete Modellteile sind keine sachlich geprüfte oder menschlich freigegebene Beratung.",
  });
  assert.equal(JSON.stringify(facts).includes("invented"), false);
});

for (const kind of ["purge", "backup"] as const)
  test(`real SIGKILL after ${kind} durable commit reopens consistently`, async () => {
    const root = await mkdtemp(join(tmpdir(), "sitefenn-kill21-"));
    let store = new Store(root);
    try {
      const p = store.createProject("Survivor", url, "production"),
        s = store.createScan(p.id);
      const result = scan(report()).result!;
      result.screenshotPath = "evidence/killed.png";
      store.finish(s.id, result);
      store.trashScan(s.id);
      await writeFile(join(root, "evidence/killed.png"), "owned");
      store.close();
      const code = `
      import { Store } from './server/store.ts';
      import { purgeTrash, beforeUpdateBackup } from './server/services/maintenance.ts';
      const store = new Store(process.argv[1]);
      const checkpoint = at => { if (at === process.argv[3]) process.kill(process.pid, 'SIGKILL'); };
      if (process.argv[4] === 'purge') await purgeTrash(store, [process.argv[2]], checkpoint);
      else await beforeUpdateBackup(store, checkpoint);
    `;
      await assert.rejects(
        promisify(execFile)(process.execPath, [
          "--import",
          "tsx",
          "--input-type=module",
          "-e",
          code,
          root,
          s.id,
          kind === "purge" ? "purge:committed" : "backup:verified",
          kind,
        ]),
        (e: unknown) => (e as { signal?: string }).signal === "SIGKILL",
      );
      store = new Store(root);
      assert.equal(store.projects()[0]?.name, "Survivor");
      assert.equal(
        store.db.prepare("SELECT count(*) n FROM maintenance_operations").get()!
          .n,
        0,
      );
      if (kind === "purge") {
        assert.equal(store.trashedScan(s.id), undefined);
        assert.deepEqual(await readdir(join(root, "evidence")), []);
      } else {
        const names = await readdir(join(root, "backups"));
        assert.equal(names.filter((n) => n.endsWith(".zip")).length, 1);
        assert.ok(!names.some((n) => n.endsWith(".partial")));
      }
    } finally {
      try {
        store.close();
      } catch {}
      await rm(root, { recursive: true, force: true });
    }
  });

test("contract diagnostics do not reintroduce URL secrets into exports", () => {
  const r = report();
  r.options.pages = ["https://owned.example/?token=DO-NOT-EXPORT"];
  const details = validateReport(r).issues;
  assert.ok(details.length > 0);
  assert.ok(!JSON.stringify(details).includes("DO-NOT-EXPORT"));
});

test("pending maintenance is exposed through the real API, blocks expensive actions and resumes explicitly", async () => {
  const { createApp } = await import("../server/app.js");
  const root = await mkdtemp(join(tmpdir(), "sitefenn-recovery-api-"));
  const { app, store } = await createApp({
    port: 4310,
    dataDir: root,
    runJobs: false,
  });
  try {
    const home = await app.inject({
      url: "/",
      headers: { host: "127.0.0.1:4310" },
    });
    const headers = {
      host: "127.0.0.1:4310",
      cookie: String(home.headers["set-cookie"]).split(";")[0],
      origin: "http://127.0.0.1:4310",
      "x-hub-request": "1",
    };
    await writeFile(join(root, "evidence", "pending.png"), "owned");
    store.db
      .prepare("INSERT INTO maintenance_operations VALUES (?,?)")
      .run(
        "pending",
        JSON.stringify({ kind: "purge", files: ["pending.png"] }),
      );
    const pending = await app.inject({ url: "/api/readiness", headers });
    assert.equal(pending.json().resourcesFree, false);
    assert.equal(pending.json().allowed.startExclusive, false);
    assert.equal(
      (
        await app.inject({
          url: "/api/updates/backup",
          method: "POST",
          headers,
          payload: {},
        })
      ).statusCode,
      409,
    );
    assert.equal(
      (
        await app.inject({
          url: "/api/maintenance/recover",
          method: "POST",
          headers,
          payload: {},
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (await app.inject({ url: "/api/readiness", headers })).json()
        .resourcesFree,
      true,
    );
    assert.deepEqual(await readdir(join(root, "evidence")), []);
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});
