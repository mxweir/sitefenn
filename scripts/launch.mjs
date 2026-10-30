/** User-invoked local launcher. Downloads require an explicit --setup choice. */
import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
const [major] = process.versions.node.split(".");
if (Number(major) !== 24) {
  console.error(
    "SiteFenn benötigt Node.js 24. Installiere die offizielle Node-24-Laufzeit und starte erneut.",
  );
  process.exit(2);
}
const args = process.argv.slice(2);
if (args.some((a) => !["--setup", "--no-browser"].includes(a))) {
  console.error(
    "Optionen: --setup (bewusster Download von Abhängigkeiten/Chromium), --no-browser",
  );
  process.exit(2);
}
const run = (command, params) =>
  new Promise((done, reject) => {
    const child = spawn(command, params, {
      cwd: root,
      stdio: "inherit",
      shell: false,
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? done()
        : reject(
            Error("Schritt fehlgeschlagen; vorhandene Daten bleiben erhalten."),
          ),
    );
  });
try {
  const npm =
    process.platform === "win32" ? process.env.ComSpec || "cmd.exe" : "npm";
  const npmArgs = (params) =>
    process.platform === "win32"
      ? ["/d", "/s", "/c", "npm.cmd", ...params]
      : params;
  if (args.includes("--setup")) {
    console.log(
      "Bewusst gewähltes Setup: npm-Abhängigkeiten und Chromium werden heruntergeladen. Modelle werden nicht geladen.",
    );
    await run(npm, npmArgs(["ci"]));
    await run(npm, npmArgs(["run", "browser:install"]));
    await run(npm, npmArgs(["run", "build"]));
  }
  try {
    await access(resolve(root, "dist/server/index.js"));
    await access(resolve(root, "node_modules/playwright/package.json"));
  } catch {
    throw Error(
      "Erstes Setup fehlt. Im Projektordner: node scripts/launch.mjs --setup. Dieser Aufruf lädt Abhängigkeiten/Chromium bewusst herunter.",
    );
  }
  const port = Number(process.env.PORT || 4310);
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw Error("PORT: 1024–65535.");
  const child = spawn(process.execPath, ["dist/server/index.js"], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });
  let ready = false;
  const timer = setInterval(() => {
    void fetch(`http://127.0.0.1:${port}/`, {
      signal: AbortSignal.timeout(1000),
    })
      .then((r) => {
        if (r.ok && !ready) {
          ready = true;
          clearInterval(timer);
          if (!args.includes("--no-browser")) {
            const command =
              process.platform === "darwin"
                ? "open"
                : process.platform === "win32"
                  ? "explorer.exe"
                  : "xdg-open";
            const browser = spawn(command, [`http://127.0.0.1:${port}/`], {
              stdio: "ignore",
            });
            browser.on("error", () =>
              console.log(`Browser selbst öffnen: http://127.0.0.1:${port}/`),
            );
          }
        }
      })
      .catch(() => {});
  }, 500);
  timer.unref();
  child.on("error", (error) => {
    clearInterval(timer);
    console.error(error.message);
    process.exitCode = 2;
  });
  child.on("exit", (code) => {
    clearInterval(timer);
    process.exitCode = code ?? 2;
  });
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, () => child.kill(signal));
} catch (error) {
  console.error(error.message);
  process.exitCode = 2;
}
