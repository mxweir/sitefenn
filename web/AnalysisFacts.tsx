import { useState } from "react";
import type { AuditReport } from "../shared/types.js";
import { analysisFacts } from "../shared/analysis-facts.js";
import { Notice } from "./ui.js";
export default function AnalysisFacts({
  report,
  pageUrl,
}: {
  report: AuditReport;
  pageUrl: string;
}) {
  const [global, setGlobal] = useState(false),
    [expanded, setExpanded] = useState(false);
  const facts = analysisFacts(report, global ? undefined : pageUrl);
  return (
    <section
      className="panel facts-panel"
      aria-label="Deterministische Messfakten"
    >
      <p className="small-label">MESSFAKTEN · AUS DEM GESPEICHERTEN BERICHT</p>
      <h3>Belegter Stand {global ? "des Checks" : "dieser Seite"}</h3>
      <p className="facts-summary">{facts.summary}</p>
      <p className="hint">
        Diese Übersicht wird ohne Modell erzeugt. Umordnung und Aufteilung der
        Modellteile ändern sie nicht.
      </p>
      {!facts.measurementValid && (
        <Notice error>
          Messvertrag unvollständig oder ungültig. Betroffene Bereiche sind
          unbekannt; keine Freigabe.
        </Notice>
      )}
      <label className="check-row">
        <input
          type="checkbox"
          checked={global}
          onChange={(e) => setGlobal(e.target.checked)}
        />
        Alle Seiten dieses Checks zeigen
      </label>
      <p>
        Profile:{" "}
        {facts.viewports
          .map((v) => `${v.id} (${v.width} × ${v.height})`)
          .join(", ")}
      </p>
      <details
        open={expanded}
        onToggle={(e) => setExpanded(e.currentTarget.open)}
      >
        <summary>Geräte-, Zustands- und Regelmatrix</summary>
        <div className="facts-table-scroll" tabIndex={0}>
          <table>
            <caption>
              Geplante Regelinstanzen pro Seite, Gerät und Zustand
            </caption>
            <thead>
              <tr>
                <th>Seite / Gerät / Zustand</th>
                <th>Bestanden</th>
                <th>Fehlgeschlagen</th>
                <th>Unbekannt</th>
                <th>Nicht anwendbar</th>
              </tr>
            </thead>
            <tbody>
              {facts.matrix.map((cell) => (
                <tr
                  key={JSON.stringify([
                    cell.pageUrl,
                    cell.viewportId,
                    cell.state,
                  ])}
                >
                  <th scope="row">
                    {new URL(cell.pageUrl).pathname}
                    <br />
                    {cell.viewportId} · {cell.state}
                  </th>
                  <td>{cell.pass}</td>
                  <td>{cell.fail}</td>
                  <td>{cell.unknown}</td>
                  <td>{cell.notApplicable}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="facts-table-scroll" tabIndex={0}>
          <table>
            <caption>
              Einzelne Regelinstanzen · unbekannt ist kein Bestehen
            </caption>
            <thead>
              <tr>
                <th>Seite / Gerät / Zustand</th>
                <th>Regel</th>
                <th>Status</th>
                <th>Befunde</th>
              </tr>
            </thead>
            <tbody>
              {facts.instances.map((row) => (
                <tr
                  key={JSON.stringify([
                    row.pageUrl,
                    row.viewportId,
                    row.state,
                    row.ruleId,
                  ])}
                >
                  <th scope="row" title={row.pageUrl}>
                    {row.pageUrl}
                    <br />
                    {row.viewportId} · {row.state}
                  </th>
                  <td>{row.ruleId}</td>
                  <td>{row.status}</td>
                  <td>{row.findingIds.join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <p className="hint">
        Verarbeitung abgeschlossen ≠ sachlich geprüft ≠ lokal redaktionell
        freigegeben ≠ durch Nachtest verifiziert.
      </p>
    </section>
  );
}
