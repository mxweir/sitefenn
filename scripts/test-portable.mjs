/** Real fresh dependency/setup/start/restart smoke; no browser automation. */
import { mkdtemp, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, relative } from "node:path";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { createServer } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import assert from "node:assert/strict";
import { unzipSync } from "fflate";
const exec = promisify(execFile),
  version = JSON.parse(await readFile("package.json")).version;
const root = await mkdtemp(join(tmpdir(), "sitefenn-portable-")),
  appRoot = join(root, "app"),
  dataRoot = join(root, "workspace");
let child;
const socket = createServer();
await new Promise((r) => socket.listen(0, "127.0.0.1", r));
const port = socket.address().port;
await new Promise((r) => socket.close(r));
const base = `http://127.0.0.1:${port}`;
let cookie = "";
async function stop() {
  if (!child || child.exitCode !== null) return;
  const current = child;
  const ended = new Promise((r) => current.once("exit", r));
  current.kill("SIGTERM");
  const timer = setTimeout(() => current.kill("SIGKILL"), 8000);
  await ended;
  clearTimeout(timer);
  child = undefined;
}
async function start(setup = false) {
  let logs = "";
  child = spawn(
    process.execPath,
    ["scripts/launch.mjs", "--no-browser", ...(setup ? ["--setup"] : [])],
    {
      cwd: appRoot,
      env: { ...process.env, PORT: String(port), HUB_DATA_DIR: dataRoot },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout.on("data", (b) => {
    logs = (logs + b.toString()).slice(-8000);
  });
  child.stderr.on("data", (b) => {
    logs = (logs + b.toString()).slice(-8000);
  });
  for (let i = 0; i < 600; i++) {
    if (child.exitCode !== null)
      throw Error(`Launcher exited ${child.exitCode}: ${logs}`);
    try {
      const r = await fetch(base, { signal: AbortSignal.timeout(500) });
      if (r.ok) {
        cookie = r.headers.get("set-cookie").split(";")[0];
        return;
      }
    } catch {}
    await delay(100);
  }
  throw Error(`Launcher timeout: ${logs}`);
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
  });
  assert.ok(r.ok, `HTTP ${r.status} ${path}`);
  return r.json();
}
try {
  const zip = await readFile(
    `.local-data/packages/sitefenn-${version}-web-cli.zip`,
  );
  const entries = unzipSync(zip);
  assert.ok(
    !Object.keys(entries).some(
      (p) =>
        p.startsWith(".local-data") ||
        p.endsWith(".env") ||
        p.includes("node_modules/") ||
        p.endsWith(".sqlite"),
    ),
  );
  await mkdir(appRoot);
  for (const [path, bytes] of Object.entries(entries)) {
    const target = resolve(appRoot, path);
    assert.ok(!relative(appRoot, target).startsWith(".."));
    await mkdir(resolve(target, ".."), { recursive: true });
    await writeFile(target, bytes);
  }
  const missing = await exec(
    process.execPath,
    ["scripts/launch.mjs", "--no-browser"],
    { cwd: appRoot },
  ).then(
    () => 0,
    (e) => e.code,
  );
  assert.equal(missing, 2);
  await start(true);
  assert.equal((await api("/api/bootstrap")).version, version);
  const p = await api("/api/projects", {
    name: "Owned persistence fixture",
    url: "http://127.0.0.1:43288/",
    environment: "local",
    acknowledged: true,
  });
  assert.ok(p.project.id);
  await api("/api/updates/backup", {});
  await stop();
  await start();
  assert.ok(
    (await api("/api/bootstrap")).projects.some((v) => v.id === p.project.id),
  );
  await stop();
  console.log(
    JSON.stringify({
      version,
      freshExtraction: true,
      missingSetupRefused: true,
      explicitNpmChromiumSetup: true,
      productionStart: true,
      restartPreservesProjects: true,
      backupBeforeUpdate: true,
      platform: process.platform,
      arch: process.arch,
      nativeInstaller: false,
    }),
  );
} finally {
  await stop();
  await rm(root, { recursive: true, force: true });
}
