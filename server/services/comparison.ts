import { validateReport } from "../../shared/report-contract.js";
import type {
  AuditReport,
  Scan,
  ScanComparison,
  Finding,
  RuleResult,
} from "../../shared/types.js";
import { calculateScore } from "./scoring.js";

import { canonical } from "../../shared/canonical.js";
export { canonical } from "../../shared/canonical.js";
import {
  sameExecution,
  comparisonLevel,
  recordedIdentity,
} from "./measurement-identity.js";
export { sameExecution, recordedIdentity } from "./measurement-identity.js";
import { journeyDefinition } from "../../shared/journeys.js";
import { locationKey, problemId } from "./problem-identity.js";
function normalizedUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  return url.href;
}
function scopeKey(value: {
  pageUrl: string;
  viewportId: string;
  state: string;
}): string {
  return canonical([
    normalizedUrl(value.pageUrl),
    value.viewportId,
    value.state,
  ]);
}
function ruleKey(rule: RuleResult): string {
  return canonical([rule.ruleId, rule.category, scopeKey(rule), rule.weight]);
}
function samePageViewport(
  a: { pageUrl: string; viewportId: string },
  b: { pageUrl: string; viewportId: string },
): boolean {
  return (
    normalizedUrl(a.pageUrl) === normalizedUrl(b.pageUrl) &&
    a.viewportId === b.viewportId
  );
}
function compatible(a: AuditReport, b: AuditReport): boolean {
  return (
    sameExecution(a, b) &&
    canonical(a.options) === canonical(b.options) &&
    canonical(a.pages.map(scopeKey).sort()) ===
      canonical(b.pages.map(scopeKey).sort()) &&
    canonical(a.rules.map(ruleKey).sort()) ===
      canonical(b.rules.map(ruleKey).sort())
  );
}

