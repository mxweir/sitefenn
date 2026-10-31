import type { Scan, AuditTask } from "../shared/types.js";
export default function ProjectFlow({
  scan,
  tasks,
  verifiedCount,
  onNavigate,
  onConfigure,
}: {
  scan?: Scan;
  tasks: AuditTask[];
  verifiedCount: number;
  onNavigate: (tab: "live" | "report" | "tasks" | "compare") => void;
  onConfigure: () => void;
}) {
  const running =
      !!scan && ["queued", "running", "paused"].includes(scan.status),
    report = scan?.result,
    open = tasks.filter(
      (t) => !["verified", "accepted"].includes(t.status),
    ).length;
  const next = !scan
    ? "Umfang festlegen und deinen ersten Check starten."
    : running
      ? "Den laufenden Check beobachten; fehlende Ergebnisse bleiben offen."
      : scan.status !== "completed"
        ? "Unterbrochene oder fehlgeschlagene Prüfung prüfen und bewusst fortsetzen."
        : !report
          ? "Gespeicherte Messdaten werden geladen."
          : open
            ? "Einen Befund mit Nachweis öffnen, Maßnahme bearbeiten und gezielt nachtesten."
            : "Den gespeicherten Bericht öffnen und Aufgaben prüfen. Ungeprüfte Bereiche und akzeptierte Risiken weiter beachten.";
  return (
    <section
      role="region"
      className="panel project-flow"
      aria-label="Vom Check zum bestätigten Fix"
    >
      <div className="panel-head">
        <div>
          <p className="eyebrow">DEIN NÄCHSTER SINNVOLLER SCHRITT</p>
          <h3>Vom Check zum bestätigten Fix.</h3>
          <p>{next}</p>
        </div>
        <span className="pill">
          {verifiedCount} durch Nachtest verifizierte Aufgaben im Projekt
        </span>
      </div>
      <ol className="flow-steps">
        <li>
          <button
            className="button secondary"
            onClick={() => (running ? onNavigate("live") : onConfigure())}
          >
            1 · Prüfen
          </button>
          <p>Ausgewählte Seiten und freigegebene Zustände beobachten.</p>
        </li>
        <li>
          <button
            className="button secondary"
            disabled={!report}
            onClick={() => onNavigate("report")}
          >
            2 · Belegen
          </button>
          <p>Messung und Screenshot ansehen; KI bleibt optional.</p>
        </li>
        <li>
          <button
            className="button secondary"
            disabled={!report}
            onClick={() => onNavigate("tasks")}
          >
            3 · Bearbeiten
          </button>
          <p>Maßnahme oder gezieltes Entwickler-Arbeitspaket nutzen.</p>
        </li>
        <li>
          <button
            className="button secondary"
            disabled={!report}
            onClick={() => onNavigate("tasks")}
          >
            4 · Nachtesten
          </button>
          <p>
            Kompatibles Messergebnis bestätigt den Fix; Abhaken allein genügt
            nicht.
          </p>
        </li>
      </ol>
      <p className="hint">
        Historische Befunde bleiben dokumentiert. Ein Teillauf ersetzt keinen
        vollständigen Score, und fehlende Messungen werden nicht als bestanden
        gezählt.
      </p>
    </section>
  );
}
