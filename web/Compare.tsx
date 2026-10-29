import { useEffect, useState } from "react";
import { ArrowLeftRight, LoaderCircle } from "lucide-react";
import type { Scan, ScanComparison } from "../shared/types.js";
import { api, message, stamp } from "./api.js";
import { Empty, Notice } from "./ui.js";
import ScoreCard from "./ScoreCard.js";
import VisualCompare from "./VisualCompare.js";

const labels: Record<string, string> = {
  new: "Neu",
  persistent: "Weiterhin vorhanden",
  resolved: "Verifiziert behoben",
  "not-retested": "Nicht erneut geprüft",
  "not-comparable": "Nicht vergleichbar",
};
export default function Compare({
  scans,
  projectId,
}: {
  scans: Scan[];
  projectId: string;
}) {
  const completed = scans.filter((s) => s.status === "completed" && s.result);
  const [before, setBefore] = useState(
    completed[0]?.options?.retest?.sourceScanId ??
      completed.slice(1).find((scan) => !scan.options?.retest)?.id ??
      completed[1]?.id ??
      "",
  );
  const [after, setAfter] = useState(completed[0]?.id ?? "");
  const [result, setResult] = useState<ScanComparison | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setBefore(
      completed[0]?.options?.retest?.sourceScanId ??
        completed.slice(1).find((scan) => !scan.options?.retest)?.id ??
        completed[1]?.id ??
        "",
    );
    setAfter(completed[0]?.id ?? "");
    setResult(null);
  }, [scans[0]?.projectId]);
  if (completed.length < 2)
    return (
      <>
        {completed.length > 0 && (
          <VisualCompare scans={scans} projectId={projectId} />
        )}
        <Empty
          icon={<ArrowLeftRight size={34} />}
          title="Zwei Checks machen Entwicklung sichtbar."
        >
          <p>
            Führe einen weiteren Check mit demselben Umfang aus. Erst dann
            können wir neue, fortbestehende und behobene Probleme vergleichen.
          </p>
        </Empty>
      </>
    );
  return (
    <>
      <VisualCompare scans={scans} projectId={projectId} />
      <div className="panel workspace-form">
        <div className="panel-head">
          <div>
            <p className="eyebrow">GLEICHE BEDINGUNGEN, EHRLICHER VERGLEICH</p>
            <h2>Was hat sich verändert?</h2>
          </div>
          <ArrowLeftRight size={24} />
        </div>
        <div className="scope-row">
          <div>
            <label htmlFor="before-scan">Vorher</label>
            <select
              id="before-scan"
              value={before}
              onChange={(e) => setBefore(e.target.value)}
            >
              <option value="">Scan auswählen</option>
              {completed.map((scan) => (
                <option key={scan.id} value={scan.id}>
                  {stamp(scan.createdAt)} · {scan.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="after-scan">Nachher</label>
            <select
              id="after-scan"
              value={after}
              onChange={(e) => setAfter(e.target.value)}
            >
              <option value="">Scan auswählen</option>
              {completed.map((scan) => (
                <option key={scan.id} value={scan.id}>
                  {stamp(scan.createdAt)} · {scan.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          className="button primary"
          disabled={busy || !before || !after || before === after}
          onClick={async () => {
            setBusy(true);
            setError("");
            setResult(null);
            try {
              setResult(
                await api<ScanComparison>(
                  `/api/compare?before=${encodeURIComponent(before)}&after=${encodeURIComponent(after)}`,
                ),
              );
            } catch (err) {
              setError(message(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <ArrowLeftRight size={16} />
          )}
          Tests vergleichen
        </button>
        {error && <Notice error>{error}</Notice>}
      </div>
      {result && (
        <>
          <div className="plan-note">
            <strong>
              {result.partial
                ? "Gezielter Teilnachtest"
                : result.comparable
                  ? "Vergleichbare Messprofile"
                  : "Nur eingeschränkt vergleichbar"}
            </strong>
            <p>{result.reason}</p>
            <p>
              {result.scoreDelta === null
                ? "Kein belastbares Score-Delta verfügbar."
                : `Audit-Score: ${result.scoreDelta > 0 ? "+" : ""}${result.scoreDelta.toFixed(1)} Punkte.`}
            </p>
          </div>
          <div className="comparison-grid score-compare">
            <ScoreCard score={result.beforeScore} />
            <ScoreCard score={result.afterScore} />
          </div>
          <section className="panel">
            <div className="panel-head">
              <h3>Entwicklung der Befunde</h3>
              <span className="pill">{result.entries.length} Einträge</span>
            </div>
            <div className="comparison-grid">
              {result.entries.map((entry) => (
                <article className="compare-item" key={entry.fingerprint}>
                  <span
                    className={`pill ${entry.state === "resolved" ? "confirmed" : entry.state === "new" ? "important" : "info"}`}
                  >
                    {labels[entry.state]}
                  </span>
                  <strong>{entry.title}</strong>
                </article>
              ))}
            </div>
            {!result.entries.length && (
              <p className="hint">
                Keine Befunde für diesen Vergleich vorhanden. Prüfabdeckung
                beachten.
              </p>
            )}
          </section>
        </>
      )}
    </>
  );
}
