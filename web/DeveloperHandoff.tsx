import { useContext } from "react";
import { WorkspaceReadiness } from "./workspace-state.js";
import { useState, type ReactNode } from "react";
import type { Scan } from "../shared/types.js";
import type { SourcePreview } from "../server/services/developer-handoff.js";
import { post, message } from "./api.js";
import { Dialog, Notice } from "./ui.js";
export default function DeveloperHandoff({
  scan,
  findingIds,
  onClose,
  inline = false,
}: {
  inline?: boolean;
  scan: Scan;
  findingIds: string[];
  onClose: () => void;
}) {
  const readiness = useContext(WorkspaceReadiness);
  const findings =
    scan.result?.audit?.findings.filter((f) => findingIds.includes(f.id)) ?? [];
  const [selected, setSelected] = useState(
      findings.slice(0, 20).map((f) => f.id),
    ),
    [root, setRoot] = useState(""),
    [ack, setAck] = useState(false),
    [preview, setPreview] = useState<SourcePreview>(),
    [sources, setSources] = useState<number[]>([]),
    [markdown, setMarkdown] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const action = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  const Wrapper = inline ? InlineHandoff : Dialog;
  return (
    <Wrapper
      title="Gezieltes Entwickler-Arbeitspaket"
      onClose={onClose}
      busy={busy}
    >
      <div className="workspace-form">
        <p>
          Nur ausgewählte Befunde, beobachtete Fundstellen und reproduzierbare
          Abnahmetests. Kein automatischer Patch, Commit oder Upload.
        </p>
        {error && <Notice error>{error}</Notice>}
        <fieldset>
          <legend>Befunde auswählen · {selected.length}/20</legend>
          {findings.map((f) => (
            <label key={f.id}>
              <input
                type="checkbox"
                checked={selected.includes(f.id)}
                disabled={
                  busy || (!selected.includes(f.id) && selected.length >= 20)
                }
                onChange={(e) => {
                  setSelected(
                    e.target.checked
                      ? [...selected, f.id]
                      : selected.filter((id) => id !== f.id),
                  );
                  setPreview(undefined);
                  setSources([]);
                  setMarkdown("");
                }}
              />
              {f.title} · {f.viewportId} · {f.state}
            </label>
          ))}
        </fieldset>
        <details>
          <summary>Optional: Quellordner nur lesend prüfen</summary>
          <p className="hint">
            Git-Projektstamm, nicht ignorierte HTML/JSX/TSX/Vue/Svelte-Dateien.
            Keine Ausführung von Projektcode. Sensible Dateinamen, versteckte
            Pfade und Symlinks werden ausgeschlossen. Quelltext kann trotzdem
            Geheimnisse enthalten: Vorschau vor Export prüfen.
          </p>
          <label htmlFor="source-root">Lokaler Git-Quellordner</label>
          <input
            id="source-root"
            value={root}
            onChange={(e) => {
              setRoot(e.target.value);
              setAck(false);
              setPreview(undefined);
              setSources([]);
              setMarkdown("");
            }}
            placeholder="/pfad/zum/projekt"
          />
          <label>
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => {
                setAck(e.target.checked);
                setPreview(undefined);
                setSources([]);
                setMarkdown("");
              }}
            />{" "}
            Diesen Ordner und die ausgewählten Befunde nur lesend für eine
            lokale Vorschau freigeben.
          </label>
          <button
            className="button secondary"
            disabled={
              busy ||
              !ack ||
              !root ||
              !selected.length ||
              (!!readiness && !readiness.allowed.startExclusive)
            }
            onClick={() =>
              void action(async () => {
                setPreview(
                  await post<SourcePreview>(
                    `/api/scans/${scan.id}/source-preview`,
                    { root, acknowledged: ack, findingIds: selected },
                  ),
                );
                setSources([]);
                setMarkdown("");
              })
            }
          >
            Quelltreffer lokal anzeigen
          </button>
          {preview && (
            <>
              <p>{preview.notice}</p>
              <p className="hint">
                {preview.filesRead} Dateien · {preview.bytesRead} Bytes gelesen
                · {preview.candidates.length} Kandidaten. Ordner wird nicht
                gespeichert.
              </p>
              {preview.omissions.map((o) => (
                <Notice key={o}>{o}</Notice>
              ))}
              {!preview.candidates.length && (
                <p>
                  Keine wörtliche Zuordnung gefunden. Das Arbeitspaket bleibt
                  ohne Dateibehauptung.
                </p>
              )}
              {preview.candidates.map((c, i) => (
                <article
                  className="plan-note"
                  key={`${c.path}:${c.line}:${c.selector}`}
                >
                  <label>
                    <input
                      type="checkbox"
                      checked={sources.includes(i)}
                      disabled={
                        busy || (!sources.includes(i) && sources.length >= 20)
                      }
                      onChange={(e) => {
                        setSources(
                          e.target.checked
                            ? [...sources, i]
                            : sources.filter((n) => n !== i),
                        );
                        setMarkdown("");
                      }}
                    />{" "}
                    Diesen unbestätigten Treffer ins Arbeitspaket aufnehmen
                  </label>
                  <p>
                    {c.path}:{c.line} · {c.selector}
                  </p>
                  <pre className="export-preview">{c.excerpt}</pre>
                </article>
              ))}
            </>
          )}
        </details>
        <button
          className="button primary"
          disabled={
            busy ||
            !selected.length ||
            (!!readiness && !readiness.allowed.startExclusive)
          }
          onClick={() =>
            void action(async () => {
              const r = await post<{ markdown: string }>(
                `/api/scans/${scan.id}/handoff`,
                {
                  findingIds: selected,
                  ...(sources.length && preview
                    ? {
                        includeSource: true,
                        root,
                        acknowledged: ack,
                        sourceSelection: sources.map(
                          (i) => preview.candidates[i],
                        ),
                      }
                    : {}),
                },
              );
              setMarkdown(r.markdown);
            })
          }
        >
          {busy ? "Prüfe …" : "Arbeitspaket als Vorschau erstellen"}
        </button>
        {markdown && (
          <>
            <p>
              Inhalte und eventuelle Quellvorschauen vor Weitergabe prüfen.
              Query/Fragment der URL fehlen im Export bewusst; der lokale
              Originalcheck bleibt maßgeblich.
            </p>
            <pre className="export-preview" aria-label="Arbeitspaket Vorschau">
              {markdown}
            </pre>
            <a
              className="button secondary"
              href={`data:text/markdown;charset=utf-8,${encodeURIComponent(markdown)}`}
              download="sitefenn-work-package.md"
            >
              Markdown herunterladen
            </a>
          </>
        )}
      </div>
    </Wrapper>
  );
}

function InlineHandoff({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  return (
    <section className="panel inline-handoff">
      <div className="panel-head">
        <h3>{title}</h3>
        <button className="text-button" onClick={onClose}>
          Zum Nachweis
        </button>
      </div>
      {children}
    </section>
  );
}
