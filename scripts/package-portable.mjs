/** Packages only allowlisted application sources/build, never workspace data or credentials. */
import { readdir, lstat, readFile, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { zipSync, strToU8 } from "fflate";
const version = JSON.parse(await readFile("package.json", "utf8")).version;
const entries = {};
let total = 0;
async function add(path) {
  const stat = await lstat(path);
  if (stat.isSymbolicLink())
    throw Error("Symlink im Paketumfang nicht erlaubt.");
  if (stat.isDirectory()) {
    for (const name of await readdir(path)) {
      if (name.startsWith(".") || name === "node_modules") continue;
      await add(join(path, name));
    }
  } else if (stat.isFile()) {
    const data = await readFile(path);
    total += data.length;
    if (total > 80 * 1024 * 1024) throw Error("Paket über 80 MiB.");
    entries[path.replaceAll("\\", "/")] = [
      data,
      {
        os: 3,
        attrs: ((path.endsWith(".command") ? 0o100755 : 0o100644) << 16) >>> 0,
      },
    ];
  }
}
for (const p of [
  "dist",
  "server",
  "shared",
  "web",
  "public",
  "docs",
  "examples",
  "tests",
  "playwright.config.ts",
  "scripts",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "tsconfig.server.json",
  "vite.config.ts",
  "index.html",
  "LICENSE",
  "README.md",
  "SiteFenn.command",
  "SiteFenn-Windows.cmd",
])
  await add(p);
entries["PORTABLE-README.txt"] = strToU8(
  "SiteFenn local Web/CLI package. Not a signed native installer. Node.js 24 required.\nFirst setup (explicit dependency/Chromium download): node scripts/launch.mjs --setup\nThen: node scripts/launch.mjs\nExisting user data remains in the same legacy workspace directory. Back up before manual updates.\nGoogle connector experimental/macOS Keychain only; Windows/native distribution not validated.\n",
);
const bytes = zipSync(entries, { level: 6 });
const sha = createHash("sha256").update(bytes).digest("hex");
await mkdir(".local-data/packages", { recursive: true });
const out = resolve(`.local-data/packages/sitefenn-${version}-web-cli.zip`);
await writeFile(out, bytes);
await writeFile(out + ".sha256", sha + "  " + out.split("/").at(-1) + "\n");
console.log(
  JSON.stringify({
    path: out,
    sha256: sha,
    bytes: bytes.length,
    files: Object.keys(entries).length,
    meaning:
      "Portable source/build package; runtime and Chromium are explicitly installed separately; no publisher signature.",
  }),
);
