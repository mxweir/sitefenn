import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Send, Volume2, VolumeX, X } from "lucide-react";
import type { AiPlan, Finding, HubSettings, Scan } from "../shared/types.js";
import { api, message, post } from "./api.js";
import { FennMark, Notice } from "./ui.js";

export default function FennGuide({
  scan,
  finding,
  savedPlan,
  open,
  onToggle,
  settings,
  speechAvailable,
}: {
  scan?: Scan;
  finding?: Finding;
  savedPlan?: AiPlan;
  open: boolean;
  onToggle: (open: boolean) => void;
  settings: HubSettings;
  speechAvailable: boolean;
}) {
  const [question, setQuestion] = useState("");
  const [plan, setPlan] = useState<AiPlan | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  useEffect(() => {
    setBusy(false);
    return () => {
      controllerRef.current?.abort();
    };
  }, [scan?.id]);
  useEffect(() => {
    setPlan(finding ? null : (savedPlan ?? null));
    setError("");
    setQuestion(
      finding
        ? `Erkläre den Befund ${finding.id}: ${finding.title}. Welche belegte Maßnahme ist sinnvoll?`
        : "",
    );
  }, [scan?.id, finding?.id, savedPlan?.id, savedPlan?.createdAt]);
  if (!open)
    return (
      <button
        className="fenn-launcher"
        aria-label="Fenns Hinweis anzeigen"
        aria-expanded="false"
        onClick={() => onToggle(true)}
      >
        <FennMark />
        <span>Ein klarer nächster Schritt?</span>
      </button>
    );
  return (
    <aside className="fenn-chat" role="region" aria-label="Hinweis von Fenn">
      <div className="fenn-chat-header">
        <span className="guide-avatar">
          <FennMark />
        </span>
        <div>
          <strong>Frag Fenn.</strong>
          <small>
            {plan ? `LOKALE KI · ${plan.model}` : "STATISCHER TIPP · KEINE KI"}
          </small>
        </div>
        <button
          aria-label="Fenns Hinweis einklappen"
          aria-expanded="true"
          onClick={() => onToggle(false)}
        >
          <X size={18} />
        </button>
      </div>
      <div className="fenn-chat-content">
        {plan ? (
          <>
            <Notice>
              KI-Vorschläge sind ungeprüft und können den Messungen
              widersprechen. Maßgeblich sind die regelbasierten Befunde und ihre
              Nachweise.
            </Notice>
            <details className="plan-note">
              <summary>Ungeprüfte KI-Zusammenfassung</summary>
              <p>{plan.summary}</p>
            </details>
            {plan.recommendations.map((recommendation) => {
              const observed = scan?.result?.audit?.findings.find(
                (item) => item.id === recommendation.findingId,
              );
              return (
                <div className="plan-note" key={recommendation.findingId}>
                  <span className="small-label">
                    BELEG {recommendation.findingId}
                  </span>
                  {observed && (
                    <div>
                      <strong>
                        {observed.evidenceStatus === "measured"
                          ? "Gemessener Befund"
                          : "Prüfkandidat"}
                        : {observed.title}
                      </strong>
                      <p>{observed.detail}</p>
                    </div>
                  )}
                  <span className="small-label">KI-EINORDNUNG · UNGEPRÜFT</span>
                  <p>{recommendation.explanation}</p>
                  <p>
                    <strong>Vorgeschlagene Maßnahme:</strong>{" "}
                    {recommendation.action}
                  </p>
                  <p>
                    <strong>Vorgeschlagenes Abnahmekriterium:</strong>{" "}
                    {recommendation.acceptance}
                  </p>
                  <p>
                    <strong>Unsicherheit:</strong> {recommendation.uncertainty}
                  </p>
                </div>
              );
            })}
            {plan.warnings.map((warning, i) => (
              <p className="hint" key={i}>
                {warning}
              </p>
            ))}
            <details className="plan-note">
              <summary>Identität der lokalen Auswertung</summary>
              {plan.provenance ? (
                <dl>
                  <dt>Promptversion</dt>
                  <dd>{plan.provenance.promptVersion}</dd>
                  <dt>Modell SHA-256</dt>
                  <dd className="identity-hash">
                    {plan.provenance.modelDigest ??
                      "Nicht erfasst — Gewichtsidentität unbekannt"}
                  </dd>
                  <dt>Prompt / Kontext SHA-256</dt>
                  <dd className="identity-hash">
                    {plan.provenance.promptSha256}
                    <br />
                    {plan.provenance.contextSha256}
                  </dd>
                  <dt>Dauer / Kontext / Vorhersagelimit</dt>
                  <dd>
                    {Math.round(plan.provenance.durationMs / 1000)} s /{" "}
                    {plan.provenance.contextTokens} /{" "}
                    {plan.provenance.predictionLimit}
                  </dd>
                </dl>
              ) : (
                <p>
                  Historische Auswertung: Prompt- und Gewichtsidentität wurden
                  noch nicht aufgezeichnet.
                </p>
              )}
            </details>
          </>
        ) : (
          <p>
            {finding
              ? `Dieser Befund ist als „${finding.evidenceStatus === "measured" ? "gemessen" : "Prüfkandidat"}“ markiert. Prüfe zuerst den gespeicherten Nachweis und das Abnahmekriterium.`
              : "Beginne mit einem begrenzten Check. Behebe bestätigte Blocker zuerst und prüfe danach unter denselben Bedingungen erneut. Ein Score ist Orientierung, kein Qualitätsversprechen."}
          </p>
        )}
        {!settings.model && (
          <p className="plan-note">
            Kein lokales Modell ausgewählt.{" "}
            {plan
              ? "Oben siehst du eine gespeicherte KI-Erklärung."
              : "Der Tipp oben ist statisch."}{" "}
            Unter „System & Setup“ kannst du ein installiertes Ollama-Modell
            wählen.
          </p>
        )}
        <label htmlFor="fenn-question" className="fenn-inline-label">
          FRAGE ZUM AUSGEWÄHLTEN CHECK
        </label>
        <textarea
          id="fenn-question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Welchen Befund sollte ich zuerst angehen?"
          maxLength={1000}
        />
        {error && <Notice error>{error}</Notice>}
        <button
          className="button primary"
          disabled={busy || !settings.model || scan?.status !== "completed"}
          onClick={async () => {
            if (!scan) return;
            setBusy(true);
            setError("");
            const controller = new AbortController();
            controllerRef.current = controller;
            try {
              const result = await api<{ plan: AiPlan }>(
                `/api/scans/${scan.id}/ai`,
                {
                  method: "POST",
                  signal: controller.signal,
                  body: JSON.stringify({
                    model: settings.model,
                    ...(finding ? { findingId: finding.id } : {}),
                    ...(question.trim() ? { question: question.trim() } : {}),
                  }),
                },
              );
              if (!controller.signal.aborted) setPlan(result.plan);
            } catch (err) {
              if (!controller.signal.aborted) setError(message(err));
            } finally {
              if (controllerRef.current === controller) setBusy(false);
            }
          }}
        >
          {busy ? (
            <LoaderCircle size={15} className="spin" />
          ) : (
            <Send size={15} />
          )}{" "}
          {busy ? "Lokales Modell arbeitet …" : "Lokal erklären lassen"}
        </button>
        {busy && (
          <button
            className="button secondary"
            onClick={async () => {
              try {
                await post("/api/ai/cancel");
                controllerRef.current?.abort();
                setBusy(false);
                setError("Die lokale Auswertung wurde abgebrochen.");
              } catch (err) {
                setError(message(err));
              }
            }}
          >
            Auswertung abbrechen
          </button>
        )}
        <p className="hint">
          Nur abgeschlossene Checks. Keine automatische Änderung deiner Website.
          KI-Aussagen mit den Nachweisen abgleichen.
        </p>
        {speechAvailable && settings.speechEnabled && plan && (
          <div className="toolbar">
            <button
              className="tiny-button"
              onClick={() =>
                void post("/api/speech", {
                  text: `Ungeprüfte KI-Zusammenfassung. ${plan.summary}`,
                }).catch((err) => setError(message(err)))
              }
            >
              <Volume2 size={14} /> KI-Zusammenfassung vorlesen
            </button>
            <button
              className="tiny-button"
              onClick={() =>
                void post("/api/speech/stop").catch((err) =>
                  setError(message(err)),
                )
              }
            >
              <VolumeX size={14} /> Stoppen
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
