import { useEffect, useState } from "react";
import { activeJob, type WorkspaceJob } from "../shared/jobs.js";
import type { Readiness } from "../shared/readiness.js";
import { BACKUP_BYTES, BACKUP_IMAGES } from "../shared/backup-limits.js";
import { api, message, post, stamp } from "./api.js";

const labels = {
  browser: "Browser-Prüfung",
  ai: "Lokale Analyse",
  export: "Berichtsexport",
  backup: "Sicherung",
  maintenance: "Wartung",
};
const phases = {
  queued: "Wartet",
  running: "Läuft",
  paused: "Pausiert",
  cancelling: "Abbruch läuft",
  "cleaning-up": "Räumt auf",
  completed: "Abgeschlossen",
  failed: "Fehlgeschlagen",
  cancelled: "Abgebrochen",
  interrupted: "Unterbrochen",
};
const failure = {
  "disk-full": "Datenträger voll. Speicher freigeben und erneut starten.",
  worker:
    "Worker unerwartet beendet. Gespeicherte Zwischenstände bleiben verfügbar.",
  operation: "Auftrag fehlgeschlagen. Umfang und verfügbaren Speicher prüfen.",
  interrupted: "App beendet. Auftrag kann erneut gestartet werden.",
};

export default function Jobs({
  projects,
  onReadiness,
}: {
  projects: { id: string; name: string }[];
  onReadiness: (readiness: Readiness) => void;
}) {
  const [state, setState] = useState<{
    jobs: WorkspaceJob[];
    readiness: Readiness;
  }>();
  const [projectId, setProject] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = async () => {
    const result = await api<{ jobs: WorkspaceJob[]; readiness: Readiness }>(
      "/api/jobs",
    );
    setState(result);
    onReadiness(result.readiness);
  };
  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const result = await api<{
          jobs: WorkspaceJob[];
          readiness: Readiness;
        }>("/api/jobs");
        if (mounted) {
          setState(result);
          onReadiness(result.readiness);
        }
      } catch {
        /* The explicit refresh and action errors remain available. */
      }
      if (mounted) timer = setTimeout(poll, 2000);
    };
    void poll();
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [onReadiness]);
  const action = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  };
  const render = (job: WorkspaceJob) => (
    <article className="plan-note" key={job.id}>
      <strong>
        {labels[job.kind]} · {phases[job.phase]}
      </strong>
      <p>
        {stamp(job.updatedAt)} · {job.id.slice(0, 8)}
        {job.projectId &&
          ` · ${projects.find((project) => project.id === job.projectId)?.name ?? "Projekt"}`}
      </p>
      {job.reason && <p>{job.reason}</p>}
      {job.failure && <p>{failure[job.failure]}</p>}
      {job.progress && job.progress.total > 0 && (
        <>
          <progress
            aria-label="Auftragsfortschritt"
            value={job.progress.completed}
            max={job.progress.total}
          />
          <p>
            {job.progress.unit === "bytes"
              ? `${(job.progress.completed / 1024 ** 2).toFixed(1)} / ${(job.progress.total / 1024 ** 2).toFixed(1)} MiB`
              : `${job.progress.completed} / ${job.progress.total} Schritte`}
          </p>
        </>
      )}
      <div className="toolbar">
        {job.scanId && job.projectId && (
          <a
            href={`/?${new URLSearchParams({ project: job.projectId, scan: job.scanId, view: job.kind === "ai" ? "analysis" : "live" })}`}
          >
            Prüfkontext öffnen
          </a>
        )}
        {(job.cancellable ||
          (job.kind === "browser" &&
            ["queued", "running", "paused"].includes(job.phase))) && (
          <button
            className="button secondary"
            disabled={busy}
            onClick={() =>
              void action(() => post(`/api/jobs/${job.id}/cancel`, {}))
            }
          >
            Auftrag abbrechen
          </button>
        )}
        {job.downloadable && (
          <a
            className="button secondary"
            href={`/api/jobs/${job.id}/backup`}
            download
          >
            Sicherung herunterladen
          </a>
        )}
      </div>
    </article>
  );
  const jobs = state?.jobs ?? [];
  const allowed = state?.readiness.allowed.startExclusive ?? false;
  return (
    <section className="panel workspace-form" id="jobs" aria-label="Aufträge">
      <div className="panel-head">
        <h2>Aufträge</h2>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => void action(load)}
        >
          Aufträge aktualisieren
        </button>
      </div>
      <p role="status">
        {state?.readiness.message ?? "Auftragsstatus wird geladen"}
      </p>
      {error && <p role="alert">{error}</p>}
      {jobs.filter((job) => activeJob(job.phase)).map(render)}
      <h3>Hintergrundsicherung</h3>
      <p>
        Bis {BACKUP_BYTES / 1024 ** 3} GiB und{" "}
        {BACKUP_IMAGES.toLocaleString("de-DE")} Bilder. Die letzte fertige
        Sicherung steht zum Download bereit.
      </p>
      <label htmlFor="backup-project">Sicherungsumfang</label>
      <select
        id="backup-project"
        value={projectId}
        onChange={(event) => setProject(event.target.value)}
      >
        <option value="">Gesamter Workspace</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
      <button
        className="button primary"
        disabled={busy || !allowed}
        onClick={() =>
          void action(() =>
            post("/api/jobs/backup", projectId ? { projectId } : {}),
          )
        }
      >
        Sicherung starten
      </button>
      {jobs.filter((job) => job.downloadable).map(render)}
      <details>
        <summary>Auftragsverlauf</summary>
        {jobs
          .filter((job) => !activeJob(job.phase) && !job.downloadable)
          .slice(0, 50)
          .map(render)}
      </details>
      <p>
        <a href="/api/jobs/diagnostics" download>
          Redigierte Diagnose herunterladen
        </a>
      </p>
    </section>
  );
}
