import { useTranslation } from "./language.js";
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
  const t = useTranslation();
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
      aria-label={t(
        "Vom Check zum bestätigten Fix",
        "From check to verified fix",
      )}
    >
      <div className="panel-head">
        <div>
          <p className="eyebrow">
            {t("DEIN NÄCHSTER SINNVOLLER SCHRITT", "YOUR NEXT STEP")}
          </p>
          <h3>
            {t("Vom Check zum bestätigten Fix.", "From check to verified fix.")}
          </h3>
          <p>{next}</p>
        </div>
        <span className="pill">
          Historisch: {verifiedCount} durch Nachtest verifizierte Aufgaben im
          Projekt. Kein aktueller Gesundheitsstatus.
        </span>
      </div>
      <ol className="flow-steps">
        <li>
          <button
            className="button secondary"
            onClick={() => (running ? onNavigate("live") : onConfigure())}
          >
            {t("1 · Prüfen", "1 · Check")}
          </button>
          <p>
            {t(
              "Ausgewählte Seiten und freigegebene Zustände beobachten.",
              "Observe selected pages and approved states.",
            )}
          </p>
        </li>
        <li>
          <button
            className="button secondary"
            disabled={!report}
            onClick={() => onNavigate("report")}
          >
            {t("2 · Belegen", "2 · Inspect")}
          </button>
          <p>
            {t(
              "Messung und Screenshot ansehen; KI bleibt optional.",
              "Review the measurement and screenshot. AI is optional.",
            )}
          </p>
        </li>
        <li>
          <button
            className="button secondary"
            disabled={!report}
            onClick={() => onNavigate("tasks")}
          >
            {t("3 · Bearbeiten", "3 · Repair")}
          </button>
          <p>
            {t(
              "Maßnahme oder gezieltes Entwickler-Arbeitspaket nutzen.",
              "Use the repair task or a focused developer work package.",
            )}
          </p>
        </li>
        <li>
          <button
            className="button secondary"
            disabled={!report}
            onClick={() => onNavigate("tasks")}
          >
            {t("4 · Nachtesten", "4 · Retest")}
          </button>
          <p>
            {t(
              "Kompatibles Messergebnis bestätigt den Fix; Abhaken allein genügt nicht.",
              "A compatible measurement confirms the fix.",
            )}
          </p>
        </li>
      </ol>
      <p className="hint">
        {t(
          "Historische Befunde bleiben dokumentiert. Ein Teillauf ersetzt keinen vollständigen Score, und fehlende Messungen werden nicht als bestanden gezählt.",
          "Historical findings stay visible. A scoped retest has no full score, and missing measurements remain unknown.",
        )}
      </p>
    </section>
  );
}
