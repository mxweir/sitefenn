import type { CheckProfile } from "../shared/check-profile.js";
import { useProjectDraft } from "./workspace-state.js";
import JourneyBuilder from "./JourneyBuilder.js";
import type { Journey } from "../shared/types.js";
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
  selectedLandingPages,
  onLandingPagesApplied,
}: {
  project: Project;
  disabled: boolean;
  onStarted: (scan: Scan) => void | Promise<void>;
  selectedLandingPages?: string[];
  onLandingPagesApplied?: () => void;
}) {
  const [pages, setPages] = useState<string[]>([project.url]);
  const [discovered, setDiscovered] = useState<string[]>([project.url]);
  const [maxPages, setMaxPages] = useProjectDraft(
    project.id,
    "scan:maxPages",
    10,
  );
  const [maxDepth, setMaxDepth] = useProjectDraft(
    project.id,
    "scan:maxDepth",
    2,
  );
  const [excluded, setExcluded] = useProjectDraft(
    project.id,
    "scan:excluded",
    "",
  );
  const [viewportIds, setViewportIds] = useProjectDraft(
    project.id,
    "scan:viewports",
    ["desktop", "tablet", "mobile"],
  );
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [technicalSeo, setTechnicalSeo] = useProjectDraft(
    project.id,
    "scan:technicalSeo",
    true,
  );
  const [sitemapUrl, setSitemapUrl] = useState(
    new URL("/sitemap.xml", project.url).href,
  );
  const [sitemapResult, setSitemapResult] = useState<SitemapImport | null>(
    null,
  );
  const [performance, setPerformance] = useProjectDraft(
    project.id,
    "scan:performance",
    false,
  );
  const [repetitions, setRepetitions] = useProjectDraft<1 | 3>(
    project.id,
    "scan:repetitions",
    1,
  );
  const [imported, setImported] = useState<CheckProfile>();
  const [profileConfirmed, setProfileConfirmed] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  useEffect(() => {
    setSitemapUrl(new URL("/sitemap.xml", project.url).href);
    setSitemapResult(null);
    setJourneys([]);
    setPages([project.url]);
    setDiscovered([project.url]);
    setError("");
    setWarnings([]);
    setImported(undefined);
    setProfileConfirmed(false);
    setProfileError("");
  }, [project.id, project.url]);
  useEffect(() => {
    if (!selectedLandingPages?.length) return;
    setPages(selectedLandingPages);
    setDiscovered([
      project.url,
      ...selectedLandingPages.filter((url) => url !== project.url),
    ]);
    if (selectedLandingPages.length > maxPages)
      setMaxPages(selectedLandingPages.length);
    onLandingPagesApplied?.();
  }, [selectedLandingPages]);
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
    ...(journeys.length ? { journeys } : {}),
  };
  return (
    <div
      id="scan-config"
      tabIndex={-1}
      aria-label="Prüfumfang konfigurieren"
      className="panel workspace-form"
    >
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
      <JourneyBuilder
        journeys={journeys}
        onChange={setJourneys}
        pages={pages}
        devices={viewportIds}
        disabled={!!busy || disabled}
      />
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
      {journeys.some((j) => !j.confirmed) && (
        <Notice>
          Bitte jeden Seitenablauf prüfen und ausdrücklich freigeben oder
          entfernen, bevor du den Check startest.
        </Notice>
      )}
      <details className="plan-note profile-import">
        <summary>Gespeichertes CLI-Prüfprofil verwenden</summary>
        <p>
          Lade ein Profil aus diesem Projekt. Ziel, Umfeld und Port müssen
          übereinstimmen. Die aktuelle manuelle Auswahl bleibt erhalten.
        </p>
        <label htmlFor="cli-profile-file">Prüfprofil als JSON</label>
        <input
          id="cli-profile-file"
          type="file"
          accept=".json,application/json"
          disabled={!!busy}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            setImported(undefined);
            setProfileConfirmed(false);
            setProfileError("");
            if (!file) return;
            try {
              if (file.size > 100000)
                throw Error("Prüfprofil ist größer als 100 KB.");
              const profile = JSON.parse(await file.text()) as CheckProfile;
              if (
                profile?.version !== "sitefenn-profile-1" ||
                typeof profile.url !== "string" ||
                !Array.isArray(profile.options?.pages) ||
                !profile.options.pages.every(
                  (page) => typeof page === "string",
                ) ||
                !Array.isArray(profile.options?.viewports) ||
                (profile.name !== undefined && typeof profile.name !== "string")
              )
                throw Error("Ungültiges SiteFenn-Prüfprofil.");
              if (
                profile.projectId !== project.id ||
                profile.environment !== project.environment
              )
                throw Error(
                  "Profil gehört zu einem anderen Projekt oder Umfeld.",
                );
              setImported(profile);
            } catch (error) {
              setProfileError(message(error));
            }
          }}
        />
        {imported && (
          <>
            <p>
              <strong>{imported.name || "Unbenanntes Profil"}</strong> ·{" "}
              {imported.environment} · {imported.url}
            </p>
            <p>
              {imported.options.pages.length} Seiten ·{" "}
              {imported.options.viewports.length} Geräteprofile
            </p>
            <ul>
              {imported.options.pages.map((page, index) => (
                <li key={index}>{page}</li>
              ))}
            </ul>
            {(imported.options.journeys?.length ?? 0) > 0 && (
              <Notice>
                Dieses Profil enthält gespeicherte Seitenaktionen. Prüfe deren
                Details in der JSON-Datei vor der Freigabe.
              </Notice>
            )}
            <label className="checklist-field">
              <input
                type="checkbox"
                checked={profileConfirmed}
                disabled={!!busy}
                onChange={(event) => setProfileConfirmed(event.target.checked)}
              />
              Ich habe Umfang, Ziele und enthaltene Seitenaktionen geprüft und
              freigegeben.
            </label>
            <button
              className="button secondary"
              type="button"
              disabled={disabled || !!busy || !profileConfirmed}
              onClick={async () => {
                setBusy("profile");
                setProfileError("");
                try {
                  const { scan } = await post<{ scan: Scan }>(
                    `/api/projects/${project.id}/profile-check`,
                    { profile: imported, confirmed: profileConfirmed },
                  );
                  await onStarted(scan);
                } catch (error) {
                  setProfileError(message(error));
                } finally {
                  setBusy("");
                }
              }}
            >
              Check mit Profil starten
            </button>
          </>
        )}
        {profileError && <Notice error>{profileError}</Notice>}
      </details>
      {error && <Notice error>{error}</Notice>}
      <div className="scan-config-actions">
        <button
          className="button primary"
          disabled={
            disabled ||
            !!busy ||
            !pages.length ||
            !viewportIds.length ||
            pages.length > maxPages ||
            journeys.some((j) => !j.confirmed)
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
