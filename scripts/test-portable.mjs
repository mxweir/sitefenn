/** Exercise the shipped builds with isolated workspaces and a pinned previous ZIP. */
import {
  mkdtemp,
  readFile,
  writeFile,
  mkdir,
  rm,
  rename,
  readdir,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, relative } from "node:path";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import assert from "node:assert/strict";
import { unzipSync } from "fflate";

const exec = promisify(execFile);
const previousVersion = "2.8.0";
const previousDigest =
  "d89847577f246d122067c9d63cb33fff5103d5f3893113cabeb8bf24e4df8618";
const version = JSON.parse(await readFile("package.json")).version;
const root = await mkdtemp(join(tmpdir(), "sitefenn-portable-"));
const appRoot = join(root, "app");
const oldRoot = join(root, "old");
const dataRoot = join(root, "workspace");
let child;
let decoy;
let cookie = "";
const socket = createServer();
await new Promise((done) => socket.listen(0, "127.0.0.1", done));
const port = socket.address().port;
await new Promise((done) => socket.close(done));
const base = `http://127.0.0.1:${port}`;
const env = (data = dataRoot, extra = {}) => ({
  ...process.env,
  PORT: String(port),
  HUB_DATA_DIR: data,
  ...extra,
});
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const launcher = ["scripts/launch.mjs", "--no-browser"];

async function stop(signal = "SIGTERM") {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const current = child;
  const ended = new Promise((done) => current.once("close", done));
  current.kill(signal);
  const timer = setTimeout(() => current.kill("SIGKILL"), 8000);
  await ended;
  clearTimeout(timer);
  child = undefined;
}

