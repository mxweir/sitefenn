import GoogleConnect from "./GoogleConnect.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileUp, Search } from "lucide-react";
import type {
  Project,
  SearchDataset,
  SearchDimension,
} from "../shared/types.js";
import { api, message, post, stamp } from "./api.js";
import { Empty, Notice, Success } from "./ui.js";
import type { SearchPreview } from "../shared/search-preview.js";
import type { SearchDatasetComparison as SearchComparison } from "../server/services/search-console.js";

function landingPage(key: string, project: Project) {
  try {
    const url = new URL(key);
    if (
      url.origin !== new URL(project.url).origin ||
      url.username ||
      url.password ||
      [...url.searchParams.keys()].some((name) =>
        /^(?:access_token|token|password|secret|api_key|authorization)$/i.test(
          name,
        ),
      )
    )
      return null;
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}
export default function SearchVisibility({
  project,
  onSelectPages,
}: {
  project: Project;
  onSelectPages: (pages: string[]) => void;
}) {
  const [datasets, setDatasets] = useState<SearchDataset[]>([]);
  const [selected, setSelected] = useState("");
  const [before, setBefore] = useState("");
  const [csv, setCsv] = useState("");
  const [property, setProperty] = useState(project.url);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dimension, setDimension] = useState<SearchDimension>("query");
  const [country, setCountry] = useState("");
  const [device, setDevice] = useState("");
  const [source, setSource] = useState<"csv" | "google-api">("csv");
  const [unknownFilters, setUnknownFilters] = useState(false);
  const [preview, setPreview] = useState<SearchPreview>();
  const [pages, setPages] = useState<string[]>([]);
  const filters = {
    ...(country ? { country: country.toLowerCase() } : {}),
    ...(device ? { device } : {}),
  };
  const metadata = {
    property,
    startDate,
    endDate,
    dimension,
    filters: unknownFilters ? null : filters,
  };
  const previewScope = useMemo(
    () => ({}),
    [
      source,
      csv,
      property,
      startDate,
      endDate,
      dimension,
      country,
      device,
      unknownFilters,
    ],
  );
  const liveScope = useRef(previewScope);
  liveScope.current = previewScope;
  const showPreview = (candidate: SearchPreview) => {
    if (liveScope.current === previewScope) setPreview(candidate);
  };
  const endpoint = `/api/projects/${project.id}/search`;
  const valid =
    !!startDate &&
    endDate >= startDate &&
    (!country || /^[a-z]{3}$/i.test(country));
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
  const baseline = datasets.find(
    (d) => d.id === before && d.id !== dataset?.id,
  );
  useEffect(() => {
    setPages([]);
  }, [dataset?.id]);
  useEffect(() => {
    setPreview(undefined);
  }, [
    csv,
    property,
    startDate,
    endDate,
    dimension,
    country,
    device,
    unknownFilters,
  ]);
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
  const scopeFields = (
    <>
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
      <label htmlFor="search-dimension">Dimension</label>
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
      <div className="scope-row">
        <div>
          <label htmlFor="search-country">Land (ISO-3)</label>
          <input
            id="search-country"
            maxLength={3}
            placeholder="z. B. DEU"
            value={country}
            onChange={(event) => setCountry(event.target.value.trim())}
          />
        </div>
        <div>
          <label htmlFor="search-device">Gerät</label>
          <select
            id="search-device"
            value={device}
            onChange={(event) => setDevice(event.target.value)}
          >
            <option value="">Alle Geräte</option>
            <option value="MOBILE">Mobil</option>
            <option value="DESKTOP">Desktop</option>
            <option value="TABLET">Tablet</option>
          </select>
        </div>
      </div>
    </>
  );
  return (
    <>
      <div className="panel-head">
        <div>
          <p className="eyebrow">ECHTE DATEN, KEIN ERFUNDENER GOOGLE-RANG</p>
          <h2>Google-Sichtbarkeit</h2>
          <p>
            Importiere einen eigenen Search-Console-CSV-Export oder verbinde
            Google optional mit rein lesendem Zugriff.
          </p>
        </div>
        <Search size={25} />
      </div>
      <div className="panel workspace-form">
        <label htmlFor="search-source">Importquelle</label>
        <select
          id="search-source"
          value={source}
          disabled={busy}
          onChange={(event) => {
            setSource(
              event.target.value === "google-api" ? "google-api" : "csv",
            );
            setPreview(undefined);
            setError("");
          }}
        >
          <option value="csv">Search-Console-CSV</option>
          <option value="google-api">
            Google Search Console · experimentell
          </option>
        </select>
      </div>
      {source === "google-api" ? (
        <GoogleConnect
          projectId={project.id}
          metadata={{ ...metadata, filters: valid ? filters : null }}
          scopeFields={scopeFields}
          onPreview={showPreview}
          onInvalidate={() => setPreview(undefined)}
        />
      ) : (
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
            {scopeFields}
            <label className="checklist-field">
              <input
                type="checkbox"
                checked={unknownFilters}
                onChange={(event) => setUnknownFilters(event.target.checked)}
              />
              Filter dieses CSV-Exports sind unbekannt
            </label>
            {error && <Notice error>{error}</Notice>}

            <button
              className="button primary"
              disabled={busy || !csv || !property || !valid}
              onClick={async () => {
                setBusy(true);
                setError("");
                setSuccess("");
                try {
                  setPreview(undefined);
                  showPreview(
                    await post<SearchPreview>(`${endpoint}/preview`, {
                      source: "csv",
                      csv,
                      metadata,
                    }),
                  );
                } catch (err) {
                  setError(message(err));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <FileUp size={16} />
              {busy ? "Import wird geprüft …" : "CSV-Vorschau prüfen"}
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
              Anonymisierte oder fehlende Suchanfragen, begrenzte Exportzeilen
              und Filter können Daten einschränken. Unterschiedliche
              Dimensionsexporte nicht zusammenaddieren.
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
      )}
      {preview && (
        <section className="panel" aria-label="Importvorschau">
          {source === "google-api" && error && <Notice error>{error}</Notice>}
          <h3>
            Importvorschau ·{" "}
            {preview.metadata.source === "google-api"
              ? "Google Search Console"
              : "CSV"}
          </h3>
          <p>
            {preview.metadata.property} · {preview.metadata.startDate} bis{" "}
            {preview.metadata.endDate} · {preview.metadata.dimension}
          </p>
          <p>
            {preview.count} Zeilen · {preview.summary.clicks} Klicks ·{" "}
            {preview.summary.impressions} Impressionen im Ausschnitt
          </p>
          <p>
            {preview.metadata.filters === null
              ? "Filter unbekannt"
              : Object.entries(preview.metadata.filters)
                  .map(([name, value]) => `${name}: ${value}`)
                  .join(" · ") || "Keine Filter angegeben"}
          </p>
          {preview.rows.length > 0 && (
            <ul className="search-keys">
              {preview.rows.map((row) => (
                <li key={row.key}>
                  {row.key} · {row.clicks} Klicks
                </li>
              ))}
            </ul>
          )}
          {preview.warnings.map((warning) => (
            <p className="hint" key={warning}>
              {warning}
            </p>
          ))}
          <div className="button-row">
            <button
              className="button primary"
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const { dataset } = await post<{ dataset: SearchDataset }>(
                    `${endpoint}/commit`,
                    { id: preview.id },
                  );
                  setDatasets((current) => [dataset, ...current]);
                  setSelected(dataset.id);
                  setPreview(undefined);
                  setSuccess("Search-Console-Daten wurden lokal importiert.");
                } catch (error) {
                  setError(message(error));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Import bestätigen
            </button>
            <button
              className="button secondary"
              type="button"
              disabled={busy}
              onClick={() => setPreview(undefined)}
            >
              Vorschau verwerfen
            </button>
          </div>
        </section>
      )}
      {success && <Success>{success}</Success>}
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
          <p className="hint">
            Quelle:{" "}
            {dataset.metadata.source === "google-api"
              ? "Google API · finale Top-Zeilen"
              : "CSV · Exportausschnitt"}{" "}
            · Importiert: {stamp(dataset.importedAt)} ·{" "}
            {dataset.metadata.filters === null
              ? "Filter unbekannt"
              : Object.entries(dataset.metadata.filters)
                  .map(([name, value]) => `${name}: ${value}`)
                  .join(" · ") || "Keine Filter angegeben"}
          </p>
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
                      {comparison.pages && (
                        <div className="data-table-wrap">
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>Landingpage</th>
                                <th>Klicks vorher</th>
                                <th>Klicks nachher</th>
                                <th>Δ Klicks</th>
                                <th>Δ Impressionen</th>
                              </tr>
                            </thead>
                            <tbody>
                              {comparison.pages.slice(0, 100).map((row) => (
                                <tr key={row.url}>
                                  <td>{row.url}</td>
                                  <td>{row.before?.clicks ?? "Unbekannt"}</td>
                                  <td>{row.after?.clicks ?? "Unbekannt"}</td>
                                  <td>{row.clicksDelta ?? "Unbekannt"}</td>
                                  <td>{row.impressionsDelta ?? "Unbekannt"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <p className="hint">
                            Bis zu 100 Zeilen des Vergleichs sichtbar.
                          </p>
                        </div>
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
          {dataset.metadata.dimension === "page" && (
            <div className="button-row">
              <button
                className="button primary"
                type="button"
                disabled={!pages.length}
                onClick={() => onSelectPages(pages)}
              >
                {pages.length} Landingpages für einen Check auswählen
              </button>
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
                    <td>
                      {dataset.metadata.dimension === "page" &&
                        (() => {
                          const url = landingPage(row.key, project);
                          return (
                            url && (
                              <input
                                type="checkbox"
                                aria-label={`Für Check auswählen: ${row.key}`}
                                checked={pages.includes(url)}
                                disabled={
                                  !pages.includes(url) && pages.length >= 30
                                }
                                onChange={(event) =>
                                  setPages((current) =>
                                    event.target.checked
                                      ? [...new Set([...current, url])]
                                      : current.filter((item) => item !== url),
                                  )
                                }
                              />
                            )
                          );
                        })()}{" "}
                      {row.key}
                    </td>
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
