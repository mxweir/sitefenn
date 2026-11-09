import { useState } from "react";
import type { Scan } from "../shared/types.js";
import type { releaseGate } from "../server/services/release-gate.js";
import type { baselineReview } from "../server/services/cli-baseline.js";
import { api, message, post } from "./api.js";
import { Notice } from "./ui.js";

const statuses = {
  pass: "Bestanden",
  regression: "Regression",
  inconclusive: "Unklar",
};

export default function ReleaseGate({
  after,
  before,
}: {
  after: Scan;
  before?: Scan;
}) {
  const [result, setResult] = useState<ReturnType<typeof releaseGate>>();
  const [review, setReview] = useState<ReturnType<typeof baselineReview>>();
  const [mode, setMode] = useState<"first" | "replace">(
    before ? "replace" : "first",
  );
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const endpoint = `/api/scans/${encodeURIComponent(after.id)}`;
  const baselineId = mode === "replace" ? before?.id : undefined;
  async function act(callback: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await callback();
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="panel release-gate">
      <summary>Release-Gate und CLI-Baseline</summary>
      <p className="hint">
        Profil: {after.labels?.profileName || "Standardprofil"} ·{" "}
        {after.options?.pages.length ?? 0} URL(s). Ein anderer Ursprung oder
        Port braucht eigene Referenzmessungen.
      </p>
      <div className="release-gate-actions">
        {after.options && !after.options.retest && (
          <a
            className="button secondary"
            href={`${endpoint}/check-profile`}
            download
          >
            Prüfprofil herunterladen
          </a>
        )}
        <button
          className="button secondary"
          type="button"
          disabled={busy || !before}
          onClick={() =>
            void act(async () => {
              setResult(undefined);
              setResult(
                await api<ReturnType<typeof releaseGate>>(
                  `${endpoint}/release-gate?baseline=${encodeURIComponent(before!.id)}`,
                ),
              );
            })
          }
        >
          Release-Gate auswerten
        </button>
      </div>
      {result && (
        <div className="plan-note" aria-live="polite">
          <strong
            className={`pill ${result.status === "pass" ? "completed" : result.status === "regression" ? "failed" : "candidate"}`}
          >
            {statuses[result.status]} · Exit {result.exitCode}
          </strong>
          <p>
            Regeln: {result.policy.categories.join(", ")} · Mindestpriorität:{" "}
            {result.policy.minimumPriority}
          </p>
          <p>
            {result.blockers.length} neue Blocker · {result.existing.length}{" "}
            bestehende Blocker · {result.unknown.length} Mess- oder
            Vergleichslücken
          </p>
          {[
            { label: "Neue Blocker", findings: result.blockers },
            { label: "Bestehende Blocker", findings: result.existing },
          ]
            .filter(({ findings }) => findings.length > 0)
            .map(({ label, findings }) => (
              <details key={label}>
                <summary>{label}</summary>
                <ul>
                  {findings.map((finding) => (
                    <li key={finding.id}>
                      {finding.title} · {finding.viewportId} · {finding.state}
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          {result.unknown.length > 0 && (
            <ul>
              {result.unknown.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <p>
        Prüfe den gewählten Nachher-Check, bevor du ihn als benannte
        CLI-Baseline übernimmst. Der Download enthält Berichtsdaten. Bilder sind
        nicht eingebettet.
      </p>
      <div className="release-gate-actions">
        <div className="release-gate-field">
          <label htmlFor="cli-baseline-mode">Baseline-Verwendung</label>
          <select
            id="cli-baseline-mode"
            value={mode}
            disabled={busy}
            onChange={(event) => {
              setMode(event.target.value === "first" ? "first" : "replace");
              setReview(undefined);
              setSaved(false);
            }}
          >
            <option value="replace" disabled={!before}>
              Gewählten Vorher-Check ersetzen
            </option>
            <option value="first">Erste Baseline für dieses Ziel</option>
          </select>
        </div>
        <button
          className="button secondary"
          type="button"
          disabled={busy || (mode === "replace" && !before)}
          onClick={() =>
            void act(async () => {
              setReview(undefined);
              setSaved(false);
              setReview(
                (
                  await post<{ review: ReturnType<typeof baselineReview> }>(
                    `${endpoint}/cli-baseline-review`,
                    { baselineId },
                  )
                ).review,
              );
            })
          }
        >
          Kandidat prüfen
        </button>
      </div>
      {review && (
        <div className="plan-note" aria-live="polite">
          <strong>
            {review.eligible
              ? "Kandidat kann übernommen werden"
              : "Kandidat kann nicht übernommen werden"}
          </strong>
          <p>
            {review.findings} Befunde · {review.newBlockers} neue Blocker ·{" "}
            {review.unknown.length} Lücken
          </p>
          {review.unknown.map((reason) => (
            <p key={reason}>{reason}</p>
          ))}
          {review.eligible && (
            <>
              <div className="release-gate-actions">
                <div className="release-gate-field">
                  <label htmlFor="cli-baseline-name">
                    Name der CLI-Baseline
                  </label>
                  <input
                    id="cli-baseline-name"
                    maxLength={100}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </div>
                <button
                  className="button primary"
                  type="button"
                  disabled={busy || !name.trim()}
                  onClick={() =>
                    void act(async () => {
                      const { baseline } = await post<{ baseline: unknown }>(
                        `${endpoint}/cli-baseline-review`,
                        { baselineId, confirm: review.sha256, name },
                      );
                      const href = URL.createObjectURL(
                        new Blob([JSON.stringify(baseline, null, 2) + "\n"], {
                          type: "application/json",
                        }),
                      );
                      const link = document.createElement("a");
                      link.href = href;
                      link.download = "sitefenn-reviewed-baseline.json";
                      link.click();
                      setTimeout(() => URL.revokeObjectURL(href), 1000);
                      setSaved(true);
                    })
                  }
                >
                  Übernehmen und herunterladen
                </button>
              </div>
              {saved && <p>Baseline zum Download bereitgestellt.</p>}
            </>
          )}
        </div>
      )}
      {error && <Notice error>{error}</Notice>}
    </details>
  );
}
