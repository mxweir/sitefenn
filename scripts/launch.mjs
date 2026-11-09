/** User-invoked local launcher. Downloads require an explicit --setup choice. */
import { fork, spawn } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
const setup = "node scripts/launch.mjs --setup";
const doctor = "node scripts/launch.mjs --doctor";
const args = process.argv.slice(2);
const version = JSON.parse(await readFile("package.json", "utf8")).version;
const host = "127.0.0.1";

function freePort(port) {
  return new Promise((done, reject) => {
    const socket = createServer();
    socket.once("error", reject);
    socket.listen({ host, port, exclusive: true }, () => socket.close(done));
  });
}

async function checkBuild() {
  try {
    await access("dist/server/index.js");
    const html = await readFile("dist/web/index.html", "utf8");
    const assets = [
      ...html.matchAll(/(?:src|href)="(\/assets\/[\w.-]+)"/g),
    ].map((entry) => entry[1]);
    if (!assets.some((path) => path.endsWith(".js")))
      throw Error("Frontend-Bundle fehlt.");
    await Promise.all(assets.map((path) => access(`dist/web${path}`)));
    const built = await import("../dist/shared/version.js");
    if (built.APP_VERSION !== version)
      throw Error("Build-Version stimmt nicht mit dem Paket überein.");
  } catch {
    throw Error(
      `Build fehlt oder gehört zu einer anderen Version. Reparatur: ${setup}`,
    );
  }
  try {
    await import("playwright");
  } catch {
    throw Error(
      `Abhängigkeiten fehlen oder sind beschädigt. Reparatur: ${setup}`,
    );
  }
}

async function diagnose() {
  let failure = false;
  try {
    await checkBuild();
    console.log(`[OK] Build und Abhängigkeiten · SiteFenn ${version}`);
  } catch (error) {
    failure = true;
    console.error(`[FEHLT] ${error.message}`);
  }
  let browser;
  try {
    const { chromium } = await import("playwright");
    browser = await chromium.launch({
      headless: true,
      chromiumSandbox: true,
      args: ["--disable-background-networking"],
      timeout: 8000,
    });
    console.log("[OK] Chromium startet mit Sandbox.");
  } catch {
    failure = true;
    console.error(
      "[FEHLT] Chromium konnte nicht starten. Browser installieren: npm run browser:install",
    );
    if (process.platform === "linux")
      console.error(
        "Linux: Fehlende Systembibliotheken oder AppArmor-/Sandbox-Konfiguration prüfen. Siehe README.",
      );
  } finally {
    await browser?.close();
  }
  try {
    const response = await fetch("http://127.0.0.1:11434/api/tags", {
      signal: AbortSignal.timeout(1500),
      redirect: "error",
    });
    const body = response.ok ? await response.json() : null;
    if (!Array.isArray(body?.models)) throw Error();
    console.log(
      body.models.length
        ? `[OPTIONAL] Ollama erreichbar · ${body.models.length} Modelle. In System & Setup ausdrücklich wählen.`
        : "[OPTIONAL] Ollama erreichbar · noch kein Modell. Bei Bedarf ein lokales Modell bewusst laden.",
    );
  } catch {
    console.log(
      "[OPTIONAL] Ollama nicht erreichbar. Regelbasierte Checks funktionieren weiterhin.",
    );
  }
  if (failure) process.exitCode = 2;
}

const run = (command, params) =>
  new Promise((done, reject) => {
    const child = spawn(command, params, {
      cwd: root,
      stdio: "inherit",
      shell: false,
    });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? done()
        : reject(
            Error(
              "Setup fehlgeschlagen. Prüfe die Ausgabe und starte das Setup erneut.",
            ),
          ),
    );
  });

