import { useEffect, useState } from "react";
import { Download, FileUp, Search } from "lucide-react";
import type {
  Project,
  SearchDataset,
  SearchDimension,
} from "../shared/types.js";
import { api, message, post, stamp } from "./api.js";
import { Empty, Notice, Success } from "./ui.js";
interface SearchComparison {
  compatible: boolean;
  reason: string;
  clicksDelta: number | null;
  impressionsDelta: number | null;
  ctrDelta: number | null;
}

export default function SearchVisibility({ project }: { project: Project }) {
  const [datasets, setDatasets] = useState<SearchDataset[]>([]);
  const [selected, setSelected] = useState("");
  const [before, setBefore] = useState("");
  const [csv, setCsv] = useState("");
  const [property, setProperty] = useState(project.url);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dimension, setDimension] = useState<SearchDimension>("query");
  const [filters, setFilters] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState("");
  const [comparison, setComparison] = useState<SearchComparison | null>(null);
  const [compareError, setCompareError] = useState("");
  useEffect(() => {
    let mounted = true;
    setProperty(project.url);
    setSelected("");
    setBefore("");
    setDatasets([]);
    setError("");
    void api<{ datasets: SearchDataset[] }>(
      `/api/projects/${project.id}/search`,
    )
      .then((result) => {
        if (mounted) {
          setDatasets(result.datasets);
          setSelected(result.datasets[0]?.id ?? "");
        }
      })
      .catch((err) => {
        if (mounted) setError(message(err));
      });
    return () => {
      mounted = false;
    };
  }, [project.id, project.url]);
  const dataset = datasets.find((d) => d.id === selected) ?? datasets[0];
  const baseline = datasets.find((d) => d.id === before);
  useEffect(() => {
    setComparison(null);
    setCompareError("");
    if (!dataset || !baseline) return;
    let mounted = true;
    void api<SearchComparison>(
      `/api/projects/${project.id}/search/compare?before=${encodeURIComponent(baseline.id)}&after=${encodeURIComponent(dataset.id)}`,
    )
      .then((result) => {
        if (mounted) setComparison(result);
      })
      .catch((err) => {
        if (mounted) setCompareError(message(err));
      });
    return () => {
      mounted = false;
    };
  }, [project.id, dataset?.id, baseline?.id]);
  const percent = (value: number | null) =>
    value === null
      ? "—"
      : `${(value * 100).toLocaleString("de-DE", { maximumFractionDigits: 2 })} %`;
  return (
    <>
      <div className="panel-head">
        <div>
          <p className="eyebrow">ECHTE DATEN, KEIN ERFUNDENER GOOGLE-RANG</p>
          <h2>Google-Sichtbarkeit</h2>
          <p>
            Importiere einen eigenen Search-Console-CSV-Export. Keine
            Google-Verbindung und kein automatisches Suchergebnis-Scraping.
          </p>
        </div>
        <Search size={25} />
      </div>
      <div className="two-column">
        <section className="panel workspace-form">
          <div className="panel-head">
            <h3>Search-Console-Daten importieren</h3>
            <FileUp size={20} />
          </div>
          <label htmlFor="search-csv">CSV-Datei</label>
          <input
            id="search-csv"
            type="file"
            accept=".csv,text/csv"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 2 * 1024 * 1024) {
                setError("Bitte eine CSV-Datei unter 2 MiB wählen.");
                return;
              }
              setCsv(await file.text());
              setSuccess("");
            }}
          />
          <p className="hint">
            Originaldaten aus deiner berechtigten Search-Console-Property. Der
            Import benötigt den Zeitraum und die zur Datei passenden Filter.
          </p>
          <label htmlFor="search-property">Property</label>
          <input
            id="search-property"
            value={property}
            onChange={(e) => setProperty(e.target.value)}
            placeholder="https://example.de/ oder sc-domain:example.de"
          />
          <div className="scope-row">
            <div>
              <label htmlFor="search-start">Zeitraum von</label>
              <input
                id="search-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="search-end">Zeitraum bis</label>
              <input
                id="search-end"
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <label htmlFor="search-dimension">Dimension der CSV</label>
          <select
            id="search-dimension"
            value={dimension}
            onChange={(e) => setDimension(e.target.value as SearchDimension)}
          >
            <option value="query">Suchanfragen</option>
            <option value="page">Seiten</option>
            <option value="date">Datum</option>
            <option value="country">Länder</option>
            <option value="device">Geräte</option>
          </select>
          <label htmlFor="search-filters">
            Angewendete Filter als JSON (optional)
          </label>
          <textarea
            id="search-filters"
            rows={2}
            placeholder={'{"country":"DE","device":"MOBILE"}'}
            value={filters}
            onChange={(e) => setFilters(e.target.value)}
          />
          {error && <Notice error>{error}</Notice>}
          {success && <Success>{success}</Success>}
          <button
            className="button primary"
            disabled={busy || !csv || !property || !startDate || !endDate}
            onClick={async () => {
              setBusy(true);
              setError("");
              setSuccess("");
              try {
                const parsed: unknown = filters.trim()
                  ? JSON.parse(filters)
                  : null;
                if (
                  parsed !== null &&
                  (typeof parsed !== "object" ||
                    Array.isArray(parsed) ||
                    Object.values(parsed).some((v) => typeof v !== "string"))
                )
                  throw new Error(
                    "Filter müssen ein JSON-Objekt mit Textwerten sein.",
                  );
                const result = await post<{ dataset: SearchDataset }>(
                  `/api/projects/${project.id}/search`,
                  {
                    csv,
                    metadata: {
                      property,
                      startDate,
                      endDate,
                      dimension,
                      filters: parsed,
                    },
                  },
                );
                setDatasets((current) => [result.dataset, ...current]);
                setSelected(result.dataset.id);
                setSuccess("Search-Console-Daten wurden lokal importiert.");
              } catch (err) {
                setError(message(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            <FileUp size={16} />
            {busy ? "Import wird geprüft …" : "CSV importieren"}
          </button>
        </section>
        <aside className="panel">
          <p className="eyebrow">WAS DIE ZAHLEN BEDEUTEN</p>
          <h3>Sichtbarkeit ist kein fixer Platz.</h3>
          <p className="hint">
            Search Console zeigt Klicks, Impressionen, CTR und eine
            durchschnittliche Position für den gewählten Zeitraum und Umfang.
            Das ist kein universeller Live-Rang für jede Person und jeden
            Standort.
          </p>
          <p className="hint">
            Anonymisierte oder fehlende Suchanfragen, begrenzte Exportzeilen und
            Filter können Daten einschränken. Unterschiedliche Dimensionsexporte
            nicht zusammenaddieren.
          </p>
          <p className="plan-note">
            Google-Daten verändern deinen Audit-Score nicht. Technisch bessere
            Seiten müssen nicht unmittelbar höher ranken.
          </p>
          <a
            className="button secondary"
            href="https://search.google.com/search-console"
            target="_blank"
            rel="noreferrer"
          >
            <Download size={15} />
            Search Console öffnen
          </a>
        </aside>
      </div>
      {dataset ? (
        <section className="panel search-results">
          <div className="panel-head">
            <div>
              <h3>Deine importierten Daten</h3>
              <p>
                {dataset.metadata.property} · {dataset.metadata.startDate} bis{" "}
                {dataset.metadata.endDate}
              </p>
            </div>
            <select
              aria-label="Import auswählen"
              value={dataset.id}
              onChange={(e) => setSelected(e.target.value)}
            >
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.metadata.startDate} – {d.metadata.endDate} ·{" "}
                  {d.metadata.dimension} · {stamp(d.importedAt)}
                </option>
              ))}
            </select>
          </div>
          <div className="metric-strip">
            <SearchMetric
              value={dataset.summary.clicks.toLocaleString("de-DE")}
              label="Klicks"
            />
            <SearchMetric
              value={dataset.summary.impressions.toLocaleString("de-DE")}
              label="Impressionen"
            />
            <SearchMetric
              value={percent(dataset.summary.ctr)}
              label="CTR im Importumfang"
            />
            <SearchMetric
              value={
                dataset.summary.position === null
                  ? "—"
                  : dataset.summary.position.toFixed(1)
              }
              label={
                dataset.summary.position === null
                  ? "Ø Position nicht aggregiert"
                  : "Durchschnittliche Position im Import"
              }
            />
          </div>
          <p className="hint">{dataset.summary.label}</p>
          {dataset.warnings.map((warning, i) => (
            <Notice key={i}>{warning}</Notice>
          ))}
          {datasets.length > 1 && (
            <div className="workspace-form">
              <label htmlFor="baseline-search">
                Mit anderem Import gegenüberstellen
              </label>
              <select
                id="baseline-search"
                value={before}
                onChange={(e) => setBefore(e.target.value)}
              >
                <option value="">Kein Vergleich</option>
                {datasets
                  .filter((d) => d.id !== dataset.id)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.metadata.startDate} – {d.metadata.endDate} ·{" "}
                      {d.metadata.dimension}
                    </option>
                  ))}
              </select>
              {baseline && (
                <div className="plan-note">
                  <strong>
                    {comparison
                      ? comparison.compatible
                        ? "Vergleichbare deklarierte Metadaten"
                        : "Unterschiedliche Datengrundlage – kein belastbares Delta"
                      : "Vergleich wird geprüft …"}
                  </strong>
                  <p>
                    Vorher: {baseline.metadata.startDate} –{" "}
                    {baseline.metadata.endDate}; {baseline.summary.clicks}{" "}
                    Klicks, {baseline.summary.impressions} Impressionen.
                  </p>
                  <p>
                    Nachher: {dataset.metadata.startDate} –{" "}
                    {dataset.metadata.endDate}; {dataset.summary.clicks} Klicks,{" "}
                    {dataset.summary.impressions} Impressionen.
                  </p>
                  <p>
                    Zeiträume, Exportabdeckung und Saisonalität selbst prüfen.
                    Diese Gegenüberstellung behauptet keinen kausalen
                    SEO-Erfolg.
                  </p>
                  {comparison && (
                    <>
                      <p>{comparison.reason}</p>
                      {comparison.clicksDelta !== null && (
                        <p>
                          Klicks: {comparison.clicksDelta > 0 ? "+" : ""}
                          {comparison.clicksDelta} · Impressionen:{" "}
                          {(comparison.impressionsDelta ?? 0) > 0 ? "+" : ""}
                          {comparison.impressionsDelta}
                        </p>
                      )}
                      {comparison.ctrDelta !== null && (
                        <p>
                          CTR: {comparison.ctrDelta > 0 ? "+" : ""}
                          {(comparison.ctrDelta * 100).toFixed(2)} Prozentpunkte
                        </p>
                      )}
                      {comparison.clicksDelta === null && (
                        <p>
                          Für diese Dimension wird kein aggregiertes Delta
                          abgeleitet.
                        </p>
                      )}
                    </>
                  )}
                  {compareError && <Notice error>{compareError}</Notice>}
                </div>
              )}
            </div>
          )}
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{dataset.metadata.dimension}</th>
                  <th>Klicks</th>
                  <th>Impressionen</th>
                  <th>CTR</th>
                  <th>Ø Position</th>
                </tr>
              </thead>
              <tbody>
                {dataset.rows.slice(0, 100).map((row, i) => (
                  <tr key={`${row.key}-${i}`}>
                    <td>{row.key}</td>
                    <td>{row.clicks}</td>
                    <td>{row.impressions}</td>
                    <td>{percent(row.ctr)}</td>
                    <td>
                      {row.position === null ? "—" : row.position.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint">
            {Math.min(100, dataset.rows.length)} von {dataset.rows.length}{" "}
            importierten Zeilen angezeigt.
          </p>
        </section>
      ) : (
        <Empty
          icon={<Search size={30} />}
          title="Noch keine Sichtbarkeitsdaten."
        >
          <p>
            Deine Website-Prüfungen funktionieren unabhängig von Google. Ein
            Import ist optional.
          </p>
        </Empty>
      )}
    </>
  );
}
function SearchMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="metric-cell">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
