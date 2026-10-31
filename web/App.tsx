import { WorkspaceReadiness, useWorkspaceRoute } from "./workspace-state.js";
import type { WorkspaceTab } from "../shared/workspace-route.js";
import type { ProjectStats } from "../shared/workspace.js";
import History from "./History.js";
import FixWorkspace from "./FixWorkspace.js";
import type { Readiness } from "../shared/readiness.js";
import ProjectFlow from "./ProjectFlow.js";
import JourneyReport from "./JourneyReport.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { APP_VERSION } from "../shared/version.js";
import {
  Activity,
  ArrowLeftRight,
  ArrowRight,
  CheckSquare2,
  ChevronRight,
  Clock3,
  ExternalLink,
  FileText,
  FlaskConical,
  FolderOpen,
  Globe2,
  LayoutDashboard,
  LoaderCircle,
  Monitor,
  Plus,
  Radio,
  Search,
  ScanLine,
  ShieldCheck,
  TerminalSquare,
} from "lucide-react";
import type {
  AiPlan,
  AuditTask,
  Dependency,
  Finding,
  HubSettings,
  Project,
  Scan,
  ScoreSummary,
} from "../shared/types.js";
import { active, api, message, post, stamp, statusLabel } from "./api.js";
import { Busy, FennMark, Notice } from "./ui.js";
import ProjectModal from "./ProjectModal.js";
import ScanConfig from "./ScanConfig.js";
import ScoreCard from "./ScoreCard.js";
import LiveScan from "./LiveScan.js";
import { Report } from "./Report.js";
import Compare from "./Compare.js";
import SeoReport from "./SeoReport.js";
import SearchVisibility from "./SearchVisibility.js";
import Settings from "./Settings.js";
import PageAnalysis from "./PageAnalysis.js";

interface Bootstrap {
  projectStats?: Record<string, ProjectStats>;
  readiness?: Readiness;
  version: string;
  projects: Project[];
  scans: Scan[];
  dependencies: Dependency[];
  settings: HubSettings;
  tasks: AuditTask[];
  scores: Record<string, ScoreSummary>;
  speechAvailable?: boolean;
}
interface ScanDetail {
  scan: Scan;
  score?: ScoreSummary;
  tasks?: AuditTask[];
  aiPlan?: AiPlan;
}
type Tab = WorkspaceTab;
const empty: Bootstrap = {
  version: APP_VERSION,
  projects: [],
  scans: [],
  dependencies: [],
  settings: { model: "", speechEnabled: false },
  tasks: [],
  scores: {},
};
const tabs = [
  { id: "overview", label: "Übersicht", icon: LayoutDashboard },
  { id: "live", label: "On-Screen-Check", icon: Radio },
  { id: "report", label: "Befunde", icon: FileText },
  { id: "seo", label: "SEO-Kontext", icon: Globe2 },
  { id: "states", label: "Seitenzustände", icon: ScanLine },
  { id: "analysis", label: "Seite erklären", icon: FileText },
  { id: "tasks", label: "Maßnahmenplan", icon: CheckSquare2 },
  { id: "compare", label: "Vergleich", icon: ArrowLeftRight },
  { id: "search", label: "Sichtbarkeit", icon: Search },
] as const;

