import DeveloperHandoff from "./DeveloperHandoff.js";
import WorkPriority from "./WorkPriority.js";
import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  ScanLine,
  Sparkles,
} from "lucide-react";
import type {
  AuditTask,
  Finding,
  Scan,
  ScoreSummary,
  TaskStatus,
} from "../shared/types.js";
import { api, categoryLabel, message, patch, post, stamp } from "./api.js";
import { Dialog, Empty, Notice } from "./ui.js";
import ScoreCard from "./ScoreCard.js";
import { EvidenceView } from "./LiveScan.js";

export const priorityLabel = (value: string) =>
  value === "critical"
    ? "Kritisch"
    : value === "important"
      ? "Wichtig"
      : "Nice to have";
export const evidenceLabel = (value: string) =>
  value === "measured"
    ? "Gemessen"
    : value === "heuristic"
      ? "Heuristischer Prüfkandidat"
      : "KI-Empfehlung";
export const taskLabels: Record<TaskStatus, string> = {
  open: "Offen",
  "in-progress": "In Arbeit",
  review: "Zur Prüfung",
  verified: "Verifiziert behoben",
  accepted: "Akzeptiertes Risiko",
};
export function Report({
  scan,
  score,
  onExplain,
  initialFindingId,
  tasks = [],
}: {
  scan?: Scan;
  score?: ScoreSummary;
  onExplain: (finding?: Finding, pageUrl?: string) => void;
  initialFindingId?: string;
  tasks?: AuditTask[];
}) {
  const [category, setCategory] = useState("all");
  const [priority, setPriority] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState("all");
  const [device, setDevice] = useState("all");
  const [status, setStatus] = useState("all");
  const [grouped, setGrouped] = useState(true);
  const [variant, setVariant] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const report = scan?.result?.audit;
  useEffect(() => {
    setCategory("all");
    setPriority("all");
    setQuery("");
    setStatus("all");
    const finding = report?.findings.find(
      (item) => item.id === initialFindingId,
    );
    setPage(finding?.pageUrl ?? "all");
    setDevice(finding?.viewportId ?? "all");
    setOpen(finding?.id ?? null);
    setVariant(finding?.id ?? "");
  }, [scan?.id, initialFindingId, !!report]);
  useEffect(() => {
    if (!initialFindingId || open !== initialFindingId) return;
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(`finding-${initialFindingId}`);
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: "center", behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [initialFindingId, open]);
  if (!scan?.result)
    return (
      <Empty
        icon={<ScanLine size={32} />}
        title="Ein Bericht braucht einen abgeschlossenen Check."
      >
        <p>
          Aktive oder abgebrochene Prüfungen liefern noch keinen vollständigen
          Bericht.
        </p>
      </Empty>
    );
  const findings = report?.findings ?? [];
  const visible = findings.filter(
    (f) =>
      (category === "all" || f.category === category) &&
      (priority === "all" || f.priority === priority) &&
      (page === "all" || f.pageUrl === page) &&
      (device === "all" || f.viewportId === device) &&
      (status === "all" ||
        tasks.some(
          (task) => task.findingIds.includes(f.id) && task.status === status,
        )) &&
      `${f.title} ${f.detail} ${f.pageUrl}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const categories = [...new Set(findings.map((f) => f.category))];
  const groupedFindings = new Map<string, Finding[]>();
  for (const finding of visible) {
    const key = grouped
      ? JSON.stringify([
          finding.pageUrl,
          finding.ruleId,
          finding.selector ?? finding.title,
          finding.evidenceStatus,
        ])
      : finding.id;
    groupedFindings.set(key, [...(groupedFindings.get(key) ?? []), finding]);
  }
  return (
    <>
      <div className="toolbar report-toolbar">
        <div>
          <p className="eyebrow">NACHVOLLZIEHBAR STATT PAUSCHAL</p>
          <h2>Dein Prüfbericht</h2>
        </div>
        <div className="action-group">
          <button
            className="button secondary"
            onClick={() =>
              onExplain(undefined, page === "all" ? undefined : page)
            }
          >
            <Sparkles size={16} />
            Mit Fenn besprechen
          </button>
          <button
            className="button primary"
            onClick={() => setExportOpen(true)}
          >
            <Download size={16} />
            Bericht exportieren
          </button>
        </div>
      </div>
      {scan.options?.retest && (
        <Notice>
          Gezielter Teilnachtest. Nur dieser ausgewählte Umfang wurde geprüft;
          der vollständige Projekt-Score bleibt separat erhalten. Ausgangscheck:{" "}
          {scan.options.retest.sourceScanId.slice(0, 8)}.
        </Notice>
      )}
      <p className="report-meta">
        Scan {scan.id.slice(0, 8)} · {stamp(scan.createdAt)} ·{" "}
        {report?.pages.length ?? 1} Seiten-/Zustandsansichten · Regeln{" "}
        {report?.ruleVersion ?? "legacy"} · Chromium{" "}
        {report?.browserVersion ?? "nicht dokumentiert"}
      </p>
      <details className="plan-note">
        <summary>Ausführungsidentität dieses Berichts</summary>
        {report?.provenance ? (
          <dl>
            <dt>SiteFenn / Node</dt>
            <dd>
              {report.provenance.appVersion} / {report.provenance.nodeVersion}
            </dd>
            <dt>Playwright / axe / Lighthouse</dt>
            <dd>
              {report.provenance.playwrightVersion} /{" "}
              {report.provenance.axeVersion} /{" "}
              {report.provenance.lighthouseVersion}
            </dd>
            <dt>System</dt>
            <dd>
              {report.provenance.platform} / {report.provenance.arch}
            </dd>
            <dt>Engine SHA-256</dt>
            <dd className="identity-hash">{report.provenance.engineSha256}</dd>
          </dl>
        ) : (
          <p>
            Historischer Bericht: Die genaue Ausführungsidentität wurde noch
            nicht erfasst. Für einen belastbaren Vergleich einen neuen Check
            starten.
          </p>
        )}
      </details>
      <ScoreCard score={score} />
      {report && (
        <div className="metric-strip">
          <Metric
            value={
              report.findings.filter(
                (f) =>
                  f.priority === "critical" && f.evidenceStatus === "measured",
              ).length
            }
            label="Kritische Messbefunde"
          />
          <Metric
            value={
              report.findings.filter((f) => f.evidenceStatus === "measured")
                .length
            }
            label="Gemessene Befunde"
          />
          <Metric
            value={
              report.findings.filter((f) => f.evidenceStatus !== "measured")
                .length
            }
            label="Prüfkandidaten & Empfehlungen"
          />
          <Metric
            value={`${report.coverage.completed}/${report.coverage.planned}`}
            label="Abgeschlossene Ansichten"
          />
        </div>
      )}
      <section aria-label="Befunde">
        <div className="panel-head">
          <h2>Basisbefunde</h2>
          <span className="pill">{findings.length} Befunde</span>
        </div>
        <div className="filter-bar">
          <input
            aria-label="Befunde durchsuchen"
            placeholder="Befunde durchsuchen …"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            aria-label="Kategorie filtern"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="all">Alle Kategorien</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c)}
              </option>
            ))}
          </select>
          <select
            aria-label="Priorität filtern"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="all">Alle Prioritäten</option>
            <option value="critical">Kritisch</option>
            <option value="important">Wichtig</option>
            <option value="nice-to-have">Nice to have</option>
          </select>
          <select
            aria-label="Seite filtern"
            value={page}
            onChange={(e) => {
              setPage(e.target.value);
              setOpen(null);
            }}
          >
            <option value="all">Alle Seiten</option>
            {report?.options.pages.map((url) => (
              <option key={url} value={url}>
                {url}
              </option>
            ))}
          </select>
          <select
            aria-label="Gerät filtern"
            value={device}
            onChange={(e) => {
              setDevice(e.target.value);
              setOpen(null);
            }}
          >
            <option value="all">Alle Geräte</option>
            {report?.options.viewports.map((viewport) => (
              <option key={viewport.id} value={viewport.id}>
                {viewport.id}
              </option>
            ))}
          </select>
          <select
            aria-label="Maßnahmenstatus filtern"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">Alle Maßnahmenstatus</option>
            {Object.entries(taskLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <label className="group-control">
          <input
            type="checkbox"
            checked={grouped}
            onChange={(e) => {
              setGrouped(e.target.checked);
              setOpen(null);
            }}
          />
          Ähnliche Befunde pro Seite bündeln
        </label>
        {[...groupedFindings.values()].map((group) => {
          const representative = group[0]!;
          const expanded = group.some((item) => item.id === open);
          const finding = expanded
            ? (group.find((item) => item.id === variant) ?? representative)
            : representative;
          const evidence = report?.evidence.find(
            (e) => e.id === finding.evidenceId,
          );
          return (
            <article
              key={representative.id}
              className="issue-card"
              id={`finding-${finding.id}`}
              tabIndex={-1}
            >
              <div className="issue-summary">
                <span
                  className={`pill ${finding.priority === "nice-to-have" ? "nice" : finding.priority}`}
                >
                  {priorityLabel(finding.priority)}
                </span>
                <div>
                  <div className="chip-list">
                    <span
                      className={`pill ${finding.evidenceStatus === "measured" ? "confirmed" : "candidate"}`}
                    >
                      {evidenceLabel(finding.evidenceStatus)}
                    </span>
                    <span className="small-label">
                      {categoryLabel(finding.category)}
                    </span>
                    <span className="pill">
                      {group.length}{" "}
                      {group.length === 1 ? "Fundstelle" : "Fundstellen"}
                    </span>
                  </div>
                  <h3>{finding.title}</h3>
                  <p className="issue-location">
                    {new URL(finding.pageUrl).pathname} ·{" "}
                    {group.length > 1
                      ? "mehrere Ansichten"
                      : `${finding.viewportId} · ${finding.state}`}
                  </p>
                  <p className="issue-excerpt">{finding.detail}</p>
                </div>
                <button
                  className="issue-toggle"
                  aria-expanded={expanded}
                  aria-label={`${expanded ? "Details schließen" : "Details öffnen"}: ${finding.title}`}
                  onClick={() => {
                    setOpen(expanded ? null : representative.id);
                    setVariant(representative.id);
                  }}
                >
                  {expanded ? (
                    <ChevronUp size={18} />
                  ) : (
                    <ChevronDown size={18} />
                  )}
                </button>
              </div>
              {expanded && (
                <div className="issue-body fix-workspace">
                  <div className="fix-observation">
                    {group.length > 1 && (
                      <>
                        <label htmlFor={`variant-${representative.id}`}>
                          Fundstelle wählen
                        </label>
                        <select
                          id={`variant-${representative.id}`}
                          value={finding.id}
                          onChange={(e) => setVariant(e.target.value)}
                        >
                          {group.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.viewportId} · {item.state} ·{" "}
                              {new URL(item.pageUrl).pathname}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                    <dl>
                      <dt>Beobachtung</dt>
                      <dd>{finding.detail}</dd>
                      <dt>Maßnahme</dt>
                      <dd>{finding.recommendation}</dd>
                      <dt>Abnahmekriterium</dt>
                      <dd>{finding.acceptance}</dd>
                    </dl>
                    {finding.elementContext && (
                      <details className="solution-references">
                        <summary>Gemessener DOM-/Style-Kontext</summary>
                        <p>
                          Begrenzte berechnete Styles und Geometrie, keine
                          Quellcodezuordnung und kein Ursachenbeweis.
                        </p>
                        <pre>
                          {JSON.stringify(finding.elementContext, null, 2)}
                        </pre>
                      </details>
                    )}
                    <details>
                      <summary>Fundstelle und technische Details</summary>
                      <dl>
                        <dt>URL</dt>
                        <dd className="identity-hash">{finding.pageUrl}</dd>
                        <dt>Element / Regel</dt>
                        <dd>
                          <code>{finding.selector ?? "Kein Elementanker"}</code>
                          <br />
                          {finding.ruleId}
                        </dd>
                      </dl>
                    </details>
                    <div className="issue-actions">
                      <button
                        className="button secondary"
                        onClick={() => onExplain(finding)}
                      >
                        <Sparkles size={15} />
                        Diesen Befund erklären
                      </button>
                    </div>
                  </div>
                  <div className="fix-evidence">
                    {evidence && (
                      <div className="evidence-detail">
                        <EvidenceView
                          evidence={evidence}
                          scanId={scan.id}
                          findings={[finding]}
                        />
                      </div>
                    )}
                    {!evidence && (
                      <p className="plan-note">
                        Für diesen Befund liegt kein Screenshot vor. Der
                        numerische oder regelbasierte Nachweis steht in der
                        Beobachtung und im Regelprotokoll.
                      </p>
                    )}
                    <div className="issue-actions">
                      {finding.source && /^https:\/\//.test(finding.source) && (
                        <a
                          className="button secondary"
                          href={finding.source}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Regelreferenz
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </article>
          );
        })}
        {!visible.length && (
          <Empty
            title={
              findings.length
                ? "Keine passenden Befunde."
                : "Keine Befunde im geprüften Umfang."
            }
          >
            <p>
              {findings.length
                ? "Passe die Filter an."
                : "Beachte die Prüfabdeckung: Das ist kein Beweis einer vollständig fehlerfreien Website."}
            </p>
          </Empty>
        )}
        {!report && (
          <div className="panel">
            {scan.result.checks.map((check) => (
              <p className="hint" key={check.id}>
                <strong>{check.label}:</strong> {check.detail}
              </p>
            ))}
          </div>
        )}
      </section>
      {report && (
        <section className="panel report-measurements">
          <div className="panel-head">
            <div>
              <h3>Messungen & Prüfabdeckung</h3>
              <p>
                Fehlende Messungen sind unbekannt, nicht bestanden. Die Rohdaten
                bleiben vom Maßnahmenplan getrennt.
              </p>
            </div>
          </div>
          {report.performance.length > 0 ? (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Referenzseite / Profil</th>
                    <th>Lighthouse</th>
                    <th>LCP</th>
                    <th>CLS</th>
                    <th>TBT</th>
                    <th>Läufe / Streuung</th>
                  </tr>
                </thead>
                <tbody>
                  {report.performance.map((sample, index) => (
                    <tr key={`${sample.pageUrl}-${sample.device}-${index}`}>
                      <td>
                        {sample.pageUrl}
                        <br />
                        {sample.device}
                        {sample.error && <p>{sample.error}</p>}
                      </td>
                      <td>
                        {sample.score === null ? "—" : Math.round(sample.score)}
                      </td>
                      <td>
                        {sample.metrics.lcp === null
                          ? "—"
                          : `${Math.round(sample.metrics.lcp)} ms`}
                      </td>
                      <td>
                        {sample.metrics.cls === null
                          ? "—"
                          : sample.metrics.cls.toFixed(3)}
                      </td>
                      <td>
                        {sample.metrics.tbt === null
                          ? "—"
                          : `${Math.round(sample.metrics.tbt)} ms`}
                      </td>
                      <td>
                        {sample.runs} ·{" "}
                        {sample.spread === undefined
                          ? "—"
                          : sample.spread.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="hint">
              Kein Performance-Lauf in diesem Bericht. Die Performance-Kategorie
              bleibt entsprechend unbekannt.
            </p>
          )}
          <p className="hint">
            Lokale Labormessung, keine Core-Web-Vitals-Felddaten und kein
            Nachweis realer Google-Rankings.
          </p>
          <details>
            <summary>
              Regelprotokoll anzeigen ({report.rules.length} Einträge)
            </summary>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Regel</th>
                    <th>Ergebnis</th>
                    <th>Seite / Ansicht</th>
                    <th>Messhinweis</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rules.map((rule) => (
                    <tr key={rule.id}>
                      <td>{rule.ruleId}</td>
                      <td>
                        {
                          {
                            pass: "Bestanden",
                            fail: "Befund",
                            not_run: "Nicht geprüft",
                            not_applicable: "Nicht anwendbar",
                          }[rule.status]
                        }
                      </td>
                      <td>
                        {rule.pageUrl}
                        <br />
                        {rule.viewportId} · {rule.state}
                      </td>
                      <td>{rule.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          {report.coverage.skipped.length > 0 && (
            <details className="plan-note">
              <summary>
                Nicht geprüfte Bereiche ({report.coverage.skipped.length})
              </summary>
              {report.coverage.skipped.map((item, i) => (
                <p key={i}>{item}</p>
              ))}
            </details>
          )}
        </section>
      )}
      {report?.warnings.length ? (
        <details className="plan-note">
          <summary>Hinweise und Grenzen ({report.warnings.length})</summary>
          {report.warnings.map((warning, i) => (
            <p key={i}>{warning}</p>
          ))}
        </details>
      ) : null}
      {exportOpen && (
        <ExportDialog scan={scan} onClose={() => setExportOpen(false)} />
      )}
    </>
  );
}
function Metric({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="metric-cell">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
export function Tasks({
  scan,
  tasks,
  onChange,
  onRetestStarted,
}: {
  scan?: Scan;
  tasks: AuditTask[];
  onChange: () => void | Promise<void>;
  onRetestStarted?: (scan: Scan) => void | Promise<void>;
}) {
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState("all");
  const [device, setDevice] = useState("all");
  const [category, setCategory] = useState("all");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [handoffIds, setHandoffIds] = useState<string[] | null>(null);
  if (!scan?.result)
    return (
      <Empty
        icon={<FileText size={30} />}
        title="Dein Maßnahmenplan entsteht nach dem Check."
      >
        <p>
          Aufgaben werden aus tatsächlichen Befunden abgeleitet, nicht aus
          allgemeinen Ratschlägen.
        </p>
      </Empty>
    );
  const visible = tasks.filter(
    (task) =>
      (filter === "all" || task.status === filter) &&
      (category === "all" || task.category === category) &&
      ((page === "all" && device === "all") ||
        scan.result?.audit?.findings.some(
          (finding) =>
            task.findingIds.includes(finding.id) &&
            (page === "all" || finding.pageUrl === page) &&
            (device === "all" || finding.viewportId === device),
        )),
  );
  const update = async (task: AuditTask, status: TaskStatus) => {
    setBusy(task.id);
    setError("");
    try {
      await patch(`/api/tasks/${task.id}`, { status });
      await onChange();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy("");
    }
  };
  return (
    <>
      <div className="panel-head">
        <div>
          <p className="eyebrow">VOM BEFUND ZUM NÄCHSTEN SCHRITT</p>
          <h2>Dein Maßnahmenplan</h2>
          <p>
            Ähnliche Beobachtungen werden gebündelt. Manuell abgehakt bedeutet
            „zur Prüfung“, nicht automatisch behoben.
          </p>
        </div>
        <button className="button primary" onClick={() => setExportOpen(true)}>
          <Download size={16} />
          Plan exportieren
        </button>
      </div>
      {error && <Notice error>{error}</Notice>}
      <div className="filter-bar">
        <select
          aria-label="Aufgabenstatus filtern"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">Alle Aufgaben ({tasks.length})</option>
          {Object.entries(taskLabels).map(([status, label]) => (
            <option key={status} value={status}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Aufgabenseite filtern"
          value={page}
          onChange={(e) => setPage(e.target.value)}
        >
          <option value="all">Alle Seiten</option>
          {scan.result.audit?.options.pages.map((url) => (
            <option key={url} value={url}>
              {url}
            </option>
          ))}
        </select>
        <select
          aria-label="Aufgabengerät filtern"
          value={device}
          onChange={(e) => setDevice(e.target.value)}
        >
          <option value="all">Alle Geräte</option>
          {scan.result.audit?.options.viewports.map((viewport) => (
            <option key={viewport.id} value={viewport.id}>
              {viewport.id}
            </option>
          ))}
        </select>
        <select
          aria-label="Aufgabenkategorie filtern"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="all">Alle Kategorien</option>
          {[...new Set(tasks.map((task) => task.category))].map((item) => (
            <option key={item} value={item}>
              {categoryLabel(item)}
            </option>
          ))}
        </select>
      </div>
      <WorkPriority scan={scan} />
      <div className="task-list">
        {visible.map((task) => (
          <article key={task.id} className="task-card">
            <div className="task-card-head">
              <button
                className={`task-check ${["review", "verified"].includes(task.status) ? "checked" : ""}`}
                disabled={!!busy || task.status === "verified"}
                aria-label={`Zur Prüfung markieren: ${task.title}`}
                aria-pressed={["review", "verified"].includes(task.status)}
                onClick={() =>
                  void update(
                    task,
                    task.status === "review" ? "open" : "review",
                  )
                }
              >
                {["review", "verified"].includes(task.status) ? "✓" : ""}
              </button>
              <div>
                <h3>{task.title}</h3>
                <div className="chip-list">
                  <span
                    className={`pill ${task.priority === "nice-to-have" ? "nice" : task.priority}`}
                  >
                    {priorityLabel(task.priority)}
                  </span>
                  <span className="pill">{categoryLabel(task.category)}</span>
                  <span className="pill">
                    {task.findingIds.length} Fundstellen
                  </span>
                </div>
              </div>
            </div>
            <button
              className="button secondary"
              onClick={() => setHandoffIds(task.findingIds)}
            >
              Entwickler-Arbeitspaket
            </button>
            <p>{task.summary}</p>
            <p>
              <strong>Maßnahme:</strong> {task.recommendation}
            </p>
            <div className="task-acceptance">
              <strong>So prüfst du die Behebung</strong>
              {task.acceptance}
            </div>
            {task.aiProposal && (
              <details className="plan-note">
                <summary>Übernommener KI-Vorschlag · ungeprüft</summary>
                <p>{task.aiProposal.explanation}</p>
                <p>Vermutete Ursache: {task.aiProposal.cause}</p>
                <ol>
                  {task.aiProposal.steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
                {task.aiProposal.code.text && (
                  <pre className="solution-code">
                    <code>{task.aiProposal.code.text}</code>
                  </pre>
                )}
                <p>Vorgeschlagener Nachtest: {task.aiProposal.acceptance}</p>
                <p>Unsicherheit: {task.aiProposal.uncertainty}</p>
                <p className="small-label">
                  Auswertung {task.aiProposal.analysisId}
                </p>
              </details>
            )}
            {scan.status === "completed" && task.status !== "verified" && (
              <div className="retest-action">
                <p className="hint">
                  Nachtest: nur betroffene URLs und Geräte, mit den
                  unterstützten anfänglichen und gescrollten Zuständen. Neuer
                  Teillauf; kein Ersatz für den vollständigen Projekt-Score.
                </p>
                <button
                  className="button secondary"
                  disabled={!!busy}
                  onClick={async () => {
                    setBusy(task.id);
                    setError("");
                    try {
                      const result = await post<{ scan: Scan }>(
                        `/api/tasks/${task.id}/retest`,
                      );
                      await onChange();
                      await onRetestStarted?.(result.scan);
                    } catch (err) {
                      setError(message(err));
                    } finally {
                      setBusy("");
                    }
                  }}
                >
                  <ScanLine size={16} />
                  Diese Maßnahme nachtesten
                </button>
              </div>
            )}
            <div className="toolbar task-status-row">
              <label htmlFor={`status-${task.id}`} className="small-label">
                STATUS
              </label>
              <select
                id={`status-${task.id}`}
                value={task.status}
                disabled={!!busy || task.status === "verified"}
                onChange={(e) =>
                  void update(task, e.target.value as TaskStatus)
                }
              >
                {Object.entries(taskLabels)
                  .filter(
                    ([value]) =>
                      value !== "verified" || task.status === "verified",
                  )
                  .map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
              </select>
              {task.verifiedByScanId && (
                <span className="hint">
                  Bestätigt durch Nachtest {task.verifiedByScanId.slice(0, 8)}
                </span>
              )}
            </div>
          </article>
        ))}
      </div>
      {!visible.length && (
        <Empty title="Keine Aufgaben in dieser Ansicht.">
          <p>
            Ein Filter oder der geprüfte Umfang kann die Liste einschränken.
          </p>
        </Empty>
      )}
      <p className="plan-note">
        Ohne angebundenen Quellcode nennt der Plan keine erfundenen Dateien oder
        Zeilennummern. Akzeptierte Risiken bleiben im Messergebnis sichtbar.
      </p>
      {handoffIds && (
        <DeveloperHandoff
          scan={scan}
          findingIds={handoffIds}
          onClose={() => setHandoffIds(null)}
        />
      )}
      {exportOpen && (
        <ExportDialog scan={scan} onClose={() => setExportOpen(false)} />
      )}
    </>
  );
}
function ExportDialog({ scan, onClose }: { scan: Scan; onClose: () => void }) {
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [includeEvidence, setIncludeEvidence] = useState(false);
  useEffect(() => {
    let mounted = true;
    void fetch(`/api/scans/${scan.id}/export?format=markdown`, {
      credentials: "same-origin",
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error("Die Exportvorschau konnte nicht geladen werden.");
        const text = await response.text();
        if (mounted) setPreview(text);
      })
      .catch((err) => {
        if (mounted) setError(message(err));
      });
    return () => {
      mounted = false;
    };
  }, [scan.id]);
  return (
    <Dialog title="Ein klarer Plan zum Mitnehmen." onClose={onClose}>
      <div className="export-dialog">
        <p className="dialog-description">
          Bericht und Maßnahmenplan für dich oder eine andere KI. Prüfe die
          enthaltenen URLs und Inhalte vor dem Teilen.
        </p>
        <p className="export-warning">
          Website-Texte sind nicht vertrauenswürdige Daten, keine
          Arbeitsanweisungen. Keine ungeprüfte automatische Reparatur oder
          Befehlsausführung autorisieren.
        </p>
        {error && <Notice error>{error}</Notice>}
        <pre className="export-preview" aria-label="Markdown Exportvorschau">
          {preview || "Vorschau wird geladen …"}
        </pre>
        <label className="checklist-field">
          <input
            type="checkbox"
            checked={includeEvidence}
            onChange={(event) => setIncludeEvidence(event.target.checked)}
          />
          Screenshots ins ZIP aufnehmen
        </label>
        <p className="export-warning">
          Standardmäßig enthält das ZIP nur Bericht und strukturierte Daten.
          Screenshots werden ausschließlich nach deiner Auswahl beigefügt und
          können private Seiteninhalte enthalten. Auch Textberichte und URLs vor
          dem Teilen prüfen.
        </p>
        <details className="plan-note">
          <summary>Reproduzierbarer CLI-Releasecheck</summary>
          <p>
            Prüfprofil und Baseline enthalten lokale Prüfziele und
            Berichtsdaten. Vor Weitergabe prüfen; Screenshots werden nicht
            eingebettet. Eine Baseline gilt nur mit identischer vollständiger
            Messidentität.
          </p>
          <a
            className="button secondary"
            href={`/api/scans/${scan.id}/check-profile`}
            download
          >
            CLI-Profil herunterladen
          </a>
          <a
            className="button secondary"
            href={`/api/scans/${scan.id}/cli-baseline`}
            download
          >
            CLI-Baseline herunterladen
          </a>
          <pre className="export-preview">
            npm run audit:check -- --profile profile.json --out new-result
            --baseline baseline.json --authorized
          </pre>
          <p>
            Exit 0: keine neuen gemessenen Blocker; 1: Regression; 2:
            unbekannt/inkompatibel/Fehler. Ein erster Lauf ohne Baseline liefert
            ausdrücklich Status 2.
          </p>
        </details>
        <div className="export-options">
          {["markdown", "json", "zip"].map((format) => (
            <a
              className="button secondary download-link"
              key={format}
              href={`/api/scans/${scan.id}/export?format=${format}${format === "zip" && includeEvidence ? "&includeEvidence=true" : ""}`}
              download
            >
              <Download size={15} />
              {format === "markdown"
                ? "Markdown"
                : format === "json"
                  ? "JSON"
                  : includeEvidence
                    ? "ZIP mit Belegen"
                    : "ZIP-Bericht"}
            </a>
          ))}
          <button
            className="button primary"
            disabled={!preview}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(preview);
                setCopied(true);
              } catch {
                setError(
                  "Kopieren nicht verfügbar. Lade stattdessen die Markdown-Datei herunter.",
                );
              }
            }}
          >
            {copied ? "Kopiert" : "Für andere KI kopieren"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
