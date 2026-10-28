import { useLayoutEffect, useRef, useState } from "react";
import { Globe2, LoaderCircle, Plus } from "lucide-react";
import type { Project } from "../shared/types.js";
import { message, post } from "./api.js";
import { Dialog } from "./ui.js";

export default function ProjectModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (project: Project) => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [environment, setEnvironment] = useState("production");
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    nameRef.current?.focus();
  }, []);
  useLayoutEffect(() => {
    if (error && !saving) nameRef.current?.focus();
  }, [error, saving]);
  return (
    <Dialog title="Deine Website hinzufügen." onClose={onClose} busy={saving}>
      <span className="modal-project-icon">
        <Globe2 size={26} />
      </span>
      <p className="dialog-description">
        Ein fester Platz für deine Prüfungen, Belege und nächsten Schritte.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!consent || saving) return;
          setSaving(true);
          setError("");
          try {
            const response = await post<{ project: Project }>("/api/projects", {
              name: name.trim(),
              url: url.trim(),
              environment,
              acknowledged: true,
            });
            await onCreated(response.project);
          } catch (err) {
            setSaving(false);
            setError(message(err));
          }
        }}
      >
        <label htmlFor="project-name">Projektname</label>
        <input
          id="project-name"
          ref={nameRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={80}
          placeholder="z. B. Mein Portfolio"
          autoComplete="off"
          disabled={saving}
        />
        <label htmlFor="project-url">Website-URL</label>
        <input
          id="project-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          placeholder="https://meine-website.de"
          disabled={saving}
          aria-describedby="url-hint"
        />
        <p id="url-hint" className="field-hint">
          Eigene oder ausdrücklich freigegebene, vertrauenswürdige Websites über
          HTTP/HTTPS. Öffentliche Ziele nur auf Port 80/443. „Lokale
          Entwicklung“ erlaubt ausschließlich den ausdrücklich gewählten
          Ursprung, keinen automatischen Scan privater Netze oder Zugriff auf
          Cloud-Metadaten.
        </p>
        <label htmlFor="environment">Umgebung</label>
        <select
          id="environment"
          value={environment}
          onChange={(e) => setEnvironment(e.target.value)}
          disabled={saving}
        >
          <option value="production">Produktion</option>
          <option value="staging">Staging</option>
          <option value="local">
            Lokale Entwicklung · exakt diesen Ursprung freigeben
          </option>
        </select>
        <label className="consent-row">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            required
            disabled={saving}
          />
          <span>
            Ich verwalte diese vertrauenswürdige Website oder bin ausdrücklich
            berechtigt, sie automatisiert zu prüfen.
          </span>
        </label>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <div className="modal-actions">
          <button
            type="button"
            className="button secondary"
            onClick={onClose}
            disabled={saving}
          >
            Abbrechen
          </button>
          <button
            className="button primary"
            type="submit"
            disabled={!consent || saving}
          >
            {saving ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <Plus size={16} />
            )}
            Projekt erstellen
          </button>
        </div>
      </form>
    </Dialog>
  );
}
