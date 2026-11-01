import { createHash, randomUUID } from "node:crypto";
import type { Store } from "../store.js";
import { canonical, compareScans } from "./comparison.js";
import type { BaselineChange } from "../../shared/baseline.js";
import type { Scan, ScanComparison } from "../../shared/types.js";
export function compareHistory(
  store: Store,
  before: Scan,
  after: Scan,
): ScanComparison {
  const comparison = compareScans(before, after);
  if (!comparison.verificationComparable) return comparison;
  for (const entry of comparison.entries) {
    if (entry.state !== "new" || !entry.problemId) continue;
    const occurrence = store.priorOccurrence(
      before.projectId,
      entry.problemId,
      before.id,
    );
    if (!occurrence) continue;
    const old = store.scan(occurrence.scanId);
    if (!old?.result?.audit) continue;
    const proof = compareScans(old, before);
    if (
      proof.verificationComparable &&
      proof.entries.some(
        (e) =>
          e.beforeFindingId === occurrence.findingId && e.state === "resolved",
      )
    ) {
      entry.state = "recurrent";
      entry.historyScanId = old.id;
    } else {
      entry.state = "history-uncertain";
      entry.historyScanId = old.id;
    }
  }
  return comparison;
}
export function baselinePreview(
  store: Store,
  projectId: string,
  candidateId: string,
  controlId: string,
) {
  const candidate = store.scan(candidateId),
    control = store.scan(controlId);
  if (
    !candidate ||
    !control ||
    candidate.projectId !== projectId ||
    control.projectId !== projectId
  )
    throw Error("Zwei Checks desselben Projekts wählen.");
  const comparison = compareScans(candidate, control);
  const reasons: string[] = [];
  if (
    !comparison.comparable ||
    candidate.result?.audit?.options.retest ||
    control.result?.audit?.options.retest
  )
    reasons.push(
      "Zwei vollständige, exakt vergleichbare Kontrollmessungen erforderlich.",
    );
  if (comparison.entries.some((e) => e.state !== "persistent"))
    reasons.push(
      "Zwischen den Kontrollmessungen haben sich Befunde geändert oder ihre Zuordnung ist unklar. Nach Stabilisierung erneut messen.",
    );
  if (
    candidate.result?.audit?.rules.some(
      (r) =>
        r.status === "not_run" &&
        (r.category !== "performance" ||
          candidate.result!.audit!.options.performance),
    ) ||
    control.result?.audit?.rules.some(
      (r) =>
        r.status === "not_run" &&
        (r.category !== "performance" ||
          control.result!.audit!.options.performance),
    )
  )
    reasons.push("Aktivierte Prüfungen enthalten unbekannte Ergebnisse.");
  const previous = store.baselines(projectId)[0] ?? null;
  const snapshotHash = createHash("sha256")
    .update(canonical([candidate.result, control.result, previous?.id ?? null]))
    .digest("hex");
  return {
    eligible: !reasons.length,
    reasons,
    snapshotHash,
    previous,
    comparison,
    candidateId,
    controlId,
    meaning:
      "Neue Referenz unter der aktuellen Messidentität. Alte Berichte und alte Referenz bleiben unverändert; keine rückwirkende Kompatibilität oder Behebung.",
  };
}
export function adoptBaseline(
  store: Store,
  projectId: string,
  input: {
    candidateId: string;
    controlId: string;
    snapshotHash: string;
    name: string;
    note: string;
    confirmed: boolean;
  },
): BaselineChange {
  if (
    input.confirmed !== true ||
    typeof input.name !== "string" ||
    !input.name.trim() ||
    input.name.length > 100 ||
    typeof input.note !== "string" ||
    input.note.length > 1500
  )
    throw Error("Referenz benennen und den geprüften Wechsel bestätigen.");
  const preview = baselinePreview(
    store,
    projectId,
    input.candidateId,
    input.controlId,
  );
  if (!preview.eligible || input.snapshotHash !== preview.snapshotHash)
    throw Error(
      preview.reasons.join(" ") || "Vorschau ist veraltet; erneut prüfen.",
    );
  return store.saveBaseline({
    id: randomUUID(),
    projectId,
    name: input.name.trim(),
    note: input.note.trim(),
    createdAt: new Date().toISOString(),
    candidateId: input.candidateId,
    controlId: input.controlId,
    previousId: preview.previous?.id ?? null,
    snapshotHash: preview.snapshotHash,
    meaning: preview.meaning,
  });
}
