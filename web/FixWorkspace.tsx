import { useTranslation } from "./language.js";
import { useEffect, useRef, useState } from "react";
import type { AuditTask, Scan, HubSettings } from "../shared/types.js";
import type { CursorPage } from "../shared/workspace.js";
import { api, message, categoryLabel } from "./api.js";
import { Empty, Notice } from "./ui.js";
import { EvidenceView } from "./LiveScan.js";
import { Tasks, taskLabels, priorityLabel } from "./Report.js";
import PageAnalysis from "./PageAnalysis.js";
import DeveloperHandoff from "./DeveloperHandoff.js";
import WorkPriority from "./WorkPriority.js";
import { useProjectDraft } from "./workspace-state.js";
export default function FixWorkspace({
  scan,
  tasks,
  taskId,
  findingId,
  panel,
  settings,
  speechAvailable,
  onSelect,
  onChange,
  onRetestStarted,
}: {
  scan?: Scan;
  tasks: AuditTask[];
  taskId?: string | null;
  findingId?: string;
  panel: "evidence" | "explain" | "handoff";
  settings: HubSettings;
  speechAvailable: boolean;
  onSelect: (
    task: AuditTask,
    findingId?: string,
    panel?: "evidence" | "explain" | "handoff",
  ) => void;
  onChange: () => void | Promise<void>;
  onRetestStarted: (scan: Scan) => void | Promise<void>;
}) {
  const t = useTranslation();
  const [filters, setFilters] = useProjectDraft(
    scan?.projectId ?? "none",
    "work",
    { q: "", status: "all", allScans: false },
  );
  const [listing, setListing] = useState<CursorPage<AuditTask>>({
    items: tasks.slice(0, 50),
    total: tasks.length,
    nextCursor: null,
  });
  const [pinned, setPinned] = useState<AuditTask>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const query = () =>
    new URLSearchParams({
      q: filters.q,
      status: filters.status,
      limit: "50",
      ...(!filters.allScans && scan ? { scanId: scan.id } : {}),
    });
  const requestKey = `${scan?.projectId}:${query()}`;
  const activeRequest = useRef(requestKey);
  activeRequest.current = requestKey;
  useEffect(() => {
    if (!scan) return;
    let live = true;
    setBusy(true);
    setError("");
    const timer = setTimeout(() => {
      void api<CursorPage<AuditTask>>(
        `/api/projects/${scan.projectId}/tasks?${query()}`,
      )
        .then((r) => {
          if (live) setListing(r);
        })
        .catch((e) => {
          if (live) setError(message(e));
        })
        .finally(() => {
          if (live) setBusy(false);
        });
    }, 150);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [scan?.id, tasks, filters.q, filters.status, filters.allScans]);
  useEffect(() => {
    setPinned(undefined);
    if (!taskId || !scan) return;
    let live = true;
    const local =
      tasks.find((t) => t.id === taskId) ??
      listing.items.find((t) => t.id === taskId);
    if (local) {
      setPinned(local);
      return;
    }
    void api<{ task: AuditTask }>(`/api/tasks/${taskId}`)
      .then(({ task }) => {
        if (!live) return;
        if (task.projectId !== scan.projectId || task.scanId !== scan.id)
          throw Error(
            "Aufgabe gehört nicht zum ausgewählten Check. Im Verlauf den passenden Check öffnen.",
          );
        setPinned(task);
      })
      .catch((e) => {
        if (live) setError(message(e));
      });
    return () => {
      live = false;
    };
  }, [taskId, scan?.id, tasks]);
  const selected = taskId
    ? (tasks.find((t) => t.id === taskId) ??
      listing.items.find((t) => t.id === taskId) ??
      pinned)
    : listing.items[0];
  const report = scan?.result?.audit;
  const observations =
    selected && report
      ? report.findings.filter((f) => selected.findingIds.includes(f.id))
      : [];
  const finding =
    observations.find((f) => f.id === findingId) ?? observations[0];
  const evidenceControl = useRef<HTMLButtonElement>(null);
  const evidence = report?.evidence.find((e) => e.id === finding?.evidenceId);
  const more = async () => {
    if (!scan || !listing.nextCursor) return;
    const key = activeRequest.current;
    setBusy(true);
    try {
      const q = query();
      q.set("cursor", listing.nextCursor);
      const r = await api<CursorPage<AuditTask>>(
        `/api/projects/${scan.projectId}/tasks?${q}`,
      );
      if (key === activeRequest.current)
        setListing((old) => ({
          ...r,
          items: [
            ...new Map(
              [...old.items, ...r.items].map((t) => [t.id, t]),
            ).values(),
          ],
        }));
    } catch (e) {
      if (key === activeRequest.current) setError(message(e));
    } finally {
      if (key === activeRequest.current) setBusy(false);
    }
  };
  if (!scan?.result?.audit)
    return (
      <Empty
        title={t(
          "Dein Arbeitsbereich entsteht nach dem Check.",
          "Your repair workspace appears after a check.",
        )}
      >
        <p>
          {t(
            "Wähle einen abgeschlossenen Check im Verlauf.",
            "Choose a completed check in History.",
          )}
        </p>
      </Empty>
    );
  return (
    <section
      className="repair-workspace"
      aria-label={t("Fix-Arbeitsbereich", "Repair workspace")}
    >
      <div className="panel-head">
        <div>
          <p className="eyebrow">
            {t(
              "BELEG VERSTEHEN. ÄNDERUNG ÜBERGEBEN. FIX PRÜFEN.",
              "REVIEW EVIDENCE, HAND OFF, AND RETEST",
            )}
          </p>
          <h2>{t("Dein Maßnahmenplan", "Your repair plan")}</h2>
          <p>
            {t(
              "Aufgabe, Originalnachweis und nächste Aktion an einem Ort.",
              "Tasks, original evidence, and next actions in one place.",
            )}
          </p>
        </div>
        <span className="pill">
          {t(
            "Manuelle Prüfung ist keine Verifizierung",
            "Verification requires a measured retest",
          )}
        </span>
      </div>
      {error && <Notice error>{error}</Notice>}
      {notice && <p role="status">{notice}</p>}
      <WorkPriority
        scan={scan}
        onOpenTask={(id) => {
          const task =
            tasks.find((t) => t.id === id) ??
            listing.items.find((t) => t.id === id);
          if (task) onSelect(task);
          else
            void api<{ task: AuditTask }>(`/api/tasks/${id}`)
              .then((r) => onSelect(r.task))
              .catch((e) => setError(message(e)));
        }}
      />
      <div className="fix-grid">
        <aside
          className="panel fix-list"
          aria-label={t("Aufgaben auswählen", "Select tasks")}
        >
          <label>
            {t("Aufgaben durchsuchen", "Search tasks")}
            <input
              type="search"
              value={filters.q}
              maxLength={120}
              placeholder={t("Titel oder Aufgaben-ID", "Title or task ID")}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            />
          </label>
          <label>
            Status
            <select
              value={filters.status}
              aria-label={t("Aufgabenstatus filtern", "Filter by task status")}
              onChange={(e) =>
                setFilters({ ...filters, status: e.target.value })
              }
            >
              <option value="all">{t("Alle Aufgaben", "All tasks")}</option>
              {Object.entries(taskLabels).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={filters.allScans}
              onChange={(e) =>
                setFilters({ ...filters, allScans: e.target.checked })
              }
            />
            {t("Alle Checks dieses Projekts", "All checks in this project")}
          </label>
          <p role="status">
            {listing.items.length} von {listing.total} Aufgaben
            {busy ? " · lädt …" : ""}
          </p>
          <div className="fix-task-buttons">
            {listing.items.map((t) => (
              <button
                key={t.id}
                className={`fix-task ${selected?.id === t.id ? "selected" : ""}`}
                aria-current={selected?.id === t.id ? "true" : undefined}
                onClick={() => onSelect(t)}
              >
                <strong>{t.title}</strong>
                <small>
                  {(() => {
                    const f = report?.findings.find((f) =>
                      t.findingIds.includes(f.id),
                    );
                    return f
                      ? `${new URL(f.pageUrl).pathname} · ${f.selector ?? f.ruleId}`
                      : `Check ${t.scanId.slice(0, 8)}`;
                  })()}
                </small>
                <span>
                  {priorityLabel(t.priority)} · {taskLabels[t.status]}
                </span>
                <small>
                  {categoryLabel(t.category)} · {t.findingIds.length}{" "}
                  Fundstellen
                </small>
              </button>
            ))}
          </div>
          {!listing.items.length && !busy && (
            <p>
              Keine passenden Aufgaben. Filter ändern oder einen anderen Check
              wählen.
            </p>
          )}
          {listing.nextCursor && (
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => void more()}
            >
              Weitere Aufgaben laden
            </button>
          )}
        </aside>
        <div
          className="fix-detail"
          aria-label={t("Ausgewählte Aufgabe", "Selected task")}
        >
          {selected && selected.scanId === scan.id ? (
            <>
              <div className="panel fix-context">
                <div className="panel-head">
                  <h3>{selected.title}</h3>
                  <button
                    className="text-button"
                    onClick={() => {
                      const url = new URL(window.location.href);
                      url.searchParams.set("project", selected.projectId);
                      url.searchParams.set("scan", selected.scanId);
                      url.searchParams.set("view", "tasks");
                      url.searchParams.set("task", selected.id);
                      if (finding) url.searchParams.set("finding", finding.id);
                      void navigator.clipboard
                        .writeText(url.href)
                        .then(() => setNotice("Link zur Aufgabe kopiert."))
                        .catch(() =>
                          setNotice(
                            "Link steht in der Adresszeile; dort kopieren.",
                          ),
                        );
                    }}
                  >
                    {t("Aufgabenlink kopieren", "Copy task link")}
                  </button>
                </div>
                <p className="hint">
                  Check {scan.id.slice(0, 8)} · {selected.findingIds.length}{" "}
                  ursprüngliche Fundstellen
                </p>
                {observations.length > 0 && (
                  <label>
                    {t("Fundstelle auswählen", "Select observation")}
                    <select
                      aria-label={t(
                        "Fundstelle auswählen",
                        "Select observation",
                      )}
                      value={finding?.id ?? ""}
                      onChange={(e) =>
                        onSelect(selected, e.target.value, panel)
                      }
                    >
                      {observations.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.viewportId} · {f.state} · {f.selector ?? f.title} ·{" "}
                          {new URL(f.pageUrl).pathname}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {finding && (
                  <div className="canonical-observation">
                    <p className="small-label">
                      {finding.evidenceStatus === "measured"
                        ? t("GEMESSENER BEFUND", "MEASURED FINDING")
                        : t("PRÜFKANDIDAT", "REVIEW CANDIDATE")}{" "}
                      · {finding.viewportId} · {finding.state}
                    </p>
                    <p className="external-url">{finding.pageUrl}</p>
                    <p>{finding.detail}</p>
                    <code>
                      {finding.selector ?? "Kein verifizierter Elementselektor"}
                    </code>
                  </div>
                )}
                <nav
                  className="fix-detail-tabs"
                  aria-label={t("Aufgabe bearbeiten", "Work on task")}
                >
                  {(
                    [
                      ["evidence", "Originalnachweis"],
                      ["explain", "Erklärung"],
                      ["handoff", "Entwicklerübergabe"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      ref={id === "evidence" ? evidenceControl : undefined}
                      className="button secondary"
                      aria-current={panel === id ? "page" : undefined}
                      onClick={() => onSelect(selected, finding?.id, id)}
                    >
                      {label}
                    </button>
                  ))}
                </nav>
              </div>
              <Tasks
                key={`controls:${selected.id}`}
                compact
                scan={scan}
                tasks={[selected]}
                onChange={onChange}
                onHandoff={() => onSelect(selected, finding?.id, "handoff")}
                onRetestStarted={onRetestStarted}
              />
              {panel === "evidence" && (
                <section className="panel fix-evidence">
                  <h3>{t("Originalnachweis", "Original evidence")}</h3>
                  {evidence ? (
                    <div
                      className="fix-capture-scroll"
                      tabIndex={0}
                      role="region"
                      aria-label={t(
                        "Originalaufnahme scrollen",
                        "Scroll original capture",
                      )}
                    >
                      <EvidenceView
                        evidence={evidence}
                        scanId={scan.id}
                        findings={finding ? [finding] : []}
                      />
                    </div>
                  ) : (
                    <p>
                      Für diese Fundstelle ist kein Screenshot dokumentiert.
                      Messung und Nachtest bleiben separat prüfbar.
                    </p>
                  )}
                  {finding?.elementContext && (
                    <details>
                      <summary>
                        {t(
                          "Gemessener Elementkontext",
                          "Measured element context",
                        )}
                      </summary>
                      <pre>
                        {JSON.stringify(finding.elementContext, null, 2)}
                      </pre>
                    </details>
                  )}
                </section>
              )}
              {panel === "explain" && (
                <PageAnalysis
                  key={`${scan.id}:${finding?.id}`}
                  scan={scan}
                  requestedPage={finding?.pageUrl}
                  requestedFocusId={finding?.id}
                  settings={settings}
                  speechAvailable={speechAvailable}
                  onTasksChanged={onChange}
                  onShowFinding={(id) => onSelect(selected, id, "evidence")}
                />
              )}
              {panel === "handoff" && (
                <DeveloperHandoff
                  key={`${selected.id}:${finding?.id}`}
                  inline
                  scan={scan}
                  findingIds={finding ? [finding.id] : selected.findingIds}
                  onClose={() => {
                    onSelect(selected, finding?.id, "evidence");
                    evidenceControl.current?.focus();
                  }}
                />
              )}
              <TaskNote
                key={`note:${selected.id}`}
                projectId={selected.projectId}
                taskId={selected.id}
              />
            </>
          ) : (
            <section className="panel">
              <h3>
                {taskId
                  ? t("Aufgabe nicht verfügbar", "Task unavailable")
                  : t("Eine Aufgabe auswählen", "Select a task")}
              </h3>
              <p>
                Aufgaben eines anderen Checks öffnen den zugehörigen Bericht.
                Archivierte Ziele können über den Verlauf oder den Papierkorb
                wiedergefunden werden.
              </p>
            </section>
          )}
        </div>
      </div>
    </section>
  );
}

function TaskNote({
  projectId,
  taskId,
}: {
  projectId: string;
  taskId: string;
}) {
  const [note, setNote] = useProjectDraft(projectId, `note:${taskId}`, "");
  return (
    <section className="panel">
      <label htmlFor="work-note">Lokale Arbeitsnotiz</label>
      <textarea
        id="work-note"
        value={note}
        maxLength={4000}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Unkritische Notiz zum nächsten Schritt"
      />
      <p className="hint">
        Nur in diesem Browser gespeichert. Kein Reparaturnachweis und kein Teil
        des Exports.
      </p>
    </section>
  );
}