export default function App() {
  const { route, navigate, reset } = useWorkspaceRoute();
  const projectId = route.projectId,
    scanId = route.scanId,
    screen = route.screen,
    tab = route.tab;
  const analysisFocus = route.findingId,
    reportFinding = route.findingId,
    analysisPage = route.page;
  const setScanId = (scanId: string | null) =>
    navigate({ scanId, taskId: null, findingId: undefined, panel: "evidence" });
  const setScreen = (screen: "projects" | "system") => navigate({ screen });
  const setTab = (tab: Tab) =>
    navigate((old) => ({
      tab,
      projectId: old.projectId ?? project?.id ?? null,
      scanId: old.scanId ?? selectedScan?.id ?? null,
    }));
  const setAnalysisFocus = (findingId: string | undefined) =>
    navigate({ findingId });
  const setReportFinding = setAnalysisFocus;
  const setAnalysisPage = (page: string | undefined) => navigate({ page });
  const [revision, setRevision] = useState(0);
  const [targetError, setTargetError] = useState("");

  const [scanDetail, setScanDetail] = useState<ScanDetail | null>(null);
  const [data, setData] = useState<Bootstrap>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modal, setModal] = useState(false);

  const [busy, setBusy] = useState("");

  const addButton = useRef<HTMLButtonElement>(null);
  const projectHeading = useRef<HTMLElement>(null);
  const refresh = useCallback(async () => {
    try {
      const result = await api<Bootstrap>("/api/bootstrap");
      setData({
        ...empty,
        ...result,
        settings: result.settings ?? empty.settings,
        scores: result.scores ?? {},
        tasks: result.tasks ?? [],
      });
      setRevision((n) => n + 1);
      setError("");
    } catch (err) {
      setError(message(err));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    document.getElementById("main")?.focus({ preventScroll: true });
  }, [screen, tab]);
  const running =
    data.scans.some(active) ||
    (!!data.readiness && !data.readiness.resourcesFree);
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => void refresh(), 2000);
    return () => window.clearInterval(timer);
  }, [running, refresh]);
  const project = projectId
    ? data.projects.find((p) => p.id === projectId)
    : data.projects[0];
  const scans = project
    ? data.scans.filter((s) => s.projectId === project.id)
    : [];
  if (
    scanDetail?.scan.projectId === project?.id &&
    scanDetail?.scan.id === scanId &&
    !scans.some((s) => s.id === scanId)
  )
    scans.push(scanDetail.scan);
  const selectedSummary = scanId
    ? scans.find((s) => s.id === scanId)
    : (scans.find((s) => !s.options?.retest) ?? scans[0]);
  const targetScanId = scanId ?? selectedSummary?.id;
  const needsReport =
    !["overview", "history", "search"].includes(tab) ||
    (!!scanId && !data.scans.some((s) => s.id === scanId));
  useEffect(() => {
    setTargetError("");
    if (!needsReport || !targetScanId || !project) {
      setScanDetail(null);
      return;
    }
    let live = true;
    void api<ScanDetail>(`/api/scans/${targetScanId}`)
      .then((detail) => {
        if (!live) return;
        if (detail.scan.projectId !== project.id) {
          setTargetError("Dieser Check gehört zu einem anderen Projekt.");
          setScanDetail(null);
          return;
        }
        setScanDetail(detail);
      })
      .catch((err) => {
        if (live) {
          setTargetError(`Check fehlt oder wurde archiviert. ${message(err)}`);
          setScanDetail(null);
        }
      });
    return () => {
      live = false;
    };
  }, [
    targetScanId,
    project?.id,
    selectedSummary?.status,
    revision,
    needsReport,
  ]);
  const detail =
    scanDetail?.scan.id === targetScanId &&
    scanDetail?.scan.projectId === project?.id
      ? scanDetail
      : null;
  const selectedScan = detail?.scan ?? selectedSummary;
  const tasks =
    detail?.tasks ??
    (selectedScan
      ? data.tasks.filter((task) => task.scanId === selectedScan.id)
      : []);
  const score =
    detail?.score ?? (selectedScan ? data.scores[selectedScan.id] : undefined);
  const missing = data.dependencies.filter((dep) => dep.status === "missing");
  const chooseProject = (id: string) => {
    navigate({
      projectId: id,
      scanId: null,
      taskId: null,
      findingId: undefined,
      page: undefined,
      panel: "evidence",
    });
    navigate({ tab: "overview", screen: "projects" });
    window.setTimeout(
      () =>
        projectHeading.current?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "auto"
            : "smooth",
          block: "start",
        }),
      0,
    );
  };
  const createDemo = async () => {
    setBusy("demo");
    setError("");
    try {
      const result = await post<{ project: Project; scan: Scan }>("/api/demo");
      await refresh();
      navigate({
        projectId: result.project.id,
        scanId: result.scan.id,
        taskId: null,
        findingId: undefined,
        tab: "live",
        screen: "projects",
      });
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy("");
    }
  };
  const explain = (finding?: Finding, pageUrl?: string) => {
    setAnalysisPage(finding?.pageUrl ?? pageUrl);
    setAnalysisFocus(finding?.id);
    setScreen("projects");
    setTab("analysis");
  };
  return (
    <WorkspaceReadiness.Provider value={data.readiness}>
      <div className="app-shell">
        <a className="skip-link" href="#main">
          Zum Inhalt springen
        </a>
        <aside className="sidebar">
          <a
            className="brand"
            href="#"
            aria-label="SiteFenn Startseite"
            onClick={(e) => {
              e.preventDefault();
              setScreen("projects");
              setTab("overview");
            }}
          >
            <span className="brand-mark">
              <FennMark />
            </span>
            <span className="brand-name">
              SiteFenn<small>DEIN WEBSITE-BEGLEITER</small>
            </span>
          </a>
          <div className="workspace">
            <span className="workspace-avatar">
              <FolderOpen size={18} />
            </span>
            <div>
              Mein Workspace<small>Lokal auf diesem Gerät</small>
            </div>
            <ShieldCheck size={16} />
          </div>
          <span className="nav-label">WORKSPACE</span>
          <nav aria-label="Hauptnavigation">
            <button
              className={`nav-item ${screen === "projects" && tab === "overview" ? "selected" : ""}`}
              onClick={() => {
                setScreen("projects");
                setTab("overview");
              }}
            >
              <LayoutDashboard size={18} />
              Websites<span className="nav-count">{data.projects.length}</span>
            </button>
            {project && (
              <>
                <button
                  className={`nav-item ${screen === "projects" && ["live", "report", "seo", "states"].includes(tab) ? "selected" : ""}`}
                  onClick={() => {
                    setScreen("projects");
                    setTab("live");
                  }}
                >
                  <Activity size={18} />
                  Prüfen
                </button>
                <button
                  className={`nav-item ${screen === "projects" && tab === "tasks" ? "selected" : ""}`}
                  onClick={() => {
                    setScreen("projects");
                    setTab("tasks");
                  }}
                >
                  <CheckSquare2 size={18} />
                  Arbeiten
                </button>
                <button
                  className={`nav-item ${screen === "projects" && ["history", "compare", "search"].includes(tab) ? "selected" : ""}`}
                  onClick={() => {
                    setScreen("projects");
                    setTab("history");
                  }}
                >
                  <Search size={18} />
                  Verlauf
                </button>
              </>
            )}
            <button
              className={`nav-item ${screen === "system" ? "selected" : ""}`}
              onClick={() => setScreen("system")}
            >
              <TerminalSquare size={18} />
              System & Setup
              {missing.length > 0 && <span className="warning-dot" />}
            </button>
          </nav>
          <div className="sidebar-projects">
            <span className="nav-label">DEINE PROJEKTE</span>
            {data.projects.map((p) => (
              <button
                className={`project-nav ${project?.id === p.id && screen === "projects" ? "current" : ""}`}
                key={p.id}
                onClick={() => chooseProject(p.id)}
              >
                <span className="project-dot" />
                {p.name}
              </button>
            ))}
            {!data.projects.length && (
              <p className="sidebar-empty">
                Ein klarer Blick beginnt
                <br />
                mit deiner ersten Website.
              </p>
            )}
          </div>
          <div className="sidebar-bottom">
            <div className="local-note">
              <span className="online-dot" />
              <span>
                Lokaler Workspace<small>Keine Cloud-KI erforderlich</small>
              </span>
            </div>
            <div className="version">
              SITEFENN <span>v{data.version}</span>
            </div>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <div>
              <span className="breadcrumb">Workspace</span>
              <ChevronRight size={13} />
              <span>{screen === "system" ? "System & Setup" : "Websites"}</span>
            </div>
            <span className="local-badge">
              <span className="online-dot" />
              LOCAL-FIRST <span className="beta-tag">{data.version}</span>
            </span>
          </header>
          <main id="main" tabIndex={-1}>
            {data.readiness && (
              <div
                className={`readiness-status ${data.readiness.resourcesFree ? "ready" : "working"}`}
                role="status"
              >
                <span className="online-dot" />
                {data.readiness.message}
              </div>
            )}
            {((!loading && projectId && !project) || targetError) && (
              <Notice error>
                <p>
                  {targetError ||
                    "Projekt fehlt oder ist nicht mehr verfügbar."}
                </p>
                <button
                  className="button secondary"
                  onClick={() => {
                    setTargetError("");
                    if (project)
                      navigate({
                        scanId: null,
                        taskId: null,
                        findingId: undefined,
                        tab: "history",
                      });
                    else reset();
                  }}
                >
                  Zurück zu{" "}
                  {project ? "diesem Projektverlauf" : "den Projekten"}
                </button>
              </Notice>
            )}
            {error && (
              <Notice error>
                <span>{error}</span>{" "}
                <button className="text-button" onClick={() => void refresh()}>
                  Erneut versuchen
                </button>
              </Notice>
            )}
            {screen === "system" ? (
              <Settings
                dependencies={data.dependencies}
                settings={data.settings}
                speechAvailable={!!data.speechAvailable}
                onSaved={refresh}
                onRefresh={refresh}
              />
            ) : (
              <>
                {data.projects.length ? (
                  tab === "overview" ? (
                    <section className="workspace-heading">
                      <div>
                        <p className="eyebrow">DEIN WEBSITE-WORKSPACE</p>
                        <h1>DEINE SITE. KLARER BLICK.</h1>
                        <p>
                          Echte Belege. Konkrete nächste Schritte. Und ein
                          Vergleich, der Veränderungen sichtbar macht.
                        </p>
                      </div>
                      <div className="workspace-actions">
                        <button
                          className="button secondary"
                          disabled={!!busy}
                          onClick={() => void createDemo()}
                        >
                          <FlaskConical size={16} />
                          {busy === "demo"
                            ? "Demo wird gestartet …"
                            : "Demo laden"}
                        </button>
                        <button
                          ref={addButton}
                          className="button primary"
                          onClick={() => setModal(true)}
                        >
                          <Plus size={17} />
                          Website hinzufügen
                        </button>
                      </div>
                    </section>
                  ) : null
                ) : (
                  <section className="page-heading poster-heading">
                    <div className="hero-copy">
                      <p className="eyebrow">
                        LOKAL. AUFMERKSAM. AUF DEINER SEITE.
                      </p>
                      <h1>
                        DEINE SITE.
                        <br />
                        <span>KLARER BLICK.</span>
                      </h1>
                      <p className="subtitle">
                        Weniger Rätselraten. Mehr Aha.
                        <br />
                        Prüfe deine Websites, verstehe Befunde und arbeite einen
                        klaren Plan ab.
                      </p>
                      <div className="hero-actions">
                        <button
                          ref={addButton}
                          className="button primary"
                          onClick={() => setModal(true)}
                        >
                          <Plus size={18} />
                          Website hinzufügen
                        </button>
                        <span className="hero-caption">
                          DEIN PRIVATER WEBSITE-WORKSPACE
                        </span>
                      </div>
                    </div>
                    <div className="hero-character">
                      <span className="character-stamp">HI, ICH BIN FENN.</span>
                      <img
                        src="/brand/fenn-flat-v2.png"
                        alt="Fenn, der aufmerksame Wüstenfuchs von SiteFenn"
                        width="420"
                        height="480"
                        fetchPriority="high"
                      />
                      <span className="character-caption">
                        KLEINER FUCHS. GENAUER BLICK.
                      </span>
                    </div>
                  </section>
                )}
                {loading ? (
                  <Busy label="Workspace wird geladen …" />
                ) : !data.projects.length ? (
                  <section className="empty-card">
                    <Monitor size={40} />
                    <p className="eyebrow">ERST MAL SICHER AUSPROBIEREN</p>
                    <h2>Dein erster Check. Ohne Rätselraten.</h2>
                    <p>
                      Unsere lokale Demo enthält absichtliche Fehler. Beobachte
                      die Prüfung in drei Ansichten und entdecke den Bericht.
                    </p>
                    <div className="button-row">
                      <button
                        className="button primary"
                        disabled={!!busy}
                        onClick={() => void createDemo()}
                      >
                        {busy ? (
                          <LoaderCircle size={17} className="spin" />
                        ) : (
                          <FlaskConical size={17} />
                        )}
                        Demo ausprobieren
                      </button>
                    </div>
                    <small>
                      Kein externes Ziel und kein KI-Modell erforderlich.
                    </small>
                  </section>
                ) : (
                  <>
                    {tab === "overview" && (
                      <section
                        className="project-grid workspace-project-grid"
                        aria-label="Deine Websites"
                      >
                        {data.projects.map((p) => {
                          const latest = data.scans
                            .filter(
                              (s) => s.projectId === p.id && !s.options?.retest,
                            )
                            .sort((a, b) =>
                              b.createdAt.localeCompare(a.createdAt),
                            )[0];
                          const latestScore = latest
                            ? data.scores[latest.id]
                            : undefined;
                          return (
                            <button
                              key={p.id}
                              className={`project-card ${project?.id === p.id ? "active-project" : ""}`}
                              onClick={() => chooseProject(p.id)}
                            >
                              <div className="project-card-top">
                                <span className="website-icon">
                                  <Globe2 size={20} />
                                </span>
                                <span
                                  className={`environment ${p.environment}`}
                                >
                                  {p.environment === "production"
                                    ? "Produktion"
                                    : p.environment === "staging"
                                      ? "Staging"
                                      : "Lokal"}
                                </span>
                              </div>
                              <h3>{p.name}</h3>
                              <span className="project-url">{p.url}</span>
                              <div className="project-card-footer">
                                <span>
                                  {latest
                                    ? statusLabel(latest.status)
                                    : "Noch keine Prüfung"}
                                </span>
                                {latestScore?.lower !== null &&
                                latestScore?.lower !== undefined ? (
                                  <span className="mini-score">
                                    {Math.round(latestScore.lower)}
                                    {latestScore.upper !== latestScore.lower
                                      ? `–${Math.round(latestScore.upper ?? latestScore.lower)}`
                                      : ""}
                                    /100
                                  </span>
                                ) : (
                                  <ArrowRight size={16} />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </section>
                    )}
                    {project && (
                      <section
                        ref={projectHeading}
                        className="workspace-project"
                        aria-label="Ausgewähltes Projekt"
                      >
                        <div className="project-context">
                          <span className="website-icon">
                            <Globe2 size={22} />
                          </span>
                          <div>
                            <h2>{project.name}</h2>
                            <a
                              className="external-url"
                              href={project.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {project.url}
                              <ExternalLink size={12} />
                            </a>
                          </div>
                          {scans.length > 0 && (
                            <select
                              aria-label="Prüfung auswählen"
                              value={selectedScan?.id ?? ""}
                              onChange={(e) => {
                                setScanId(e.target.value);
                                setAnalysisPage(undefined);
                                setReportFinding(undefined);
                              }}
                            >
                              {scans.map((scan) => (
                                <option key={scan.id} value={scan.id}>
                                  {stamp(scan.createdAt)} ·{" "}
                                  {scan.options?.retest
                                    ? "Teilnachtest · "
                                    : ""}{" "}
                                  {statusLabel(scan.status)}
                                </option>
                              ))}
                            </select>
                          )}
                          {selectedScan?.options &&
                            !selectedScan.options.retest &&
                            !active(selectedScan) && (
                              <button
                                className="button secondary"
                                disabled={
                                  !!busy ||
                                  scans.some(active) ||
                                  missing.length > 0
                                }
                                onClick={async () => {
                                  setBusy("repeat");
                                  setError("");
                                  try {
                                    const result = await post<{ scan: Scan }>(
                                      `/api/projects/${project.id}/scans`,
                                      selectedScan.options,
                                    );
                                    await refresh();
                                    setScanId(result.scan.id);
                                    setTab("live");
                                  } catch (err) {
                                    setError(message(err));
                                  } finally {
                                    setBusy("");
                                  }
                                }}
                              >
                                {busy === "repeat" ? (
                                  <LoaderCircle size={15} className="spin" />
                                ) : (
                                  <Activity size={15} />
                                )}
                                Gleichen Check wiederholen
                              </button>
                            )}
                        </div>
                        {selectedScan?.options?.retest && (
                          <div className="plan-note">
                            <strong>
                              Gezielter Teilnachtest · kein vollständiger
                              Projekt-Score
                            </strong>
                            <p>
                              Dieser Lauf gehört zu einer einzelnen Maßnahme.
                              Ausgelassene Seiten und Geräte bleiben ungeprüft.
                            </p>
                            <button
                              className="text-button"
                              onClick={() => {
                                navigate({
                                  scanId:
                                    selectedScan.options!.retest!.sourceScanId,
                                  taskId: selectedScan.options!.retest!.taskId,
                                  findingId:
                                    route.findingId ??
                                    selectedScan.options!.retest!.findingIds[0],
                                  tab: "tasks",
                                  panel: "evidence",
                                });
                              }}
                            >
                              Zum Ausgangscheck und Maßnahmenplan
                            </button>
                          </div>
                        )}
                        <nav
                          className="workspace-tabs primary-tabs"
                          aria-label="Projektbereiche"
                        >
                          {(
                            [
                              {
                                id: "overview",
                                label: "Übersicht",
                                icon: LayoutDashboard,
                              },
                              { id: "live", label: "Prüfen", icon: Radio },
                              {
                                id: "tasks",
                                label: "Arbeiten",
                                icon: CheckSquare2,
                              },
                              { id: "history", label: "Verlauf", icon: Clock3 },
                            ] as const
                          ).map((item) => (
                            <button
                              key={item.id}
                              aria-current={
                                (item.id === "live"
                                  ? ["live", "report", "seo", "states"]
                                  : item.id === "tasks"
                                    ? ["tasks", "analysis"]
                                    : item.id === "history"
                                      ? ["history", "compare", "search"]
                                      : ["overview"]
                                ).includes(tab)
                                  ? "page"
                                  : undefined
                              }
                              onClick={() => setTab(item.id)}
                            >
                              <item.icon size={16} />
                              {item.label}
                            </button>
                          ))}
                        </nav>
                        <nav
                          className="workspace-subnav"
                          aria-label="Kontextansichten"
                        >
                          {tabs
                            .filter((item) =>
                              (tab === "overview"
                                ? ["report", "tasks"]
                                : ["tasks", "analysis"].includes(tab)
                                  ? ["tasks", "analysis"]
                                  : ["history", "compare", "search"].includes(
                                        tab,
                                      )
                                    ? ["compare", "search"]
                                    : ["live", "report", "seo", "states"]
                              ).includes(item.id),
                            )
                            .map((item) => (
                              <button
                                className="text-button"
                                key={item.id}
                                aria-current={
                                  tab === item.id ? "page" : undefined
                                }
                                onClick={() => setTab(item.id)}
                              >
                                {item.label}
                              </button>
                            ))}
                        </nav>
                        {tab === "overview" && (
                          <>
                            <ProjectFlow
                              scan={selectedScan}
                              tasks={tasks}
                              verifiedCount={
                                data.projectStats?.[project.id]?.verified ??
                                data.tasks.filter(
                                  (t) =>
                                    t.projectId === project.id &&
                                    t.status === "verified" &&
                                    t.verifiedByScanId,
                                ).length
                              }
                              onNavigate={setTab}
                              onConfigure={() => {
                                const config =
                                  document.getElementById("scan-config");
                                config?.focus({ preventScroll: true });
                                config?.scrollIntoView({
                                  behavior: "smooth",
                                  block: "start",
                                });
                              }}
                            />
                            <section
                              className="stats-grid"
                              aria-label="Projektübersicht"
                            >
                              <Stat
                                icon={<Globe2 size={18} />}
                                label="Geprüfte Ansichten"
                                value={
                                  selectedScan?.result?.audit?.coverage
                                    .completed ??
                                  (
                                    selectedSummary as import("../shared/workspace.js").ScanSummary
                                  )?.counts?.completed ??
                                  0
                                }
                                detail="Im ausgewählten Check"
                              />
                              <Stat
                                icon={<FileText size={18} />}
                                label="Befunde im Check"
                                value={
                                  selectedScan?.result?.audit?.findings
                                    .length ??
                                  (
                                    selectedSummary as import("../shared/workspace.js").ScanSummary
                                  )?.counts?.findings ??
                                  0
                                }
                                detail="Gespeicherte Beobachtungen"
                              />
                              <Stat
                                icon={<Activity size={18} />}
                                label="Prüfungen"
                                value={
                                  data.projectStats?.[project.id]?.scans ??
                                  scans.length
                                }
                                detail={
                                  scans.some(active)
                                    ? "Ein Check ist aktiv"
                                    : "Lokal dokumentierter Verlauf"
                                }
                              />
                            </section>
                            <div className="two-column">
                              <ScanConfig
                                key={project.id}
                                project={project}
                                disabled={
                                  scans.some(active) ||
                                  missing.length > 0 ||
                                  (!!data.readiness &&
                                    !data.readiness.allowed.startExclusive)
                                }
                                onStarted={async (scan) => {
                                  await refresh();
                                  setScanId(scan.id);
                                  setTab("live");
                                }}
                              />
                              <div>
                                <ScoreCard score={score} />
                                <section className="panel">
                                  <div className="panel-head">
                                    <h3>Prüfverlauf</h3>
                                    <Clock3 size={18} />
                                  </div>
                                  <div className="hub-history">
                                    {scans.map((scan) => (
                                      <button
                                        className="history-row"
                                        aria-current={
                                          scan.id === selectedScan?.id
                                        }
                                        key={scan.id}
                                        onClick={() => {
                                          setScanId(scan.id);
                                          setTab(
                                            active(scan) ? "live" : "report",
                                          );
                                        }}
                                      >
                                        <div>
                                          <strong>
                                            {statusLabel(scan.status)}
                                          </strong>
                                          <small>
                                            {stamp(scan.createdAt)} ·{" "}
                                            {scan.options?.retest
                                              ? "Teilnachtest · "
                                              : ""}{" "}
                                            {scan.options?.viewports.length ??
                                              1}{" "}
                                            Ansichten
                                          </small>
                                        </div>
                                        <ChevronRight size={15} />
                                      </button>
                                    ))}
                                  </div>
                                  {!scans.length && (
                                    <p className="hint">
                                      Noch keine Prüfung. Wähle den Umfang und
                                      starte deinen ersten Check.
                                    </p>
                                  )}
                                </section>
                                {missing.length > 0 && (
                                  <Notice>
                                    Eine Systemvoraussetzung fehlt.{" "}
                                    <button
                                      className="text-button"
                                      onClick={() => setScreen("system")}
                                    >
                                      Setup öffnen
                                    </button>
                                  </Notice>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                        {tab === "live" && (
                          <>
                            <LiveScan scan={selectedScan} onChange={refresh} />
                            {selectedScan?.result && (
                              <div className="scan-config-actions">
                                <button
                                  className="button primary"
                                  onClick={() => setTab("report")}
                                >
                                  Zum vollständigen Bericht
                                  <ArrowRight size={16} />
                                </button>
                              </div>
                            )}
                          </>
                        )}
                        {tab === "report" && (
                          <Report
                            scan={selectedScan}
                            score={score}
                            onExplain={explain}
                            initialFindingId={reportFinding}
                            tasks={tasks}
                          />
                        )}
                        {tab === "seo" && (
                          <SeoReport
                            key={selectedScan?.id}
                            scan={selectedScan}
                            onFinding={(id) => {
                              setReportFinding(id);
                              setTab("report");
                            }}
                          />
                        )}
                        {tab === "states" && (
                          <JourneyReport
                            key={selectedScan?.id}
                            scan={selectedScan}
                            onFinding={(id) => {
                              setReportFinding(id);
                              setTab("report");
                            }}
                          />
                        )}
                        {tab === "analysis" && (
                          <PageAnalysis
                            key={selectedScan?.id}
                            scan={selectedScan}
                            requestedPage={analysisPage}
                            requestedFocusId={analysisFocus}
                            legacyPlan={detail?.aiPlan}
                            settings={data.settings}
                            speechAvailable={!!data.speechAvailable}
                            onTasksChanged={refresh}
                            onShowFinding={(id) => {
                              setReportFinding(id);
                              setTab("report");
                            }}
                          />
                        )}
                        {tab === "history" && (
                          <History
                            key={project.id}
                            projectId={project.id}
                            initial={scans}
                            onSelect={(scan) => {
                              setScanId(scan.id);
                              setTab(active(scan) ? "live" : "report");
                            }}
                          />
                        )}
                        {tab === "tasks" && (
                          <FixWorkspace
                            key={`${project.id}:${selectedScan?.id}`}
                            scan={selectedScan}
                            tasks={tasks}
                            taskId={route.taskId}
                            findingId={route.findingId}
                            panel={route.panel}
                            settings={data.settings}
                            speechAvailable={!!data.speechAvailable}
                            onSelect={(task, findingId, panel = "evidence") =>
                              navigate({
                                projectId: task.projectId,
                                scanId: task.scanId,
                                taskId: task.id,
                                findingId,
                                tab: "tasks",
                                panel,
                              })
                            }
                            onChange={refresh}
                            onRetestStarted={async (scan) => {
                              await refresh();
                              navigate({
                                scanId: scan.id,
                                taskId: scan.options?.retest?.taskId ?? null,
                                findingId:
                                  route.findingId ??
                                  scan.options?.retest?.findingIds[0],
                                tab: "live",
                              });
                            }}
                          />
                        )}
                        {tab === "compare" && (
                          <Compare
                            key={project.id}
                            scans={scans}
                            projectId={project.id}
                          />
                        )}
                        {tab === "search" && (
                          <SearchVisibility
                            key={project.id}
                            project={project}
                          />
                        )}
                      </section>
                    )}
                  </>
                )}
              </>
            )}
            <aside className="fenn-dock" aria-label="Fenn Assistent">
              <FennMark />
              <div>
                <strong>Fenn bleibt an deiner Seite.</strong>
                <p>
                  Messfakten und ungeprüfte Lösungsvorschläge bleiben getrennt.
                </p>
              </div>
              <button
                className="button secondary"
                disabled={!selectedScan?.result}
                onClick={() => explain()}
              >
                Fenn öffnen
              </button>
            </aside>
            <footer className="main-footer">
              <span>
                <ShieldCheck size={13} />
                Belege statt Bauchgefühl.
              </span>
              <span>SiteFenn · v{data.version} · lokaler Workspace</span>
            </footer>
          </main>
        </div>
        {modal && (
          <ProjectModal
            onClose={() => setModal(false)}
            onCreated={async (p) => {
              await refresh();
              chooseProject(p.id);
              setModal(false);
              window.setTimeout(() => addButton.current?.focus(), 0);
            }}
          />
        )}
      </div>
    </WorkspaceReadiness.Provider>
  );
}
function Stat({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <article className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        {icon}
      </div>
      <strong>{value.toString().padStart(2, "0")}</strong>
      <p>{detail}</p>
    </article>
  );
}
