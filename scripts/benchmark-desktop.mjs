/** macOS-only headless comparison. The prototype is never installed or signed. */
import { execFile, spawn } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { performance } from "node:perf_hooks";
import { zipSync } from "fflate";

if (process.platform !== "darwin")
  throw Error("This prototype requires macOS and the Swift toolchain.");
const exec = promisify(execFile);
const directory = await mkdtemp(join(tmpdir(), "sitefenn-desktop-spike-"));
const wrapper = join(directory, "sidecar");
const version = JSON.parse(await readFile("package.json", "utf8")).version;
const currentZip = await stat(
  `.local-data/packages/sitefenn-${version}-web-cli.zip`,
);

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) =>
    server.once("error", reject).listen(0, "127.0.0.1", resolve),
  );
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function processTree(pid) {
  const { stdout } = await exec("ps", ["-axo", "pid=,ppid=,rss="]);
  const rows = stdout
    .trim()
    .split("\n")
    .map((row) => row.trim().split(/\s+/).map(Number));
  const tree = (parent) =>
    rows
      .filter(([id, ppid]) => id !== parent && ppid === parent)
      .flatMap((row) => [row, ...tree(row[0])]);
  return [...rows.filter(([id]) => id === pid), ...tree(pid)];
}

async function sample(wrapped) {
  const port = await freePort();
  const started = performance.now();
  const processHandle = spawn(
    wrapped ? wrapper : process.execPath,
    wrapped
      ? [process.execPath, process.cwd()]
      : ["scripts/launch.mjs", "--no-browser"],
    {
      env: {
        ...process.env,
        PORT: String(port),
        HUB_DATA_DIR: join(directory, "workspace"),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const closed = new Promise((resolve) => processHandle.once("close", resolve));
  let logs = "";
  let members = [];
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(Error("Startup timeout")), 15000);
      closed.then(() => {
        clearTimeout(timeout);
        reject(Error(`Early exit: ${logs}`));
      });
      processHandle.once("error", reject);
      for (const stream of [processHandle.stdout, processHandle.stderr])
        stream.on("data", (chunk) => {
          logs += chunk;
          if (
            logs.includes(
              `SiteFenn bereit · ${version} · http://127.0.0.1:${port}`,
            )
          ) {
            clearTimeout(timeout);
            resolve();
          }
        });
    });
    const startMs = performance.now() - started;
    members = await processTree(processHandle.pid);
    return {
      startMs: Math.round(startMs),
      rssMiB: Number(
        (members.reduce((sum, row) => sum + row[2], 0) / 1024).toFixed(1),
      ),
    };
  } finally {
    processHandle.kill("SIGTERM");
    const force = setTimeout(() => {
      for (const [pid] of members.reverse()) {
        try {
          process.kill(pid, "SIGKILL");
        } catch {}
      }
      processHandle.kill("SIGKILL");
    }, 6500);
    const status = await closed;
    clearTimeout(force);
    if (status !== 0) throw Error(`Lifecycle stop failed: ${status}`);
    for (const [pid] of members) {
      try {
        process.kill(pid, 0);
      } catch (error) {
        if (error.code === "ESRCH") continue;
        throw error;
      }
      throw Error("A process survived shutdown.");
    }
  }
}

const median = (values) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
try {
  await exec(
    "swiftc",
    ["-O", "scripts/desktop-sidecar-spike.swift", "-o", wrapper],
    { timeout: 120000 },
  );
  await sample(false); // initialize the shared test workspace
  const plain = [],
    sidecar = [];
  for (let i = 0; i < 5; i++) {
    if (i % 2) {
      sidecar.push(await sample(true));
      plain.push(await sample(false));
    } else {
      plain.push(await sample(false));
      sidecar.push(await sample(true));
    }
  }
  const wrapperBytes = await readFile(wrapper);
  const summarize = (samples) => ({
    samples,
    medianStartMs: median(samples.map((item) => item.startMs)),
    medianRssMiB: median(samples.map((item) => item.rssMiB)),
  });
  console.log(
    JSON.stringify({
      platform: process.platform,
      arch: process.arch,
      node: process.version,
      plain: summarize(plain),
      sidecar: summarize(sidecar),
      webCliZipBytes: currentZip.size,
      sidecarBinaryBytes: wrapperBytes.length,
      sidecarCompressedBytes: zipSync({ sidecar: wrapperBytes }).byteLength,
      cleanShutdowns: 11,
    }),
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
