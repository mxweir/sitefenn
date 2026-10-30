import { useEffect, useState } from "react";
import type {
  SearchDataset,
  SearchDimension,
  SearchImportMetadata,
} from "../shared/types.js";
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
  onImport,
}: {
  projectId: string;
  metadata: SearchImportMetadata;
  onImport: (dataset: SearchDataset) => void;
}) {
  const [status, setStatus] = useState<Status>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [url, setUrl] = useState(""),
    [properties, setProperties] = useState<
      { siteUrl: string; permissionLevel: string }[]
    >([]),
    [ack, setAck] = useState(false);
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
    } finally {
      setBusy(false);
    }
  };
  return (
    <details className="panel workspace-form">
      <summary>Google direkt verbinden · experimentell</summary>
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
          <label htmlFor="google-client">Desktop-OAuth-JSON auswählen</label>
          <input
            id="google-client"
            type="file"
            accept=".json,application/json"
            disabled={busy || !ack || status?.available === false}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              void action(async () => {
                if (file.size > 20000)
                  throw Error("Konfiguration maximal 20 KB.");
                const json = JSON.parse(await file.text());
                await post("/api/google/configure", {
                  acknowledged: ack,
                  config: {
                    installed: {
                      clientId: json.installed?.client_id,
                      clientSecret: json.installed?.client_secret,
                    },
                  },
                });
              });
              e.target.value = "";
            }}
          />
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
                setProperties(r.properties);
              })
            }
          >
            Berechtigte Properties anzeigen
          </button>
          {properties.map((p) => (
            <p key={p.siteUrl} className="hint">
              {p.siteUrl} · {p.permissionLevel}
            </p>
          ))}
          <p className="hint">
            Abruf nutzt Property, Zeitraum, Dimension und Filter aus dem
            Importformular unten. Websuche, finale Daten, maximal 25.000
            Top-Zeilen. Keine vollständigen Property-Summen.
          </p>
          <button
            className="button primary"
            disabled={busy || !ack || !metadata.startDate || !metadata.endDate}
            onClick={() =>
              void action(async () => {
                const r = await post<{ dataset: SearchDataset }>(
                  `/api/projects/${projectId}/search/google`,
                  { acknowledged: ack, metadata },
                );
                onImport(r.dataset);
              })
            }
          >
            Gewählten Umfang von Google abrufen
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
            })
          }
        >
          Google-Zugriff widerrufen & Verbindung entfernen
        </button>
      )}
    </details>
  );
}