function start(port, timeout) {
  const origin = `http://${host}:${port}`;
  const child = fork("dist/server/index.js", [], {
    cwd: root,
    env: process.env,
    execArgv: [],
    stdio: ["inherit", "inherit", "inherit", "ipc"],
  });
  let ready = false;
  let stopping = false;
  let force;
  let failed = false;
  function stop(signal) {
    if (stopping) return;
    stopping = true;
    clearTimeout(deadline);
    child.kill(signal);
    force = setTimeout(() => child.kill("SIGKILL"), 5000);
    force.unref();
  }
  function fail(reason) {
    if (stopping) return;
    failed = true;
    console.error(reason);
    process.exitCode = 2;
    stop("SIGTERM");
  }
  const deadline = setTimeout(
    () =>
      fail(
        `Startzeit überschritten (${timeout} ms). SiteFenn wurde beendet. Diagnose: ${doctor}`,
      ),
    timeout,
  );
  const interrupt = () => stop("SIGINT");
  const terminate = () => stop("SIGTERM");
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", terminate);
  child.on("message", (message) => {
    if (ready || stopping || message?.protocol !== "sitefenn-launch-1") return;
    if (message.state === "failed") {
      fail(
        message.code === "EADDRINUSE"
          ? `Port ${port} ist belegt. Beende die andere Instanz oder wähle einen anderen PORT.`
          : `SiteFenn konnte nicht starten. Details stehen oben. Diagnose: ${doctor}`,
      );
      return;
    }
    if (
      message.state !== "ready" ||
      message.pid !== child.pid ||
      message.version !== version ||
      message.origin !== origin
    ) {
      fail(
        `Startbestätigung passt nicht zum gestarteten Dienst. Reparatur: ${setup}`,
      );
      return;
    }
    ready = true;
    clearTimeout(deadline);
    console.log(`SiteFenn bereit · ${version} · ${origin}`);
    if (!args.includes("--no-browser")) {
      const command =
        process.platform === "darwin"
          ? "open"
          : process.platform === "win32"
            ? "explorer.exe"
            : "xdg-open";
      const browser = spawn(command, [origin], { stdio: "ignore" });
      browser.once("error", () =>
        console.log(`Browser selbst öffnen: ${origin}`),
      );
    }
  });
  child.once("error", () =>
    fail(`Serverprozess konnte nicht gestartet werden. Diagnose: ${doctor}`),
  );
  child.once("close", (code) => {
    clearTimeout(deadline);
    clearTimeout(force);
    process.removeListener("SIGINT", interrupt);
    process.removeListener("SIGTERM", terminate);
    if (!ready && !stopping) {
      console.error(
        `Server endete vor der Startbestätigung. Diagnose: ${doctor}`,
      );
      process.exitCode = 2;
    } else if (!failed) process.exitCode = code ?? (stopping ? 0 : 2);
  });
}

try {
  if (process.versions.node.split(".")[0] !== "24")
    throw Error(
      "SiteFenn benötigt Node.js 24. Installiere die offizielle Node-24-Laufzeit und starte erneut.",
    );
  if (
    args.some(
      (arg) => !["--setup", "--doctor", "--no-browser"].includes(arg),
    ) ||
    (args.includes("--doctor") && args.includes("--setup"))
  )
    throw Error(
      "Optionen: --doctor (Diagnose), --setup (bewusster Download), --no-browser.",
    );
  if (args.includes("--doctor")) {
    console.log(`[OK] Node.js ${process.version}`);
    await diagnose();
  } else {
    const port = Number(process.env.PORT || 4310);
    const timeout = Number(process.env.SITEFENN_START_TIMEOUT_MS || 25000);
    if (!Number.isInteger(port) || port < 1024 || port > 65535)
      throw Error("PORT: 1024–65535.");
    if (!Number.isInteger(timeout) || timeout < 250 || timeout > 120000)
      throw Error("SITEFENN_START_TIMEOUT_MS: 250–120000.");
    try {
      await freePort(port);
    } catch (error) {
      if (error.code === "EADDRINUSE")
        throw Error(
          `Port ${port} ist belegt. Beende die andere Instanz oder wähle einen anderen PORT.`,
        );
      throw error;
    }
    if (args.includes("--setup")) {
      console.log(
        "Bewusst gewähltes Setup: npm-Abhängigkeiten und Chromium werden heruntergeladen.",
      );
      const windows = process.platform === "win32";
      const npm = windows ? process.env.ComSpec || "cmd.exe" : "npm";
      for (const params of [
        ["ci"],
        ["run", "browser:install"],
        ["run", "build"],
      ])
        await run(
          npm,
          windows ? ["/d", "/s", "/c", "npm.cmd", ...params] : params,
        );
    }
    await checkBuild();
    start(port, timeout);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 2;
}
