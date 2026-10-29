import { useState } from "react";
import type { Scan, SeoProbe } from "../shared/types.js";
import { Empty, Notice } from "./ui.js";
import { stamp } from "./api.js";
const state = (value: string) =>
  ({
    pass: "Im Teilumfang unauffällig",
    fail: "Befund / Prüfkandidat",
    not_run: "Unbekannt / begrenzt",
    not_applicable: "Nicht im unterstützten Profil",
  })[value] ?? value;
const probeLabel = (p?: SeoProbe) =>
  !p
    ? "Nicht abgefragt"
    : p.outcome !== "checked"
      ? `Unbekannt${p.statusCode ? ` · HTTP ${p.statusCode}` : ""}`
      : `HTTP ${p.statusCode}${p.redirects.length ? ` · ${p.redirects.length} Redirect(s)` : ""}`;
export default function SeoReport({
  scan,
  onFinding,
}: {
  scan?: Scan;
  onFinding: (id: string) => void;
}) {
  const [tab, setTab] = useState("links"),
    [page, setPage] = useState("all"),
    [device, setDevice] = useState("all"),
    [query, setQuery] = useState("");
  const report = scan?.result?.audit,
    seo = report?.seo;
  if (!seo || !report)
    return (
      <Empty title="SEO im Zusammenhang prüfen">
        <p>
          Starte einen neuen Check mit aktivierter „SEO-Kontextprüfung“. Frühere
          Berichte erhalten keine nachträglich erfundenen Link- oder
          Metadatenmessungen. Sitemap-Kandidaten lassen sich vorher in der
          Übersicht importieren.
        </p>
      </Empty>
    );
  const matches = (s: { pageUrl: string; viewportId: string }) =>
    (page === "all" || s.pageUrl === page) &&
    (device === "all" || s.viewportId === device);
  const pages = seo.pages.filter(matches),
    probes = new Map(seo.probes.map((p) => [p.url, p]));
  const search = (...values: string[]) =>
    !query ||
    values.join(" ").toLocaleLowerCase().includes(query.toLocaleLowerCase());
  const edges = seo.graph.filter(
    (e) =>
      (page === "all" || e.from === page) &&
      (device === "all" || e.viewportIds.includes(device)) &&
      search(e.from, e.to, e.text),
  );
  const related = new Set(
    pages.flatMap((p) => [
      p.pageUrl,
      ...p.links.map((l) => l.url),
      ...p.canonicals.map((c) => {
        try {
          return new URL(c, p.finalUrl).href;
        } catch {
          return c;
        }
      }),
    ]),
  );
  const findingButton = (
    ruleId: string,
    pageUrl: string,
    viewportId: string,
  ) => {
    const f = report.findings.find(
      (f) =>
        f.ruleId === ruleId &&
        f.pageUrl === pageUrl &&
        f.viewportId === viewportId,
    );
    return f ? (
      <button className="text-button" onClick={() => onFinding(f.id)}>
        Befund und Maßnahme öffnen
      </button>
    ) : null;
  };
  return (
    <section
      className="seo-workspace"
      aria-label="Technisches SEO im Zusammenhang"
    >
      <header className="panel-head">
        <div>
          <p className="eyebrow">VERBINDUNGEN SEHEN. SIGNALE VERSTEHEN.</p>
          <h2>SEO-Kontext</h2>
          <p>
            Links, Metadaten und Indexierungssignale aus diesem gespeicherten
            Prüfbereich.
          </p>
        </div>
        <span className="pill">technical-seo-1.4</span>
      </header>
      <Notice>
        HTTP-Status sind zeitbezogene Stichproben. Metadatenähnlichkeit und
        widersprüchliche Signale bleiben Prüfkandidaten. Keine
        Google-Indexierung, Rankingprognose oder vollständige Website-Abdeckung.
      </Notice>
      {scan?.options?.retest && (
        <Notice>
          Teilnachtest: Vergleiche und Linkbeobachtungen beziehen sich nur auf
          diesen Teilumfang.
        </Notice>
      )}
      <div className="seo-summary">
        {[
          ["Geprüfte Dokumente", new Set(seo.pages.map((p) => p.pageUrl)).size],
          ["Beobachtete Linkkanten", seo.graph.length],
          [
            "HTTP-Ziele geprüft",
            `${seo.coverage.checkedTargets}/${seo.coverage.linkTargets}`,
          ],
          ["Nicht abgefragt", seo.coverage.omittedTargets],
        ].map(([label, value]) => (
          <div className="panel" key={label}>
            <span className="small-label">{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <details className="panel">
        <summary>Prüfumfang und Grenzen ansehen</summary>
        <p>
          Bis zu 100 Anker pro Seite/Profil, 1.500 Graphkanten, 40 Zielproben,
          60 HTTP-Anfragen einschließlich Redirects und 90 Sekunden. HTTP-Proben
          sind einmalig pro URL; das Geräteprofil bezeichnet die Quelle der
          gerenderten Beobachtung.
        </p>
        <p>
          {seo.coverage.linksTruncated
            ? "Linkerfassung ist begrenzt; nicht erfasste Ziele bleiben unbekannt."
            : "Kein Erfassungslimit für die gespeicherten Linkkanten gemeldet."}
        </p>
        <ul>
          {seo.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      </details>
      <div className="filter-bar">
        <select
          aria-label="SEO-Seite filtern"
          value={page}
          onChange={(e) => setPage(e.target.value)}
        >
          <option value="all">Alle geprüften Seiten</option>
          {report.options.pages.map((url) => (
            <option key={url} value={url}>
              {url}
            </option>
          ))}
        </select>
        <select
          aria-label="SEO-Gerät filtern"
          value={device}
          onChange={(e) => setDevice(e.target.value)}
        >
          <option value="all">Alle Profile</option>
          {report.options.viewports.map((p) => (
            <option key={p.id} value={p.id}>
              {p.id}
            </option>
          ))}
        </select>
        <input
          aria-label="SEO-Kontext durchsuchen"
          placeholder="URL, Text oder Titel suchen"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <nav className="seo-tabs" aria-label="SEO-Kontextbereiche">
        {[
          ["links", "Links & Redirects"],
          ["metadata", "Metadaten im Vergleich"],
          ["indexing", "Canonical & Robots"],
          ["schema", "Strukturierte Daten"],
        ].map(([id, label]) => (
          <button
            key={id}
            aria-pressed={tab === id}
            className={`button ${tab === id ? "primary" : "secondary"}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "links" && (
        <>
          <section className="panel">
            <h3>Interner Linkgraph</h3>
            <p>
              Gerichtete Kanten: gerenderte Quellseite → beobachtetes internes
              Ziel. Keine vollständige Erreichbarkeits- oder Verwaisungsprüfung.
            </p>
            <div className="seo-node-list">
              {[...new Set(pages.map((p) => p.pageUrl))]
                .filter((url) => search(url))
                .map((url) => (
                  <div key={url} className="seo-node">
                    <strong className="seo-url">{new URL(url).pathname}</strong>
                    <span>
                      {seo.graph.filter((e) => e.to === url).length} eingehend
                      beobachtet ·{" "}
                      {seo.graph.filter((e) => e.from === url).length} ausgehend
                    </span>
                    <small>
                      0 eingehende Kanten beweisen keine verwaiste Seite.
                    </small>
                  </div>
                ))}
            </div>
            <div
              className="seo-table-scroll"
              tabIndex={0}
              aria-label="Interner Linkgraph als Tabelle"
            >
              <table className="seo-table">
                <thead>
                  <tr>
                    <th>Quellseite</th>
                    <th>Internes Ziel</th>
                    <th>HTTP-Stichprobe / Quelle</th>
                  </tr>
                </thead>
                <tbody>
                  {edges.map((e, i) => (
                    <tr key={i}>
                      <td className="seo-url">
                        {e.from}
                        <small>{e.text || "Ohne beobachteten Linktext"}</small>
                      </td>
                      <td className="seo-url">
                        → {e.to}
                        <small>{e.rel || "Kein rel-Wert"}</small>
                      </td>
                      <td>
                        {probeLabel(probes.get(e.to))}
                        <small>{e.viewportIds.join(", ")}</small>
                        {probes.get(e.to)?.outcome === "checked" &&
                          (probes.get(e.to)?.statusCode ?? 0) >= 400 &&
                          findingButton(
                            "seo-internal-links",
                            e.from,
                            e.viewportIds[0]!,
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!edges.length && (
              <p>
                Keine beobachteten Kanten für diesen Filter. Das ist kein
                vollständiges Urteil über interne Links.
              </p>
            )}
          </section>
          <section className="panel">
            <h3>Zielproben und Redirect-Ketten</h3>
            <p>
              Nur GET ohne Anmeldung. Ausgeschlossene oder beschränkte Ziele
              sind unbekannt, keine als kaputt bestätigten Links.
            </p>
            {seo.probes
              .filter(
                (p) =>
                  ((page === "all" && device === "all") ||
                    related.has(p.url)) &&
                  search(p.url, p.detail),
              )
              .map((p) => (
                <details key={p.url} className="seo-probe">
                  <summary>
                    <span
                      className={`pill ${p.outcome === "checked" && (p.statusCode ?? 0) >= 400 ? "important" : "info"}`}
                    >
                      {probeLabel(p)}
                    </span>{" "}
                    <span className="seo-url">{p.url}</span>
                  </summary>
                  <p>{p.detail}</p>
                  <p>Beobachtet: {stamp(p.checkedAt)}</p>
                  <ol className="seo-url">
                    {p.redirects.map((r, i) => (
                      <li key={i}>
                        {r.url} — HTTP {r.statusCode} → {r.to}
                      </li>
                    ))}
                  </ol>
                  <p className="seo-url">
                    Endziel: {p.finalUrl ?? "Unbekannt"}
                  </p>
                </details>
              ))}
          </section>
        </>
      )}
      {tab === "metadata" && (
        <>
          <section className="panel">
            <h3>Metadaten der geprüften Seiten</h3>
            <p>
              Normalisierte Ähnlichkeit innerhalb des erfassten Profils. Kein
              Rankingverlust und keine gemeinsame Template-Ursache nachgewiesen.
            </p>
            <div
              className="seo-table-scroll"
              tabIndex={0}
              aria-label="Metadaten im Seitenvergleich"
            >
              <table className="seo-table">
                <thead>
                  <tr>
                    <th>Seite / Profil</th>
                    <th>Titel</th>
                    <th>Beschreibung</th>
                  </tr>
                </thead>
                <tbody>
                  {pages
                    .filter((p) => search(p.pageUrl, p.title, p.description))
                    .map((p) => (
                      <tr key={`${p.pageUrl}:${p.viewportId}`}>
                        <td className="seo-url">
                          {p.pageUrl}
                          <small>
                            {p.viewportId}
                            {p.signalsTruncated ? " · Metadaten begrenzt" : ""}
                          </small>
                        </td>
                        <td>{p.title || "Leer / fehlt"}</td>
                        <td>{p.description || "Leer / fehlt"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
          {seo.duplicates
            .filter(
              (g) =>
                (page === "all" || g.pages.includes(page)) &&
                (device === "all" || g.viewportId === device) &&
                search(g.value, ...g.pages),
            )
            .map((g, i) => (
              <article className="panel" key={i}>
                <span className="pill candidate">
                  Prüfkandidat · {g.viewportId}
                </span>
                <h3>
                  {g.kind === "title"
                    ? "Ähnliche Seitentitel"
                    : "Ähnliche Meta Descriptions"}
                </h3>
                <p>{g.value}</p>
                <ul className="seo-url">
                  {g.pages.map((url) => (
                    <li key={url}>{url}</li>
                  ))}
                </ul>
                {findingButton(
                  `seo-duplicate-${g.kind}`,
                  g.pages[0]!,
                  g.viewportId,
                )}
              </article>
            ))}
          {!seo.duplicates.length && (
            <p>
              Keine normalisierten Duplikatgruppen in den tatsächlich erfassten
              Dokumenten. Grenzen und nicht geprüfte Seiten beachten.
            </p>
          )}
        </>
      )}
      {tab === "indexing" && (
        <>
          <section className="panel">
            <h3>Robots-Kontext für Googlebot</h3>
            <p>{seo.robots.detail}</p>
            <p className="seo-url">
              {seo.robots.url || "Nicht gelesen"} · HTTP{" "}
              {seo.robots.statusCode ?? "unbekannt"}
            </p>
            <p>
              robots.txt ist keine Zugriffserlaubnis oder Zugangssicherung. Die
              Produktionsabsicht wird nicht auf Staging-/lokale Projekte
              übertragen.
            </p>
            <ul className="seo-url">
              {seo.robots.googlebot.map((p) => (
                <li key={p.pageUrl}>
                  {p.pageUrl} —{" "}
                  {p.allowed === null
                    ? "unbekannt"
                    : p.allowed
                      ? "laut Datei nicht gesperrt"
                      : "laut Datei gesperrt"}
                </li>
              ))}
            </ul>
          </section>
          {pages
            .filter((p) => search(p.pageUrl, ...p.canonicals, ...p.robots))
            .map((p) => (
              <article className="panel" key={`${p.pageUrl}:${p.viewportId}`}>
                <h3 className="seo-url">{p.pageUrl}</h3>
                <p className="small-label">{p.viewportId}</p>
                <p>
                  Meta Robots:{" "}
                  {[...p.robots, ...p.googlebot.map((v) => `Googlebot: ${v}`)]
                    .filter(Boolean)
                    .join(" · ") || "Nicht beobachtet"}
                </p>
                <p>
                  X-Robots-Tag:{" "}
                  {p.headerRobots.filter(Boolean).join(" · ") ||
                    "Nicht beobachtet"}
                </p>
                <ul className="seo-url">
                  {p.canonicals.map((c, i) => (
                    <li key={i}>Canonical: {c || "Leeres Attribut"}</li>
                  ))}
                </ul>
                {!p.canonicals.length && (
                  <p>
                    Kein HTML-Canonical beobachtet; nicht automatisch ein
                    Fehler.
                  </p>
                )}
                <p>
                  {
                    report.rules.find(
                      (r) =>
                        r.ruleId === "seo-canonical-target" &&
                        r.pageUrl === p.pageUrl &&
                        r.viewportId === p.viewportId,
                    )?.detail
                  }
                </p>
                {findingButton("seo-canonical-target", p.pageUrl, p.viewportId)}
                {findingButton("seo-robots-context", p.pageUrl, p.viewportId)}
              </article>
            ))}
        </>
      )}
      {tab === "schema" && (
        <>
          <Notice>
            JSON-Syntax und das eingeschränkte Inline-Breadcrumb-Profil sind
            verschiedene Prüfungen. Andere Schema-Typen, Referenzauflösung,
            Sichtbarkeit und Google-Rich-Result-Eignung sind nicht validiert.
          </Notice>
          {pages
            .filter((p) => search(p.pageUrl, ...p.jsonld.types))
            .map((p) => (
              <article className="panel" key={`${p.pageUrl}:${p.viewportId}`}>
                <h3 className="seo-url">{p.pageUrl}</h3>
                <p className="small-label">{p.viewportId}</p>
                <p>
                  JSON-Syntax:{" "}
                  {state(
                    report.rules.find(
                      (r) =>
                        r.ruleId === "structured-data-json" &&
                        r.pageUrl === p.pageUrl &&
                        r.viewportId === p.viewportId,
                    )?.status ?? "not_run",
                  )}
                </p>
                <p>Breadcrumb-Teilprofil: {state(p.jsonld.status)}</p>
                <p>{p.jsonld.detail}</p>
                <p>
                  Beobachtete Typen:{" "}
                  {p.jsonld.types.join(", ") || "Keine erkannten Typen"}
                </p>
                {findingButton(
                  "seo-breadcrumb-profile",
                  p.pageUrl,
                  p.viewportId,
                )}
              </article>
            ))}
          <a
            href="https://developers.google.com/search/docs/appearance/structured-data/breadcrumb"
            target="_blank"
            rel="noreferrer"
          >
            Dokumentiertes Breadcrumb-Profil bei Google
          </a>
        </>
      )}
    </section>
  );
}
