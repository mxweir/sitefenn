import { useEffect, useState } from "react";
import type { BaselineChange } from "../shared/baseline.js";
import type { ScanComparison } from "../shared/types.js";
import { api, post, message } from "./api.js";
import { Notice } from "./ui.js";
type Preview = {
  eligible: boolean;
  reasons: string[];
  snapshotHash: string;
  previous: BaselineChange | null;
  comparison: ScanComparison;
  candidateId: string;
  controlId: string;
  meaning: string;
};
export default function BaselinePanel({
  projectId,
  beforeId,
  afterId,
  onSelect,
}: {
  projectId: string;
  beforeId: string;
  afterId: string;
  onSelect?: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false),
    [history, setHistory] = useState<BaselineChange[]>([]),
    [preview, setPreview] = useState<Preview | null>(null),
    [name, setName] = useState(""),
    [note, setNote] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const load = async () =>
    setHistory(
      (
        await api<{ baselines: BaselineChange[] }>(
          `/api/projects/${projectId}/baselines`,
        )
      ).baselines,
    );
  useEffect(() => {
    if (open) void load().catch((e) => setError(message(e)));
  }, [open, projectId]);
  useEffect(() => {
    setPreview(null);
    setConfirmed(false);
    setError("");
  }, [beforeId, afterId, projectId]);
  return (
    <details
      className="panel baseline-workspace"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>Referenzstand bewusst wechseln</summary>
      {open && (
        <>
          <p>
            Die oben gewählten Vorher-/Nachher-Läufe dienen als zwei
            Kontrollmessungen für die neue Referenz. Vollchecks mit gleicher
            Messidentität und stabilen Befunden sind erforderlich. Ein
            Messvertragwechsel wird dadurch nicht rückwirkend vergleichbar.
          </p>
          <p>
            Aktive Referenz:{" "}
            <strong>{history[0]?.name ?? "Keine benannte Referenz"}</strong>
          </p>
          {history[0] && onSelect && (
            <button
              className="button secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onSelect(history[0]!.controlId);
                } catch (e) {
                  setError(message(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Aktive Referenz als Ausgangscheck wählen
            </button>
          )}
          {error && <Notice error>{error}</Notice>}
          <button
            className="button secondary"
            disabled={busy || !beforeId || !afterId || beforeId === afterId}
            onClick={async () => {
              setBusy(true);
              setError("");
              setConfirmed(false);
              try {
                setPreview(
                  await post<Preview>(
                    `/api/projects/${projectId}/baseline-preview`,
                    { candidateId: beforeId, controlId: afterId },
                  ),
                );
              } catch (e) {
                setError(message(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Referenzwechsel prüfen
          </button>
          {preview && (
            <div className="plan-note">
              <strong>
                {preview.eligible
                  ? "Kontrollmessungen geeignet"
                  : "Weitere Kontrollmessungen nötig"}
              </strong>
              <ul>
                {preview.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <p>{preview.meaning}</p>
              <p>
                Kontrollpaar: {preview.candidateId} → {preview.controlId}
              </p>
              <label>
                Referenzname
                <input
                  aria-label="Referenzname"
                  value={name}
                  maxLength={100}
                  onChange={(e) => {
                    setName(e.target.value);
                    setConfirmed(false);
                  }}
                />
              </label>
              <label>
                Grund für den Wechsel
                <textarea
                  aria-label="Grund für den Referenzwechsel"
                  value={note}
                  maxLength={1500}
                  onChange={(e) => {
                    setNote(e.target.value);
                    setConfirmed(false);
                  }}
                />
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                Ich habe die Kontrollmessungen geprüft. Die bisherige Referenz
                bleibt Historie; eine Behebung wird nicht bestätigt.
              </label>
              <button
                className="button primary"
                disabled={
                  busy ||
                  !preview.eligible ||
                  !confirmed ||
                  !name.trim() ||
                  preview.candidateId !== beforeId ||
                  preview.controlId !== afterId
                }
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await post(`/api/projects/${projectId}/baselines`, {
                      candidateId: beforeId,
                      controlId: afterId,
                      snapshotHash: preview.snapshotHash,
                      name,
                      note,
                      confirmed,
                    });
                    await load();
                    setPreview(null);
                    setConfirmed(false);
                  } catch (e) {
                    setError(message(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Geprüften Referenzstand übernehmen
              </button>
            </div>
          )}
          <h4>Referenzhistorie ({history.length})</h4>
          {history.map((h) => (
            <article className="plan-note" key={h.id}>
              <strong>{h.name}</strong>
              <p>
                {h.createdAt} · {h.note}
              </p>
              <a
                href={`/?project=${encodeURIComponent(projectId)}&scan=${encodeURIComponent(h.controlId)}&view=report`}
              >
                Kontrollnachweis öffnen
              </a>
              <p className="hint">{h.meaning}</p>
            </article>
          ))}
        </>
      )}
    </details>
  );
}