export function compareScans(before: Scan, after: Scan): ScanComparison {
  if (before.id === after.id) throw Error("Two distinct scans required.");
  const a = before.result?.audit,
    b = after.result?.audit;
  if (!a || !b)
    throw new Error("Both scans need persisted audit reports for comparison.");
  if (before.projectId !== after.projectId)
    throw new Error("Only scans of the same project may be compared.");
  const terminal =
    before.status === "completed" &&
    after.status === "completed" &&
    Date.parse(a.startedAt) <= Date.parse(b.startedAt) &&
    Date.parse(before.createdAt) <= Date.parse(after.createdAt);
  const partial = !!b.options.retest;
  const comparable = terminal && !partial && compatible(a, b);
  const verificationComparable =
    comparable ||
    (terminal &&
      partial &&
      b.options.retest?.sourceScanId === before.id &&
      sameExecution(a, b) &&
      b.options.pages.every((url) => a.options.pages.includes(url)) &&
      b.options.performanceRuns === a.options.performanceRuns &&
      !!b.options.technicalSeo === !!a.options.technicalSeo &&
      (!b.options.performance || a.options.performance) &&
      (b.options.journeys ?? []).every((j) =>
        a.options.journeys?.some(
          (old) =>
            canonical(journeyDefinition(old)) ===
              canonical(journeyDefinition(j)) &&
            j.viewportIds.every((id) => old.viewportIds.includes(id)),
        ),
      ) &&
      b.options.viewports.every((profile) =>
        a.options.viewports.some(
          (old) => canonical(old) === canonical(profile),
        ),
      ));
  const beforeScore = calculateScore(a),
    afterScore = calculateScore(b);
  const grouped = (findings: Finding[]) => {
    const m = new Map<string, Finding[]>();
    for (const f of findings)
      m.set(locationKey(f), [...(m.get(locationKey(f)) ?? []), f]);
    return m;
  };
  const beforeGroups = grouped(a.findings),
    afterGroups = grouped(b.findings);
  const beforeByFingerprint = new Map(
    [...beforeGroups].map(([key, values]) => [key, values[0]!]),
  );
  const afterByFingerprint = new Map(
    [...afterGroups].map(([key, values]) => [key, values[0]!]),
  );
  const level = terminal ? comparisonLevel(a, b) : "incompatible";
  const effectiveLevel =
    level === "exact" && !verificationComparable ? "diagnostic" : level;

  const keys = [
    ...new Set([...beforeByFingerprint.keys(), ...afterByFingerprint.keys()]),
  ].sort();
  const isVerifiedPass = (finding: Finding): boolean => {
    // Lab performance uses its numeric sample, not a page screenshot, as evidence.
    if (
      finding.category === "performance" &&
      /^performance-(lcp|cls|tbt)$/.test(finding.ruleId)
    ) {
      const metric = finding.ruleId.slice("performance-".length) as
        | "lcp"
        | "cls"
        | "tbt";
      return (
        b.rules.some(
          (rule) =>
            rule.ruleId === finding.ruleId &&
            rule.category === "performance" &&
            scopeKey(rule) === scopeKey(finding) &&
            rule.status === "pass",
        ) &&
        b.performance.some(
          (sample) =>
            normalizedUrl(sample.pageUrl) === normalizedUrl(finding.pageUrl) &&
            sample.device === finding.viewportId &&
            sample.runs > 0 &&
            !sample.error &&
            sample.metrics[metric] !== null,
        )
      );
    }
    if (finding.state.startsWith("journey:")) {
      const confirmed = (r: AuditReport) =>
        r.journeyRuns?.some(
          (j) =>
            samePageViewport(j, finding) &&
            j.steps.some(
              (s) => s.state === finding.state && s.status === "completed",
            ),
        );
      if (!confirmed(a) || !confirmed(b)) return false;
    }
    const originalDocument = a.pages.find(
      (page) =>
        samePageViewport(page, finding) &&
        page.state === "initial" &&
        page.status === "completed",
    );
    if (
      !originalDocument ||
      !b.pages.some(
        (page) =>
          samePageViewport(page, finding) &&
          page.state === "initial" &&
          page.status === "completed" &&
          normalizedUrl(page.finalUrl) ===
            normalizedUrl(originalDocument.finalUrl),
      )
    )
      return false;
    if (
      !b.pages.some(
        (page) =>
          samePageViewport(page, finding) &&
          page.state === "initial" &&
          page.status === "completed",
      )
    )
      return false;
    if (
      finding.category === "layout" &&
      ["horizontal-overflow", "covered-control"].includes(finding.ruleId)
    ) {
      // Layout scoring aggregates a fixed budget across bounded scroll samples.
      // The old captured scroll coordinate must actually have been sampled again;
      // scroll-2 may point somewhere else after a document-height change.
      const previousEvidence = a.evidence.find(
        (evidence) =>
          evidence.id === finding.evidenceId &&
          samePageViewport(evidence, finding) &&
          evidence.state === finding.state,
      );
      const resampled =
        previousEvidence &&
        b.evidence.some(
          (evidence) =>
            samePageViewport(evidence, finding) &&
            evidence.state === finding.state &&
            evidence.width === previousEvidence.width &&
            evidence.height === previousEvidence.height &&
            Math.abs(evidence.scrollX - previousEvidence.scrollX) <= 1 &&
            Math.abs(evidence.scrollY - previousEvidence.scrollY) <= 1,
        );
      return (
        !!resampled &&
        b.rules.some(
          (rule) =>
            samePageViewport(rule, finding) &&
            rule.ruleId === finding.ruleId &&
            rule.category === "layout" &&
            rule.state ===
              (finding.state.startsWith("journey:")
                ? finding.state
                : "initial") &&
            rule.status === "pass",
        )
      );
    }
    // axe sub-rule findings are represented by one measured aggregate rule.
    const ruleId =
      finding.category === "accessibility" && finding.ruleId.startsWith("axe-")
        ? "axe-automated"
        : finding.ruleId;
    return b.rules.some(
      (rule) =>
        rule.ruleId === ruleId &&
        rule.category === finding.category &&
        scopeKey(rule) === scopeKey(finding) &&
        rule.status === "pass",
    );
  };
  return {
    level: effectiveLevel,
    identityReasons: [
      ...(!sameExecution(a, b)
        ? [
            "Mess-/Normalisierungs-/Verifizierungsidentität oder Toolchain abweichend bzw. historisch unvollständig.",
          ]
        : []),
      ...(!compatible(a, b)
        ? [
            "Umfang/Optionen/Zustände unterscheiden sich; kein vollständiges Score-Delta.",
          ]
        : []),
    ],
    beforeId: before.id,
    afterId: after.id,
    comparable,
    partial,
    verificationComparable,
    reason: !terminal
      ? "Checks sind nicht abgeschlossen oder die zeitliche Reihenfolge ist umgekehrt/unklar; keine Behebung oder Score-Differenz ableiten."
      : partial
        ? "Gezielter Teilnachtest: nur die angegebenen Fundstellen können verifiziert werden. Kein Projekt-Score-Delta; ausgelassene Seiten bleiben ungeprüft." +
          (!verificationComparable
            ? " Die Engine-/Profilidentität passt nicht zum Ausgangscheck; keine Behebung wird verifiziert."
            : "")
        : comparable
          ? "Gleiche Regeln, Profile, Browser-Version, Optionen, geplante Regelinstanzen und Seitenzustände."
          : !recordedIdentity(a) || !recordedIdentity(b)
            ? "Historische Ausführungsidentität fehlt. Bitte neue Checks mit derselben Engine starten; kein belastbares Score-Delta und keine verifizierte Behebung."
            : "Prüfumfang, Engine-Identität oder Ausführungsprofil haben sich geändert. Kein Score-Delta; fehlende oder nicht vergleichbare Belege bestätigen keine Behebung.",
    scoreDelta:
      comparable &&
      beforeScore.final &&
      afterScore.final &&
      beforeScore.lower !== null &&
      afterScore.lower !== null
        ? afterScore.lower - beforeScore.lower
        : null,
    beforeScore,
    afterScore,
    entries: keys.map((fingerprint) => {
      const previous = beforeByFingerprint.get(fingerprint),
        current = afterByFingerprint.get(fingerprint);
      const inRetest =
        !previous ||
        !partial ||
        (!!previous && b.options.retest!.findingIds.includes(previous.id));
      const ambiguous =
        (beforeGroups.get(fingerprint)?.length ?? 0) > 1 ||
        (afterGroups.get(fingerprint)?.length ?? 0) > 1 ||
        (!previous &&
          a.findings.some(
            (f) => locationKey(f, false) === locationKey(current!, false),
          )) ||
        (!current &&
          b.findings.some(
            (f) => locationKey(f, false) === locationKey(previous!, false),
          ));
      const state =
        effectiveLevel === "incompatible" || !verificationComparable
          ? "not-comparable"
          : ambiguous
            ? "mapping-review"
            : !inRetest
              ? "not-retested"
              : previous && current
                ? "persistent"
                : !previous
                  ? "new"
                  : previous.evidenceStatus === "measured" &&
                      isVerifiedPass(previous)
                    ? "resolved"
                    : "not-retested";
      return {
        location: (({ ruleId, pageUrl, viewportId, state, selector }) => ({
          ruleId,
          pageUrl,
          viewportId,
          state,
          selector,
        }))((current ?? previous)!),
        fingerprint: (current ?? previous)!.fingerprint,
        problemId: problemId(before.projectId, (current ?? previous)!),
        match: ambiguous ? "needs-review" : "exact-location",
        beforeFindingIds:
          beforeGroups.get(fingerprint)?.map((f) => f.id) ??
          (ambiguous && current
            ? a.findings
                .filter(
                  (f) => locationKey(f, false) === locationKey(current, false),
                )
                .map((f) => f.id)
            : []),
        afterFindingIds:
          afterGroups.get(fingerprint)?.map((f) => f.id) ??
          (ambiguous && previous
            ? b.findings
                .filter(
                  (f) => locationKey(f, false) === locationKey(previous, false),
                )
                .map((f) => f.id)
            : []),
        title: (current ?? previous)!.title,
        state,
        beforeFindingId: previous?.id,
        afterFindingId: current?.id,
      };
    }),
  };
}
