import { useContext } from "react";
import { WorkspaceReadiness } from "./workspace-state.js";
import { pageFacts } from "../shared/report-contract.js";
import { useEffect, useState } from "react";
import {
  Copy,
  Download,
  LoaderCircle,
  Send,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
} from "lucide-react";
import type {
  AiPlan,
  HubSettings,
  PageAnalysis as Analysis,
  Scan,
} from "../shared/types.js";
import { api, message, post, stamp } from "./api.js";
import { FennMark, Notice, Empty } from "./ui.js";
import { EvidenceView } from "./LiveScan.js";

type Summary = Pick<
  Analysis,
  "id" | "pageUrl" | "status" | "model" | "createdAt"
>;
const labels: Record<Analysis["status"], string> = {
  queued: "Wartet",
  running: "Lokales Modell arbeitet",
  completed: "Alle Teile verarbeitet · Faktenprüfung offen",
  partial: "Teilweise ausgewertet",
  failed: "Auswertung fehlgeschlagen",
  cancelled: "Abgebrochen",
  interrupted: "Durch Neustart unterbrochen",
};
export default function PageAnalysis({
  scan,
  requestedPage,
  requestedFocusId,
  legacyPlan,
  settings,
  speechAvailable,
  onTasksChanged,
  onShowFinding,
}: {
  scan?: Scan;
  requestedPage?: string;
  requestedFocusId?: string;
  legacyPlan?: AiPlan;
  settings: HubSettings;
  speechAvailable: boolean;
  onTasksChanged: () => void | Promise<void>;
  onShowFinding: (id: string) => void;
}) {
  const readiness = useContext(WorkspaceReadiness);
  const report = scan?.result?.audit;
  const pages = report?.options.pages ?? [];
  const [page, setPage] = useState("");
  const [history, setHistory] = useState<Summary[]>([]);
  const [selected, setSelected] = useState("");
  const [job, setJob] = useState<Analysis | null>(null);
  const [purpose, setPurpose] = useState(""),
    [goal, setGoal] = useState(""),
    [audience, setAudience] = useState("");
  const [includeTasks, setIncludeTasks] = useState(true),
    [comparisonId, setComparisonId] = useState("");
  const [comparisons, setComparisons] = useState<
    { id: string; createdAt: string }[]
  >([]);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const url = pages.includes(page) ? page : (pages[0] ?? "");
  useEffect(() => {
    setPage(
      requestedPage && pages.includes(requestedPage)
        ? requestedPage
        : (pages[0] ?? ""),
    );
    setSelected("");
    setJob(null);
    setQuestion("");
    setError("");
  }, [scan?.id, requestedPage]);
  useEffect(() => {
    setSelected("");
    setJob(null);
    setQuestion("");
    setError("");
    setNotice("");
  }, [url]);
  useEffect(() => {
    if (!scan?.id) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const result = await api<{ analyses: Summary[] }>(
          `/api/scans/${scan.id}/page-analyses`,
        );
        if (stopped) return;
        setHistory(result.analyses);
        setSelected(
          (value) =>
            value ||
            result.analyses.find((item) => item.pageUrl === url)?.id ||
            "",
        );
      } catch (err) {
        if (!stopped) setError(message(err));
      }
      if (!stopped) timer = setTimeout(() => void load(), 2000);
    };
    void load();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [scan?.id, url]);
  useEffect(() => {
    if (!selected) {
      setJob(null);
      return;
    }
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const result = await api<{ analysis: Analysis }>(
          `/api/page-analyses/${selected}`,
        );
        if (stopped) return;
        if (result.analysis.pageUrl !== url) {
          setJob(null);
          return;
        }
        setJob(result.analysis);
        if (["queued", "running"].includes(result.analysis.status))
          timer = setTimeout(() => void load(), 1000);
      } catch (err) {
        if (!stopped) setError(message(err));
      }
    };
    void load();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [selected, url]);
  useEffect(() => {
    setComparisonId("");
    setComparisons([]);
    if (!scan?.id) return;
    let alive = true;
    void api<{ comparisons: { id: string; createdAt: string }[] }>(
      `/api/scans/${scan.id}/analysis-sources`,
    )
      .then((data) => {
        if (alive) setComparisons(data.comparisons);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [scan?.id]);
  if (!report)
    return (
      <Empty title="Für die Seitenanalyse zuerst einen Check durchführen.">
        <p>
          Fenn erklärt gespeicherte Messergebnisse. Ohne Report gibt es keinen
          belegten Seitenkontext.
        </p>
      </Empty>
    );
  const current = job?.pageUrl === url && job.scanId === scan?.id ? job : null;
  const running = current && ["queued", "running"].includes(current.status);
  const findings = report.findings.filter((item) => item.pageUrl === url);
  const rules = report.rules.filter((item) => item.pageUrl === url);
  const completed =
    current?.parts.filter((part) => part.status === "completed").length ?? 0;
  const begin = async () => {
    if (!scan) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await post<{ analysis: Analysis }>(
        `/api/scans/${scan.id}/page-analyses`,
        {
          pageUrl: url,
          model: settings.model,
          question: question.trim(),
          ...(!(
            question.trim() &&
            current &&
            ["completed", "partial"].includes(current.status)
          )
            ? {
                context: {
                  purpose,
                  goal,
                  audience,
                  ...(requestedFocusId &&
                  findings.some((f) => f.id === requestedFocusId)
                    ? { focusFindingId: requestedFocusId }
                    : {}),
                },
                includeTasks,
                ...(comparisonId ? { comparisonScanId: comparisonId } : {}),
              }
            : {}),
          ...(question.trim() &&
          current &&
          ["completed", "partial"].includes(current.status)
            ? { parentId: current.id }
            : {}),
        },
      );
      setJob(response.analysis);
      setSelected(response.analysis.id);
      setQuestion("");
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-label="Seitenanalyse mit Fenn" className="page-analysis">
      <div className="panel-head">
        <div>
          <p className="eyebrow">MESSUNGEN VERSTEHEN. LÖSUNGEN VORBEREITEN.</p>
          <h2>Seite mit Fenn erklären</h2>
          <p>
            Der Bericht dieser Seite ist der Kontext — über alle geprüften
            Geräte und Zustände.
          </p>
        </div>
        <span className="analysis-fenn">
          <FennMark />
        </span>
      </div>
      <div className="analysis-layout">
        <aside className="panel analysis-context">
          <label htmlFor="analysis-page">Seite auswählen</label>
          <select
            id="analysis-page"
            value={url}
            onChange={(e) => setPage(e.target.value)}
          >
            {pages.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <h3>Dein Seitenkontext</h3>
          <div className="chip-list">
            <span className="pill">{findings.length} Befunde</span>
            <span className="pill">{rules.length} Regelprüfungen</span>
            <span className="pill">
              {report.pages.filter((item) => item.pageUrl === url).length}{" "}
              Geräte-/Seitenzustände
            </span>
          </div>
          <p>
            Enthalten sind Beobachtungen, bestandene und fehlgeschlagene
            Prüfungen, unbekannte Bereiche, Messwerte, Selektoren und
            Nachweisreferenzen. Neue Checks enthalten bei eindeutig erfassten
            Elementen außerdem begrenzte DOM-/Style-Messwerte.
          </p>
          <p className="hint">
            Keine Quellcode-Dateien, Zugangsdaten oder Screenshot-Bilder. Große
            Berichte werden in begrenzte Teile aufgeteilt. Überlange Datensätze
            oder erreichte Grenzen werden ausdrücklich ausgewiesen.
          </p>
          <details>
            <summary>Messkontext ansehen</summary>
            <ul>
              <li>
                {rules.filter((item) => item.status === "pass").length}{" "}
                bestandene Prüfungen
              </li>
              <li>
                {rules.filter((item) => item.status === "fail").length}{" "}
                Regelbefunde
              </li>
              <li>
                {rules.filter((item) => item.status === "not_run").length} nicht
                ausgeführte Prüfungen
              </li>
              <li>
                {
                  report.performance.filter((item) => item.pageUrl === url)
                    .length
                }{" "}
                Performance-Datensätze
              </li>
            </ul>
          </details>
          {requestedFocusId &&
            findings.some((f) => f.id === requestedFocusId) && (
              <p className="notice">
                Schwerpunkt für die neue Analyse:{" "}
                {findings.find((f) => f.id === requestedFocusId)!.title}. Der
                übrige Seitenbericht bleibt Kontext.
              </p>
            )}
          <details className="analysis-intent">
            <summary>Analyse ausrichten</summary>
            <label htmlFor="analysis-purpose">Seitenzweck (optional)</label>
            <input
              id="analysis-purpose"
              maxLength={500}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="z. B. Leistungen eines Studios vorstellen"
            />
            <label htmlFor="analysis-goal">Nutzerziel (optional)</label>
            <input
              id="analysis-goal"
              maxLength={500}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="z. B. passende Leistung finden und Kontakt aufnehmen"
            />
            <label htmlFor="analysis-audience">Zielgruppe (optional)</label>
            <input
              id="analysis-audience"
              maxLength={500}
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
            />
            <label className="check-option">
              <input
                type="checkbox"
                checked={includeTasks}
                onChange={(e) => setIncludeTasks(e.target.checked)}
              />
              Bestehende Maßnahmen als Kontext einbeziehen
            </label>
            <label htmlFor="analysis-comparison">
              Kompatibler früherer Check
            </label>
            <select
              id="analysis-comparison"
              value={comparisonId}
              onChange={(e) => setComparisonId(e.target.value)}
            >
              <option value="">Ohne Vergleich</option>
              {comparisons.map((c) => (
                <option key={c.id} value={c.id}>
                  {stamp(c.createdAt)}
                </option>
              ))}
            </select>
            <p className="hint">
              Nur kompatible vollständige Checks aus den letzten 20 Kandidaten.
              Unbekannte Ziele bleiben unbekannt. Rückfragen behalten den
              gespeicherten Kontext; geänderte Angaben gelten für eine neue
              Analyse.
            </p>
          </details>
          <label htmlFor="analysis-history">Gespeicherte Auswertung</label>
          <select
            id="analysis-history"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Neue Auswertung</option>
            {history
              .filter((item) => item.pageUrl === url)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {stamp(item.createdAt)} · {labels[item.status]} · {item.model}
                </option>
              ))}
          </select>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void begin();
            }}
          >
            <label htmlFor="analysis-question">
              Frage zum Seitenbericht (optional)
            </label>
            <textarea
              id="analysis-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={1000}
              placeholder="Warum tritt das auf Mobil auf? Wie kann ich es ohne feste Höhen lösen?"
            />
            {current && (
              <p className="hint">
                Eine Rückfrage nutzt denselben Messstand und die vorherige
                ungeprüfte Interpretation. Dafür wird eine neue Auswertung
                gespeichert.
              </p>
            )}
            <p className="small-label">
              LOKALES MODELL FÜR DEN AUFRUF ·{" "}
              {settings.model || "KEIN MODELL AUSGEWÄHLT"}
            </p>
            <p className="hint">
              Seitenanalysen benötigen Ollama ab 0.40.0. Bekannte Referenzen und
              gültiges JSON sind keine Qualitätsgarantie.
            </p>
            <button
              className="button primary"
              disabled={
                busy ||
                !!running ||
                !settings.model ||
                (!!readiness && !readiness.allowed.startExclusive) ||
                scan?.status !== "completed"
              }
            >
              {busy ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Send size={16} />
              )}{" "}
              {question.trim()
                ? "Frage lokal auswerten"
                : "Seite lokal analysieren"}
            </button>
            {!settings.model && (
              <p>
                Unter „System & Setup“ ein installiertes lokales Modell
                auswählen. Der Messbericht bleibt ohne KI nutzbar.
              </p>
            )}
          </form>
        </aside>
        <div className="analysis-results">
          <Notice>
            KI-Vorschläge sind ungeprüft und können den Messungen widersprechen.
            Ursachen bleiben Vermutungen, Codebeispiele sind Anpassungshilfen.
            Es wurde nichts repariert oder manuell bestätigt.
          </Notice>
          {error && <Notice error>{error}</Notice>}
          {notice && (
            <p className="notice success" role="status">
              {notice}
            </p>
          )}
          {legacyPlan && (
            <details className="panel">
              <summary>
                Frühere KI-Auswertung dieses Scans ({legacyPlan.model})
              </summary>
              <p className="hint">
                Historischer, ungeprüfter Vorschlag im früheren Format. Er
                enthielt nur ausgewählte Befunde und ist keine vollständige
                Seitenanalyse.
              </p>
              <p>{legacyPlan.summary}</p>
              {legacyPlan.recommendations.map((item) => (
                <div key={item.findingId}>
                  <strong>{item.findingId}</strong>
                  <p>{item.explanation}</p>
                  <p>{item.action}</p>
                  <p>Nachtest: {item.acceptance}</p>
                  <p className="hint">{item.uncertainty}</p>
                </div>
              ))}
            </details>
          )}
          {!current ? (
            <Empty title="Vom Report zur konkreten Lösung">
              <p>
                Wähle eine Seite. Fenn erklärt ihre Messungen und schlägt
                Schritte mit einem Abnahmetest vor.
              </p>
            </Empty>
          ) : (
            <>
              <section
                className="panel"
                aria-label="Fortschritt der Seitenanalyse"
              >
                <div className="panel-head">
                  <h3>{labels[current.status]}</h3>
                  <span className="pill">{current.model}</span>
                </div>
                <p>
                  {completed}/{current.parts.length} Kontextteile erfolgreich
                  ausgewertet · {current.totalUnits} Datensätze im vorgesehenen
                  Kontext
                </p>
                {current.context && (
                  <details>
                    <summary>Gespeicherte Analyseausrichtung</summary>
                    <p>Seitenzweck: {current.context.purpose || "Unbekannt"}</p>
                    <p>Nutzerziel: {current.context.goal || "Unbekannt"}</p>
                    <p>Zielgruppe: {current.context.audience || "Unbekannt"}</p>
                    <p>
                      {current.context.tasks?.length ?? 0} Aufgaben im
                      Kontext-Snapshot · Vergleich:{" "}
                      {current.context.comparison?.scanId ?? "Ohne Vergleich"}
                    </p>
                    {current.context.omissions?.map((x, i) => (
                      <p key={i}>{x}</p>
                    ))}
                  </details>
                )}
                <progress
                  aria-label="Fortschritt der Seitenanalyse"
                  max={current.parts.length + 1}
                  value={
                    completed +
                    (current.stage === "done" && current.summary ? 1 : 0)
                  }
                />
                <p className="hint">
                  {current.stage === "summary"
                    ? "Teilinterpretationen werden zur Seitenzusammenfassung verbunden."
                    : running
                      ? "Lokale Verarbeitung läuft nacheinander. Du kannst den Bereich wechseln; die Auswertung bleibt gespeichert."
                      : "Historisch an diesen Scan und diese Seite gebunden. Nach einem neuen Check erneut analysieren."}
                </p>
                {running && (
                  <button
                    className="button secondary"
                    onClick={async () => {
                      try {
                        await post(`/api/page-analyses/${current.id}/cancel`);
                        setNotice(
                          "Abbruch angefordert. Vorhandene Teilantworten bleiben erhalten.",
                        );
                      } catch (err) {
                        setError(message(err));
                      }
                    }}
                  >
                    <Square size={15} />
                    Auswertung abbrechen
                  </button>
                )}
                <details>
                  <summary>Verarbeitete Teile und Identität</summary>
                  <p className="identity-hash">
                    Messkontext {current.sourceHash}
                  </p>
                  {current.parts.map((part) => (
                    <div key={part.id} className="analysis-part">
                      <strong>
                        {part.id}: {part.status}
                      </strong>
                      <p>
                        {part.unitIds.length} Datensätze ·{" "}
                        {part.findingIds.length} Befunde · {part.attempts ?? 1}{" "}
                        Versuch(e)
                      </p>
                      {part.error && <p>{part.error}</p>}
                      {part.provenance && (
                        <p className="identity-hash">
                          {part.provenance.promptVersion}
                          <br />
                          Modell{" "}
                          {part.provenance.modelDigest ??
                            "Gewichtsidentität unbekannt"}
                          <br />
                          Kontext {part.provenance.contextSha256}
                        </p>
                      )}
                    </div>
                  ))}
                </details>
              </section>
              {(current.omitted.length > 0 ||
                (!running && current.unexplainedFindingIds.length > 0) ||
                current.status === "partial") && (
                <section className="panel incomplete-context">
                  <h3>Diese Interpretation ist unvollständig</h3>
                  <p>
                    {current.omitted.length} ausgelassene Datensätze ·{" "}
                    {current.unexplainedFindingIds.length} Befunde ohne gültige
                    Lösungserklärung.
                  </p>
                  <ul>
                    {current.omitted.map((item) => (
                      <li key={item.unitId}>
                        {item.unitId}: {item.reason}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {["failed", "partial"].includes(current.status) && (
                <p className="notice">
                  Nicht jede Modellantwort konnte übernommen werden. Details
                  stehen unter „Verarbeitete Teile und Identität“. Ein anderes
                  geeignetes installiertes Modell kann helfen. Der regelbasierte
                  Bericht bleibt vollständig nutzbar.
                </p>
              )}
              {report && (
                <section className="panel canonical-observation">
                  <p className="small-label">
                    MESSFAKTEN · AUS DEM GESPEICHERTEN BERICHT
                  </p>
                  <h3>Belegter Stand dieser Seite</h3>
                  <p>
                    {pageFacts(report, url).findings.length} Befunde ·{" "}
                    {
                      pageFacts(report, url).rules.filter(
                        (r) => r.status === "not_run",
                      ).length
                    }{" "}
                    nicht ausgeführte Regeln.
                  </p>
                  {!pageFacts(report, url).valid && (
                    <Notice error>
                      Messvertrag unvollständig oder ungültig. Keine Freigabe;
                      Bericht erneut prüfen.
                    </Notice>
                  )}
                  <p>
                    Geräte:{" "}
                    {pageFacts(report, url)
                      .viewports.map(
                        (v) => `${v.id} (${v.width} × ${v.height})`,
                      )
                      .join(", ")}
                  </p>
                  <p className="hint">
                    Sachliche KI-Faktenprüfung: nicht durchgeführt · Menschliche
                    Freigabe: nicht erfasst.
                  </p>
                  <p className="hint">
                    Technische Fundstellen, Messwerte und Prüfergebnisse stehen
                    im Originalbericht. KI-Texte sind Lösungsvorschläge und
                    bestätigen keine Fakten oder Reparaturen.
                  </p>
                </section>
              )}
              {current.summary && (
                <section className="panel">
                  <p className="small-label">
                    KI-INTERPRETATION · KEINE FAKTENBESTÄTIGUNG
                  </p>
                  <h3>Was bedeutet das für diese Seite?</h3>
                  <p>{current.summary}</p>
                  {speechAvailable && settings.speechEnabled && (
                    <div className="toolbar">
                      <button
                        className="tiny-button"
                        onClick={() =>
                          void post("/api/speech", {
                            text: `Ungeprüfte KI-Zusammenfassung. ${current.summary}`,
                          }).catch((err) => setError(message(err)))
                        }
                      >
                        <Volume2 size={15} />
                        Vorlesen
                      </button>
                      <button
                        className="tiny-button"
                        onClick={() =>
                          void post("/api/speech/stop").catch((err) =>
                            setError(message(err)),
                          )
                        }
                      >
                        <VolumeX size={15} />
                        Stoppen
                      </button>
                    </div>
                  )}
                </section>
              )}
              {current.parts
                .filter((part) => part.status === "completed")
                .flatMap((part) =>
                  part.solutions.map((solution) => ({ part, solution })),
                )
                .map(({ part, solution }) => {
                  const finding = report.findings.find(
                    (item) => item.id === solution.findingId,
                  );
                  if (!finding) return null;
                  const evidence = report.evidence.find(
                    (item) => item.id === finding.evidenceId,
                  );
                  return (
                    <article
                      key={`${part.id}:${solution.findingId}`}
                      className="panel page-solution"
                    >
                      <div className="panel-head">
                        <h3>{finding.title}</h3>
                        <button
                          className="text-button"
                          onClick={() => onShowFinding(finding.id)}
                        >
                          Zum Befund
                        </button>
                      </div>
                      <div className="canonical-observation">
                        <span className="small-label">
                          {finding.evidenceStatus === "measured"
                            ? "GEMESSENER BEFUND"
                            : "PRÜFKANDIDAT"}{" "}
                          · {finding.viewportId} · {finding.state}
                        </span>
                        <p>{finding.detail}</p>
                        <code>
                          {finding.selector ??
                            "Kein verifizierter Elementselektor"}
                        </code>
                      </div>
                      <p className="hint">
                        Regelbasiertes Abnahmekriterium (zukünftiger Nachtest):{" "}
                        {finding.acceptance}
                      </p>
                      <p className="small-label">KI-EINORDNUNG · UNGEPRÜFT</p>
                      <p>{solution.explanation}</p>
                      {finding.elementContext && (
                        <details className="solution-references">
                          <summary>Gemessenen Elementkontext ansehen</summary>
                          <pre>
                            {JSON.stringify(finding.elementContext, null, 2)}
                          </pre>
                        </details>
                      )}
                      {solution.relevance && (
                        <>
                          <h4>Mögliche Relevanz</h4>
                          <p>{solution.relevance}</p>
                        </>
                      )}
                      {solution.evidenceRefs?.length ? (
                        <details className="solution-references">
                          <summary>
                            Belegverweise ansehen (
                            {solution.evidenceRefs.length})
                          </summary>
                          <p className="hint">
                            IDs stammen aus dem übergebenen Kontext. Das
                            bestätigt keine semantische Richtigkeit der
                            Erklärung.
                          </p>
                          {solution.evidenceRefs.map((id) => (
                            <div key={id}>
                              <code>{id}</code>
                              {current.sources?.find((s) => s.id === id)
                                ?.truncated && (
                                <p className="hint">
                                  Anzeige auf 1400 Zeichen gekürzt; der
                                  Modellkontext enthielt den vollständigen
                                  Datensatz innerhalb seines Budgets.
                                </p>
                              )}
                              <pre>
                                {current.sources?.find((s) => s.id === id)
                                  ?.excerpt ??
                                  "Historischer Referenzauszug nicht gespeichert."}
                              </pre>
                            </div>
                          ))}
                        </details>
                      ) : null}
                      <h4>Mögliche Ursache</h4>
                      <p>{solution.cause}</p>
                      <h4>Konkrete Lösungsschritte</h4>
                      <ol>
                        {solution.steps.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
                      {!!solution.alternatives?.length && (
                        <>
                          <h4>Alternativen abwägen</h4>
                          <ul>
                            {solution.alternatives.map((x, i) => (
                              <li key={i}>{x}</li>
                            ))}
                          </ul>
                        </>
                      )}
                      {!!solution.missingInformation?.length && (
                        <>
                          <h4>Noch zu klären</h4>
                          <ul>
                            {solution.missingInformation.map((x, i) => (
                              <li key={i}>{x}</li>
                            ))}
                          </ul>
                        </>
                      )}
                      {solution.code.text && (
                        <>
                          <div className="panel-head">
                            <h4>
                              Anpassungsbeispiel · {solution.code.language}
                            </h4>
                            <button
                              className="tiny-button"
                              onClick={() =>
                                void navigator.clipboard
                                  .writeText(solution.code.text)
                                  .then(() =>
                                    setNotice(
                                      "Codebeispiel kopiert. Vor Verwendung im Quellprojekt prüfen.",
                                    ),
                                  )
                                  .catch(() =>
                                    setError("Kopieren nicht verfügbar."),
                                  )
                              }
                            >
                              <Copy size={14} />
                              Code kopieren
                            </button>
                          </div>
                          <pre className="solution-code">
                            <code>{solution.code.text}</code>
                          </pre>
                          <p className="hint">
                            Kein verifizierter Projektpatch. Beispielselektoren
                            und Einbauort im Quellprojekt prüfen.
                          </p>
                        </>
                      )}
                      <div className="task-acceptance">
                        <strong>Vorgeschlagener Nachtest</strong>
                        {solution.acceptance}
                      </div>
                      <p className="hint">
                        Unsicherheit: {solution.uncertainty}
                      </p>
                      {evidence && (
                        <details>
                          <summary>Originalnachweis ansehen</summary>
                          <EvidenceView
                            evidence={evidence}
                            scanId={scan!.id}
                            findings={[finding]}
                          />
                        </details>
                      )}
                      <button
                        className="button secondary"
                        disabled={
                          !["completed", "partial"].includes(current.status)
                        }
                        onClick={async () => {
                          try {
                            const result = await post<{ duplicate: boolean }>(
                              `/api/page-analyses/${current.id}/adopt`,
                              { findingId: solution.findingId },
                            );
                            await onTasksChanged();
                            setNotice(
                              result.duplicate
                                ? "Dieser Vorschlag ist bereits an der bestehenden Maßnahme hinterlegt."
                                : "KI-Vorschlag an der bestehenden Maßnahme hinterlegt. Status: offen. Keine Behebung bestätigt.",
                            );
                          } catch (err) {
                            setError(message(err));
                          }
                        }}
                      >
                        <Sparkles size={15} />
                        Als Maßnahme übernehmen
                      </button>
                      <p className="hint">
                        Der Vorschlag bleibt ungeprüft. Eine vorhandene offene
                        Maßnahme wird ergänzt; es entsteht keine doppelte
                        Aufgabe.
                      </p>
                    </article>
                  );
                })}
              <div className="panel">
                <a
                  className="button primary"
                  href={`/api/page-analyses/${current.id}/export`}
                >
                  <Download size={16} />
                  Seitenanalyse als Markdown
                </a>
                <p className="hint">
                  Enthält Seitentexte und ungeprüfte Codebeispiele. Vor
                  Weitergabe prüfen; Exporte können private Inhalte enthalten.
                </p>
                {current.warnings.map((warning, i) => (
                  <p className="hint" key={i}>
                    {warning}
                  </p>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
