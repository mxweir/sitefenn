import { createHash } from "node:crypto";
import { canonical } from "../../shared/canonical.js";
import type { Scan } from "../../shared/types.js";
import { gateCoverage, releaseGate, type GatePolicy } from "./release-gate.js";

export function reportDigest(report: Scan): string {
  return createHash("sha256")
    .update(canonical(JSON.parse(JSON.stringify(report))))
    .digest("hex");
}

export function baselineReport(input: unknown): Scan {
  const artifact = input as {
    version?: string;
    sha256?: string;
    report?: Scan;
  } | null;
  if (artifact?.version === "sitefenn-reviewed-baseline-1") {
    if (!artifact.report || reportDigest(artifact.report) !== artifact.sha256)
      throw Error("Baseline-Prüfsumme stimmt nicht.");
    return artifact.report;
  }
  if (artifact && typeof artifact === "object" && "status" in artifact)
    return input as Scan;
  throw Error("Ungültige Baseline-Datei.");
}

export function baselineReview(
  report: Scan,
  policy: GatePolicy,
  before?: Scan,
) {
  const unknown = gateCoverage(report, policy);
  const previous = before ? releaseGate(report, before, policy) : undefined;
  return {
    sha256: reportDigest(report),
    eligible: !unknown.length && (!previous || previous.status === "pass"),
    unknown: previous?.unknown ?? unknown,
    newBlockers: previous?.blockers.length ?? 0,
    checks: report.result?.audit?.coverage ?? null,
    findings: report.result?.audit?.findings.length ?? 0,
  };
}

export function reviewedBaseline(
  report: Scan,
  name: string,
  policy: GatePolicy,
  sha256: string,
  before?: Scan,
) {
  if (!name.trim() || name.length > 100)
    throw Error("Baseline-Name mit 1–100 Zeichen erforderlich.");
  const review = baselineReview(report, policy, before);
  if (sha256 !== review.sha256)
    throw Error("Die Bestätigung passt nicht zur Kandidaten-Prüfsumme.");
  if (!review.eligible)
    throw Error("Kandidat hat Messlücken, neue Blocker oder ist inkompatibel.");
  return {
    version: "sitefenn-reviewed-baseline-1",
    name: name.trim(),
    sha256,
    previousSha256: before ? reportDigest(before) : null,
    report,
  };
}
