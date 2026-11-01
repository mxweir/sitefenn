import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AuditReport, Finding, Scan } from "../shared/types.js";
import { normalizeScanOptions } from "../server/options.js";
import { validReviewReport } from "./helpers/review-report.js";
import { compareScans, sameExecution } from "../server/services/comparison.js";
import { problemId } from "../server/services/problem-identity.js";
import {
  baselinePreview,
  adoptBaseline,
  compareHistory,
} from "../server/services/baselines.js";
import { changeEvidence } from "../server/services/change-evidence.js";
import { releaseGate } from "../server/services/release-gate.js";
import { Store } from "../server/store.js";
import { createBackup, restoreBackup } from "../server/backup.js";
import { protectedScans } from "../server/services/maintenance.js";
import { createApp } from "../server/app.js";
const url = "https://owned.example/";
function report(fail = false): AuditReport {
  const f: Finding = {
    id: "f",
    fingerprint: "original-fingerprint",
    ruleId: "meta-description",
    category: "seo",
    priority: "important",
    title: "Description fehlt",
    detail: "Meta Description fehlt.",
    pageUrl: url,
    viewportId: "mobile",
    state: "initial",
    evidenceStatus: "measured",
    recommendation: "Description ergänzen.",
    acceptance: "HTML-Präsenz erneut prüfen.",
  };
  return validReviewReport({
    schemaVersion: 1,
    ruleVersion: "rules-2.1.0",
    profileVersion: "responsive-1.0.0",
    browserVersion: "fixture",
    provenance: {
      appVersion: "2.4.0",
      seoVersions: {
        saxes: "fixture",
        parse5: "fixture",
        robotsParser: "fixture",
      },
      engineSha256: "a".repeat(64),
      measurement: {
        version: "measurement-identity-2.4",
        captureSha256: "b".repeat(64),
        normalizationSha256: "c".repeat(64),
        verificationSha256: "d".repeat(64),
      },
      playwrightVersion: "fixture",
      axeVersion: "fixture",
      lighthouseVersion: "fixture",
      nodeVersion: "fixture",
      platform: "fixture",
      arch: "fixture",
    },
    options: normalizeScanOptions(
      { pages: [url], viewports: ["mobile"], performance: false },
      url,
    ),
    pages: [
      {
        id: "p",
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
    findings: fail ? [f] : [],
    evidence: [],
    performance: [],
    discoveredUrls: [url],
    coverage: { planned: 1, completed: 1, skipped: [] },
    startedAt: "2026-11-01T00:00:00Z",
    finishedAt: "2026-11-01T00:00:01Z",
    durationMs: 1,
    warnings: [],
  });
}
function scan(id: string, r: AuditReport): Scan {
  return {
    id,
    projectId: "p",
    status: "completed",
    createdAt: r.startedAt,
    finishedAt: r.finishedAt,
    error: null,
    options: r.options,
    result: {
      title: "Owned",
      url,
      statusCode: 200,
      viewport: { width: 390, height: 844 },
      screenshotPath: "",
      checks: [],
      durationMs: 1,
      audit: r,
    },
  };
}
test("explicit 2.4 measurement identity permits only an application/UI version change; legacy remains strict", () => {
  const a = report(true),
    b = report();
  b.provenance!.appVersion = "2.4.1";
  const c = compareScans(scan("a", a), scan("b", b));
  assert.equal(c.level, "exact");
  assert.equal(c.entries[0]!.state, "resolved");
  assert.equal(c.comparable, true);
  delete a.provenance!.measurement;
  delete b.provenance!.measurement;
  const before = JSON.stringify(a);
  assert.equal(sameExecution(a, b), false);
  assert.equal(compareScans(scan("a", a), scan("b", b)).level, "diagnostic");
  assert.equal(JSON.stringify(a), before);
  b.provenance!.appVersion = a.provenance!.appVersion;
  assert.equal(sameExecution(a, b), true);
});
test("compatibility matrix rejects browser, engine, parser, normalization and verification changes without false deltas or fixes", () => {
  const mutations: ((r: AuditReport) => void)[] = [
    (r) => (r.browserVersion = "different"),
    (r) => (r.provenance!.measurement!.captureSha256 = "e".repeat(64)),
    (r) => (r.provenance!.measurement!.normalizationSha256 = "e".repeat(64)),
    (r) => (r.provenance!.measurement!.verificationSha256 = "e".repeat(64)),
    (r) => (r.provenance!.engineSha256 = "e".repeat(64)),
    (r) => (r.provenance!.nodeVersion = "different"),
    (r) => (r.provenance!.axeVersion = "different"),
    (r) =>
      (r.provenance!.seoVersions = {
        saxes: "other",
        parse5: "other",
        robotsParser: "other",
      }),
    (r) => delete r.provenance!.measurement,
    (r) => delete r.provenance!.seoVersions,
    (r) => (r.provenance!.measurement!.captureSha256 = "invalid"),
  ];
  for (const mutate of mutations) {
    const a = report(true),
      b = report();
    mutate(b);
    const c = compareScans(scan("a", a), scan("b", b));
    assert.equal(c.level, "diagnostic");
    assert.equal(c.scoreDelta, null);
    assert.equal(c.verificationComparable, false);
    assert.notEqual(c.entries[0]!.state, "resolved");
    assert.equal(
      releaseGate(scan("b", b), scan("a", a)).status,
      "inconclusive",
    );
  }
  for (const mutate of [
    (r: AuditReport) => (r.ruleVersion = "rules-new"),
    (r: AuditReport) => (r.profileVersion = "profile-new"),
    (r: AuditReport) => (r.pages = []),
    (r: AuditReport) => (r.contractVersion = "unknown"),
  ]) {
    const b = report();
    mutate(b);
    assert.equal(
      compareScans(scan("a", report(true)), scan("b", b)).level,
      "incompatible",
    );
  }
});
test("problem identity is separate from occurrence/fingerprint; selector changes and duplicates require review", () => {
  const a = report(true),
    b = report(true);
  b.findings[0]!.id = "later";
  b.rules.find((r) => r.ruleId === "meta-description")!.findingIds = ["later"];
  b.findings[0]!.fingerprint = "different-occurrence-fingerprint";
  let c = compareScans(scan("a", a), scan("b", b));
  assert.equal(c.entries.length, 1);
  assert.equal(c.entries[0]!.state, "persistent");
  assert.equal(c.entries[0]!.problemId, problemId("p", a.findings[0]!));
  assert.notEqual(
    problemId("other-project", a.findings[0]!),
    c.entries[0]!.problemId,
  );
  b.findings[0]!.selector = "#changed";
  c = compareScans(scan("a", a), scan("b", b));
  assert.equal(c.entries.length, 2);
  assert.ok(
    c.entries.every(
      (e) => e.state === "mapping-review" && e.match === "needs-review",
    ),
  );
  assert.ok(
    c.entries.every(
      (e) => e.beforeFindingIds!.length && e.afterFindingIds!.length,
    ),
  );
  const dup = structuredClone(a.findings[0]!);
  dup.id = "duplicate";
  a.findings.push(dup);
  a.rules.find((r) => r.ruleId === "meta-description")!.findingIds.push(dup.id);
  assert.ok(
    compareScans(scan("a", a), scan("b", report())).entries.every(
      (e) => e.state === "mapping-review",
    ),
  );
});
test("unknown and changed state/target remain unknown; backwards comparison cannot confirm a repair", () => {
  const a = report(true),
    b = report();
  b.rules.find((r) => r.ruleId === "meta-description")!.status = "not_run";
  assert.equal(
    compareScans(scan("a", a), scan("b", b)).entries[0]!.state,
    "not-retested",
  );
  b.pages[0]!.finalUrl = `${url}redirected`;
  assert.notEqual(
    compareScans(scan("a", a), scan("b", b)).entries[0]!.state,
    "resolved",
  );
  const backwards = scan("b", report());
  backwards.createdAt = "2026-10-01T00:00:00Z";
  assert.equal(compareScans(scan("a", a), backwards).level, "incompatible");
});
test("targeted retest never gets a score delta and cannot change normalization, SEO or journey definitions", () => {
  const a = report(true),
    b = report();
  b.options.retest = { sourceScanId: "a", taskId: "task", findingIds: ["f"] };
  b.rules = b.rules.filter(
    (r) => r.category !== "performance" || r.viewportId === "mobile",
  );
  let c = compareScans(scan("a", a), scan("b", b));
  assert.equal(c.verificationComparable, true);
  assert.equal(c.entries[0]!.state, "resolved");
  assert.equal(c.scoreDelta, null);
  b.options.technicalSeo = true;
  c = compareScans(scan("a", a), scan("b", b));
  assert.equal(c.verificationComparable, false);
  delete b.options.technicalSeo;
  b.options.journeys = [
    {
      id: "new",
      name: "Other",
      pageUrl: url,
      viewportIds: ["mobile"],
      confirmed: true,
      steps: [],
    },
  ];
  assert.equal(
    compareScans(scan("a", a), scan("b", b)).verificationComparable,
    false,
  );
});
test("on-demand change evidence is bound to actual IDs and includes the after rule instead of inferring a fix from absence", () => {
  const a = scan("a", report(true)),
    b = scan("b", report()),
    id = problemId("p", a.result!.audit!.findings[0]!);
  const proof = changeEvidence(a, b, id);
  assert.equal(proof.before.observations[0]!.id, "f");
  assert.equal(proof.after.rules[0]!.status, "pass");
  assert.equal(proof.after.observations.length, 0);
  assert.throws(() => changeEvidence(a, b, "foreign"));
});
test("occurrences, controlled baseline history, labels and safety references survive migration/trash/restore without rewriting reports", async () => {
  const root = await mkdtemp(join(tmpdir(), "sitefenn24-"));
  let store = new Store(join(root, "source"));
  let restored: Store | undefined;
  try {
    const p = store.createProject("Owned", url, "production");
    const save = (r: AuditReport) => {
      const s = store.createScan(p.id, r.options);
      store.finish(s.id, scan("source", r).result!);
      return store.scan(s.id)!;
    };
    const old = save(report(true)),
      fixed = save(report()),
      control = save(report()),
      recur = save(report(true));
    const raw = store.db
      .prepare("SELECT result FROM scans WHERE id=?")
      .get(old.id)!.result;
    store.annotateScan(old.id, { name: "First", profileName: "Mobile QA" });
    assert.equal(
      store.db.prepare("SELECT result FROM scans WHERE id=?").get(old.id)!
        .result,
      raw,
    );
    assert.equal(
      compareHistory(store, control, recur).entries[0]!.state,
      "recurrent",
    );
    const preview = baselinePreview(store, p.id, fixed.id, control.id);
    assert.equal(preview.eligible, true);
    assert.throws(() =>
      adoptBaseline(store, p.id, {
        candidateId: fixed.id,
        controlId: control.id,
        snapshotHash: preview.snapshotHash,
        name: "Reference",
        note: "",
        confirmed: false,
      }),
    );
    const first = adoptBaseline(store, p.id, {
      candidateId: fixed.id,
      controlId: control.id,
      snapshotHash: preview.snapshotHash,
      name: "Reference",
      note: "Stable measurements",
      confirmed: true,
    });
    assert.throws(
      () =>
        adoptBaseline(store, p.id, {
          candidateId: fixed.id,
          controlId: control.id,
          snapshotHash: preview.snapshotHash,
          name: "Stale",
          note: "",
          confirmed: true,
        }),
      /veraltet/,
    );
    const nextReport = report();
    nextReport.provenance!.appVersion = "2.5.0";
    nextReport.provenance!.engineSha256 = "e".repeat(64);
    const next = save(nextReport),
      nextControl = save(nextReport);
    assert.equal(compareScans(control, next).level, "diagnostic");
    const nextPreview = baselinePreview(store, p.id, next.id, nextControl.id);
    const second = adoptBaseline(store, p.id, {
      candidateId: next.id,
      controlId: nextControl.id,
      snapshotHash: nextPreview.snapshotHash,
      name: "New identity",
      note: "Two controlled measurements",
      confirmed: true,
    });
    assert.equal(second.previousId, first.id);
    assert.equal(
      store.scan(control.id)!.result!.audit!.provenance!.appVersion,
      "2.4.0",
    );
    assert.ok(protectedScans(store).has(next.id));
    assert.ok(protectedScans(store).has(fixed.id));
    assert.ok(protectedScans(store).has(control.id));
    assert.equal(
      baselinePreview(store, p.id, old.id, fixed.id).eligible,
      false,
    );
    store.trashScan(old.id);
    store.close();
    store = new Store(join(root, "source"));
    store.restoreTrash(old.id);
    assert.equal(store.scan(old.id)!.labels!.name, "First");
    assert.equal(
      compareHistory(store, control, recur).entries[0]!.state,
      "recurrent",
    );
    await restoreBackup(await createBackup(store), join(root, "restored"));
    restored = new Store(join(root, "restored"));
    assert.equal(restored.baselines(p.id)[0]!.id, second.id);
    assert.equal(
      compareHistory(restored, control, recur).entries[0]!.state,
      "recurrent",
    );
    assert.equal(
      restored.db.prepare("SELECT result FROM scans WHERE id=?").get(old.id)!
        .result,
      raw,
    );
    // Simulate an original schema-2 workspace: derived index absent, reports untouched.
    restored.db.exec(
      "DROP TABLE problem_occurrences; DROP TABLE baseline_changes; ALTER TABLE scans DROP COLUMN annotation; DELETE FROM workspace_preferences WHERE key='migration:problems-2.4'; PRAGMA user_version=2;",
    );
    restored.close();
    restored = undefined;
    const reopened = new Store(join(root, "restored"));
    try {
      assert.equal(
        reopened.db.prepare("PRAGMA user_version").get()!.user_version,
        3,
      );
      assert.equal(
        compareHistory(reopened, control, recur).entries[0]!.state,
        "recurrent",
      );
      assert.equal(
        reopened.db.prepare("SELECT result FROM scans WHERE id=?").get(old.id)!
          .result,
        raw,
      );
      assert.ok(
        (await readdir(join(root, "restored", "backups"))).some((p) =>
          p.startsWith("before-schema-3-from-2-"),
        ),
      );
    } finally {
      reopened.close();
    }
  } finally {
    store.close();
    restored?.close();
    await rm(root, { recursive: true, force: true });
  }
});
test("real API previews and adopts only a confirmed unchanged baseline; named runs keep original evidence", async () => {
  const root = await mkdtemp(join(tmpdir(), "sitefenn24-api-"));
  const { app, store } = await createApp({
    port: 4337,
    dataDir: root,
    runJobs: false,
  });
  try {
    const host = "127.0.0.1:4337",
      home = await app.inject({ url: "/", headers: { host } }),
      headers = {
        host,
        cookie: String(home.headers["set-cookie"]).split(";")[0],
        origin: `http://${host}`,
        "x-hub-request": "1",
      };
    const p = store.createProject("Owned", url, "production"),
      a = store.createScan(p.id),
      b = store.createScan(p.id);
    store.finish(a.id, scan("a", report()).result!);
    store.finish(b.id, scan("b", report()).result!);
    const req = (path: string, payload: unknown) =>
      app.inject({
        method: "POST",
        url: path,
        headers,
        payload: payload as Record<string, unknown>,
      });
    const preview = await req(`/api/projects/${p.id}/baseline-preview`, {
      candidateId: a.id,
      controlId: b.id,
    });
    assert.equal(preview.statusCode, 200);
    assert.equal(preview.json().eligible, true);
    const payload = {
      candidateId: a.id,
      controlId: b.id,
      snapshotHash: preview.json().snapshotHash,
      name: "QA",
      note: "Stable",
      confirmed: true,
    };
    assert.equal(
      (
        await req(`/api/projects/${p.id}/baselines`, {
          ...payload,
          confirmed: false,
        })
      ).statusCode,
      409,
    );
    assert.equal(
      (await req(`/api/projects/${p.id}/baselines`, payload)).statusCode,
      200,
    );
    assert.equal(
      (await req(`/api/projects/${p.id}/baselines`, payload)).statusCode,
      409,
    );
    assert.equal(
      (
        await app.inject({
          method: "PATCH",
          url: `/api/scans/${a.id}/labels`,
          headers,
          payload: { name: "Release review", profileName: "Mobile QA" },
        })
      ).statusCode,
      200,
    );
    assert.equal(store.scan(a.id)!.labels!.name, "Release review");
    assert.equal(
      store.scan(a.id)!.result!.audit!.provenance!.appVersion,
      "2.4.0",
    );
    const foreign = store.createProject("Other", url, "production"),
      f = store.createScan(foreign.id);
    store.finish(f.id, scan("f", report()).result!);
    assert.equal(
      (
        await req(`/api/projects/${p.id}/baseline-preview`, {
          candidateId: a.id,
          controlId: f.id,
        })
      ).statusCode,
      400,
    );
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("report and derived problem index commit atomically when an index write fails", async () => {
  const root = await mkdtemp(join(tmpdir(), "sitefenn24-atomic-")),
    store = new Store(root);
  try {
    const p = store.createProject("Owned", url, "production"),
      s = store.createScan(p.id);
    store.finish(s.id, scan("a", report()).result!);
    const before = JSON.stringify(store.scan(s.id));
    store.db.exec(
      "CREATE TRIGGER injected_index_failure BEFORE INSERT ON problem_occurrences BEGIN SELECT RAISE(FAIL,'injected index failure'); END;",
    );
    assert.throws(
      () => store.finish(s.id, scan("a", report(true)).result!),
      /injected/,
    );
    assert.equal(JSON.stringify(store.scan(s.id)), before);
    assert.equal(
      store.db.prepare("SELECT count(*) n FROM problem_occurrences").get()!.n,
      0,
    );
  } finally {
    store.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("a known earlier occurrence without a verified gap is not labelled new or verified recurrence", async () => {
  const root = await mkdtemp(join(tmpdir(), "sitefenn24-gap-")),
    store = new Store(root);
  try {
    const p = store.createProject("Owned", url, "production");
    const save = (r: AuditReport) => {
      const s = store.createScan(p.id, r.options);
      store.finish(s.id, scan("r", r).result!);
      return store.scan(s.id)!;
    };
    save(report(true));
    const gap = report();
    gap.rules.find((r) => r.ruleId === "meta-description")!.status = "not_run";
    const middle = save(gap),
      returned = save(report(true));
    const c = compareHistory(store, middle, returned);
    assert.equal(c.entries[0]!.state, "history-uncertain");
    assert.ok(c.entries[0]!.historyScanId);
  } finally {
    store.close();
    await rm(root, { recursive: true, force: true });
  }
});
