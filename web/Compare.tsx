import { useTranslation } from "./language.js";
import ReleaseGate from "./ReleaseGate.js";
import ChangeEvidence from "./ChangeEvidence.js";
import BaselinePanel from "./BaselinePanel.js";
import ScanDetails, { scanLabel } from "./ScanDetails.js";
import { useScanOptions } from "./use-scan-options.js";
import { useEffect, useState } from "react";
import { ArrowLeftRight, LoaderCircle } from "lucide-react";
import type { Scan, ScanComparison } from "../shared/types.js";
import { api, message, stamp } from "./api.js";
import { Empty, Notice } from "./ui.js";
import ScoreCard from "./ScoreCard.js";
import VisualCompare from "./VisualCompare.js";

const labels: Record<string, string> = {
  new: "Neu",
  recurrent: "Wieder aufgetreten",
  "history-uncertain": "Erneut beobachtet · Zwischenhistorie ungeklärt",
  "mapping-review": "Zuordnung prüfen · keine automatische Verknüpfung",
  persistent: "Weiterhin vorhanden",
  resolved: "Verifiziert behoben",
  "not-retested": "Nicht erneut geprüft",
  "not-comparable": "Nicht vergleichbar",
};
export default function Compare({
  scans: initialScans,
  projectId,
  onChange,
}: {
  scans: Scan[];
  projectId: string;
  onChange?: () => Promise<void>;
}) {
  const t = useTranslation();
  const options = useScanOptions(projectId, initialScans);
  const scans = options.scans;
  const [referenceScan, setReferenceScan] = useState<Scan | null>(null);
  const completed = [
    ...scans,
    ...(referenceScan && !scans.some((s) => s.id === referenceScan.id)
      ? [referenceScan]
      : []),
  ].filter((s) => s.status === "completed" && s.result);
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
  useEffect(() => {
    if (!before && completed.length > 1) setBefore(completed[1]!.id);
    if (!after && completed.length) setAfter(completed[0]!.id);
  }, [completed.map((s) => s.id).join("|")]);
  const pagination = (
    <>
      <p className="hint">
        Vergleich aus {completed.length} geladenen Checks dieses Projekts
        wählen. Ältere Checks bleiben über den Verlauf und weitere Seiten
        erreichbar.
      </p>
      {options.error && <Notice error>{options.error}</Notice>}
      {options.cursor && (
        <button
          className="button secondary"
          disabled={options.busy}
          onClick={() => void options.more()}
        >
          {t("Ältere Vergleichschecks laden", "Load older checks")}
        </button>
      )}
    </>
  );
  if (completed.length < 2)
    return (
      <>
        {pagination}
        {completed[0] && (
          <ReleaseGate key={completed[0].id} after={completed[0]} />
        )}
        {completed.length > 0 && (
          <details className="panel">
            <summary>
              {t(
                "Bildvergleich und visuelle Referenzen",
                "Visual comparison and references",
              )}
            </summary>
            <VisualCompare scans={scans} projectId={projectId} />
          </details>
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
      {pagination}
      <div className="panel workspace-form">
        <div className="panel-head">
          <div>
            <p className="eyebrow">GLEICHE BEDINGUNGEN, EHRLICHER VERGLEICH</p>
            <h2>{t("Was hat sich verändert?", "What changed?")}</h2>
          </div>
          <ArrowLeftRight size={24} />
        </div>
        <div className="scope-row">
          <div>
            <label htmlFor="before-scan">{t("Vorher", "Before")}</label>
            <select
              id="before-scan"
              value={before}
              disabled={busy}
              onChange={(e) => {
                setBefore(e.target.value);
                setResult(null);
              }}
            >
              <option value="">Scan auswählen</option>
              {completed.map((scan) => (
                <option key={scan.id} value={scan.id}>
                  {scanLabel(scan)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="after-scan">{t("Nachher", "After")}</label>
            <select
              id="after-scan"
              value={after}
              disabled={busy}
              onChange={(e) => {
                setAfter(e.target.value);
                setResult(null);
              }}
            >
              <option value="">Scan auswählen</option>
              {completed.map((scan) => (
                <option key={scan.id} value={scan.id}>
                  {scanLabel(scan)}
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
          {t("Tests vergleichen", "Compare checks")}
        </button>
        {error && <Notice error>{error}</Notice>}
      </div>
      <div className="comparison-grid">
        {[before, after]
          .filter((id, i, all) => id && all.indexOf(id) === i)
          .map((id) => {
            const scan = completed.find((s) => s.id === id);
            return scan ? (
              <ScanDetails key={id} scan={scan} onChange={onChange} />
            ) : null;
          })}
      </div>
      {completed.find((scan) => scan.id === after) && (
        <ReleaseGate
          key={`${before}:${after}`}
          after={completed.find((scan) => scan.id === after)!}
          before={
            before !== after
              ? completed.find((scan) => scan.id === before)
              : undefined
          }
        />
      )}
      <BaselinePanel
        projectId={projectId}
        beforeId={before}
        afterId={after}
        onSelect={async (id) => {
          const selected = (
            await api<{ scan: Scan }>(`/api/scans/${encodeURIComponent(id)}`)
          ).scan;
          if (
            selected.projectId !== projectId ||
            selected.status !== "completed"
          )
            throw Error(
              "Referenz ist nicht als abgeschlossener Check dieses Projekts verfügbar.",
            );
          setReferenceScan(selected);
          setBefore(id);
          setResult(null);
        }}
      />
      {result && (
        <>
          <div className="plan-note">
            <strong>
              {result.partial
                ? "Gezielter Teilnachtest"
                : result.level === "incompatible"
                  ? "Inkompatible Messstände"
                  : result.comparable
                    ? "Exakt verifizierbarer Vergleich"
                    : "Nur eingeschränkt vergleichbar"}
            </strong>
            <p>{result.reason}</p>
            {result.identityReasons?.map((r) => (
              <p key={r}>{r}</p>
            ))}
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
                <article
                  className="compare-item"
                  key={entry.problemId ?? entry.fingerprint}
                >
                  <span
                    className={`pill ${entry.state === "resolved" ? "confirmed" : entry.state === "new" ? "important" : "info"}`}
                  >
                    {labels[entry.state]}
                  </span>
                  <strong>{entry.title}</strong>
                  {entry.location && (
                    <p>
                      {entry.location.viewportId} · {entry.location.state} ·{" "}
                      <code>
                        {entry.location.selector ?? entry.location.ruleId}
                      </code>
                      <br />
                      {entry.location.pageUrl}
                    </p>
                  )}
                  {entry.problemId && (
                    <>
                      <p className="hint">
                        Standortproblem {entry.problemId.slice(0, 12)} ·{" "}
                        {entry.match === "needs-review"
                          ? "Zuordnung unklar"
                          : "gleiche Regel/URL/Gerät/Zustand/Selektor"}
                        . Keine Ursachenidentität behauptet.
                      </p>
                      <ChangeEvidence
                        entry={entry}
                        beforeId={result.beforeId}
                        afterId={result.afterId}
                        projectId={projectId}
                      />
                    </>
                  )}
                  {entry.historyScanId && (
                    <a
                      href={`/?project=${encodeURIComponent(projectId)}&scan=${encodeURIComponent(entry.historyScanId)}&view=report`}
                    >
                      Früheres Auftreten öffnen
                    </a>
                  )}
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
      <details className="panel">
        <summary>
          {t(
            "Bildvergleich und visuelle Referenzen",
            "Visual comparison and references",
          )}
        </summary>
        <VisualCompare scans={scans} projectId={projectId} />
      </details>
    </>
  );
}
