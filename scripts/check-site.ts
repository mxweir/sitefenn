/** Explicit standalone CLI: no uploads, source changes, LLM or credentials. */
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { normalizeAuditUrl } from "../server/audit-engine.js";
import { canonical } from "../shared/canonical.js";
import { performScan } from "../server/scan-worker.js";
import { closeAuditResources } from "../server/audit-engine.js";
import { validateTarget } from "../server/security.js";
import { releaseGate } from "../server/services/release-gate.js";
import { parseCheckProfile } from "../server/services/check-profile.js";
import {
  baselineReport,
  baselineReview,
  reviewedBaseline,
} from "../server/services/cli-baseline.js";
import { APP_VERSION } from "../shared/version.js";
import type { Scan } from "../shared/types.js";

const args = process.argv.slice(2);
const flags = new Set(["--authorized", "--help"]);
const known = new Set([
  ...flags,
  "--profile",
  "--out",
  "--baseline",
  "--candidate",
  "--confirm",
  "--name",
  "--source-repo",
]);
const values = new Map<string, string>();
let output: string | undefined;
let toolRevision: string | undefined;
function gitRevision(path: string) {
  const git = (args: string[]) =>
    execFileSync("git", ["-C", path, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5000,
    });
  if (
    realpathSync(git(["rev-parse", "--show-toplevel"]).trim()) !==
    realpathSync(path)
  )
    throw Error(
      "Git-Quellordner muss das Wurzelverzeichnis des Checkouts sein.",
    );
  if (git(["status", "--porcelain", "--untracked-files=no"]).trim())
    throw Error("Quell-Checkout hat Änderungen an versionierten Dateien.");
  const revision = git(["rev-parse", "--verify", "HEAD^{commit}"]).trim();
  if (!/^[a-f0-9]{40,64}$/.test(revision))
    throw Error("Quellrevision nicht verifizierbar.");
  return revision;
}
async function json(path: string, max = 30 * 1024 * 1024) {
  if ((await stat(path)).size > max)
    throw Error("JSON-Datei überschreitet Größenlimit.");
  return JSON.parse(await readFile(path, "utf8"));
}
const save = (path: string, data: unknown) =>
  writeFile(path, JSON.stringify(data, null, 2) + "\n", {
    flag: "wx",
    mode: 0o600,
  });
function markdown(gate: {
  status: string;
  exitCode: number;
  blockers: unknown[];
  existing: unknown[];
  unknown: unknown[];
}) {
  return `## SiteFenn ${APP_VERSION} · ${gate.status}\n\n| New blockers | Existing blockers | Coverage / comparison gaps | Exit |\n| ---: | ---: | ---: | ---: |\n| ${gate.blockers.length} | ${gate.existing.length} | ${gate.unknown.length} | ${gate.exitCode} |\n`;
}
function scopeMatches(
  scan: Scan,
  profile: ReturnType<typeof parseCheckProfile>,
) {
  if (
    scan.projectId !== profile.projectId ||
    !scan.result?.audit ||
    scan.result.audit.options.pages.some(
      (page) => new URL(page).origin !== new URL(profile.url).origin,
    )
  )
    throw Error("Kandidat gehört zu einem anderen Projekt oder Ursprung.");
  const { options } = scan.result.audit;
  const expected = {
    ...profile.options,
    pages: profile.options.pages.map((page) => normalizeAuditUrl(page)),
  };
  if (
    canonical(JSON.parse(JSON.stringify(options))) !==
    canonical(JSON.parse(JSON.stringify(expected)))
  )
    throw Error("Kandidat und Profil haben einen anderen Messumfang.");
}

