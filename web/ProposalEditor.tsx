import { useEffect, useState } from "react";
import type {
  AuditReport,
  Finding,
  PageAnalysis,
  PageSolution,
} from "../shared/types.js";
import type {
  AnalysisFeedback,
  FeedbackClass,
  ProposalEdits,
  ProposalReview,
} from "../shared/proposal-review.js";
import { api, post, message } from "./api.js";
import { Notice } from "./ui.js";
const feedbackLabels: Record<FeedbackClass, string> = {
  "factual-contradiction": "Faktenwiderspruch",
  "bad-code": "Unpassender Code",
  "bad-acceptance": "Unbrauchbarer Nachtest",
  "missing-context": "Fehlender Kontext",
};
export default function ProposalEditor({
  job,
  solution,
  finding,
  report,
  onAdopted,
}: {
  job: PageAnalysis;
  solution: PageSolution;
  finding: Finding;
  report: AuditReport;
  onAdopted: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false),
    [steps, setSteps] = useState(solution.steps.join("\n")),
    [acceptance, setAcceptance] = useState(solution.acceptance),
    [code, setCode] = useState(solution.code.text),
    [language, setLanguage] = useState(solution.code.language),
    [mode, setMode] = useState<ProposalEdits["codeMode"]>(
      solution.code.text ? "captured" : "none",
    );
  const [confirmed, setConfirmed] = useState(false),
    [reviews, setReviews] = useState<ProposalReview[]>([]),
    [feedback, setFeedback] = useState<AnalysisFeedback[]>([]),
    [category, setCategory] = useState<FeedbackClass>("factual-contradiction"),
    [note, setNote] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const load = async () => {
    const data = await api<{
      reviews: ProposalReview[];
      feedback: AnalysisFeedback[];
    }>(`/api/page-analyses/${job.id}/reviews`);
    setReviews(data.reviews.filter((r) => r.findingId === finding.id));
    setFeedback(data.feedback.filter((f) => f.findingId === finding.id));
  };
  useEffect(() => {
    if (!open) return;
    void load().catch((e) => setError(message(e)));
  }, [open, job.id, finding.id]);
  const edits = (): ProposalEdits => ({
    steps: steps
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
    acceptance,
    code: { language: code.trim() ? language : "none", text: code },
    codeMode: code.trim() ? mode : "none",
  });
  const action = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  const save = async (status: ProposalReview["status"], adopt = false) => {
    const { review } = await post<{ review: ProposalReview }>(
      `/api/page-analyses/${job.id}/reviews`,
      {
        findingId: finding.id,
        status,
        edits: edits(),
        ...(status === "approved" ? { confirmed } : {}),
      },
    );
    if (adopt) {
      await post(`/api/page-analyses/${job.id}/adopt`, {
        findingId: finding.id,
        reviewId: review.id,
      });
      await onAdopted();
      setNotice(
        "Geprüfter Entwurf an der bestehenden Maßnahme hinterlegt. Status: offen. Keine Behebung bestätigt.",
      );
    } else
      setNotice(
        status === "needs-context"
          ? "Mehr Kontext nötig: lokal festgehalten; nichts übernommen."
          : "Neue Entwurfsrevision lokal gespeichert. Das Original bleibt unverändert.",
      );
  };
  return (
    <section
      className="proposal-editor"
      aria-label={`Vorschlag prüfen: ${finding.title}`}
    >
      <button
        className="button secondary"
        disabled={!["completed", "partial"].includes(job.status)}
        onClick={() => setOpen(!open)}
      >
        {open ? "Editor schließen" : "Vorschlag prüfen & bearbeiten"}
      </button>
      {open && (
        <div className="workspace-form panel reviewed-draft">
          <h4>Dein geprüfter Entwurf</h4>
          <p>
            Nur deine geprüften Schritte, der gewählte Code und der zukünftige
            Abnahmetest werden übernommen. Modell-Erklärung und vermutete
            Ursache bleiben im unveränderten Original.
          </p>
          <div className="canonical-observation">
            <strong>
              {finding.viewportId} · {finding.state}
            </strong>
            <p>{finding.pageUrl}</p>
            <code>{finding.selector ?? "Kein erfasster Selektor"}</code>
          </div>
          {error && <Notice error>{error}</Notice>}
          {notice && <p role="status">{notice}</p>}
          <label>
            Geprüfte Schritte · eine Zeile je Schritt
            <textarea
              aria-label="Geprüfte Schritte"
              value={steps}
              onChange={(e) => {
                setSteps(e.target.value);
                setConfirmed(false);
              }}
              maxLength={3600}
            />
          </label>
          <button
            className="text-button"
            onClick={() => {
              setSteps(finding.recommendation);
              setAcceptance(finding.acceptance);
              setCode("");
              setLanguage("none");
              setMode("none");
              setConfirmed(false);
            }}
          >
            Nur Regelbasis verwenden
          </button>
          <label>
            Codeherkunft
            <select
              aria-label="Codeherkunft"
              value={mode}
              onChange={(e) => {
                setMode(e.target.value as ProposalEdits["codeMode"]);
                setConfirmed(false);
                if (e.target.value === "none") {
                  setCode("");
                  setLanguage("none");
                }
              }}
            >
              <option value="none">Keinen Code übernehmen</option>
              <option value="captured">CSS an der erfassten Fundstelle</option>
              <option value="illustrative">
                Bewusst neues Beispiel · .sf-example- Klassen
              </option>
            </select>
          </label>
          <button
            className="text-button"
            onClick={() => {
              setCode("");
              setLanguage("none");
              setMode("none");
              setConfirmed(false);
            }}
          >
            Code verwerfen
          </button>
          {mode !== "none" && (
            <>
              <label>
                Codesprache
                <select
                  aria-label="Codesprache"
                  value={language}
                  onChange={(e) => {
                    setLanguage(
                      e.target.value as PageSolution["code"]["language"],
                    );
                    setConfirmed(false);
                  }}
                >
                  <option value="none">Keine</option>
                  <option value="css">CSS</option>
                  <option value="html">HTML · neues Beispiel</option>
                  <option value="javascript">
                    JavaScript · nur im Original behalten
                  </option>
                </select>
              </label>
              <label>
                Geprüfter Code
                <textarea
                  aria-label="Geprüfter Code"
                  value={code}
                  maxLength={3000}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setConfirmed(false);
                  }}
                />
              </label>
              <p className="hint">
                Keine Codeausführung oder Patch-Verifizierung. Neue Klassen
                müssen ausdrücklich als Beispiel gekennzeichnet sein.
                Unpassenden Code verwerfen.
              </p>
            </>
          )}
          <label>
            Zukünftiger Abnahmetest
            <textarea
              aria-label="Zukünftiger Abnahmetest"
              value={acceptance}
              maxLength={1800}
              onChange={(e) => {
                setAcceptance(e.target.value);
                setConfirmed(false);
              }}
            />
          </label>
          <div className="toolbar">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => void action(() => save("draft"))}
            >
              Entwurf speichern
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => void action(() => save("needs-context"))}
            >
              Mehr Kontext nötig
            </button>
          </div>
          <label className="check-row">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            Ich habe diesen Entwurf im angegebenen Messkontext redaktionell
            geprüft. Eine Reparatur ist damit nicht bestätigt.
          </label>
          <button
            className="button primary"
            disabled={busy || !confirmed}
            onClick={() => void action(() => save("approved", true))}
          >
            Geprüften Entwurf übernehmen
          </button>
          <details>
            <summary>
              Original und Entwurfsrevisionen ({reviews.length})
            </summary>
            <p>
              Originalauswertung {job.id} · Messkontext {job.sourceHash}
            </p>
            {reviews.map((r) => (
              <article className="plan-note" key={r.id}>
                <strong>
                  {r.status} · {new Date(r.createdAt).toLocaleString("de-DE")}
                </strong>
                <p>{r.edits.steps.join(" · ")}</p>
                <code>{r.edits.code.text || "Kein Code"}</code>
                <p>{r.meaning}</p>
                <button
                  className="text-button"
                  onClick={() => {
                    setSteps(r.edits.steps.join("\n"));
                    setAcceptance(r.edits.acceptance);
                    setCode(r.edits.code.text);
                    setLanguage(r.edits.code.language);
                    setMode(r.edits.codeMode);
                    setConfirmed(false);
                  }}
                >
                  Als neuen Entwurf laden
                </button>
              </article>
            ))}
          </details>
          <h4>Fehler gezielt zurückmelden</h4>
          <p className="hint">
            Nur in diesem Workspace gespeichert. Kein Upload, kein automatisches
            Training.
          </p>
          <label>
            Fehlerklasse
            <select
              aria-label="Fehlerklasse"
              value={category}
              onChange={(e) => setCategory(e.target.value as FeedbackClass)}
            >
              {Object.entries(feedbackLabels).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Rückmeldung
            <textarea
              aria-label="Rückmeldung"
              value={note}
              maxLength={2000}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() =>
              void action(async () => {
                await post(`/api/page-analyses/${job.id}/feedback`, {
                  findingId: finding.id,
                  category,
                  note,
                });
                setNote("");
                setNotice("Rückmeldung lokal gespeichert.");
              })
            }
          >
            Rückmeldung lokal speichern
          </button>
          {feedback.map((f) => (
            <p className="plan-note" key={f.id}>
              {feedbackLabels[f.category]} · {f.note}
            </p>
          ))}
          <p className="hint">
            {report.ruleVersion} · Dein Entwurf verändert keine ursprünglichen
            Messwerte oder Scores.
          </p>
        </div>
      )}
    </section>
  );
}
