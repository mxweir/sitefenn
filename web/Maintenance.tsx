import { useEffect, useState } from "react";
import { api, post, message, stamp } from "./api.js";
import { Notice, Success } from "./ui.js";
interface Overview {
  storage: {
    pendingOperations?: number;
    evidenceBytes: number;
    evidenceFiles: number;
    databaseBytes: number;
    scans: number;
    trash: {
      id: string;
      projectId: string;
      createdAt: string;
      trashedAt: string;
    }[];
    retention: { keepPerProject: number };
    notice: string;
  };
  schedules: {
    projectId: string;
    sourceScanId: string;
    intervalHours: number;
    enabled: boolean;
    nextRunAt: string;
    lastState: string;
    missed: number;
  }[];
  profiles: { id: string; projectId: string; createdAt: string }[];
  projects: { id: string; name: string }[];
}
interface Preview {
  token: string;
  expiresAt: string;
  preview: {
    keepPerProject: number;
    protectedCount: number;
    candidates: {
      id: string;
      projectId: string;
      createdAt: string;
      status: string;
    }[];
    limited: boolean;
    notice: string;
  };
}
export default function Maintenance({
  onChanged,
}: {
  onChanged: () => void | Promise<void>;
}) {
  const [data, setData] = useState<Overview>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState(""),
    [keep, setKeep] = useState(10),
    [preview, setPreview] = useState<Preview>(),
    [purgeIds, setPurgeIds] = useState<string[]>([]),
    [confirmation, setConfirmation] = useState(""),
    [update, setUpdate] = useState<{
      current: string;
      latest: string;
      available: boolean;
      url: string;
      checkedAt: string;
      notice: string;
    }>(),
    [profile, setProfile] = useState(""),
    [hours, setHours] = useState(24),
    [ack, setAck] = useState(false);
  const load = async () => {
    const value = await api<Overview>("/api/maintenance");
    setData(value);
    setKeep(value.storage.retention.keepPerProject);
  };
  useEffect(() => {
    void load().catch((e) => setError(message(e)));
  }, []);
  const action = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await fn();
      await load();
      await onChanged();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  const mib = (n: number) => (n / 1024 / 1024).toFixed(1) + " MiB";
  return (
    <section className="panel workspace-form">
      <p className="eyebrow">IM ALLTAG GUT AUFGEHOBEN</p>
      <h2>Updates, Speicher & Prüfintervalle</h2>
      {error && <Notice error>{error}</Notice>}
      {success && <Success>{success}</Success>}
      {!!data?.storage.pendingOperations && (
        <Notice error>
          Ein bereits bestätigter Wartungsauftrag ist noch offen. Neue
          aufwendige Aktionen warten darauf.
          <button
            className="button secondary"
            disabled={busy}
            onClick={() =>
              void action(async () => {
                await post("/api/maintenance/recover", {});
                setSuccess("Wartung abgeschlossen.");
              })
            }
          >
            Wartung fortsetzen
          </button>
        </Notice>
      )}
      <details>
        <summary>Manuelles Update mit Vorsicherung</summary>
        <p>
          Prüft nur auf deinen Klick die öffentlichen Release-Metadaten bei
          GitHub. Kein automatischer Programmtausch oder Modell-Download. Vor
          dem manuellen Update Vorsicherung erstellen und in einem neuen
          Programmordner starten. Der vorhandene Datenpfad bleibt erhalten.
        </p>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() =>
            void action(async () => {
              setUpdate(await post("/api/updates/check", {}));
            })
          }
        >
          GitHub-Release prüfen
        </button>
        {update && (
          <p>
            Installiert {update.current} · veröffentlicht {update.latest} ·{" "}
            {update.available
              ? "Update verfügbar"
              : "Keine neuere stabile Version"}{" "}
            · {stamp(update.checkedAt)}
            <br />
            {update.notice}
            <br />
            <a href={update.url} target="_blank" rel="noreferrer">
              Release und Prüfsummen öffnen
            </a>
          </p>
        )}
        <button
          className="button secondary"
          disabled={busy}
          onClick={() =>
            void action(async () => {
              const r = await post<{
                name: string;
                bytes: number;
                sha256: string;
              }>("/api/updates/backup", {});
              setSuccess(
                `Vorsicherung im Workspace-Ordner backups: ${r.name} · ${mib(r.bytes)} · SHA-256 ${r.sha256}`,
              );
            })
          }
        >
          Vorsicherung vor Update erstellen
        </button>
        <p className="hint">
          Wiederherstellung erfolgt bei gestoppter App in ein neues
          Datenverzeichnis. Schlüsselbund-Verbindungen werden nicht exportiert.
          Keine unabhängig signierten nativen Updates.
        </p>
      </details>
      {data && (
        <>
          <details>
            <summary>
              Speicher verwalten · {mib(data.storage.evidenceBytes)} Nachweise
            </summary>
            <p>
              {data.storage.scans} gespeicherte Checks ·{" "}
              {data.storage.evidenceFiles} Bilddateien · Datenbank{" "}
              {mib(data.storage.databaseBytes)}
            </p>
            <p className="hint">{data.storage.notice}</p>
            <label htmlFor="retention-keep">
              Mindestens neueste Checks pro Projekt behalten
            </label>
            <input
              id="retention-keep"
              type="number"
              min="1"
              max="100"
              value={keep}
              onChange={(e) => {
                setKeep(Number(e.target.value));
                setPreview(undefined);
              }}
            />
            <button
              className="button secondary"
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  setPreview(
                    await post<Preview>("/api/storage/preview", {
                      keepPerProject: keep,
                    }),
                  );
                })
              }
            >
              Aufräumen vorschauen
            </button>
            {preview && (
              <div className="plan-note">
                <p>{preview.preview.notice}</p>
                <p>
                  {preview.preview.protectedCount} geschützte Quellen ·{" "}
                  {preview.preview.candidates.length} Kandidaten{" "}
                  {preview.preview.limited
                    ? "· begrenzte Auswahl, weitere bleiben erhalten"
                    : ""}{" "}
                  · gültig bis {stamp(preview.expiresAt)}
                </p>
                {preview.preview.candidates.map((c) => (
                  <p key={c.id}>
                    {data.projects.find((p) => p.id === c.projectId)?.name} ·{" "}
                    {stamp(c.createdAt)} · {c.status} · {c.id}
                  </p>
                ))}
                <button
                  className="button secondary"
                  disabled={busy || !preview.preview.candidates.length}
                  onClick={() =>
                    void action(async () => {
                      const r = await post<{ trashed: number }>(
                        "/api/storage/trash",
                        { token: preview.token, confirmed: true },
                      );
                      setPreview(undefined);
                      setSuccess(
                        `${r.trashed} Checks im wiederherstellbaren Papierkorb.`,
                      );
                    })
                  }
                >
                  Vorgeschlagene Checks in Papierkorb verschieben
                </button>
              </div>
            )}
            <h3>Papierkorb · {data.storage.trash.length}</h3>
            {data.storage.trash.map((t) => (
              <div className="plan-note" key={t.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={purgeIds.includes(t.id)}
                    disabled={
                      busy ||
                      (!purgeIds.includes(t.id) && purgeIds.length >= 20)
                    }
                    onChange={(e) => {
                      setPurgeIds(
                        e.target.checked
                          ? [...purgeIds, t.id]
                          : purgeIds.filter((id) => id !== t.id),
                      );
                      setConfirmation("");
                    }}
                  />
                  {data.projects.find((p) => p.id === t.projectId)?.name} ·{" "}
                  {stamp(t.createdAt)}
                </label>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() =>
                    void action(async () => {
                      await post("/api/storage/restore", { id: t.id });
                      setPurgeIds(purgeIds.filter((id) => id !== t.id));
                      setSuccess(
                        "Check mit Aufgaben und Analyseverlauf wiederhergestellt.",
                      );
                    })
                  }
                >
                  Check wiederherstellen
                </button>
              </div>
            ))}
            {purgeIds.length > 0 && (
              <>
                <Notice>
                  Diese {purgeIds.length} ausgewählten Papierkorbeinträge und
                  nicht mehr verwendete Nachweise werden endgültig gelöscht. Das
                  ist in der App nicht rückgängig zu machen. Vorher Backup
                  sichern; vorhandene externe Backups bleiben erhalten.
                </Notice>
                <label htmlFor="purge-confirmation">
                  Zur Bestätigung ENDGÜLTIG LÖSCHEN eingeben
                </label>
                <input
                  id="purge-confirmation"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                />
                <button
                  className="button secondary"
                  disabled={busy || confirmation !== "ENDGÜLTIG LÖSCHEN"}
                  onClick={() =>
                    void action(async () => {
                      await post("/api/storage/purge", {
                        ids: purgeIds,
                        confirmation,
                      });
                      setPurgeIds([]);
                      setConfirmation("");
                      setSuccess(
                        "Ausgewählte Papierkorbeinträge endgültig entfernt.",
                      );
                    })
                  }
                >
                  Auswahl endgültig löschen
                </button>
              </>
            )}
          </details>
          <details>
            <summary>Regelmäßige Checks · nur bei laufender App</summary>
            <p>
              Ein freigegebenes vollständiges Prüfprofil täglich oder
              wöchentlich wiederholen. Maximal eine zusätzliche Prüfung pro
              Takt, nur bei freien Ressourcen. App schließen beendet die
              Planung. Verpasste Termine werden sichtbar gezählt und nicht als
              Nachholstapel gestartet. Keine Google-Synchronisierung oder KI
              automatisch.
            </p>
            <label htmlFor="scheduled-profile">
              Profil aus abgeschlossenem Check
            </label>
            <select
              id="scheduled-profile"
              value={profile}
              onChange={(e) => {
                setProfile(e.target.value);
                setAck(false);
              }}
            >
              <option value="">Profil auswählen</option>
              {data.profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {
                    data.projects.find((project) => project.id === p.projectId)
                      ?.name
                  }{" "}
                  · {stamp(p.createdAt)}
                </option>
              ))}
            </select>
            <label htmlFor="schedule-hours">Intervall</label>
            <select
              id="schedule-hours"
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
            >
              <option value="24">Täglich · 24 Stunden</option>
              <option value="168">Wöchentlich · 168 Stunden</option>
            </select>
            <label>
              <input
                type="checkbox"
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
              />{" "}
              Diese bekannten Ziele und das gewählte Profil regelmäßig prüfen,
              solange die App läuft.
            </label>
            <button
              className="button secondary"
              disabled={busy || !ack || !profile}
              onClick={() =>
                void action(async () => {
                  const p = data.profiles.find((p) => p.id === profile)!;
                  await post("/api/schedules", {
                    projectId: p.projectId,
                    sourceScanId: profile,
                    intervalHours: hours,
                    enabled: true,
                    acknowledged: ack,
                  });
                  setAck(false);
                  setSuccess("Prüfintervall gespeichert.");
                })
              }
            >
              Prüfintervall aktivieren
            </button>
            {data.schedules.map((s) => (
              <div className="plan-note" key={s.projectId}>
                <strong>
                  {data.projects.find((p) => p.id === s.projectId)?.name}
                </strong>
                <p>
                  {s.enabled ? "Aktiv" : "Deaktiviert"} · {s.lastState} ·
                  nächster Termin {stamp(s.nextRunAt)} · {s.missed} verpasst
                </p>
                {s.enabled && (
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() =>
                      void action(async () => {
                        await post("/api/schedules", {
                          ...s,
                          enabled: false,
                          acknowledged: true,
                        });
                        setSuccess("Prüfintervall deaktiviert.");
                      })
                    }
                  >
                    Prüfintervall deaktivieren
                  </button>
                )}
              </div>
            ))}
          </details>
        </>
      )}
    </section>
  );
}
