import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
  access,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { unzipSync, zipSync, strToU8, strFromU8 } from "fflate";
import { Store } from "../server/store.js";
import { createBackup, restoreBackup } from "../server/backup.js";
import { normalizeScanOptions } from "../server/options.js";
import { VIEWPORTS } from "../shared/types.js";

const hash = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
const legacySchema = `CREATE TABLE projects(id TEXT PRIMARY KEY,name TEXT NOT NULL,url TEXT NOT NULL,environment TEXT NOT NULL,createdAt TEXT NOT NULL,demo INTEGER NOT NULL DEFAULT 0);
CREATE TABLE scans(id TEXT PRIMARY KEY,projectId TEXT NOT NULL REFERENCES projects(id),status TEXT NOT NULL,createdAt TEXT NOT NULL,finishedAt TEXT,error TEXT,result TEXT);
INSERT INTO projects VALUES('legacy-project','Legacy project','https://example.com/','production','2026-01-01',0);
INSERT INTO scans(id,projectId,status,createdAt) VALUES('legacy-scan','legacy-project','queued','2026-01-01');PRAGMA user_version=1;`;

test("portable backup restores projects, settings, completed scan and evidence without changing the source", async () => {
  const directory = await mkdtemp(join(tmpdir(), "hub-backup-roundtrip-"));
  const source = new Store(join(directory, "source"));
  let restored: Store | undefined;
  try {
    const project = source.createProject(
      "Kundenprojekt äöü",
      "https://example.com/?lang=de",
      "production",
    );
    source.updateSettings({ model: "local-test-model", speechEnabled: true });
    const scan = source.createScan(
      project.id,
      normalizeScanOptions({}, project.url),
    );
    const evidencePath = `evidence/${scan.id}.png`;
    const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
    await writeFile(join(source.dataDir, evidencePath), bytes);
    source.finish(scan.id, {
      title: "Ein echter gespeicherter Befund",
      url: project.url,
      statusCode: 200,
      viewport: { width: 1440, height: 900 },
      screenshotPath: evidencePath,
      checks: [],
      durationMs: 250,
    });
    const archive = await createBackup(source);
    const files = unzipSync(archive);
    assert.ok(files["hub.sqlite"]);
    assert.ok(files[evidencePath]);
    assert.ok(files["backup-manifest.json"]);
    assert.equal(source.project(project.id)?.name, "Kundenprojekt äöü");
    const destination = join(directory, "restored");
    await restoreBackup(archive, destination);
    restored = new Store(destination);
    assert.equal(restored.project(project.id)?.name, project.name);
    assert.deepEqual(restored.settings(), {
      model: "local-test-model",
      speechEnabled: true,
    });
    assert.equal(restored.scan(scan.id)?.status, "completed");
    assert.equal(
      restored.scan(scan.id)?.result?.title,
      "Ein echter gespeicherter Befund",
    );
    assert.deepEqual(await readFile(join(destination, evidencePath)), bytes);
    assert.equal(source.scan(scan.id)?.status, "completed");
  } finally {
    restored?.close();
    source.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("restore rejects existing destination, modified evidence, missing entries and unsafe ZIP paths before extraction", async () => {
  const directory = await mkdtemp(join(tmpdir(), "hub-backup-rejection-"));
  const store = new Store(join(directory, "source"));
  try {
    await writeFile(
      join(store.dataDir, "evidence", "proof.png"),
      Buffer.from("original evidence"),
    );
    const archive = await createBackup(store);
    const existing = join(directory, "existing");
    await mkdir(existing);
    await writeFile(join(existing, "keep.txt"), "do not touch");
    await assert.rejects(restoreBackup(archive, existing), /neues|vorhanden/);
    assert.equal(
      await readFile(join(existing, "keep.txt"), "utf8"),
      "do not touch",
    );
    const modified = unzipSync(archive);
    modified["evidence/proof.png"] = strToU8("tampered evidence");
    const tamperedDestination = join(directory, "tampered");
    await assert.rejects(
      restoreBackup(zipSync(modified), tamperedDestination),
      /Integrit/,
    );
    await assert.rejects(access(tamperedDestination));
    const missing = unzipSync(archive);
    delete missing["evidence/proof.png"];
    await assert.rejects(
      restoreBackup(zipSync(missing), join(directory, "missing")),
      /Manifest/,
    );
    for (const pathname of [
      "../outside.txt",
      "evidence/../../outside.txt",
      "/absolute.png",
      "evidence\\outside.png",
    ]) {
      const unsafe = unzipSync(archive);
      unsafe[pathname] = strToU8("unsafe");
      const destination = join(
        directory,
        `unsafe-${hash(strToU8(pathname)).slice(0, 8)}`,
      );
      await assert.rejects(
        restoreBackup(zipSync(unsafe), destination),
        /Dateipfad/,
      );
      await assert.rejects(access(destination));
    }
    await assert.rejects(access(join(directory, "outside.txt")));
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("backup manifest rejects unsupported formats and validly rehashed future database schemas", async () => {
  const directory = await mkdtemp(join(tmpdir(), "hub-backup-future-"));
  const store = new Store(join(directory, "source"));
  try {
    const archive = await createBackup(store);
    const unknownFormat = unzipSync(archive);
    const wrongManifest = JSON.parse(
      strFromU8(unknownFormat["backup-manifest.json"]!),
    );
    wrongManifest.schema = 999;
    unknownFormat["backup-manifest.json"] = strToU8(
      JSON.stringify(wrongManifest),
    );
    await assert.rejects(
      restoreBackup(zipSync(unknownFormat), join(directory, "format")),
      /Unbekanntes/,
    );
    const futureFile = join(directory, "future.sqlite");
    const db = new DatabaseSync(futureFile);
    db.exec(
      "CREATE TABLE future_data(value TEXT); INSERT INTO future_data VALUES ('keep'); PRAGMA user_version=99;",
    );
    db.close();
    const files = unzipSync(archive);
    files["hub.sqlite"] = await readFile(futureFile);
    const manifest = JSON.parse(strFromU8(files["backup-manifest.json"]!));
    manifest.files["hub.sqlite"] = {
      size: files["hub.sqlite"].byteLength,
      sha256: hash(files["hub.sqlite"]),
    };
    files["backup-manifest.json"] = strToU8(JSON.stringify(manifest));
    await assert.rejects(
      restoreBackup(zipSync(files), join(directory, "future-restore")),
      /Datenbankversion/,
    );
    const unchanged = new DatabaseSync(futureFile, { readOnly: true });
    try {
      assert.equal(
        unchanged.prepare("PRAGMA user_version").get()?.user_version,
        99,
      );
      assert.equal(
        unchanged.prepare("SELECT value FROM future_data").get()?.value,
        "keep",
      );
    } finally {
      unchanged.close();
    }
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("schema-1 migration preserves legacy records and creates a readable pre-migration database backup", async () => {
  const directory = await mkdtemp(join(tmpdir(), "hub-migration-"));
  let store: Store | undefined;
  try {
    const db = new DatabaseSync(join(directory, "hub.sqlite"));
    db.exec(legacySchema);
    db.close();
    store = new Store(directory);
    assert.equal(
      store.db.prepare("PRAGMA user_version").get()?.user_version,
      2,
    );
    assert.equal(store.project("legacy-project")?.name, "Legacy project");
    assert.equal(store.scan("legacy-scan")?.status, "interrupted");
    assert.ok(
      store.db
        .prepare("PRAGMA table_info(scans)")
        .all()
        .some((row) => row.name === "options"),
    );
    const backups = (await readdir(join(directory, "backups"))).filter((name) =>
      name.startsWith("before-schema-2-"),
    );
    assert.equal(backups.length, 1);
    const backup = new DatabaseSync(join(directory, "backups", backups[0]!), {
      readOnly: true,
    });
    try {
      assert.equal(
        backup.prepare("PRAGMA user_version").get()?.user_version,
        1,
      );
      assert.equal(
        backup
          .prepare("SELECT name FROM projects WHERE id=?")
          .get("legacy-project")?.name,
        "Legacy project",
      );
      assert.equal(
        backup.prepare("SELECT status FROM scans WHERE id=?").get("legacy-scan")
          ?.status,
        "queued",
      );
    } finally {
      backup.close();
    }
  } finally {
    store?.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("portable restore accepts an original schema-1 database without a runtime_lock table", async () => {
  const directory = await mkdtemp(join(tmpdir(), "hub-legacy-restore-"));
  let restored: Store | undefined;
  try {
    const path = join(directory, "legacy.sqlite");
    const db = new DatabaseSync(path);
    db.exec(legacySchema);
    db.close();
    const bytes = await readFile(path);
    const manifest = {
      kind: "sitefenn-backup",
      schema: 1,
      createdAt: new Date().toISOString(),
      files: { "hub.sqlite": { size: bytes.byteLength, sha256: hash(bytes) } },
    };
    const archive = zipSync({
      "hub.sqlite": bytes,
      "backup-manifest.json": strToU8(JSON.stringify(manifest)),
    });
    const destination = join(directory, "restored");
    await restoreBackup(archive, destination);
    restored = new Store(destination);
    assert.equal(restored.project("legacy-project")?.name, "Legacy project");
    assert.equal(
      restored.db.prepare("PRAGMA user_version").get()?.user_version,
      2,
    );
  } finally {
    restored?.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("opening a future schema is refused without deleting future records", async () => {
  const directory = await mkdtemp(join(tmpdir(), "hub-future-store-"));
  try {
    const path = join(directory, "hub.sqlite");
    const db = new DatabaseSync(path);
    db.exec(
      "CREATE TABLE future_records(value TEXT); INSERT INTO future_records VALUES ('preserved'); PRAGMA user_version=99;",
    );
    db.close();
    assert.throws(() => new Store(directory), /newer/);
    const check = new DatabaseSync(path, { readOnly: true });
    try {
      assert.equal(
        check.prepare("PRAGMA user_version").get()?.user_version,
        99,
      );
      assert.equal(
        check.prepare("SELECT value FROM future_records").get()?.value,
        "preserved",
      );
    } finally {
      check.close();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("scan options preserve query semantics, remove fragments, deduplicate URLs and use versioned profiles", () => {
  const options = normalizeScanOptions(
    {
      pages: [
        "https://example.com/page?lang=de#one",
        "https://example.com/page?lang=de#two",
      ],
      viewports: ["mobile", "desktop"],
      maxPages: 2,
      maxDepth: 3,
      performance: true,
      performanceRuns: 3,
    },
    "https://example.com/",
  );
  assert.deepEqual(options.pages, ["https://example.com/page?lang=de"]);
  assert.deepEqual(options.viewports, [VIEWPORTS[2], VIEWPORTS[0]]);
  assert.equal(options.maxDepth, 3);
  assert.equal(options.performanceRuns, 3);
  const defaults = normalizeScanOptions({}, "https://example.com/");
  assert.equal(defaults.maxPages, 10);
  assert.equal(defaults.performance, false);
  assert.equal(defaults.viewports.length, 3);
  assert.deepEqual(
    normalizeScanOptions({ maxPages: 30, maxDepth: 0 }, "https://example.com/")
      .maxPages,
    30,
  );
});

test("scan options reject out-of-scope pages, credential queries, contradictory exclusions and unversioned profiles", () => {
  for (const pages of [
    ["https://example.com.evil.test/"],
    ["http://example.com/"],
    ["https://example.com:8443/"],
    ["https://user:pass@example.com/"],
    ["https://example.com/?ACCESS_TOKEN=secret"],
    ["https://example.com/?password=secret"],
  ])
    assert.throws(() =>
      normalizeScanOptions({ pages }, "https://example.com/"),
    );
  for (const options of [
    { maxPages: 31 },
    { maxPages: 0 },
    { maxDepth: 4 },
    { maxDepth: -1 },
    { maxDepth: 1.5 },
    { pages: [] },
    { pages: ["https://example.com/a", "https://example.com/b"], maxPages: 1 },
    { viewports: [] },
    { viewports: ["desktop", "desktop"] },
    { viewports: ["unknown"] },
    { viewports: [{ id: "desktop", width: 1000 }] },
    { excludedPaths: ["private"] },
    { excludedPaths: ["/bad\\path"] },
    { excludedPaths: ["/bad\u0000path"] },
    {
      pages: ["https://example.com/private/area"],
      excludedPaths: ["/private"],
    },
    { performance: "yes" },
    { performanceRuns: 2 },
    { unrecognized: true },
  ])
    assert.throws(
      () => normalizeScanOptions(options, "https://example.com/"),
      JSON.stringify(options),
    );
  assert.throws(() =>
    normalizeScanOptions(
      { pages: ["http://127.0.0.1:4310/api/bootstrap"] },
      "http://127.0.0.1:4310/demo-site",
      "http://127.0.0.1:4310",
    ),
  );
  assert.throws(() =>
    normalizeScanOptions(
      { pages: ["http://127.0.0.1:4310/demo-site-evil"] },
      "http://127.0.0.1:4310/demo-site",
      "http://127.0.0.1:4310",
    ),
  );
});