async function launch({
  directory = appRoot,
  data = dataRoot,
  setup = false,
  previous = false,
  expectedVersion = previous ? previousVersion : version,
} = {}) {
  let logs = "";
  child = spawn(
    process.execPath,
    previous
      ? ["dist/server/index.js"]
      : [...launcher, ...(setup ? ["--setup"] : [])],
    {
      cwd: directory,
      env: env(data),
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  for (const stream of [child.stdout, child.stderr])
    stream.on("data", (bytes) => {
      logs = (logs + bytes.toString()).slice(-10000);
    });
  const expected = expectedVersion;
  const until = Date.now() + (setup ? 180000 : 30000);
  for (; Date.now() < until; await delay(75)) {
    if (child.exitCode !== null || child.signalCode !== null)
      throw Error(
        `Launcher exited ${child.exitCode ?? child.signalCode}: ${logs}`,
      );
    if (
      !logs.includes(
        previous ? `Local: ${base}` : `SiteFenn bereit · ${expected} · ${base}`,
      )
    )
      continue;
    const page = await fetch(base, {
      signal: AbortSignal.timeout(1500),
      redirect: "error",
    });
    assert.ok(page.ok);
    cookie = page.headers.get("set-cookie").split(";")[0];
    assert.equal((await api("/api/bootstrap")).version, expected);
    return;
  }
  throw Error(`Launcher timeout: ${logs}`);
}

async function failedStart({
  directory = appRoot,
  data = dataRoot,
  extra = {},
  args = launcher,
  expected,
}) {
  const result = await exec(process.execPath, args, {
    cwd: directory,
    env: env(data, extra),
    timeout: 18000,
  }).then(
    (out) => ({ code: 0, ...out }),
    (error) => error,
  );
  assert.equal(result.code, 2, result.stdout + result.stderr);
  assert.doesNotMatch(result.stdout, /SiteFenn bereit/);
  if (expected) assert.match(result.stderr, expected);
}

async function api(path, body) {
  const r = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      cookie,
      origin: base,
      "x-hub-request": "1",
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  assert.ok(r.ok, `HTTP ${r.status} ${path}`);
  return r.json();
}

async function extract(bytes, directory) {
  const entries = unzipSync(bytes);
  assert.ok(
    !Object.keys(entries).some(
      (p) =>
        p.startsWith(".local-data") ||
        p.endsWith(".env") ||
        p.includes("node_modules/") ||
        p.endsWith(".sqlite"),
    ),
  );
  await mkdir(directory);
  for (const [path, entry] of Object.entries(entries)) {
    const target = resolve(directory, path);
    assert.ok(!relative(directory, target).startsWith(".."));
    await mkdir(resolve(target, ".."), { recursive: true });
    await writeFile(target, entry);
  }
}

try {
  const zipPath = `.local-data/packages/sitefenn-${version}-web-cli.zip`;
  const zip = await readFile(zipPath);
  assert.equal(
    digest(zip),
    (await readFile(zipPath + ".sha256", "utf8")).split(" ")[0],
  );
  const previous = await readFile(
    process.argv[2] ??
      `.local-data/packages/sitefenn-${previousVersion}-web-cli.zip`,
  );
  assert.equal(digest(previous), previousDigest, "Previous release digest");
  await extract(zip, appRoot);
  await extract(previous, oldRoot);
  await failedStart({ expected: /Abhängigkeiten/ });
  decoy = createServer((_request, response) =>
    response.end("foreign HTTP 200"),
  );
  await new Promise((done) => decoy.listen(port, "127.0.0.1", done));
  await failedStart({ expected: new RegExp(`Port ${port} ist belegt`) });
  assert.equal(await (await fetch(base)).text(), "foreign HTTP 200");
  await new Promise((done) => decoy.close(done));
  decoy = undefined;

  await launch({ setup: true, data: join(root, "fresh") });
  await stop();
  const doctor = await exec(
    process.execPath,
    ["scripts/launch.mjs", "--doctor"],
    {
      cwd: appRoot,
      env: env(),
      timeout: 15000,
    },
  );
  assert.match(doctor.stdout, /Chromium startet mit Sandbox/);
  assert.match(doctor.stdout, /\[OPTIONAL\] Ollama/);

  const lockFiles = await Promise.all(
    [oldRoot, appRoot].map(
      async (folder) =>
        JSON.parse(await readFile(join(folder, "package-lock.json"), "utf8"))
          .packages,
    ),
  );
  for (const lock of lockFiles) delete lock[""];
  assert.deepEqual(
    ...lockFiles,
    "Reuse identical locked dependencies between extracted releases",
  );
  await symlink(
    join(appRoot, "node_modules"),
    join(oldRoot, "node_modules"),
    "junction",
  );

  await launch({ directory: oldRoot, previous: true });
  const { project } = await api("/api/projects", {
    name: "Owned persistence fixture",
    url: "http://127.0.0.1:43288/",
    environment: "local",
    acknowledged: true,
  });
  assert.ok(project.id);
  const demo = await api("/api/demo", {});
  const scanPath = `/api/scans/${demo.scan.id}`;
  let savedReport;
  for (let i = 0; i < 300; i++) {
    const { scan } = await api(scanPath);
    assert.ok(
      !["failed", "cancelled", "interrupted"].includes(scan.status),
      scan.error ?? scan.status,
    );
    if (
      scan.status === "completed" &&
      (await api("/api/bootstrap")).readiness.allowed.startExclusive
    ) {
      savedReport = scan.result.audit;
      break;
    }
    await delay(100);
  }
  assert.equal(savedReport?.coverage.completed, 9);
  const evidencePath = `${scanPath}/evidence/${savedReport.evidence[0].id}`;
  async function evidenceDigest() {
    const result = await fetch(base + evidencePath, {
      headers: { cookie },
      signal: AbortSignal.timeout(5000),
    });
    assert.equal(result.headers.get("content-type"), "image/png");
    return digest(Buffer.from(await result.arrayBuffer()));
  }
  const originalEvidence = await evidenceDigest();
  async function verifyReport() {
    const { scan } = await api(scanPath);
    assert.deepEqual(scan.result.audit, savedReport);
    assert.equal(await evidenceDigest(), originalEvidence);
  }
  const backup = await api("/api/updates/backup", {});
  await stop();
  const archive = join(dataRoot, "backups", backup.name);
  const bytes = await readFile(archive);
  assert.equal(digest(bytes), backup.sha256);

  const brokenData = join(root, "broken-workspace");
  await mkdir(brokenData);
  const brokenDb = join(brokenData, "hub.sqlite");
  await writeFile(brokenDb, "invalid database");
  await failedStart({
    data: brokenData,
    expected: /SiteFenn konnte nicht starten/,
  });
  assert.equal(await readFile(brokenDb, "utf8"), "invalid database");

  const buildVersion = join(appRoot, "dist/shared/version.js");
  const originalVersion = await readFile(buildVersion);
  try {
    await writeFile(buildVersion, 'export const APP_VERSION = "0.0.0";');
    await failedStart({ expected: /anderen Version/ });
  } finally {
    await writeFile(buildVersion, originalVersion);
  }

  const entry = join(appRoot, "dist/server/index.js");
  const savedEntry = entry + ".saved";
  await rename(entry, savedEntry);
  try {
    await writeFile(
      entry,
      'process.send({ protocol: "sitefenn-launch-1", state: "ready", pid: process.pid, version: "0.0.0", origin: "http://127.0.0.1:" + process.env.PORT }); setInterval(() => {}, 100);',
    );
    await failedStart({ expected: /Startbestätigung passt nicht/ });
    const pidFile = join(root, "stalled.pid");
    await writeFile(
      entry,
      'import { writeFileSync } from "node:fs"; writeFileSync(process.env.SITEFENN_TEST_PID, String(process.pid)); setInterval(() => {}, 100);',
    );
    await failedStart({
      extra: { SITEFENN_START_TIMEOUT_MS: "1200", SITEFENN_TEST_PID: pidFile },
      expected: /Startzeit überschritten/,
    });
    const stalledPid = Number(await readFile(pidFile, "utf8"));
    assert.throws(() => process.kill(stalledPid, 0), { code: "ESRCH" });
  } finally {
    await rename(savedEntry, entry);
  }

  await launch();
  assert.ok(
    (await api("/api/bootstrap")).projects.some(
      (item) => item.id === project.id,
    ),
  );
  await verifyReport();
  const upgraded = await api("/api/projects", {
    name: "New version only",
    url: "http://127.0.0.1:43289/",
    environment: "local",
    acknowledged: true,
  });
  await stop();

  const recovered = join(root, "rollback");
  const restore = (source, destination) =>
    exec(
      process.execPath,
      ["--import", "tsx", "scripts/restore-backup.ts", source, destination],
      {
        cwd: appRoot,
        timeout: 20000,
      },
    );
  const corrupt = join(root, "corrupt.zip");
  await writeFile(corrupt, bytes.subarray(0, bytes.length - 48));
  await assert.rejects(restore(corrupt, join(root, "invalid-restore")));
  await restore(archive, recovered);
  await launch({ directory: oldRoot, previous: true, data: recovered });
  const projects = (await api("/api/bootstrap")).projects;
  assert.ok(projects.some((item) => item.id === project.id));
  assert.ok(!projects.some((item) => item.id === upgraded.project.id));
  await verifyReport();
  await stop();

  await launch();
  assert.ok(
    (await api("/api/bootstrap")).projects.some(
      (item) => item.id === upgraded.project.id,
    ),
  );
  const db = new DatabaseSync(join(dataRoot, "hub.sqlite"), { readOnly: true });
  const serverPid = db
    .prepare("SELECT pid FROM runtime_lock WHERE id=1")
    .get().pid;
  db.close();
  await stop("SIGKILL");
  assert.throws(() => process.kill(serverPid, 0), { code: "ESRCH" });
  await launch();
  await stop("SIGINT");
  const original20 = await readFile(
    process.argv[3] ?? ".local-data/packages/sitefenn-2.0.0-web-cli.zip",
  );
  assert.equal(
    digest(original20),
    "b82fbe8841cd580a09744ccc7ba3b8fef77c3fdbf03347bd7f152a6a64ed6c35",
  );
  const legacyApp = join(root, "legacy-2.0-app");
  const legacyData = join(root, "legacy-2.0-workspace");
  await extract(original20, legacyApp);
  const legacyLock = JSON.parse(
    await readFile(join(legacyApp, "package-lock.json"), "utf8"),
  ).packages;
  delete legacyLock[""];
  assert.deepEqual(
    legacyLock,
    lockFiles[1],
    "Reuse the identical 2.0 locked dependency tree",
  );
  await symlink(
    join(appRoot, "node_modules"),
    join(legacyApp, "node_modules"),
    "junction",
  );
  await launch({
    directory: legacyApp,
    data: legacyData,
    previous: true,
    expectedVersion: "2.0.0",
  });
  const legacyDemo = await api("/api/demo", {});
  const legacyScanPath = `/api/scans/${legacyDemo.scan.id}`;
  let legacyReport;
  for (let i = 0; i < 300; i++) {
    const { scan } = await api(legacyScanPath);
    assert.ok(
      !["failed", "cancelled", "interrupted"].includes(scan.status),
      scan.error ?? scan.status,
    );
    if (scan.status === "completed") {
      legacyReport = scan.result.audit;
      break;
    }
    await delay(100);
  }
  assert.equal(legacyReport?.coverage.completed, 9);
  const legacyImagePath = `${legacyScanPath}/evidence/${legacyReport.evidence[0].id}`;
  const legacyImage = async () => {
    const response = await fetch(base + legacyImagePath, {
      headers: { cookie },
      signal: AbortSignal.timeout(5000),
    });
    assert.equal(response.headers.get("content-type"), "image/png");
    return digest(Buffer.from(await response.arrayBuffer()));
  };
  const legacyImageHash = await legacyImage();
  await stop();
  await launch({ data: legacyData });
  assert.deepEqual((await api(legacyScanPath)).scan.result.audit, legacyReport);
  assert.equal(await legacyImage(), legacyImageHash);
  assert.ok(
    (await readdir(join(legacyData, "backups"))).some((name) =>
      /^before-schema-3-from-2-/.test(name),
    ),
  );
  await stop();
  console.log(
    JSON.stringify({
      version,
      previousVersion,
      original20SchemaMigrationPreservedReportAndEvidence: true,
      freshExtraction: true,
      portConflictWithForeignHttp: true,
      doctorChromiumSandbox: true,
      invalidBuildAndHandshakeRefused: true,
      deadlineKillsChild: true,
      parentLossStopsService: true,
      failedDataStartRefused: true,
      genuinePreviousPackageUpgrade: true,
      reportAndEvidencePreserved: true,
      corruptBackupRefused: true,
      restoredPreviousPackage: true,
      restartPreservesProjects: true,
      platform: process.platform,
      arch: process.arch,
    }),
  );
} finally {
  await stop();
  if (decoy) await new Promise((done) => decoy.close(done));
  await rm(root, { recursive: true, force: true });
}
