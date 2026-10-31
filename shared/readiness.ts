export interface Readiness {
  phase: "ready" | "queued" | "running" | "cleaning-up" | "operation";
  scanId?: string;
  operation: string | null;
  resultsSaved: boolean;
  resourcesFree: boolean;
  allowed: { read: true; startExclusive: boolean; enqueueScan: boolean };
  message: string;
}
export function readiness(
  worker: {
    active: boolean;
    scanId?: string;
    resultsSaved: boolean;
    queued: boolean;
  },
  operation: string | null,
): Readiness {
  const phase = operation
    ? "operation"
    : worker.active
      ? worker.resultsSaved
        ? "cleaning-up"
        : "running"
      : worker.queued
        ? "queued"
        : "ready";
  const resourcesFree = phase === "ready";
  return {
    phase,
    scanId: worker.scanId,
    operation,
    resultsSaved: worker.resultsSaved,
    resourcesFree,
    allowed: {
      read: true,
      startExclusive: resourcesFree,
      enqueueScan: !operation,
    },
    message:
      phase === "ready"
        ? "Bereit für die nächste Aktion"
        : phase === "cleaning-up"
          ? "Ergebnisse gespeichert · Browser wird noch beendet"
          : phase === "queued"
            ? "Prüfung wartet auf den Worker"
            : phase === "operation"
              ? `Workspace beschäftigt · ${operation}`
              : "Prüfung läuft · Ergebnisse werden gespeichert",
  };
}
