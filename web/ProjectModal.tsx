import { useTranslation } from "./language.js";
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
  const t = useTranslation();
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
    <Dialog
      title={t("Deine Website hinzufügen.", "Add your website")}
      onClose={onClose}
      busy={saving}
    >
      <span className="modal-project-icon">
        <Globe2 size={26} />
      </span>
      <p className="dialog-description">
        {t(
          "Ein fester Platz für deine Prüfungen, Belege und nächsten Schritte.",
          "Keep your checks, evidence, and next steps together.",
        )}
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
        <label htmlFor="project-name">{t("Projektname", "Project name")}</label>
        <input
          id="project-name"
          ref={nameRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={80}
          placeholder={t("z. B. Mein Portfolio", "e.g. My portfolio")}
          autoComplete="off"
          disabled={saving}
        />
        <label htmlFor="project-url">{t("Website-URL", "Website URL")}</label>
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
          {t(
            "Eigene oder ausdrücklich freigegebene, vertrauenswürdige Websites über HTTP/HTTPS. Öffentliche Ziele nur auf Port 80/443. „Lokale Entwicklung“ erlaubt ausschließlich den ausdrücklich gewählten Ursprung, keinen automatischen Scan privater Netze oder Zugriff auf Cloud-Metadaten.",
            "Use trusted websites you own or have explicit permission to check over HTTP or HTTPS. Public targets use ports 80 and 443. Local development allows only the selected origin.",
          )}
        </p>
        <label htmlFor="environment">{t("Umgebung", "Environment")}</label>
        <select
          id="environment"
          value={environment}
          onChange={(e) => setEnvironment(e.target.value)}
          disabled={saving}
        >
          <option value="production">{t("Produktion", "Production")}</option>
          <option value="staging">Staging</option>
          <option value="local">
            {t(
              "Lokale Entwicklung · exakt diesen Ursprung freigeben",
              "Local development · allow this exact origin",
            )}
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
            {t(
              "Ich verwalte diese vertrauenswürdige Website oder bin ausdrücklich berechtigt, sie automatisiert zu prüfen.",
              "I manage this trusted website or have explicit permission to run automated checks on it.",
            )}
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
            {t("Abbrechen", "Cancel")}
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
            {t("Projekt erstellen", "Create project")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
