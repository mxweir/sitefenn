import { useEffect, useState, type ReactNode } from "react";
import type { SearchImportMetadata } from "../shared/types.js";
import type { SearchPreview } from "../shared/search-preview.js";
import { api, post, message } from "./api.js";
import { Notice } from "./ui.js";
interface Status {
  available: boolean;
  configured: boolean;
  connected: boolean;
  pending: boolean;
  state: string;
  validation: string;
  scope: string;
}
export default function GoogleConnect({
  projectId,
  metadata,
  onPreview,
  scopeFields,
  onInvalidate,
}: {
  projectId: string;
  metadata: SearchImportMetadata;
  onPreview: (preview: SearchPreview) => void;
  scopeFields: ReactNode;
  onInvalidate: () => void;
}) {
  const [status, setStatus] = useState<Status>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [url, setUrl] = useState(""),
    [properties, setProperties] = useState<
      { siteUrl: string; permissionLevel: string }[]
    >([]),
    [ack, setAck] = useState(false),
    [property, setProperty] = useState(""),
    [clientId, setClientId] = useState(""),
    [clientSecret, setClientSecret] = useState("");
  const refresh = async () =>
    setStatus(await api<Status>("/api/google/status"));
  useEffect(() => {
    void refresh().catch((e) => setError(message(e)));
  }, []);
  const action = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(message(e));
      await refresh().catch(() => {});
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="panel workspace-form">
      <h3>Google direkt verbinden · experimentell</h3>
      <p>
        Optionaler rein lesender Zugriff. Desktop-OAuth-Client aus deinem
        Google-Cloud-Projekt und aktivierte Search Console API erforderlich.
        Konfiguration und Refresh-Token bleiben im macOS-Schlüsselbund; kein
        Token in Backup/Export. Andere Systeme nutzen weiterhin CSV.
      </p>
      {status && (
        <p role="status">
          {status.state} · {status.validation}
        </p>
      )}
      {error && <Notice error>{error}</Notice>}
      <label>
        <input
          type="checkbox"
          checked={ack}
          onChange={(e) => setAck(e.target.checked)}
        />{" "}
        Google-Verbindung und Schlüsselbund-Speicherung ausdrücklich aktivieren.
      </label>
      {!status?.configured && (
        <>
          <label htmlFor="google-client-id">Desktop-Client-ID</label>
          <input
            id="google-client-id"
            autoComplete="off"
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
          />
          <label htmlFor="google-client-secret">Desktop-Client-Secret</label>
          <input
            id="google-client-secret"
            type="password"
            autoComplete="off"
            value={clientSecret}
            onChange={(event) => setClientSecret(event.target.value)}
          />
          <button
            className="button secondary"
            type="button"
            disabled={
              busy ||
              !ack ||
              !clientId.trim() ||
              !clientSecret.trim() ||
              status?.available !== true
            }
            onClick={() =>
              void action(async () => {
                await post("/api/google/configure", {
                  acknowledged: ack,
                  config: {
                    installed: {
                      clientId: clientId.trim(),
                      clientSecret: clientSecret.trim(),
                    },
                  },
                });
                setClientId("");
                setClientSecret("");
              })
            }
          >
            Desktop-Client speichern
          </button>
        </>
      )}
      {status?.configured && !status.connected && (
        <button
          className="button secondary"
          disabled={busy || !ack || status.pending}
          onClick={() =>
            void action(async () => {
              const r = await post<{ url: string }>("/api/google/start", {
                acknowledged: ack,
              });
              setUrl(r.url);
            })
          }
        >
          Google-Anmeldung vorbereiten
        </button>
      )}
      {url && status?.pending && (
        <a
          className="button primary"
          href={url}
          target="_blank"
          rel="noreferrer"
        >
          Bei Google rein lesenden Zugriff freigeben
        </a>
      )}
      {status?.pending && (
        <button
          className="button secondary"
          disabled={busy}
          onClick={() =>
            void action(async () => {
              await post("/api/google/cancel", {});
              setUrl("");
            })
          }
        >
          Anmeldung abbrechen
        </button>
      )}
      <button
        className="button secondary"
        disabled={busy}
        onClick={() => void action(async () => {})}
      >
        Verbindungsstatus aktualisieren
      </button>
      {status?.connected && (
        <>
          <button
            className="button secondary"
            disabled={busy || !ack}
            onClick={() =>
              void action(async () => {
                const r = await api<{ properties: typeof properties }>(
                  "/api/google/properties",
                );
                setProperties(
                  r.properties.filter(
                    (p) => p.permissionLevel !== "siteUnverifiedUser",
                  ),
                );
                setProperty("");
                onInvalidate();
              })
            }
          >
            Berechtigte Properties anzeigen
          </button>
          <label htmlFor="google-property">Berechtigte Property</label>
          <select
            id="google-property"
            value={property}
            disabled={busy}
            onChange={(event) => {
              setProperty(event.target.value);
              onInvalidate();
            }}
          >
            <option value="">Property auswählen</option>
            {properties.map((p) => (
              <option key={p.siteUrl} value={p.siteUrl}>
                {p.siteUrl}
              </option>
            ))}
          </select>
          {property && scopeFields}
          <p className="hint">
            Wähle darunter Zeitraum, Dimension und Filter. Die Vorschau
            verwendet finale Websuchdaten und maximal 25.000 Top-Zeilen.
          </p>
          <button
            className="button primary"
            disabled={
              busy ||
              !ack ||
              !property ||
              !metadata.startDate ||
              !metadata.endDate ||
              metadata.filters === null
            }
            onClick={() =>
              void action(async () => {
                onInvalidate();
                const preview = await post<SearchPreview>(
                  `/api/projects/${projectId}/search/preview`,
                  {
                    source: "google-api",
                    acknowledged: ack,
                    metadata: { ...metadata, property },
                  },
                );
                onPreview(preview);
              })
            }
          >
            Google-Vorschau abrufen
          </button>
        </>
      )}
      {status?.configured && (
        <button
          className="button secondary"
          disabled={busy}
          onClick={() =>
            void action(async () => {
              await post("/api/google/disconnect", { confirmed: true });
              setUrl("");
              setProperties([]);
              setProperty("");
              onInvalidate();
            })
          }
        >
          Google-Zugriff widerrufen & Verbindung entfernen
        </button>
      )}
    </section>
  );
}
