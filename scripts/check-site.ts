/** Explicit standalone CLI: no uploads, source changes, LLM or credentials. */
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { performScan } from "../server/scan-worker.js";
import { closeAuditResources } from "../server/audit-engine.js";
import { normalizeScanOptions } from "../server/options.js";
import { parseTarget, validateTarget } from "../server/security.js";
import { releaseGate } from "../server/services/release-gate.js";
import type { CheckProfile } from "../shared/check-profile.js";
import type { Scan } from "../shared/types.js";
const args = process.argv.slice(2);
const value = (flag: string) => {
  const i = args.indexOf(flag);
  return i < 0 ? undefined : args[i + 1];
};
async function json(path: string, max: number) {
  if ((await stat(path)).size > max)
    throw Error("JSON-Datei überschreitet Größenlimit.");
  return JSON.parse(await readFile(path, "utf8"));
}
try {
  const known = new Set([
    "--profile",
    "--out",
    "--baseline",
    "--authorized",
    "--help",
  ]);
  for (let i = 0; i < args.length; i++) {
    const key = args[i]!;
    if (!known.has(key)) throw Error("Unbekanntes CLI-Argument.");
    if (!["--authorized", "--help"].includes(key)) {
      if (!args[i + 1] || args[i + 1]!.startsWith("--"))
        throw Error("CLI-Wert fehlt.");
      i++;
    }
  }
  if (args.includes("--help")) {
    console.log(
      "npm run audit:check -- --profile profile.json --out NEW_OUTPUT_FOLDER --authorized [--baseline baseline.json]\nExit: 0 no new measured blockers; 1 regression; 2 inconclusive/error. First run without baseline is inconclusive and produces report.json for the next run.",
    );
    process.exitCode = 0;
  } else {
    if (!args.includes("--authorized"))
      throw Error("Nur freigegebene Ziele prüfen: --authorized erforderlich.");
    const profilePath = value("--profile");
    if (!profilePath) throw Error("--profile erforderlich.");
    const profile = (await json(profilePath, 100000)) as CheckProfile;
    if (
      profile.version !== "sitefenn-profile-1" ||
      typeof profile.projectId !== "string" ||
      !profile.projectId ||
      profile.projectId.length > 100 ||
      !["production", "staging", "local"].includes(profile.environment) ||
      !profile.gate ||
      !["critical", "important"].includes(profile.gate.minimumPriority) ||
      !Array.isArray(profile.gate.categories) ||
      !profile.gate.categories.length ||
      new Set(profile.gate.categories).size !==
        profile.gate.categories.length ||
      profile.gate.categories.some(
        (c) =>
          ![
            "layout",
            "accessibility",
            "seo",
            "runtime",
            "performance",
          ].includes(c),
      )
    )
      throw Error("Ungültiges Prüfprofil oder Gate-Policy.");
    const target = parseTarget(profile.url, {
      allowLocal: profile.environment === "local",
    });
    const allowedLocalOrigin =
      profile.environment === "local" ? target.origin : undefined;
    await validateTarget(target, { allowedLocalOrigin });
    const options = normalizeScanOptions(profile.options, profile.url);
    if (profile.gate.categories.includes("performance") && !options.performance)
      throw Error("Performance-Gate benötigt aktivierte Performance-Messung.");
    const out = resolve(value("--out") ?? `.local-data/cli-${Date.now()}`);
    await mkdir(resolve(out, ".."), { recursive: true });
    await mkdir(out, { recursive: false, mode: 0o700 });
    const id = randomUUID(),
      createdAt = new Date().toISOString();
    const result = await performScan({
      id,
      url: profile.url,
      environment: profile.environment,
      dataDir: out,
      allowedLocalOrigin,
      options,
    });
    const scan: Scan = {
      id,
      projectId: profile.projectId,
      status: "completed",
      error: null,
      createdAt,
      finishedAt: new Date().toISOString(),
      options,
      result,
    };
    const baselinePath = value("--baseline");
    const before = baselinePath
      ? ((await json(baselinePath, 30 * 1024 * 1024)) as Scan)
      : undefined;
    const gate = releaseGate(scan, before, profile.gate);
    await writeFile(
      join(out, "report.json"),
      JSON.stringify(scan, null, 2) + "\n",
      { flag: "wx", mode: 0o600 },
    );
    await writeFile(
      join(out, "gate.json"),
      JSON.stringify(gate, null, 2) + "\n",
      { flag: "wx", mode: 0o600 },
    );
    console.log(
      JSON.stringify({
        status: gate.status,
        exitCode: gate.exitCode,
        blockers: gate.blockers.length,
        unknown: gate.unknown,
        output: out,
      }),
    );
    process.exitCode = gate.exitCode;
  }
} catch (error) {
  console.error(
    JSON.stringify({
      status: "inconclusive",
      exitCode: 2,
      error: error instanceof Error ? error.message : "Prüfung fehlgeschlagen.",
    }),
  );
  process.exitCode = 2;
} finally {
  await closeAuditResources();
}
