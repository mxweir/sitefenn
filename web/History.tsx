import { useEffect, useRef, useState } from "react";
import type { Scan } from "../shared/types.js";
import type { CursorPage, ScanSummary } from "../shared/workspace.js";
import { api, active, message, stamp, statusLabel } from "./api.js";
import { Notice } from "./ui.js";
import { useProjectDraft } from "./workspace-state.js";
export default function History({
  projectId,
  initial,
  onSelect,
}: {
  projectId: string;
  initial: Scan[];
  onSelect: (scan: Scan) => void;
}) {
  const [filters, setFilters] = useProjectDraft(projectId, "history", {
    q: "",
    status: "all",
  });
  const [result, setResult] = useState<CursorPage<ScanSummary>>({
    items: initial,
    total: initial.length,
    nextCursor: null,
  });
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const query = () =>
    new URLSearchParams({ q: filters.q, status: filters.status, limit: "50" });
  const requestKey = `${projectId}:${query()}`;
  const activeRequest = useRef(requestKey);
  activeRequest.current = requestKey;
  useEffect(() => {
    let live = true;
    setBusy(true);
    setError("");
    const timer = setTimeout(() => {
      void api<CursorPage<ScanSummary>>(
        `/api/projects/${projectId}/scans?${query()}`,
      )
        .then((r) => {
          if (live) setResult(r);
        })
        .catch((e) => {
          if (live) setError(message(e));
        })
        .finally(() => {
          if (live) setBusy(false);
        });
    }, 180);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [projectId, filters.q, filters.status, revision]);
  const more = async () => {
    const key = activeRequest.current;
    setBusy(true);
    setError("");
    try {
      const q = query();
      q.set("cursor", result.nextCursor!);
      const r = await api<CursorPage<ScanSummary>>(
        `/api/projects/${projectId}/scans?${q}`,
      );
      if (key === activeRequest.current)
        setResult((old) => ({
          ...r,
          items: [
            ...new Map(
              [...old.items, ...r.items].map((s) => [s.id, s]),
            ).values(),
          ],
        }));
    } catch (e) {
      if (key === activeRequest.current) setError(message(e));
    } finally {
      if (key === activeRequest.current) setBusy(false);
    }
  };
  return (
    <section className="panel history-workspace">
      <p className="eyebrow">ALLE GESPEICHERTEN CHECKS DIESES PROJEKTS</p>
      <div className="panel-head">
        <h2>Prüfverlauf</h2>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => setRevision((n) => n + 1)}
        >
          Verlauf aktualisieren
        </button>
      </div>
      <p className="hint">
        Neu hinzugefügte Checks erscheinen nach dem Aktualisieren. Beim Blättern
        bleibt die bisherige Reihenfolge stabil.
      </p>
      <div className="filter-bar">
        <label>
          Verlauf durchsuchen
          <input
            type="search"
            value={filters.q}
            maxLength={120}
            placeholder="Titel, URL oder Check-ID"
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          />
        </label>
        <label>
          Prüfstatus
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="all">Alle Prüfungen</option>
            {[
              "completed",
              "failed",
              "interrupted",
              "cancelled",
              "queued",
              "running",
              "paused",
            ].map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && <Notice error>{error}</Notice>}
      <p role="status">
        {result.items.length} von {result.total} Checks
        {busy ? " · wird geladen …" : ""}
      </p>
      <div className="hub-history">
        {result.items.map((scan) => (
          <button
            className="history-row"
            key={scan.id}
            onClick={() => onSelect(scan)}
          >
            <div>
              <strong>{scan.result?.title || statusLabel(scan.status)}</strong>
              <small>
                {stamp(scan.createdAt)} · {statusLabel(scan.status)} ·{" "}
                {scan.options?.retest
                  ? "Teilnachtest"
                  : "Vollständiger Prüfumfang"}{" "}
                · {scan.id.slice(0, 8)}
              </small>
            </div>
            <span>{active(scan) ? "Prüfung öffnen" : "Bericht öffnen"} →</span>
          </button>
        ))}
      </div>
      {!busy && !result.items.length && (
        <p>
          Keine passenden Checks. Filter ändern oder einen neuen Check starten.
        </p>
      )}
      {result.nextCursor && (
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => void more()}
        >
          Weitere Checks laden
        </button>
      )}
    </section>
  );
}
