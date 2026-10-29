/** 1.1 feasibility checks, not an installer or a Google connector. No Google requests. */
import { createServer } from "node:http";
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { mkdir, writeFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import assert from "node:assert/strict";
import { APP_VERSION } from "../shared/version.js";
import { percentile } from "../server/services/evaluation.js";

const output = resolve(
  process.argv[2] ?? `.local-data/readiness-${Date.now()}`,
);
await mkdir(output, { recursive: true, mode: 0o700 });
const dataDir = join(output, "workspace");
const listener = createServer();
await new Promise<void>((done) => listener.listen(0, "127.0.0.1", done));
const address = listener.address();
assert.ok(address && typeof address !== "string");
const port = address.port;
await new Promise<void>((done) => listener.close(() => done()));
const base = `http://127.0.0.1:${port}`;
let child: ChildProcess | undefined,
  cookie = "";
async function stop() {
  if (!child || child.exitCode !== null) return;
  const current = child;
  const ended = new Promise<void>((done) => current.once("exit", () => done()));
  current.kill("SIGTERM");
  const guard = setTimeout(() => current.kill("SIGKILL"), 8000);
  await ended;
  clearTimeout(guard);
  child = undefined;
}
async function start() {
  child = spawn(process.execPath, ["dist/server/index.js"], {
    env: { ...process.env, PORT: String(port), HUB_DATA_DIR: dataDir },
    stdio: ["ignore", "ignore", "pipe"],
  });
  let errors = "";
  child.stderr?.on("data", (bytes) => {
    errors = (errors + bytes.toString()).slice(-3000);
  });
  for (let count = 0; count < 100; count++) {
    if (child.exitCode !== null) throw new Error(`Sidecar exited: ${errors}`);
    try {
      const response = await fetch(base, { signal: AbortSignal.timeout(1000) });
      if (response.ok) {
        cookie = response.headers.get("set-cookie")!.split(";")[0]!;
        return;
      }
    } catch {}
    await delay(100);
  }
  throw new Error("Sidecar startup timed out");
}
async function api(path: string, body?: unknown) {
  const response = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      cookie,
      origin: base,
      "x-hub-request": "1",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Sidecar ${path}: ${response.status}`);
  return response.json();
}
async function until<T>(
  read: () => Promise<T>,
  done: (value: T) => boolean,
  timeout = 90000,
): Promise<T> {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = await read();
    if (done(value)) return value;
    await delay(150);
  }
  throw new Error("Readiness condition timed out");
}
const started = Date.now();
try {
  await start();
  const bootstrap = await api("/api/bootstrap");
  assert.equal(bootstrap.version, APP_VERSION);
  const { project, scan } = await api("/api/demo", {});
  const ages: number[] = [],
    seen = new Set<string>();
  let framePolls = 0;
  const poll = setInterval(() => {
    void api(`/api/scans/${scan.id}/live`)
      .then((value) => {
        framePolls++;
        if (value.frame && !seen.has(value.frame.id)) {
          seen.add(value.frame.id);
          ages.push(
            Math.max(0, Date.now() - Date.parse(value.frame.capturedAt)),
          );
        }
      })
      .catch(() => {});
  }, 1000);
  let first;
  try {
    first = await until(
      () => api(`/api/scans/${scan.id}`),
      (value) => value.scan.status === "completed",
    );
  } finally {
    clearInterval(poll);
  }
  assert.equal(first.scan.result.audit.coverage.completed, 9);
  assert.match(
    first.scan.result.audit.provenance.engineSha256,
    /^[a-f0-9]{64}$/,
  );
  const next = await api("/api/demo", {});
  await until(
    () => api(`/api/scans/${next.scan.id}`),
    (value) =>
      value.scan.status === "completed" ||
      value.scan.result?.audit?.coverage.completed > 0,
  );
  const terminal = await api(`/api/scans/${next.scan.id}`);
  assert.notEqual(
    terminal.scan.status,
    "completed",
    "Cancel test needs a partial scan, not a finished job",
  );
  const cancelStart = Date.now();
  await api(`/api/scans/${next.scan.id}/control`, { action: "cancel" });
  const cancelled = await until(
    () => api(`/api/scans/${next.scan.id}`),
    (value) => value.scan.status === "cancelled",
  );
  const cancelToTerminalMs = Date.now() - cancelStart;
  assert.equal(cancelled.score.final, false);
  await stop();
  await assert.rejects(fetch(base, { signal: AbortSignal.timeout(1000) }));
  await start();
  const reloaded = await api("/api/bootstrap");
  assert.ok(
    reloaded.projects.some((item: { id: string }) => item.id === project.id),
  );
  assert.equal((await api(`/api/scans/${scan.id}`)).scan.status, "completed");
  await api(`/api/scans/${next.scan.id}/control`, { action: "resume" });
  const resumed = await until(
    () => api(`/api/scans/${next.scan.id}`),
    (value) => value.scan.status === "completed",
  );
  assert.equal(resumed.scan.result.audit.coverage.completed, 9);
  const identity = resumed.scan.result.audit.provenance;
  await stop();
  const desktop = {
    testedAt: new Date().toISOString(),
    platform: process.platform,
    arch: process.arch,
    appVersion: APP_VERSION,
    provenance: identity,
    tests: {
      startup: true,
      realDemoNineProfiles: true,
      cancelPartial: true,
      cancelToTerminalMs,
      closedPort: true,
      restartPreservesProject: true,
      resumeAfterRestart: true,
    },
    live: {
      pollMs: 1000,
      polls: framePolls,
      freshFrames: ages.length,
      captureToHttpReceiptP95Ms: percentile(ages, 0.95),
      boundary:
        "Real API sampled once per second; excludes browser image decode and paint. Small demo sample, not a general latency guarantee.",
    },
    nodeBinaryBytes: (await stat(process.execPath)).size,
    tauriPackaged: false,
    installerSigned: false,
  };
  await writeFile(
    join(output, "desktop.json"),
    JSON.stringify(desktop, null, 2),
    { mode: 0o600 },
  );
  console.log(
    "Node service lifecycle smoke passed; Tauri packaging/signing not yet tested.",
  );
} finally {
  await stop();
}

// Deliberately local protocol contract check: no browser login, authorization-code exchange or tokens.
const verifier = randomBytes(32).toString("base64url"),
  state = randomBytes(32).toString("base64url");
const challenge = createHash("sha256").update(verifier).digest("base64url");
let consumed = false;
const callback = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://callback");
  if (req.method !== "GET" || url.pathname !== "/oauth/callback") {
    res.writeHead(404);
    res.end();
    return;
  }
  const incoming = url.searchParams.get("state") ?? "";
  const incomingBytes = Buffer.from(incoming),
    expectedBytes = Buffer.from(state);
  if (
    incomingBytes.length !== expectedBytes.length ||
    !timingSafeEqual(incomingBytes, expectedBytes)
  ) {
    res.writeHead(403);
    res.end();
    return;
  }
  if (consumed) {
    res.writeHead(409);
    res.end();
    return;
  }
  if (!url.searchParams.get("code")) {
    res.writeHead(400);
    res.end();
    return;
  }
  consumed = true;
  res.writeHead(200);
  res.end("Local synthetic protocol check only.");
});
await new Promise<void>((done) => callback.listen(0, "127.0.0.1", done));
try {
  const address = callback.address();
  assert.ok(address && typeof address !== "string");
  const redirect = `http://127.0.0.1:${address.port}/oauth/callback`;
  const authorization = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  for (const [key, value] of Object.entries({
    client_id: "synthetic-not-a-real-client",
    redirect_uri: redirect,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }))
    authorization.searchParams.set(key, value);
  assert.equal(
    (await fetch(`${redirect}?state=wrong&code=synthetic`)).status,
    403,
  );
  assert.equal(
    (
      await fetch(
        `${redirect}?state=${encodeURIComponent("é".repeat(state.length))}&code=synthetic`,
      )
    ).status,
    403,
  );
  assert.equal(
    (await fetch(`${redirect}?state=${state}&code=synthetic`)).status,
    200,
  );
  assert.equal(
    (await fetch(`${redirect}?state=${state}&code=synthetic`)).status,
    409,
  );
  assert.ok(verifier.length >= 43 && verifier.length <= 128);
  await writeFile(
    join(output, "oauth.json"),
    JSON.stringify(
      {
        testedAt: new Date().toISOString(),
        providerRequests: 0,
        pkceS256: true,
        loopbackCallback: true,
        stateMismatchRejected: true,
        replayRejected: true,
        readOnlyScope: true,
        googleConsentTested: false,
        tokenStorageTested: false,
        googleProjectConfigured: false,
        durationTotalMs: Date.now() - started,
        nextRequirements: [
          "Real desktop OAuth client and enabled Search Console API",
          "User consent and authorized property",
          "OS secret-store integration, expiry/revocation and provider errors",
          "Potential Google verification requirements",
        ],
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  console.log(
    `Local OAuth protocol contract passed; real Google authorization untested. Private reports: ${output}`,
  );
} finally {
  await new Promise<void>((done) => callback.close(() => done()));
}