try {
  const command =
    args[0]?.startsWith("--") || !args[0] ? "check" : args.shift();
  if (!["check", "baseline-review", "baseline-adopt"].includes(command!))
    throw Error("Unbekannter Befehl.");
  for (let i = 0; i < args.length; i++) {
    const key = args[i]!;
    if (!known.has(key) || values.has(key))
      throw Error("Unbekanntes oder doppeltes CLI-Argument.");
    const value = flags.has(key) ? "" : args[++i];
    if (
      value === undefined ||
      (!flags.has(key) && (!value || value.startsWith("--")))
    )
      throw Error("CLI-Wert fehlt.");
    values.set(key, value);
  }
  if (values.has("--help")) {
    console.log(`npm run audit:check -- --profile profile.json --out NEW_DIR --authorized [--baseline baseline.json] [--source-repo PATH]
npm run audit:check -- baseline-review --profile profile.json --candidate NEW_DIR/report.json [--baseline old.json]
npm run audit:check -- baseline-adopt --profile profile.json --candidate NEW_DIR/report.json --name NAME --confirm SHA256 --out NEW_BASELINE.json [--baseline old.json]
Exit: 0 pass; 1 regression; 2 inconclusive/error. First check without baseline produces a candidate and exits 2.`);
  } else {
    const profilePath = values.get("--profile");
    if (!profilePath) throw Error("--profile erforderlich.");
    const profile = parseCheckProfile(await json(profilePath, 100000));
    const baselinePath = values.get("--baseline");
    const before = baselinePath
      ? baselineReport(await json(baselinePath, 31 * 1024 * 1024))
      : undefined;
    if (command !== "check") {
      const candidate = values.get("--candidate");
      if (!candidate) throw Error("--candidate erforderlich.");
      const report = baselineReport(await json(candidate));
      scopeMatches(report, profile);
      if (command === "baseline-review") {
        const review = baselineReview(report, profile.gate, before);
        console.log(JSON.stringify(review));
        process.exitCode = review.eligible ? 0 : 2;
      } else {
        const path = values.get("--out"),
          name = values.get("--name"),
          digest = values.get("--confirm");
        if (!path || !name || !digest)
          throw Error("--out, --name und --confirm erforderlich.");
        await save(
          path,
          reviewedBaseline(report, name, profile.gate, digest, before),
        );
      }
    } else {
      if (!values.has("--authorized"))
        throw Error(
          "Nur freigegebene Ziele prüfen: --authorized erforderlich.",
        );
      const out = resolve(
        values.get("--out") ?? `.local-data/cli-${Date.now()}`,
      );
      await mkdir(dirname(out), { recursive: true });
      await mkdir(out, { mode: 0o700 });
      output = out;
      try {
        toolRevision = gitRevision(process.cwd());
      } catch {}
      const sourcePath = values.get("--source-repo");
      const sourceRevision = sourcePath ? gitRevision(sourcePath) : undefined;
      const target = new URL(profile.url);
      const allowedLocalOrigin =
        profile.environment === "local" ? target.origin : undefined;
      await validateTarget(target, { allowedLocalOrigin });
      const id = randomUUID(),
        createdAt = new Date().toISOString();
      const result = await performScan({
        id,
        url: profile.url,
        environment: profile.environment,
        dataDir: out,
        allowedLocalOrigin,
        options: profile.options,
      });
      const scan: Scan = {
        id,
        projectId: profile.projectId,
        status: "completed",
        error: null,
        createdAt,
        finishedAt: new Date().toISOString(),
        options: profile.options,
        result,
      };
      if (sourcePath && gitRevision(sourcePath) !== sourceRevision)
        throw Error("Quell-Checkout hat sich während der Prüfung verändert.");
      if (sourceRevision)
        scan.sourceCheckout = {
          revision: sourceRevision,
          kind: "local-tracked-checkout",
        };
      const gate = {
        ...releaseGate(scan, before, profile.gate),
        tool: { version: APP_VERSION, revision: toolRevision },
        sourceCheckout: scan.sourceCheckout,
      };
      await save(join(out, "report.json"), scan);
      await save(join(out, "gate.json"), gate);
      await writeFile(join(out, "summary.md"), markdown(gate), {
        flag: "wx",
        mode: 0o600,
      });
      console.log(
        JSON.stringify({
          status: gate.status,
          exitCode: gate.exitCode,
          blockers: gate.blockers.length,
          existing: gate.existing.length,
          unknown: gate.unknown,
          output: out,
        }),
      );
      process.exitCode = gate.exitCode;
    }
  }
} catch (error) {
  const unknown = [
    error instanceof Error ? error.message : "Prüfung fehlgeschlagen.",
  ];
  const failure = {
    version: "release-gate-2.1",
    status: "inconclusive",
    exitCode: 2,
    blockers: [],
    existing: [],
    unknown,
    tool: { version: APP_VERSION, revision: toolRevision },
  };
  if (output) {
    await save(join(output, "gate.json"), failure).catch(() => {});
    await writeFile(join(output, "summary.md"), markdown(failure), {
      flag: "wx",
      mode: 0o600,
    }).catch(() => {});
  }
  console.error(JSON.stringify(failure));
  process.exitCode = 2;
} finally {
  await closeAuditResources();
}
