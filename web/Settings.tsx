import { useEffect, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  Download,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { Dependency, HubSettings } from "../shared/types.js";
import { api, message, patch } from "./api.js";
import { Notice, Success } from "./ui.js";
import { QUALITY_REFERENCE } from "../shared/quality.js";

export default function Settings({
  dependencies,
  settings,
  speechAvailable,
  onSaved,
  onRefresh,
}: {
  dependencies: Dependency[];
  settings: HubSettings;
  speechAvailable: boolean;
  onSaved: () => void | Promise<void>;
  onRefresh: () => void | Promise<void>;
}) {
  const [models, setModels] = useState<string[]>([]);
  const [available, setAvailable] = useState(false);
  const [model, setModel] = useState(settings.model);
  const [speech, setSpeech] = useState(settings.speechEnabled);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setModel(settings.model);
    setSpeech(settings.speechEnabled);
  }, [settings.model, settings.speechEnabled]);
  const load = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ models: string[]; available: boolean }>(
        "/api/models",
      );
      setModels(result.models);
      setAvailable(result.available);
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  return (
    <>
      <section className="workspace-heading">
        <div>
          <p className="eyebrow">LOKAL HEISST: DU HAST DIE KONTROLLE.</p>
          <h1>Ein gesundes Setup.</h1>
          <p>
            Regelbasierte Prüfungen brauchen keine KI. Fenn nutzt nur ein von
            dir ausgewähltes lokales Modell.
          </p>
        </div>
        <button className="button secondary" onClick={() => void onRefresh()}>
          <RefreshCw size={16} />
          Status aktualisieren
        </button>
      </section>
      <div className="settings-grid">
        <section
          className="panel workspace-form"
          aria-label="Prüfqualität und Referenzbasis"
        >
          <div className="panel-head">
            <h2>Prüfqualität & Referenzbasis</h2>
            <ShieldCheck size={23} />
          </div>
          <span className="pill confirmed">
            Referenzstand {QUALITY_REFERENCE.date}
          </span>
          <p>
            {QUALITY_REFERENCE.cases} zusätzliche synthetische Layoutfälle ·{" "}
            {QUALITY_REFERENCE.profiles} Geräteprofile ·{" "}
            {QUALITY_REFERENCE.repeats} Wiederholungen.
          </p>
          <p>
            {QUALITY_REFERENCE.uniqueLabels} unterschiedliche
            Regel-/Seiten-/Profil-Erwartungen für zwei eng begrenzte
            Layoutprüfungen. Wiederholungen sind keine zusätzlichen unabhängigen
            Fälle.
          </p>
          <ul>
            {QUALITY_REFERENCE.fixes.map((fix) => (
              <li key={fix}>{fix}</li>
            ))}
          </ul>
          <p className="hint">
            {QUALITY_REFERENCE.realSites} autorisierte Websites wurden in{" "}
            {QUALITY_REFERENCE.realRuns} begrenzten Real-Läufen geprüft. Das
            bestätigt Ausführung und Wiederholbarkeit, keine allgemeine
            Erkennungsgenauigkeit.
          </p>
          <p className="plan-note">
            Implementierungsseitig beschriftete Testfälle, keine unabhängige
            menschliche Wirksamkeitsstudie. Nicht geprüfte Zustände bleiben
            unbekannt.
          </p>
          <a
            className="text-button"
            href="https://github.com/mxweir/sitefenn/blob/main/docs/BASELINE-1.1.md"
            target="_blank"
            rel="noreferrer"
          >
            Messbericht und Grenzen lesen
          </a>
        </section>
        <section className="panel workspace-form">
          <div className="panel-head">
            <h2>Fenn & lokale KI</h2>
            <Sparkles size={23} />
          </div>
          <span className={`pill ${available ? "confirmed" : "candidate"}`}>
            {available ? "Ollama erreichbar" : "Ollama nicht erreichbar"}
          </span>
          <p className="hint">
            Keine automatischen Modelldownloads. Teste zunächst ein kleines
            quantisiertes Modell; Browser und Modellkontext benötigen zusätzlich
            Arbeitsspeicher.
          </p>
          <label htmlFor="local-model">Installiertes Modell</label>
          <select
            id="local-model"
            value={model}
            onChange={(e) => {
              setModel(e.target.value);
              setSaved(false);
            }}
          >
            <option value="">Kein Modell ausgewählt</option>
            {model && !models.includes(model) && (
              <option value={model}>{model} · nicht gefunden</option>
            )}
            {models.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => void load()}
          >
            <RefreshCw size={14} />
            {busy ? "Prüfe Modelle …" : "Modellliste aktualisieren"}
          </button>
          {!models.length && (
            <p className="plan-note">
              Noch kein lokales Modell gefunden. Installiere Ollama und lade ein
              Modell bewusst außerhalb des Hubs. Danach die Modellliste
              aktualisieren.
            </p>
          )}
          {speechAvailable && (
            <label className="check-option">
              <input
                type="checkbox"
                checked={speech}
                onChange={(e) => {
                  setSpeech(e.target.checked);
                  setSaved(false);
                }}
              />
              <span>
                Optionale lokale Sprachausgabe über macOS aktivieren. Nur nach
                ausdrücklichem Klick vorlesen.
              </span>
            </label>
          )}
          {error && <Notice error>{error}</Notice>}
          {saved && <Success>Einstellungen gespeichert.</Success>}
          <button
            className="button primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await patch("/api/settings", {
                  model,
                  speechEnabled: speechAvailable && speech,
                });
                await onSaved();
                setSaved(true);
              } catch (err) {
                setError(message(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            Einstellungen speichern
          </button>
          <p className="hint">
            KI-Erklärungen sind Empfehlungen. Website-Inhalte werden als nicht
            vertrauenswürdige Daten behandelt, nicht als Anweisungen.
          </p>
        </section>
        <section className="panel">
          <div className="panel-head">
            <h2>Deine Daten mitnehmen</h2>
            <ShieldCheck size={22} />
          </div>
          <p className="hint">
            Das Backup enthält lokale Projekte, Ergebnisse und Nachweise. Es
            kann vertrauliche URLs und sichtbare Seiteninhalte enthalten. Vor
            dem Teilen prüfen und sicher aufbewahren.
          </p>
          <a
            className="button secondary download-link"
            href="/api/data/backup"
            download
          >
            <Download size={16} />
            Workspace-Backup herunterladen
          </a>
          <p className="hint">
            Wiederherstellen:{" "}
            <code className="inline-code">
              npm run restore -- /pfad/backup.zip /pfad/NEUER-workspace
            </code>
            . Das Ziel muss neu sein. Danach den alten Hub stoppen und mit{" "}
            <code className="inline-code">HUB_DATA_DIR</code> auf das neue
            Verzeichnis starten. Kein Überschreiben des laufenden Workspaces.
          </p>
          <p className="plan-note">
            Lokal heißt nicht automatisch verschlüsselt. Wer auf dein
            Benutzerkonto und die Hub-Dateien zugreifen kann, kann
            möglicherweise auch Berichte lesen.
          </p>
          <h3 className="settings-subtitle">Grenzen bewusst kennen</h3>
          <p className="hint">
            Chromium-Emulation ersetzt keine echten Geräte. Automatische
            Accessibility-Prüfungen sind keine vollständige WCAG-Zertifizierung.
            Ein hoher Score verspricht keine bessere Google-Position.
          </p>
        </section>
      </div>
      <section className="dependency-list">
        {dependencies.map((dep) => (
          <article key={dep.id} className="dependency-card">
            <span className={`dependency-icon ${dep.status}`}>
              {dep.status === "ready" ? (
                <CheckCircle2 />
              ) : dep.status === "missing" ? (
                <CircleAlert />
              ) : (
                <Sparkles />
              )}
            </span>
            <div>
              <div className="dependency-heading">
                <h2>{dep.label}</h2>
                <span className={`dependency-state ${dep.status}`}>
                  {dep.status === "ready"
                    ? "Bereit"
                    : dep.status === "missing"
                      ? "Fehlt"
                      : "Optional"}
                </span>
              </div>
              <p>{dep.detail}</p>
              {dep.instruction && (
                <pre>
                  <code>{dep.instruction}</code>
                </pre>
              )}
            </div>
          </article>
        ))}
      </section>
    </>
  );
}
