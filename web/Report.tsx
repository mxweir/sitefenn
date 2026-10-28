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
import { api, categoryLabel, message, patch, stamp } from "./api.js";
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
}: {
  scan?: Scan;
  score?: ScoreSummary;
  onExplain: (finding?: Finding) => void;
}) {
  const [category, setCategory] = useState("all");
  const [priority, setPriority] = useState("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const report = scan?.result?.audit;
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
      `${f.title} ${f.detail} ${f.pageUrl}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const categories = [...new Set(findings.map((f) => f.category))];
  return (
    <>
      <div className="toolbar report-toolbar">
        <div>
          <p className="eyebrow">NACHVOLLZIEHBAR STATT PAUSCHAL</p>
          <h2>Dein Prüfbericht</h2>
        </div>
        <div className="action-group">
          <button className="button secondary" onClick={() => onExplain()}>
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
      <p className="report-meta">
        Scan {scan.id.slice(0, 8)} · {stamp(scan.createdAt)} ·{" "}
        {report?.pages.length ?? 1} Seitenansichten · Regeln{" "}
        {report?.ruleVersion ?? "legacy"} · Chromium{" "}
        {report?.browserVersion ?? "nicht dokumentiert"}
      </p>
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
        </div>
        {visible.map((finding) => {
          const expanded = open === finding.id;
          const evidence = report?.evidence.find(
            (e) => e.id === finding.evidenceId,
          );
          return (
            <article key={finding.id} className="issue-card">
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
                  </div>
                  <h3>{finding.title}</h3>
                  <p className="issue-location">
                    {finding.pageUrl} · {finding.viewportId} · {finding.state}
                  </p>
                  <p className="issue-excerpt">{finding.detail}</p>
                </div>
                <button
                  className="issue-toggle"
                  aria-expanded={expanded}
                  aria-label={`${expanded ? "Details schließen" : "Details öffnen"}: ${finding.title}`}
                  onClick={() => setOpen(expanded ? null : finding.id)}
                >
                  {expanded ? (
                    <ChevronUp size={18} />
                  ) : (
                    <ChevronDown size={18} />
                  )}
                </button>
              </div>
              {expanded && (
                <div className="issue-body">
                  <dl>
                    <dt>Beobachtung</dt>
                    <dd>{finding.detail}</dd>
                    <dt>Maßnahme</dt>
                    <dd>{finding.recommendation}</dd>
                    <dt>Abnahmekriterium</dt>
                    <dd>{finding.acceptance}</dd>
                    <dt>Element / Regel</dt>
                    <dd>
                      <code>{finding.selector ?? "Kein Elementanker"}</code>
                      <br />
                      {finding.ruleId}
                    </dd>
                  </dl>
                  {evidence && (
                    <div className="evidence-detail">
                      <EvidenceView
                        evidence={evidence}
                        scanId={scan.id}
                        findings={[finding]}
                      />
                    </div>
                  )}
                  <div className="issue-actions">
                    <button
                      className="button secondary"
                      onClick={() => onExplain(finding)}
                    >
                      <Sparkles size={15} />
                      Diesen Befund erklären
                    </button>
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
}: {
  scan?: Scan;
  tasks: AuditTask[];
  onChange: () => void | Promise<void>;
}) {
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
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
    (task) => filter === "all" || task.status === filter,
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
            Gemeinsame Ursachen werden gebündelt. Manuell abgehakt bedeutet „zur
            Prüfung“, nicht automatisch behoben.
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
      </div>
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
            <p>{task.summary}</p>
            <p>
              <strong>Maßnahme:</strong> {task.recommendation}
            </p>
            <div className="task-acceptance">
              <strong>So prüfst du die Behebung</strong>
              {task.acceptance}
            </div>
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
