import { canonical } from "../../shared/canonical.js";
import { validateReport } from "../../shared/report-contract.js";
import type { AuditReport, AuditProvenance } from "../../shared/types.js";
export const MEASUREMENT_IDENTITY_VERSION = "measurement-identity-2.4";
export function recordedIdentity(report: AuditReport) {
  const p = report.provenance;
  return (
    !!p &&
    /^[a-f0-9]{64}$/.test(p.engineSha256) &&
    [
      p.appVersion,
      p.playwrightVersion,
      p.axeVersion,
      p.lighthouseVersion,
      p.nodeVersion,
      p.platform,
      p.arch,
    ].every((v) => typeof v === "string" && !!v.trim())
  );
}
export function modernIdentity(p: AuditProvenance | undefined) {
  const m = p?.measurement;
  return (
    !!m &&
    m.version === MEASUREMENT_IDENTITY_VERSION &&
    [
      p?.seoVersions?.saxes,
      p?.seoVersions?.parse5,
      p?.seoVersions?.robotsParser,
    ].every((v) => typeof v === "string" && !!v.trim()) &&
    [m.captureSha256, m.normalizationSha256, m.verificationSha256].every((v) =>
      /^[a-f0-9]{64}$/.test(v),
    )
  );
}
export function sameExecution(a: AuditReport, b: AuditReport) {
  if (
    !validateReport(a).valid ||
    !validateReport(b).valid ||
    !recordedIdentity(a) ||
    !recordedIdentity(b) ||
    a.ruleVersion !== b.ruleVersion ||
    a.profileVersion !== b.profileVersion ||
    a.browserVersion !== b.browserVersion
  )
    return false;
  const ap = a.provenance!,
    bp = b.provenance!;
  if (ap.measurement || bp.measurement) {
    if (!modernIdentity(ap) || !modernIdentity(bp)) return false;
    const { appVersion: av, ...am } = ap,
      { appVersion: bv, ...bm } = bp;
    return canonical(am) === canonical(bm);
  }
  // Historical records retain their original, strict policy. No inferred hashes or relabelling.
  return canonical(ap) === canonical(bp);
}
export function comparisonLevel(
  a: AuditReport,
  b: AuditReport,
): "exact" | "diagnostic" | "incompatible" {
  if (sameExecution(a, b)) return "exact";
  if (
    validateReport(a).valid &&
    validateReport(b).valid &&
    a.ruleVersion === b.ruleVersion &&
    a.profileVersion === b.profileVersion &&
    a.contractVersion === b.contractVersion
  )
    return "diagnostic";
  return "incompatible";
}
