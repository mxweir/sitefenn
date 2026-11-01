import { useState, useEffect } from "react";
import type { Scan } from "../shared/types.js";
import { patch, message } from "./api.js";
export const scanLabel = (s: Scan) =>
  `${s.labels?.name || new Date(s.createdAt).toLocaleString("de-DE")} · ${s.options?.retest ? "Teilnachtest" : "Vollcheck"} · ${s.labels?.profileName || "Standardprofile"} · ${s.id.slice(0, 8)}`;
export default function ScanDetails({
  scan,
  onChange,
}: {
  scan: Scan;
  onChange?: () => Promise<void>;
}) {
  const [name, setName] = useState(scan.labels?.name ?? ""),
    [profileName, setProfile] = useState(scan.labels?.profileName ?? ""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setName(scan.labels?.name ?? "");
    setProfile(scan.labels?.profileName ?? "");
    setNotice("");
  }, [scan.id, scan.labels?.name, scan.labels?.profileName]);
  return (
    <section className="scan-identity">
      <strong>{scanLabel(scan)}</strong>
      <p>
        <time dateTime={scan.createdAt}>{scan.createdAt}</time> ·{" "}
        {scan.options?.pages.length ?? "?"} URLs ·{" "}
        {scan.options?.viewports
          .map((v) => `${v.id} ${v.width}×${v.height}`)
          .join(", ") || "Historischer Umfang unbekannt"}
      </p>
      <details>
        <summary>Lauf und Profil benennen</summary>
        <p className="hint">
          Bezeichnungen sind Metadaten. Optionen, Messidentität und
          Originalbericht bleiben unverändert.
        </p>
        <label>
          Laufname
          <input
            aria-label={`Laufname ${scan.id}`}
            value={name}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Profilname
          <input
            aria-label={`Profilname ${scan.id}`}
            value={profileName}
            maxLength={100}
            onChange={(e) => setProfile(e.target.value)}
          />
        </label>
        <button
          className="button secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await patch(`/api/scans/${scan.id}/labels`, {
                name,
                profileName,
              });
              await onChange?.();
              setNotice("Bezeichnungen gespeichert; Messbericht unverändert.");
            } catch (e) {
              setNotice(message(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Bezeichnungen speichern
        </button>
        <p role="status">{notice}</p>
      </details>
    </section>
  );
}
