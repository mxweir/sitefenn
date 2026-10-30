import type { Journey, JourneyStep } from "../shared/types.js";
import { stepLabel } from "../shared/journeys.js";
export default function JourneyBuilder({
  journeys,
  onChange,
  pages,
  devices,
  disabled,
}: {
  journeys: Journey[];
  onChange: (j: Journey[]) => void;
  pages: string[];
  devices: string[];
  disabled: boolean;
}) {
  const update = (index: number, patch: Partial<Journey>) =>
    onChange(
      journeys.map((j, i) =>
        i === index
          ? { ...j, ...patch, confirmed: patch.confirmed ?? false }
          : j,
      ),
    );
  const blank = (): JourneyStep => ({
    action: "click",
    selector: "",
    expect: { selector: "", condition: "visible" },
  });
  const count = journeys.reduce(
    (n, j) => n + j.steps.length * j.viewportIds.length,
    0,
  );
  return (
    <section
      className="journey-builder"
      aria-label="Freigegebene Seitenabläufe"
    >
      <div className="panel-head">
        <div>
          <p className="eyebrow">AUCH DEN GEÖFFNETEN ZUSTAND PRÜFEN</p>
          <h3>Seitenabläufe</h3>
          <p>
            Menü, Akkordeon oder Dialog bewusst öffnen. Jeder Schritt nennt
            vorher sein erwartetes Ergebnis.
          </p>
        </div>
        <span className="pill">Optional · {count}/18 Zustände</span>
      </div>
      <p className="hint">
        Bis zu 3 Abläufe mit je 5 Schritten. Einfache Selektoren: #id,
        [data-testid="…"] oder [aria-label="…"]. Unterstützt werden native
        button type="button" mit aria-controls und Aufklapp-/Dialog-Semantik
        sowie details/summary. Keine Formulare, Links, Anmeldung oder
        Bestellungen. Die Website muss dir gehören oder freigegeben sein; eigene
        Klick-Handler können trotzdem Seiteneffekte haben.
      </p>
      <fieldset disabled={disabled} className="journey-fields">
        {journeys.map((j, index) => (
          <article className="journey-editor" key={j.id}>
            <div className="panel-head">
              <strong>Ablauf {index + 1}</strong>
              <button
                type="button"
                className="text-button"
                onClick={() => onChange(journeys.filter((_, i) => i !== index))}
              >
                Ablauf entfernen
              </button>
            </div>
            <div className="scope-row">
              <label>
                Name
                <input
                  aria-label={`Ablauf ${index + 1} Name`}
                  value={j.name}
                  maxLength={80}
                  onChange={(e) => update(index, { name: e.target.value })}
                />
              </label>
              <label>
                Startseite
                <select
                  aria-label={`Ablauf ${index + 1} Startseite`}
                  value={j.pageUrl}
                  onChange={(e) => update(index, { pageUrl: e.target.value })}
                >
                  {!pages.includes(j.pageUrl) && (
                    <option value={j.pageUrl} disabled>
                      Nicht im Check ausgewählt: {j.pageUrl}
                    </option>
                  )}
                  {pages.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="journey-devices">
              {[...new Set([...devices, ...j.viewportIds])].map((d) => (
                <label key={d}>
                  <input
                    type="checkbox"
                    checked={j.viewportIds.includes(d)}
                    onChange={(e) =>
                      update(index, {
                        viewportIds: e.target.checked
                          ? [...j.viewportIds, d]
                          : j.viewportIds.filter((v) => v !== d),
                      })
                    }
                  />
                  {d}
                  {!devices.includes(d) ? " (nicht im Check ausgewählt)" : ""}
                </label>
              ))}
            </div>
            {j.steps.map((step, i) => {
              const edit = (patch: Partial<JourneyStep>) =>
                update(index, {
                  steps: j.steps.map((s, n) =>
                    n === i ? { ...s, ...patch } : s,
                  ),
                });
              return (
                <div className="journey-step-editor" key={i}>
                  <div className="panel-head">
                    <strong>Schritt {i + 1}</strong>
                    <button
                      type="button"
                      className="text-button"
                      disabled={j.steps.length === 1}
                      onClick={() =>
                        update(index, {
                          steps: j.steps.filter((_, n) => n !== i),
                        })
                      }
                    >
                      Schritt entfernen
                    </button>
                  </div>
                  <div className="scope-row">
                    <label>
                      Aktion
                      <select
                        aria-label={`Ablauf ${index + 1} Schritt ${i + 1} Aktion`}
                        value={step.action}
                        onChange={(e) =>
                          edit(
                            e.target.value === "click"
                              ? { action: "click", selector: "", y: undefined }
                              : { action: "scroll", selector: undefined, y: 0 },
                          )
                        }
                      >
                        <option value="click">UI-Schalter betätigen</option>
                        <option value="scroll">Auf Position scrollen</option>
                      </select>
                    </label>
                    {step.action === "click" ? (
                      <label>
                        Schalter-Selektor
                        <input
                          aria-label={`Ablauf ${index + 1} Schritt ${i + 1} Schalter`}
                          placeholder="#menu-toggle"
                          value={step.selector ?? ""}
                          onChange={(e) => edit({ selector: e.target.value })}
                        />
                      </label>
                    ) : (
                      <label>
                        Vertikale Position (px)
                        <input
                          aria-label={`Ablauf ${index + 1} Schritt ${i + 1} Scrollposition`}
                          type="number"
                          min={0}
                          max={10000}
                          value={step.y ?? 0}
                          onChange={(e) => edit({ y: Number(e.target.value) })}
                        />
                      </label>
                    )}
                  </div>
                  <div className="scope-row">
                    <label>
                      Erwartetes Zielelement
                      <input
                        aria-label={`Ablauf ${index + 1} Schritt ${i + 1} Erwartungsziel`}
                        placeholder="#mobile-menu"
                        value={step.expect.selector}
                        onChange={(e) =>
                          edit({
                            expect: {
                              ...step.expect,
                              selector: e.target.value,
                            },
                          })
                        }
                      />
                    </label>
                    <label>
                      Erwarteter Zustand
                      <select
                        aria-label={`Ablauf ${index + 1} Schritt ${i + 1} Erwartung`}
                        value={step.expect.condition}
                        onChange={(e) =>
                          edit({
                            expect: {
                              ...step.expect,
                              condition: e.target
                                .value as JourneyStep["expect"]["condition"],
                            },
                          })
                        }
                      >
                        <option value="visible">Eingeblendet</option>
                        <option value="hidden">Ausgeblendet</option>
                        <option value="open">details/dialog offen</option>
                        <option value="closed">
                          details/dialog geschlossen
                        </option>
                      </select>
                    </label>
                  </div>
                </div>
              );
            })}
            <button
              type="button"
              className="button secondary"
              disabled={j.steps.length >= 5}
              onClick={() => update(index, { steps: [...j.steps, blank()] })}
            >
              Schritt hinzufügen
            </button>
            <div className="journey-preview">
              <strong>Vorschau · {j.name || "Unbenannter Ablauf"}</strong>
              <p>
                {j.pageUrl} ·{" "}
                {j.viewportIds.join(", ") || "Kein Gerät ausgewählt"}
              </p>
              <ol>
                {j.steps.map((s, i) => (
                  <li key={i}>{stepLabel(s)}</li>
                ))}
              </ol>
              <p>
                Frischer Seitenstart; Abbruch bei fehlendem Ziel, gesperrter
                Anfrage, unerwarteter Navigation, unerfüllter Erwartung oder
                Zeitlimit. Ausführung maximal 30 s je Ablauf, Startnavigation
                separat begrenzt. Vorher-/Nachher-Bilder bleiben lokal.
              </p>
            </div>
            <label className="check-option">
              <input
                type="checkbox"
                aria-label={`Ablauf ${index + 1} ausdrücklich freigeben`}
                checked={j.confirmed}
                onChange={(e) => update(index, { confirmed: e.target.checked })}
              />
              <span>
                Ich habe diese Schritte und Ziele geprüft und gebe diesen Ablauf
                ausdrücklich frei. Jede Änderung hebt die Freigabe auf.
              </span>
            </label>
            {(!pages.includes(j.pageUrl) ||
              j.viewportIds.some((v) => !devices.includes(v))) && (
              <p role="alert">
                Startseite und Geräte müssen auch im Browsercheck ausgewählt
                sein. Ablauf bitte anpassen.
              </p>
            )}
          </article>
        ))}
        <button
          type="button"
          className="button secondary"
          disabled={journeys.length >= 3 || !pages.length}
          onClick={() =>
            onChange([
              ...journeys,
              {
                id: crypto.randomUUID(),
                name: "Mobilmenü öffnen",
                pageUrl: pages[0]!,
                viewportIds: [
                  devices.includes("mobile")
                    ? "mobile"
                    : (devices[0] ?? "desktop"),
                ],
                steps: [blank()],
                confirmed: false,
              },
            ])
          }
        >
          Seitenablauf hinzufügen
        </button>
      </fieldset>
      {count > 18 && (
        <p role="alert">
          Bitte auf maximal 18 Schritt-/Geräte-Kombinationen begrenzen.
        </p>
      )}
    </section>
  );
}
