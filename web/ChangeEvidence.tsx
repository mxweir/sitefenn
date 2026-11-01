import { useState } from "react";
import { api, message } from "./api.js";
import type { ComparisonEntry } from "../shared/types.js";
import type { changeEvidence } from "../server/services/change-evidence.js";
export default function ChangeEvidence({
  entry,
  beforeId,
  afterId,
  projectId,
}: {
  entry: ComparisonEntry;
  beforeId: string;
  afterId: string;
  projectId: string;
}) {
  const [data, setData] = useState<ReturnType<typeof changeEvidence> | null>(
      null,
    ),
    [error, setError] = useState("");
  const link = (scanId: string, findingId?: string) =>
    `/?${new URLSearchParams({ project: projectId, scan: scanId, view: "report", ...(findingId ? { finding: findingId } : {}) })}`;
  return (
    <details
      className="change-evidence"
      onToggle={async (e) => {
        if (!e.currentTarget.open || data) return;
        try {
          setData(
            await api(
              `/api/compare/evidence?${new URLSearchParams({ before: beforeId, after: afterId, problemId: entry.problemId ?? "" })}`,
            ),
          );
        } catch (e) {
          setError(message(e));
        }
      }}
    >
      <summary>Vorher-/Nachher-Nachweise öffnen</summary>
      {error && <p role="alert">{error}</p>}
      {data && (
        <>
          <p>
            {data.observation.pageUrl} · {data.observation.viewportId} ·{" "}
            {data.observation.state} ·{" "}
            <code>{data.observation.selector ?? "Dokumentregel"}</code>
          </p>
          <p className="hint">{data.meaning}</p>
          <div className="change-proof-columns">
            {(["before", "after"] as const).map((side) => (
              <section key={side}>
                <h4>{side === "before" ? "Vorher" : "Nachher"}</h4>
                <p>{data[side].createdAt}</p>
                {data[side].pages?.map((p) => (
                  <p key={p.id}>
                    Dokumentziel: {p.finalUrl} · {p.state} · {p.status}
                  </p>
                ))}
                {data[side].observations.map((f) => (
                  <p key={f.id}>
                    <a href={link(data[side].scanId, f.id)}>
                      {f.id} · {f.evidenceStatus}
                    </a>
                    <br />
                    {f.detail}
                  </p>
                ))}
                {data[side].rules.map((r) => (
                  <p key={r.id}>
                    <strong>
                      {r.ruleId}: {r.status}
                    </strong>
                    <br />
                    {r.detail}
                  </p>
                ))}
                {!data[side].rules.length && (
                  <p>
                    Kein passender Regeldatensatz; nicht als bestanden
                    behandeln.
                  </p>
                )}
                {data[side].performance
                  .filter(() =>
                    data.observation.ruleId.startsWith("performance-"),
                  )
                  .map((p, i) => (
                    <pre key={i}>{JSON.stringify(p.metrics, null, 2)}</pre>
                  ))}
                <a href={link(data[side].scanId)}>Originalbericht öffnen</a>
                {data[side].evidence.map((e) => (
                  <details key={e.id}>
                    <summary>
                      Originalaufnahme · {e.state} · {e.scrollX}/{e.scrollY} ·{" "}
                      {e.width}×{e.height}
                    </summary>
                    <img
                      loading="lazy"
                      alt={`${side} · ${e.viewportId} · ${e.state}`}
                      src={`/api/scans/${data[side].scanId}/evidence/${e.id}`}
                    />
                  </details>
                ))}
              </section>
            ))}
          </div>
        </>
      )}
    </details>
  );
}
