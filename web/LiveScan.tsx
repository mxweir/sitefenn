import { useEffect, useState } from "react";
import {
  CircleAlert,
  LoaderCircle,
  Pause,
  Play,
  ScanLine,
  Square,
} from "lucide-react";
import type {
  Evidence,
  Finding,
  LiveFrame,
  Scan,
  ScanProgress,
} from "../shared/types.js";
import { active, api, message, post, stamp, statusLabel } from "./api.js";
import { Empty, Notice } from "./ui.js";

type LiveState = {
  frame: LiveFrame | null;
  progress: ScanProgress | null;
  findings: Finding[];
};
export default function LiveScan({
  scan,
  onChange,
}: {
  scan?: Scan;
  onChange: () => void | Promise<void>;
}) {
  const [live, setLive] = useState<LiveState>({
    frame: null,
    progress: null,
    findings: [],
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [evidenceId, setEvidenceId] = useState("");
  useEffect(() => {
    setLive({ frame: null, progress: null, findings: [] });
    setEvidenceId("");
    setError("");
  }, [scan?.id]);
  useEffect(() => {
    if (!scan || !active(scan)) return;
    let cancelled = false;
    let timer: number;
    const poll = async () => {
      try {
        const state = await api<LiveState>(`/api/scans/${scan.id}/live`);
        if (!cancelled) {
          setLive(state);
          setError("");
        }
      } catch (err) {
        if (!cancelled) setError(message(err));
      }
      if (!cancelled) timer = window.setTimeout(() => void poll(), 1000);
    };
    void poll();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [scan?.id, scan?.status]);
  if (!scan)
    return (
      <Empty
        icon={<ScanLine size={35} />}
        title="Noch kein Scan zum Beobachten."
      >
        <p>Starte in der Übersicht einen On-Screen-Check.</p>
      </Empty>
    );
  const report = scan.result?.audit;
  const evidence =
    report?.evidence.find((e) => e.id === evidenceId) ?? report?.evidence[0];
  const isActive = active(scan);
  const frame = isActive ? live.frame : null;
  const progress = live.progress ?? scan.progress;
  const findings = isActive ? live.findings : (report?.findings ?? []);
  const control = async (action: "pause" | "resume" | "cancel") => {
    setBusy(true);
    try {
      await post(`/api/scans/${scan.id}/control`, { action });
      await onChange();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="two-column">
      <section className="panel live-card">
        <div className="panel-head">
          <div>
            <p className="eyebrow">BEOBACHTEN, NICHT FERNSTEUERN</p>
            <h2>{isActive ? "On-Screen-Check" : "Gespeicherte Nachweise"}</h2>
          </div>
          <span className={`pill ${scan.status}`}>
            {statusLabel(scan.status)}
          </span>
        </div>
        {scan.options?.retest && (
          <Notice>
            Gezielter Teilnachtest. Dieser Lauf prüft nur die betroffenen URLs
            und Geräte und ersetzt keinen vollständigen Projekt-Score.
          </Notice>
        )}
        {error && <Notice error>{error}</Notice>}
        {scan.error && <Notice error>{scan.error}</Notice>}
        {frame ? (
          <FrameView frame={frame} />
        ) : evidence ? (
          <EvidenceView
            evidence={evidence}
            scanId={scan.id}
            findings={findings}
          />
        ) : scan.result ? (
          <div className="live-frame">
            <img
              src={`/api/scans/${scan.id}/screenshot`}
              alt="Gespeicherter Desktop-Screenshot"
            />
          </div>
        ) : (
          <Empty
            icon={<LoaderCircle className={isActive ? "spin" : ""} size={28} />}
            title={
              isActive
                ? "Der Browser bereitet die Ansicht vor."
                : "Kein Nachweis verfügbar."
            }
          >
            <p>
              {progress?.message ??
                "Ergebnisse werden hier automatisch aktualisiert."}
            </p>
          </Empty>
        )}
        <p className="frame-caption">
          {frame
            ? "Aktualisierte Browser-Aufnahme. Marker gehören genau zu diesem Frame. Keine interaktive Einbettung der geprüften Website."
            : "Gespeicherte Aufnahme, kein Live-Bild. Fundstellen beziehen sich auf den Zeitpunkt und Zustand dieser Aufnahme."}
        </p>
        {isActive && (
          <div className="toolbar">
            <button
              className="button secondary"
              disabled={busy || scan.status === "queued"}
              onClick={() =>
                void control(scan.status === "paused" ? "resume" : "pause")
              }
            >
              {scan.status === "paused" ? (
                <Play size={15} />
              ) : (
                <Pause size={15} />
              )}{" "}
              {scan.status === "paused" ? "Fortsetzen" : "Pausieren"}
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => void control("cancel")}
            >
              <Square size={14} />
              Abbrechen
            </button>
          </div>
        )}
        {["interrupted", "failed", "cancelled"].includes(scan.status) && (
          <div className="toolbar">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => void control("resume")}
            >
              <Play size={15} />
              Check wieder aufnehmen
            </button>
            <p className="hint">
              Kompatible abgeschlossene Schritte werden nach Möglichkeit
              übernommen.
            </p>
          </div>
        )}
        {!!report?.evidence.length && (
          <div className="capture-grid">
            {report.evidence.map((item) => (
              <button
                key={item.id}
                className={`capture-button ${evidence?.id === item.id ? "selected" : ""}`}
                onClick={() => setEvidenceId(item.id)}
              >
                <strong>
                  {item.viewportId} · {item.width} × {item.height}
                </strong>
                <span>{new URL(item.pageUrl).pathname}</span>
                <br />
                {item.state}
              </button>
            ))}
          </div>
        )}
      </section>
      <aside className="panel">
        <div className="panel-head">
          <h3>Was gerade passiert</h3>
          <ScanLine size={18} />
        </div>
        {progress && (
          <div className="plan-note">
            <span className="small-label">{progress.phase.toUpperCase()}</span>
            <p>{progress.message}</p>
            <p>
              {progress.completed} / {progress.total} geplante Schritte
            </p>
            <span className="small-label">{stamp(progress.updatedAt)}</span>
          </div>
        )}
        <ul className="scan-log">
          {findings
            .slice(-30)
            .reverse()
            .map((f) => (
              <li key={f.id}>
                <time>
                  {f.viewportId} ·{" "}
                  {f.evidenceStatus === "measured"
                    ? "Gemessen"
                    : "Prüfkandidat"}
                </time>
                <strong>{f.title}</strong>
                <p>{f.detail}</p>
              </li>
            ))}
        </ul>
        {!findings.length && (
          <p className="hint">
            Noch keine Befunde. Das ist kein Nachweis, dass alle Prüfungen
            bestanden sind.
          </p>
        )}
        <p className="hint">
          <CircleAlert size={13} /> Live-Hinweise sind vorläufig. Der
          abgeschlossene Bericht enthält Umfang, Abdeckung und Grenzen.
        </p>
      </aside>
    </div>
  );
}
function FrameView({ frame }: { frame: LiveFrame }) {
  return (
    <>
      <div className="frame-status">
        <span>AKTUALISIERTE AUFNAHME · {frame.viewportId}</span>
        <span>
          vor{" "}
          {Math.max(
            0,
            Math.floor((Date.now() - Date.parse(frame.capturedAt)) / 1000),
          )}{" "}
          s
        </span>
      </div>
      <div className="live-frame">
        <img
          src={
            frame.image.startsWith("data:")
              ? frame.image
              : `data:image/jpeg;base64,${frame.image}`
          }
          alt={`Browser-Aufnahme ${frame.pageUrl}, ${frame.viewportId}`}
        />
        {frame.rects.map((item) => (
          <div
            key={item.findingId}
            className="frame-overlay"
            style={{
              left: `${((item.rect.x - frame.scrollX) / frame.width) * 100}%`,
              top: `${((item.rect.y - frame.scrollY) / frame.height) * 100}%`,
              width: `${(item.rect.width / frame.width) * 100}%`,
              height: `${(item.rect.height / frame.height) * 100}%`,
            }}
          >
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </>
  );
}
export function EvidenceView({
  evidence,
  scanId,
  findings,
}: {
  evidence: Evidence;
  scanId: string;
  findings: Finding[];
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [evidence.id]);
  const related = findings.filter(
    (f) => f.evidenceId === evidence.id && f.rect,
  );
  return (
    <>
      <div className="frame-status">
        <span>
          NACHWEIS · {evidence.viewportId} · {evidence.state}
        </span>
        <span>
          {evidence.width} × {evidence.height}
        </span>
      </div>
      <div className="live-frame">
        {failed ? (
          <div className="image-message">
            Die gespeicherte Aufnahme ist nicht verfügbar.
          </div>
        ) : (
          <img
            src={`/api/scans/${scanId}/evidence/${evidence.id}`}
            alt={`Gespeicherter ${evidence.viewportId === "mobile" ? "Mobile" : evidence.viewportId === "tablet" ? "Tablet" : "Desktop"}-Screenshot / ${evidence.viewportId}: ${evidence.pageUrl}`}
            onError={() => setFailed(true)}
          />
        )}{" "}
        {!failed &&
          related.map((f) => (
            <div
              key={f.id}
              className={`frame-overlay ${f.evidenceStatus === "heuristic" ? "candidate" : ""}`}
              style={{
                left: `${((f.rect!.x - evidence.scrollX) / evidence.width) * 100}%`,
                top: `${((f.rect!.y - evidence.scrollY) / evidence.height) * 100}%`,
                width: `${(f.rect!.width / evidence.width) * 100}%`,
                height: `${(f.rect!.height / evidence.height) * 100}%`,
              }}
            >
              <span>{f.title}</span>
            </div>
          ))}
      </div>
      <p className="frame-caption">
        {evidence.pageUrl} · {stamp(evidence.capturedAt)}
      </p>
    </>
  );
}
