import { useEffect, useState } from "react";
import { Compass, LoaderCircle, ScanLine } from "lucide-react";
import { VIEWPORTS } from "../shared/types.js";
import type {
  DiscoveryResult,
  Project,
  Scan,
  ScanOptions,
  SitemapImport,
} from "../shared/types.js";
import { message, post } from "./api.js";
import { Notice } from "./ui.js";

export default function ScanConfig({
  project,
  disabled,
  onStarted,
}: {
  project: Project;
  disabled: boolean;
  onStarted: (scan: Scan) => void | Promise<void>;
}) {
  const [pages, setPages] = useState<string[]>([project.url]);
  const [discovered, setDiscovered] = useState<string[]>([project.url]);
  const [maxPages, setMaxPages] = useState(10);
  const [maxDepth, setMaxDepth] = useState(2);
  const [excluded, setExcluded] = useState("");
  const [viewportIds, setViewportIds] = useState([
    "desktop",
    "tablet",
    "mobile",
  ]);
  const [technicalSeo, setTechnicalSeo] = useState(true);
  const [sitemapUrl, setSitemapUrl] = useState(
    new URL("/sitemap.xml", project.url).href,
  );
  const [sitemapResult, setSitemapResult] = useState<SitemapImport | null>(
    null,
  );
  const [performance, setPerformance] = useState(false);
  const [repetitions, setRepetitions] = useState<1 | 3>(1);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  useEffect(() => {
    setSitemapUrl(new URL("/sitemap.xml", project.url).href);
    setSitemapResult(null);
    setPages([project.url]);
    setDiscovered([project.url]);
    setError("");
    setWarnings([]);
  }, [project.id, project.url]);
  const exclusions = excluded
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const config: ScanOptions = {
    pages,
    maxPages,
    maxDepth,
    excludedPaths: exclusions,
    viewports: VIEWPORTS.filter((v) => viewportIds.includes(v.id)),
    performance,
    performanceRuns: repetitions,
    technicalSeo,
  };
  return (
    <div className="panel workspace-form">
      <div className="panel-head">
        <div>
          <p className="eyebrow">BEWUSST PRÜFEN, NICHT BLIND CRAWLEN</p>
          <h2>Deinen Check konfigurieren</h2>
          <p>
            Erst den Umfang festlegen. Dann wissen wir genau, worauf sich das
            Ergebnis bezieht.
          </p>
        </div>
        <Compass size={26} />
      </div>
      <div className="scope-row">
        <div>
          <label htmlFor="max-pages">Maximale Seitenzahl</label>
          <input
            id="max-pages"
            type="number"
            min={1}
            max={30}
            value={maxPages}
            onChange={(e) => setMaxPages(Number(e.target.value))}
          />
        </div>
        <div>
          <label htmlFor="max-depth">Entdeckungstiefe</label>
          <input
            id="max-depth"
            type="number"
            min={0}
            max={3}
            value={maxDepth}
            onChange={(e) => setMaxDepth(Number(e.target.value))}
          />
        </div>
      </div>
      <label htmlFor="excluded-paths">Ausgeschlossene Pfade</label>
      <textarea
        id="excluded-paths"
        value={excluded}
        onChange={(e) => setExcluded(e.target.value)}
        placeholder={"/checkout\n/account"}
        rows={2}
      />
      <p className="hint">
        Ein Pfad pro Zeile. Es werden keine Formulare abgesendet oder
        Bestellungen ausgelöst. Nur ausdrücklich freigegebene Websites prüfen.
      </p>
      <button
        className="button secondary"
        disabled={!!busy || disabled}
        onClick={async () => {
          setBusy("discover");
          setError("");
          try {
            const result = await post<DiscoveryResult>(
              `/api/projects/${project.id}/discover`,
              { maxPages, maxDepth, excludedPaths: exclusions },
            );
            setDiscovered(result.urls);
            setPages(result.urls);
            setWarnings([
              ...result.warnings,
              ...result.excluded.map((url) => `Ausgeschlossen: ${url}`),
            ]);
          } catch (err) {
            setError(message(err));
          } finally {
            setBusy("");
          }
        }}
      >
        {busy === "discover" ? (
          <LoaderCircle size={16} className="spin" />
        ) : (
          <Compass size={16} />
        )}
        Seiten entdecken
      </button>
      <details className="sitemap-import">
        <summary>Seiten aus einer Sitemap auswählen</summary>
        <p>
          XML oder gzip; auch begrenzte Sitemap-Indizes. Gleicher freigegebener
          Ursprung und Pfadausschlüsse. Neue Kandidaten werden nicht automatisch
          gescannt oder ausgewählt.
        </p>
        <label htmlFor="sitemap-url">Sitemap-URL</label>
        <input
          id="sitemap-url"
          type="url"
          value={sitemapUrl}
          onChange={(e) => setSitemapUrl(e.target.value)}
        />
        <button
          className="button secondary"
          disabled={!!busy || disabled}
          onClick={async () => {
            setBusy("sitemap");
            setError("");
            setSitemapResult(null);
            try {
              const result = await post<SitemapImport>(
                `/api/projects/${project.id}/sitemap`,
                { sitemapUrl, maxPages, excludedPaths: exclusions },
              );
              setSitemapResult(result);
              setDiscovered((current) =>
                [...new Set([...current, ...result.urls])].slice(0, 60),
              );
              setWarnings([
                ...result.warnings,
                ...result.excluded
                  .slice(0, 10)
                  .map((url) => `Nicht freigegeben/ausgewählt: ${url}`),
                "Neue Sitemap-Kandidaten bleiben bis zur ausdrücklichen Auswahl ungeprüft. Die Auswahlliste ist auf 60 Einträge begrenzt.",
              ]);
            } catch (err) {
              setError(message(err));
            } finally {
              setBusy("");
            }
          }}
        >
          {busy === "sitemap"
            ? "Sitemap wird gelesen …"
            : "Sitemap importieren"}
        </button>
        {sitemapResult && (
          <div role="status">
            <p>
              {sitemapResult.urls.length} Kandidaten ·{" "}
              {sitemapResult.documents.length} Sitemap-Dokumente ·{" "}
              {sitemapResult.limited
                ? "begrenzt"
                : "Import innerhalb der Grenzen"}
            </p>
            <ul>
              {sitemapResult.documents.map((doc, i) => (
                <li key={i}>
                  {doc.url}: {doc.status} · {doc.entries} Einträge ·{" "}
                  {doc.detail}
                </li>
              ))}
            </ul>
          </div>
        )}
      </details>
      <div className="section-divider" />
      <div className="panel-head">
        <h3>Ausgewählte Seiten</h3>
        <span className="pill">
          {pages.length} / {maxPages}
        </span>
      </div>
      <div className="url-list">
        {discovered.map((url) => (
          <label key={url} className="url-option">
            <input
              type="checkbox"
              checked={pages.includes(url)}
              onChange={(e) =>
                setPages((current) =>
                  e.target.checked
                    ? [...current, url]
                    : current.filter((p) => p !== url),
                )
              }
            />
            <span>{url}</span>
          </label>
        ))}
      </div>
      <p className="hint">
        Der Browsercheck besucht die ausgewählten Seiten. Mit aktivierter
        SEO-Kontextprüfung werden zusätzlich begrenzte interne HTTP-Ziele
        geprüft. Die Auswahl ist kein vollständiger Index deiner Domain.
      </p>
      <label className="check-option">
        <input
          type="checkbox"
          checked={technicalSeo}
          onChange={(e) => setTechnicalSeo(e.target.checked)}
        />
        <span>
          <strong>SEO-Kontextprüfung</strong>
          <small>
            Vergleicht Metadaten und interne Links. Zusätzliche GET-Stichproben:
            bis zu 40 Ziel-URLs und 60 HTTP-Anfragen inklusive Redirects im
            freigegebenen Ursprung; maximal 90 Sekunden. Keine Anmeldung oder
            Formulare.
          </small>
        </span>
      </label>
      <label>Ansichten</label>
      <div className="checkbox-grid">
        {VIEWPORTS.map((viewport) => (
          <label key={viewport.id} className="check-option">
            <input
              type="checkbox"
              checked={viewportIds.includes(viewport.id)}
              onChange={(e) =>
                setViewportIds((current) =>
                  e.target.checked
                    ? [...current, viewport.id]
                    : current.filter((id) => id !== viewport.id),
                )
              }
            />
            <span>
              <strong>
                {viewport.id === "desktop"
                  ? "Desktop"
                  : viewport.id === "tablet"
                    ? "Tablet"
                    : "Mobil"}
              </strong>
              <br />
              {viewport.width} × {viewport.height}
            </span>
          </label>
        ))}
      </div>
      <p className="hint">
        Chromium-Profile, keine Garantie für alle realen Geräte oder andere
        Browser.
      </p>
      <label className="check-option">
        <input
          type="checkbox"
          checked={performance}
          onChange={(e) => setPerformance(e.target.checked)}
        />
        <span>
          <strong>Performance-Labormessung</strong>
          <br />
          Separater Lighthouse-Lauf auf der Referenzseite. Kostet zusätzliche
          Zeit; keine echten Google-Nutzerdaten.
        </span>
      </label>
      {performance && (
        <>
          <label htmlFor="perf-runs">Wiederholungen</label>
          <select
            id="perf-runs"
            value={repetitions}
            onChange={(e) => setRepetitions(Number(e.target.value) as 1 | 3)}
          >
            <option value={1}>1 Lauf · schneller Überblick</option>
            <option value={3}>3 Läufe · Median und Streuung</option>
          </select>
        </>
      )}
      {warnings.length > 0 && (
        <details className="plan-note">
          <summary>Hinweise zur Entdeckung ({warnings.length})</summary>
          {warnings.map((w, i) => (
            <p key={i}>{w}</p>
          ))}
        </details>
      )}
      {error && <Notice error>{error}</Notice>}
      <div className="scan-config-actions">
        <button
          className="button primary"
          disabled={
            disabled ||
            !!busy ||
            !pages.length ||
            !viewportIds.length ||
            pages.length > maxPages
          }
          onClick={async () => {
            setBusy("scan");
            setError("");
            try {
              const result = await post<{ scan: Scan }>(
                `/api/projects/${project.id}/scans`,
                config,
              );
              await onStarted(result.scan);
            } catch (err) {
              setError(message(err));
            } finally {
              setBusy("");
            }
          }}
        >
          {busy === "scan" ? (
            <LoaderCircle size={17} className="spin" />
          ) : (
            <ScanLine size={17} />
          )}
          On-Screen-Check starten
        </button>
        <span className="controls-caption">
          {pages.length} Seiten × {viewportIds.length} Ansichten ·{" "}
          {pages.length * viewportIds.length} geplante Seitenansichten
        </span>
      </div>
    </div>
  );
}
