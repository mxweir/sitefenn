import { useEffect, useRef, useState } from "react";
import type {
  Evidence,
  Rect,
  Scan,
  VisualDiff,
  VisualMask,
  VisualPair,
  VisualReference,
} from "../shared/types.js";
import { api, message, post, stamp } from "./api.js";
import { Notice } from "./ui.js";
export default function VisualCompare({
  scans,
  projectId,
}: {
  scans: Scan[];
  projectId: string;
}) {
  const complete = scans.filter((s) => s.status === "completed" && s.result);
  const [references, setReferences] = useState<VisualReference[]>([]),
    [referenceId, setReferenceId] = useState("");
  const [before, setBefore] = useState(
      complete[1]?.id ?? complete[0]?.id ?? "",
    ),
    [after, setAfter] = useState(complete[0]?.id ?? "");
  const [pairs, setPairs] = useState<VisualPair[]>([]),
    [evidenceId, setEvidenceId] = useState("");
  const [masks, setMasks] = useState<VisualMask[]>([]),
    [diff, setDiff] = useState<VisualDiff | null>(null);
  const [mode, setMode] = useState("side"),
    [wipe, setWipe] = useState(50),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [confirmed, setConfirmed] = useState(false);
  const [rect, setRect] = useState<Rect>({
      x: 0,
      y: 0,
      width: 100,
      height: 50,
    }),
    [drawing, setDrawing] = useState<Rect | null>(null);
  const [sourceEvidence, setSourceEvidence] = useState<Evidence[]>([]),
    [previewId, setPreviewId] = useState("");
  useEffect(() => {
    let disposed = false;
    setSourceEvidence([]);
    if (before)
      api<{ scan: Scan }>(`/api/scans/${before}`)
        .then((result) => {
          if (disposed) return;
          const evidence = result.scan.result?.audit?.evidence ?? [];
          setSourceEvidence(evidence);
          setPreviewId(evidence[0]?.id ?? "");
        })
        .catch((err) => {
          if (!disposed) setError(message(err));
        });
    return () => {
      disposed = true;
    };
  }, [before]);
  const start = useRef<{ x: number; y: number } | null>(null);
  const current = pairs.find((p) => p.before.id === evidenceId),
    source = complete.find((s) => s.id === before);
  useEffect(() => {
    let disposed = false;
    api<{ references: VisualReference[] }>(
      `/api/projects/${projectId}/visual-references`,
    )
      .then((result) => {
        if (disposed) return;
        setReferences(result.references);
        const r = result.references[0];
        if (r) {
          setReferenceId(r.id);
          setBefore(r.scanId);
          setMasks(r.masks);
        }
      })
      .catch((err) => {
        if (!disposed) setError(message(err));
      });
    return () => {
      disposed = true;
    };
  }, [projectId]);
  useEffect(() => {
    setPairs([]);
    setEvidenceId("");
    setDiff(null);
    setConfirmed(false);
    setNotice("");
  }, [before, after]);
  useEffect(() => {
    setDiff(null);
    setDrawing(null);
  }, [evidenceId, masks]);
  const image = (scanId: string, id: string) =>
    `/api/scans/${scanId}/evidence/${id}`;
  const selectBefore = (id: string) => {
    setBefore(id);
    setReferenceId("");
    setMasks([]);
  };
  const add = (r: Rect) => {
    if (!current || busy) return;
    const value = {
      x: Math.round(r.x),
      y: Math.round(r.y),
      width: Math.round(r.width),
      height: Math.round(r.height),
    };
    if (
      value.width < 1 ||
      value.height < 1 ||
      value.x < 0 ||
      value.y < 0 ||
      value.x + value.width > current.before.width ||
      value.y + value.height > current.before.height
    ) {
      setError("Maske liegt außerhalb der Aufnahme.");
      return;
    }
    if (masks.length >= 30) {
      setError("Maximal 30 Masken pro Referenz.");
      return;
    }
    setMasks([...masks, { evidenceId, rect: value }]);
    setDiff(null);
    setConfirmed(false);
    setNotice(
      "Maske geändert. Für künftige Vergleiche als neue Referenzfreigabe speichern.",
    );
  };
  const approve = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await post<{ reference: VisualReference }>(
        `/api/projects/${projectId}/visual-references`,
        { scanId: before, masks, confirmed },
      );
      setReferences([result.reference, ...references]);
      setReferenceId(result.reference.id);
      setConfirmed(false);
      setNotice(
        "Neue Referenzfreigabe gespeichert. Regelbefunde und Aufgaben wurden nicht verändert.",
      );
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      className="panel visual-workspace"
      aria-label="Visueller Vorher-Nachher-Vergleich"
    >
      <p className="eyebrow">BILDER VERGLEICHEN. ÄNDERUNGEN VERSTEHEN.</p>
      <h2>Visueller Vorher-/Nachher-Vergleich</h2>
      <p>
        Referenzen sind ausdrücklich freigegebene Aufnahmen. Eine Designänderung
        ist kein Beweis für einen Fehler oder dessen Behebung.
      </p>
      {error && <Notice error>{error}</Notice>}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <div className="scope-row">
        <label>
          Gespeicherte Referenz
          <select
            disabled={busy}
            aria-label="Gespeicherte visuelle Referenz"
            value={referenceId}
            onChange={(e) => {
              const r = references.find((r) => r.id === e.target.value);
              setReferenceId(r?.id ?? "");
              setMasks(r?.masks ?? []);
              if (r) setBefore(r.scanId);
            }}
          >
            <option value="">Eigene Auswahl / neue Freigabe</option>
            {references.map((r) => (
              <option key={r.id} value={r.id}>
                {stamp(r.approvedAt)} · {r.scanId.slice(0, 8)} ·{" "}
                {r.masks.length} Masken
              </option>
            ))}
          </select>
        </label>
        <label>
          Vorher
          <select
            disabled={busy}
            aria-label="Visueller Ausgangscheck"
            value={before}
            onChange={(e) => selectBefore(e.target.value)}
          >
            {complete.map((s) => (
              <option key={s.id} value={s.id}>
                {stamp(s.createdAt)} · {s.id.slice(0, 8)}
                {s.options?.retest ? " · Teilnachtest" : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          Nachher
          <select
            disabled={busy}
            aria-label="Visueller Nachher-Check"
            value={after}
            onChange={(e) => setAfter(e.target.value)}
          >
            {complete.map((s) => (
              <option key={s.id} value={s.id}>
                {stamp(s.createdAt)} · {s.id.slice(0, 8)}
                {s.options?.retest ? " · Teilnachtest" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="toolbar">
        <button
          className="button primary"
          disabled={busy || !before || !after || before === after}
          onClick={async () => {
            setBusy(true);
            setError("");
            setDiff(null);
            try {
              const result = await api<{ pairs: VisualPair[] }>(
                `/api/visual-pairs?before=${encodeURIComponent(before)}&after=${encodeURIComponent(after)}`,
              );
              setPairs(result.pairs);
              setEvidenceId(result.pairs[0]?.before.id ?? "");
            } catch (err) {
              setError(message(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          Bildpaare laden
        </button>
      </div>
      {pairs.length > 0 && (
        <>
          <label>
            Seite / Gerät / Zustand
            <select
              disabled={busy}
              aria-label="Bildpaar auswählen"
              value={evidenceId}
              onChange={(e) => setEvidenceId(e.target.value)}
            >
              {pairs.map((p) => (
                <option key={p.before.id} value={p.before.id}>
                  {p.before.pageUrl} · {p.before.viewportId} · {p.before.state}
                  {p.comparable ? "" : " · eingeschränkt"}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      {current && (
        <>
          <p className="plan-note">
            <strong>
              {current.comparable
                ? "Vergleichbare Aufnahmebedingungen"
                : "Nur nebeneinander ansehen · kein Pixelwert"}
            </strong>
            <br />
            {current.reason}
          </p>
          <details>
            <summary>Aufnahmebedingungen ansehen</summary>
            <p>
              {current.before.width} × {current.before.height} · Scroll{" "}
              {current.before.scrollX}/{current.before.scrollY} · Aufnahme{" "}
              {stamp(current.before.capturedAt)}
            </p>
            <pre className="visual-conditions">
              {JSON.stringify(
                {
                  vorher: current.before.capture ?? "Unbekannt",
                  nachher: current.after?.capture ?? "Unbekannt",
                },
                null,
                2,
              )}
            </pre>
          </details>
          <div className="toolbar">
            <label>
              Ansicht
              <select
                aria-label="Bildvergleich Ansicht"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
              >
                <option value="side">Nebeneinander</option>
                <option value="wipe">Wischregler</option>
                <option value="diff">Änderungsbereiche</option>
              </select>
            </label>
            <button
              className="button secondary"
              disabled={busy || !current.comparable}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const result = await post<{ diff: VisualDiff }>(
                    "/api/visual-diff",
                    {
                      beforeId: before,
                      afterId: after,
                      evidenceId,
                      masks: masks.filter((m) => m.evidenceId === evidenceId),
                    },
                  );
                  setDiff(result.diff);
                  setMode("diff");
                } catch (err) {
                  setError(message(err));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Wird berechnet …" : "Pixeländerungen berechnen"}
            </button>
          </div>
          {mode === "wipe" && current.after && (
            <label>
              Vorher-Anteil: {wipe}%
              <input
                aria-label="Vorher-Nachher Wischregler"
                type="range"
                min={0}
                max={100}
                value={wipe}
                onChange={(e) => setWipe(Number(e.target.value))}
              />
            </label>
          )}
          <div
            className={mode === "side" ? "visual-images side" : "visual-images"}
          >
            <div
              className="visual-capture"
              data-label={
                mode === "diff" && diff
                  ? "Änderungsbild"
                  : mode === "wipe"
                    ? "Wischvergleich"
                    : "Vorher"
              }
              onPointerDown={(event) => {
                if (mode !== "side") return;
                const b = event.currentTarget.getBoundingClientRect();
                start.current = {
                  x:
                    ((event.clientX - b.left) * current.before.width) / b.width,
                  y:
                    ((event.clientY - b.top) * current.before.height) /
                    b.height,
                };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                if (!start.current) return;
                const b = event.currentTarget.getBoundingClientRect(),
                  x = Math.max(
                    0,
                    Math.min(
                      current.before.width,
                      ((event.clientX - b.left) * current.before.width) /
                        b.width,
                    ),
                  ),
                  y = Math.max(
                    0,
                    Math.min(
                      current.before.height,
                      ((event.clientY - b.top) * current.before.height) /
                        b.height,
                    ),
                  );
                setDrawing({
                  x: Math.min(x, start.current.x),
                  y: Math.min(y, start.current.y),
                  width: Math.abs(x - start.current.x),
                  height: Math.abs(y - start.current.y),
                });
              }}
              onPointerUp={() => {
                if (drawing) add(drawing);
                start.current = null;
                setDrawing(null);
              }}
              onPointerCancel={() => {
                start.current = null;
                setDrawing(null);
              }}
            >
              {mode === "diff" && diff ? (
                <img
                  src={diff.image}
                  alt="Pixeländerungen pink, Masken grau, unveränderte Bereiche in Graustufen"
                />
              ) : (
                <>
                  <img
                    src={
                      current.after && mode === "wipe"
                        ? image(after, current.after.id)
                        : image(before, evidenceId)
                    }
                    alt="Gespeicherte Aufnahme vorher"
                    draggable={false}
                  />
                  {mode === "wipe" && current.after && (
                    <img
                      className="visual-wipe"
                      style={{ clipPath: `inset(0 ${100 - wipe}% 0 0)` }}
                      src={image(before, evidenceId)}
                      alt="Vorher-Aufnahme im Wischvergleich"
                      draggable={false}
                    />
                  )}
                </>
              )}
              {(mode === "diff" && diff ? diff.regions : []).map((r, i) => (
                <span
                  key={`region-${i}`}
                  className="visual-region"
                  style={{
                    left: `${(r.x / current.before.width) * 100}%`,
                    top: `${(r.y / current.before.height) * 100}%`,
                    width: `${(r.width / current.before.width) * 100}%`,
                    height: `${(r.height / current.before.height) * 100}%`,
                  }}
                />
              ))}
              {[
                ...masks
                  .filter((m) => m.evidenceId === evidenceId)
                  .map((m) => m.rect),
                ...(drawing ? [drawing] : []),
              ].map((r, i) => (
                <span
                  key={i}
                  className="visual-mask"
                  style={{
                    left: `${(r.x / current.before.width) * 100}%`,
                    top: `${(r.y / current.before.height) * 100}%`,
                    width: `${(r.width / current.before.width) * 100}%`,
                    height: `${(r.height / current.before.height) * 100}%`,
                  }}
                />
              ))}
            </div>
            {mode === "side" &&
              (current.after ? (
                <div className="visual-capture" data-label="Nachher">
                  <img
                    src={image(after, current.after.id)}
                    alt="Gespeicherte Aufnahme nachher"
                  />
                </div>
              ) : (
                <p>Keine erneute Aufnahme für diesen Zustand vorhanden.</p>
              ))}
          </div>
          {mode === "diff" && !diff && (
            <p>Für vergleichbare Aufnahmen zuerst Pixeländerungen berechnen.</p>
          )}
          {diff && (
            <div className="plan-note" role="status">
              <strong>
                {diff.changedPercent.toFixed(2)} % der unmaskierten Pixel
                geändert
              </strong>
              <p>
                {diff.changedPixels.toLocaleString("de-DE")} /{" "}
                {diff.comparedPixels.toLocaleString("de-DE")} verglichene Pixel
                · {diff.maskedPixels.toLocaleString("de-DE")} maskiert ·
                Kanaltoleranz {diff.threshold}/255. Bis zu 50 zusammenhängende
                Kachelregionen markiert; keine DOM- oder Fehlererkennung.
              </p>
              <a href={diff.image} download="sitefenn-pixelvergleich.png">
                Änderungsbild herunterladen
              </a>
            </div>
          )}
          <details className="mask-editor">
            <summary>Dynamische Bereiche maskieren</summary>
            <p>
              Im Vorher-Bild der Ansicht „Nebeneinander“ ziehen oder ein
              Rechteck in Originalpixeln eingeben. Masken gelten für beide
              Bilder dieses Zustands, nur für den Bildvergleich. Regelbefunde
              bleiben erhalten.
            </p>
            <div className="mask-fields">
              {(["x", "y", "width", "height"] as const).map((key) => (
                <label key={key}>
                  {{ x: "X", y: "Y", width: "Breite", height: "Höhe" }[key]}
                  <input
                    aria-label={`Maske ${key}`}
                    type="number"
                    min={key === "x" || key === "y" ? 0 : 1}
                    value={rect[key]}
                    onChange={(e) =>
                      setRect({ ...rect, [key]: Number(e.target.value) })
                    }
                  />
                </label>
              ))}
              <button className="button secondary" onClick={() => add(rect)}>
                Maske hinzufügen
              </button>
            </div>
            <ul>
              {masks.map((m, i) => (
                <li key={i}>
                  {m.evidenceId === evidenceId
                    ? "Diese Aufnahme"
                    : "Andere Aufnahme"}
                  : {m.rect.x}/{m.rect.y} · {m.rect.width} × {m.rect.height}{" "}
                  <button
                    className="text-button"
                    onClick={() => {
                      setMasks(masks.filter((_, index) => index !== i));
                      setConfirmed(false);
                    }}
                  >
                    Maske entfernen
                  </button>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
      <div className="reference-approval">
        {sourceEvidence.length > 0 && (
          <details>
            <summary>Ausgangsaufnahmen vor Freigabe ansehen</summary>
            <select
              aria-label="Referenzaufnahme ansehen"
              value={previewId}
              onChange={(e) => setPreviewId(e.target.value)}
            >
              {sourceEvidence.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.pageUrl} · {item.viewportId} · {item.state}
                </option>
              ))}
            </select>
            <img
              className="reference-preview"
              src={image(before, previewId)}
              alt="Originalaufnahme des gewählten Ausgangschecks"
            />
          </details>
        )}

        <h3>Eine Referenz bewusst freigeben</h3>
        <p>
          Speichert den Ausgangscheck und die aktuell gewählten Masken als neue
          Freigabe. Frühere Freigaben bleiben erhalten. Auch ein freigegebenes
          Design kann Regelbefunde enthalten.
        </p>
        <label className="consent-row">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          Ich habe die Aufnahmen und Masken geprüft. Diese Freigabe bestätigt
          keine Fehlerbehebung.
        </label>
        <button
          className="button secondary"
          disabled={
            !confirmed ||
            busy ||
            !source ||
            !sourceEvidence.length ||
            !!source.options?.retest
          }
          onClick={() => void approve()}
        >
          Ausgangscheck als Referenz freigeben
        </button>
        {source?.options?.retest && (
          <p>Für eine Projektreferenz einen vollständigen Check wählen.</p>
        )}
      </div>
    </section>
  );
}
