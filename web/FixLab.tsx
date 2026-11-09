import { useState } from "react";
import {
  LAB_PROPERTIES,
  type LabOperation,
  type LabResult,
} from "../shared/fix-lab.js";
import { VIEWPORTS } from "../shared/types.js";
import { message, post } from "./api.js";
import { Notice } from "./ui.js";

const example = `<style>
  body { margin: 16px; font: 16px system-ui; }
  #menu { width: 680px; padding: 16px; box-sizing: border-box; background: #e3daf3; }
</style>
<main><h1>Northstar Studio</h1><p><a href="#menu">Zur Navigation</a></p>
<nav id="menu"><button>Kontakt</button></nav></main>`;

export default function FixLab({
  projectId,
  disabled,
}: {
  projectId: string;
  disabled: boolean;
}) {
  const [html, setHtml] = useState("");
  const [target, setTarget] = useState("#menu");
  const [viewportId, setViewport] = useState("mobile");
  const [kind, setKind] = useState<"css" | "rename">("css");
  const [property, setProperty] =
    useState<(typeof LAB_PROPERTIES)[number]>("max-width");
  const [value, setValue] = useState("100%");
  const [acknowledged, setAcknowledged] = useState(false);
  const [result, setResult] = useState<LabResult>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const reset = () => {
    setResult(undefined);
    setError("");
  };
  return (
    <details className="panel workspace-form fix-lab">
      <summary>Fix-Labor · experimentell</summary>
      <p>
        Teste eine CSS-Idee an einer flüchtigen Kopie deines HTML-Ausschnitts.
        Seitenskripte und Netzwerk sind gesperrt. Skriptgesteuerte Zustände
        sowie externe Schriften, Bilder und Styles fehlen in dieser Vorschau.
      </p>
      <button
        className="button secondary"
        type="button"
        disabled={busy}
        onClick={() => {
          reset();
          setHtml(example);
          setTarget("#menu");
          setKind("css");
          setProperty("max-width");
          setValue("100%");
          setAcknowledged(false);
        }}
      >
        Lokales Beispiel laden
      </button>
      <fieldset disabled={busy}>
        <legend>HTML-Ausschnitt und Änderung</legend>
        <label htmlFor="lab-html">Lokaler HTML-Ausschnitt</label>
        <textarea
          id="lab-html"
          rows={6}
          maxLength={24576}
          value={html}
          onChange={(event) => {
            reset();
            setHtml(event.target.value);
            setAcknowledged(false);
          }}
        />
        <div className="scope-row">
          <div>
            <label htmlFor="lab-target">
              Eindeutiges Ziel (#ID oder .Klasse)
            </label>
            <input
              id="lab-target"
              value={target}
              onChange={(event) => {
                reset();
                setTarget(event.target.value);
              }}
            />
          </div>
          <div>
            <label htmlFor="lab-viewport">Geräteprofil</label>
            <select
              id="lab-viewport"
              value={viewportId}
              onChange={(event) => {
                reset();
                setViewport(event.target.value);
              }}
            >
              {VIEWPORTS.map((viewport) => (
                <option key={viewport.id} value={viewport.id}>
                  {viewport.id} · {viewport.width} × {viewport.height}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="lab-kind">Änderung</label>
            <select
              id="lab-kind"
              value={kind}
              onChange={(event) => {
                reset();
                setKind(event.target.value === "rename" ? "rename" : "css");
                setValue("");
              }}
            >
              <option value="css">CSS-Eigenschaft setzen</option>
              <option value="rename">ID oder Klasse umbenennen</option>
            </select>
          </div>
          {kind === "css" && (
            <div>
              <label htmlFor="lab-property">CSS-Eigenschaft</label>
              <select
                id="lab-property"
                value={property}
                onChange={(event) => {
                  reset();
                  setProperty(event.target.value as typeof property);
                  setValue("");
                }}
              >
                {LAB_PROPERTIES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <label htmlFor="lab-value">
          {kind === "css"
            ? "CSS-Wert (z. B. 100%)"
            : "Neuer Name ohne # oder Punkt"}
        </label>
        <input
          id="lab-value"
          value={value}
          maxLength={64}
          onChange={(event) => {
            reset();
            setValue(event.target.value);
          }}
        />
        <label className="checklist-field">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => {
              reset();
              setAcknowledged(event.target.checked);
            }}
          />
          Diesen Ausschnitt einmalig lokal prüfen.
        </label>
      </fieldset>
      <div className="button-row">
        <button
          type="button"
          className="button primary"
          disabled={
            disabled ||
            busy ||
            !acknowledged ||
            !html.trim() ||
            !target.trim() ||
            !value.trim()
          }
          onClick={async () => {
            reset();
            setBusy(true);
            try {
              const operation: LabOperation =
                kind === "css"
                  ? { type: "css", property, value: value.trim() }
                  : { type: "rename", value: value.trim() };
              setResult(
                await post<LabResult>(
                  `/api/projects/${encodeURIComponent(projectId)}/fix-lab`,
                  {
                    html,
                    target: target.trim(),
                    viewportId,
                    operation,
                    acknowledged,
                  },
                ),
              );
            } catch (err) {
              setError(message(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy
            ? "Vorschau wird gemessen …"
            : "Original und Änderung vergleichen"}
        </button>
        {result && (
          <button type="button" className="button secondary" onClick={reset}>
            Vorschau zurücksetzen
          </button>
        )}
      </div>
      {error && <Notice error>{error}</Notice>}
      {result && (
        <section aria-label="Fix-Labor-Ergebnis">
          <h3>Temporäre Vorschau geprüft</h3>
          <p>
            Für eine Bestätigung am echten Projekt braucht es nach der
            Quelländerung einen kompatiblen Nachtest.
          </p>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Messwert</th>
                  <th>Original</th>
                  <th>Änderung</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th>Horizontaler Überlauf</th>
                  <td>{result.before.documentOverflow} px</td>
                  <td>{result.after.documentOverflow} px</td>
                </tr>
                <tr>
                  <th>Zielbreite</th>
                  <td>{result.before.targetWidth} px</td>
                  <td>{result.after.targetWidth} px</td>
                </tr>
                <tr>
                  <th>Ziel außerhalb der Breite</th>
                  <td>{result.before.targetOutside ? "Ja" : "Nein"}</td>
                  <td>{result.after.targetOutside ? "Ja" : "Nein"}</td>
                </tr>
                <tr>
                  <th>Ziel im horizontalen Sichtbereich</th>
                  <td>{result.before.targetVisible ? "Ja" : "Nein"}</td>
                  <td>{result.after.targetVisible ? "Ja" : "Nein"}</td>
                </tr>
                <tr>
                  <th>
                    Gerenderte Bedienelemente im horizontalen Sichtbereich
                  </th>
                  <td>{result.before.visibleControls}</td>
                  <td>{result.after.visibleControls}</td>
                </tr>
                <tr>
                  <th>Interne Anker ohne Ziel</th>
                  <td>{result.before.unresolvedAnchors}</td>
                  <td>{result.after.unresolvedAnchors}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="scope-row">
            <figure>
              <img
                alt="Original im Fix-Labor"
                src={`data:image/jpeg;base64,${result.originalImage}`}
              />
              <figcaption>Original</figcaption>
            </figure>
            <figure>
              <img
                alt="Temporär geänderter HTML-Ausschnitt"
                src={`data:image/jpeg;base64,${result.changedImage}`}
              />
              <figcaption>Temporäre Änderung</figcaption>
            </figure>
          </div>
        </section>
      )}
    </details>
  );
}
