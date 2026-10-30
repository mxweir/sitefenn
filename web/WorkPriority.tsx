import { useEffect, useState } from "react";
import type { Scan, SearchDataset, Category } from "../shared/types.js";
import type {
  workPriorities,
  PriorityWeights,
} from "../server/services/work-priority.js";
import { api, post, message, categoryLabel } from "./api.js";
import { Notice } from "./ui.js";
type Board = ReturnType<typeof workPriorities>;
export default function WorkPriority({ scan }: { scan: Scan }) {
  const [datasets, setDatasets] = useState<SearchDataset[]>([]),
    [datasetId, setDatasetId] = useState(""),
    [result, setResult] = useState<Board>(),
    [weights, setWeights] = useState<PriorityWeights>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    let live = true;
    setResult(undefined);
    setWeights(undefined);
    setDatasetId("");
    setError("");
    void Promise.all([
      api<{ datasets: SearchDataset[] }>(
        `/api/projects/${scan.projectId}/search`,
      ),
      post<Board>(`/api/scans/${scan.id}/work-priority`, {}),
    ])
      .then(([d, r]) => {
        if (live) {
          setDatasets(
            d.datasets.filter((v) => v.metadata.dimension === "page"),
          );
          setResult(r);
          setWeights(r.weights);
        }
      })
      .catch((e) => {
        if (live) setError(message(e));
      });
    return () => {
      live = false;
    };
  }, [scan.id, scan.projectId]);
  return (
    <details className="panel">
      <summary>Arbeitspriorität · Reichweite und Projektgewichte</summary>
      <p>
        Eine begründete Reihenfolge für offene Maßnahmen. Der Audit-Score bleibt
        unverändert.
      </p>
      {error && <Notice error>{error}</Notice>}
      {weights && (
        <form
          className="workspace-form"
          onSubmit={(e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            void post<Board>(`/api/scans/${scan.id}/work-priority`, {
              datasetId: datasetId || undefined,
              weights,
              save: true,
            })
              .then((r) => {
                setResult(r);
                setSaved(true);
              })
              .catch((e) => setError(message(e)))
              .finally(() => setBusy(false));
          }}
        >
          <label htmlFor="priority-dataset">Seiten-Reichweite (optional)</label>
          <select
            id="priority-dataset"
            value={datasetId}
            onChange={(e) => {
              setDatasetId(e.target.value);
              setSaved(false);
            }}
          >
            <option value="">Ohne Reichweitenbonus · unbekannt</option>
            {datasets.map((d) => (
              <option key={d.id} value={d.id}>
                {d.metadata.property} · {d.metadata.startDate} –{" "}
                {d.metadata.endDate} · {d.metadata.source ?? "CSV"}
              </option>
            ))}
          </select>
          <label htmlFor="severity-weight">
            Technische Schwere: {weights.severity}% · Reichweite:{" "}
            {weights.reach}%
          </label>
          <input
            id="severity-weight"
            type="range"
            min="0"
            max="100"
            step="5"
            value={weights.severity}
            onChange={(e) => {
              setWeights({
                ...weights,
                severity: Number(e.target.value),
                reach: 100 - Number(e.target.value),
              });
              setSaved(false);
            }}
          />
          <div className="scope-row">
            {Object.entries(weights.categories).map(([category, value]) => (
              <label key={category}>
                {categoryLabel(category)} ×
                <input
                  aria-label={`Gewicht ${categoryLabel(category)}`}
                  type="number"
                  min="0.5"
                  max="2"
                  step="0.25"
                  value={value}
                  onChange={(e) => {
                    setWeights({
                      ...weights,
                      categories: {
                        ...weights.categories,
                        [category as Category]: Number(e.target.value),
                      },
                    });
                    setSaved(false);
                  }}
                />
              </label>
            ))}
          </div>
          <button className="button secondary" disabled={busy}>
            {busy ? "Berechne …" : "Gewichte speichern & Reihenfolge berechnen"}
          </button>
          {saved && (
            <p role="status">
              Projektgewichte gespeichert. Reihenfolge unten aktualisiert.
            </p>
          )}
        </form>
      )}
      {result && (
        <>
          <p className="hint">
            {result.metadata
              ? `${result.metadata.property} · ${result.metadata.startDate} – ${result.metadata.endDate} · Filter ${JSON.stringify(result.metadata.filters)} · importiert ${result.importedAt}`
              : "Keine Reichweitenquelle ausgewählt."}
          </p>
          {result.warnings.map((w) => (
            <p className="hint" key={w}>
              {w}
            </p>
          ))}
          <div className="task-list">
            {result.entries.map((entry, i) => (
              <article className="plan-note" key={entry.taskId}>
                <strong>
                  {i + 1}. {entry.title}
                </strong>
                <p>
                  {entry.score} Sortierpunkte{" "}
                  {entry.provisional ? "· vorläufig" : ""} ·{" "}
                  {entry.impressions === null
                    ? "Reichweite unbekannt"
                    : `${entry.impressions} größte beobachtete Seiten-Impressionen`}
                </p>
                <p className="hint">{entry.reason}</p>
              </article>
            ))}
          </div>
          {result.candidates.length > 0 && (
            <>
              <h4>Sichtbarkeits-Kandidaten zur Untersuchung</h4>
              {result.candidates.map((c) => (
                <p className="plan-note" key={c.page}>
                  {c.page}
                  <br />
                  {c.impressions} Impressionen · {(c.ctr * 100).toFixed(2)}% CTR
                  <br />
                  {c.reason}
                </p>
              ))}
            </>
          )}
        </>
      )}
    </details>
  );
}
