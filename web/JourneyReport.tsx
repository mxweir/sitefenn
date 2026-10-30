import type { Scan } from "../shared/types.js";
import { stepLabel } from "../shared/journeys.js";
import { Empty, Notice } from "./ui.js";
import { EvidenceView } from "./LiveScan.js";
export default function JourneyReport({
  scan,
  onFinding,
}: {
  scan?: Scan;
  onFinding: (id: string) => void;
}) {
  const report = scan?.result?.audit,
    runs = report?.journeyRuns;
  if (!report || !scan || !runs?.length)
    return (
      <Empty title="Seitenzustände bewusst prüfen">
        <p>
          In der Übersicht kannst du optionale Seitenabläufe anlegen und
          ausdrücklich freigeben. Bestehende Berichte erhalten keine erfundenen
          Interaktionsmessungen.
        </p>
      </Empty>
    );
  const all = runs.flatMap((r) => r.steps);
  return (
    <section aria-label="Geprüfte Seitenzustände" className="journey-workspace">
      <div className="panel-head">
        <div>
          <p className="eyebrow">VOM SCHALTER ZUM BELEGTEN ZUSTAND</p>
          <h2>Seitenzustände</h2>
          <p>
            {all.filter((s) => s.status === "completed").length}/{all.length}{" "}
            Schritt-/Geräte-Zustände bestätigt · {runs.length} Abläufe
          </p>
        </div>
        <span className="pill">journeys-1.5</span>
      </div>
      <Notice>
        Bestätigt bedeutet: Die konfigurierte Erwartung wurde erreicht und
        aufgenommen. Regelbefunde bleiben separat. Fehlende Bereitschaft und
        blockierte Anfragen sind unbekannt, keine bestätigten Websitefehler.
      </Notice>
      {runs.map((run) => {
        const flow = report.options.journeys?.find(
          (j) => j.id === run.journeyId,
        );
        return (
          <article
            className="panel journey-run"
            key={`${run.journeyId}:${run.viewportId}`}
          >
            <div className="panel-head">
              <div>
                <h3>{run.name}</h3>
                <p className="seo-url">
                  {run.pageUrl} · {run.viewportId}
                </p>
              </div>
              <span
                className={`pill ${run.status === "completed" ? "" : "warm"}`}
              >
                {run.status === "completed"
                  ? "Zustände bestätigt"
                  : run.status === "not_run"
                    ? "Noch nicht ausgeführt"
                    : "Unbekannt / abgebrochen"}
              </span>
            </div>
            <p>{run.detail}</p>
            <details>
              <summary>Freigegebene Schritte und Identität</summary>
              <p>
                Signatur: {run.signature}. Jede Ausführung startet die Seite
                neu.
              </p>
              <ol>
                {flow?.steps.map((s, i) => (
                  <li key={i}>{stepLabel(s)}</li>
                ))}
              </ol>
            </details>
            {run.steps.map((step) => {
              const findings = report.findings.filter(
                (f) =>
                  f.pageUrl === run.pageUrl &&
                  f.viewportId === run.viewportId &&
                  f.state === step.state,
              );
              return (
                <details className="journey-result-step" key={step.index}>
                  <summary>
                    Schritt {step.index + 1} ·{" "}
                    {step.status === "completed"
                      ? "Erwartung erreicht"
                      : step.status === "unknown"
                        ? "Unbekannt"
                        : "Nicht ausgeführt"}{" "}
                    · {step.durationMs} ms
                  </summary>
                  <p>
                    {flow?.steps[step.index]
                      ? stepLabel(flow.steps[step.index]!)
                      : step.state}
                  </p>
                  <p>{step.detail}</p>
                  <div className="journey-evidence-pair">
                    {[
                      ["Vorher", step.beforeId],
                      ["Nachher", step.afterId],
                    ].map(([label, id]) => {
                      const evidence = report.evidence.find((e) => e.id === id);
                      return (
                        <div key={label}>
                          <h4>{label}</h4>
                          {evidence ? (
                            <EvidenceView
                              scanId={scan.id}
                              evidence={evidence}
                              findings={report.findings.filter(
                                (f) => f.evidenceId === id,
                              )}
                            />
                          ) : (
                            <p>Kein Nachweis erfasst.</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p>{findings.length} Regelbefunde in diesem Zustand.</p>
                  {findings.map((f) => (
                    <button
                      className="text-button journey-finding"
                      key={f.id}
                      onClick={() => onFinding(f.id)}
                    >
                      {f.title} ·{" "}
                      {f.evidenceStatus === "measured"
                        ? "gemessen"
                        : "Prüfkandidat"}{" "}
                      →
                    </button>
                  ))}
                </details>
              );
            })}
          </article>
        );
      })}
    </section>
  );
}
