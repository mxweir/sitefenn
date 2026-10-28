// CI-only: allow user namespaces for the two exact downloaded Chromium binaries.
// Chromium's documented AppArmor approach (not --no-sandbox and not a global sysctl):
// https://github.com/chromium/chromium/blob/main/docs/security/apparmor-userns-restrictions.md
// This profile is for an ephemeral GitHub-hosted Ubuntu VM, never a user installation.
import { chromium } from "playwright";
import { basename, dirname, join, relative } from "node:path";
import { realpathSync, statSync, existsSync } from "node:fs";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

if (
  process.platform !== "linux" ||
  process.env.GITHUB_ACTIONS !== "true" ||
  process.env.RUNNER_ENVIRONMENT !== "github-hosted"
) {
  throw new Error(
    "Sandbox setup is restricted to an ephemeral GitHub-hosted Linux runner.",
  );
}
if (
  !existsSync("/sys/module/apparmor/parameters/enabled") ||
  !existsSync("/etc/apparmor.d/abi/4.0")
) {
  throw new Error(
    "Expected Ubuntu AppArmor installation is unavailable; refusing a sandbox workaround.",
  );
}
const executable = realpathSync(chromium.executablePath());
const revisionDirectory = dirname(dirname(executable));
const revision = basename(revisionDirectory).match(/^chromium-(\d+)$/)?.[1];
if (!revision)
  throw new Error("Unexpected Playwright Chromium executable layout.");
const cache = dirname(revisionDirectory);
const headless = realpathSync(
  join(
    cache,
    `chromium_headless_shell-${revision}`,
    "chrome-headless-shell-linux64",
    "chrome-headless-shell",
  ),
);
const binaries = [executable, headless];
for (const binary of binaries) {
  if (
    !binary.startsWith("/") ||
    /["\n\r\x00{}*?\[\]\\]/.test(binary) ||
    relative(cache, binary).startsWith("..") ||
    !statSync(binary).isFile()
  ) {
    throw new Error("Refusing an unexpected or non-exact executable path.");
  }
}
const profile = `abi <abi/4.0>,\ninclude <tunables/global>\n\n${binaries.map((binary, index) => `profile sitefenn-ci-chromium-${index} "${binary}" flags=(unconfined) {\n  userns,\n}`).join("\n\n")}\n`;
const temporary = await mkdtemp(join(tmpdir(), "sitefenn-ci-apparmor-"));
try {
  const source = join(temporary, "profile");
  await writeFile(source, profile, { mode: 0o600 });
  const destination = "/etc/apparmor.d/sitefenn-ci-chromium";
  execFileSync(
    "sudo",
    [
      "-n",
      "install",
      "-o",
      "root",
      "-g",
      "root",
      "-m",
      "0644",
      source,
      destination,
    ],
    { stdio: "inherit" },
  );
  execFileSync("sudo", ["-n", "apparmor_parser", "-r", "-W", destination], {
    stdio: "inherit",
  });
  console.log(
    `AppArmor userns permission installed for Chromium revision ${revision}, exact executable paths only. Chromium sandbox stays enabled.`,
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}
