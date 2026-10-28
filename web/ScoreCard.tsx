import type { ScoreSummary } from "../shared/types.js";
import { categoryLabel } from "./api.js";

export default function ScoreCard({ score }: { score?: ScoreSummary }) {
  if (!score)
    return (
      <div className="panel">
        <p className="eyebrow">AUDIT-SCORE</p>
        <p className="hint">
          Noch kein auswertbarer Score. Nicht geprüfte Bereiche gelten nicht als
          bestanden.
        </p>
      </div>
    );
  const format = (value: number | null) =>
    value === null ? "—" : Math.round(value).toString();
  const value =
    score.lower === score.upper
      ? format(score.lower)
      : `${format(score.lower)}–${format(score.upper)}`;
  const coverage = Math.round(score.coverage);
  return (
    <div className="panel score-panel">
      <div className="score-box">
        <div className="score-number">
          {value}
          <small>/100</small>
        </div>
        <div>
          <span className="eyebrow">AUDIT-SCORE · {score.version}</span>
          <h3>
            {score.final
              ? "Für den geprüften Umfang"
              : "Vorläufig · fehlende Prüfungen bleiben unbekannt"}
          </h3>
          <p>
            {coverage} % Prüfgewicht ausgewertet. Kein Google-Rang, keine
            vollständige Barrierefreiheits- oder Qualitätsgarantie.
          </p>
        </div>
      </div>
      <div
        className="score-progress"
        role="progressbar"
        aria-label="Prüfabdeckung"
        aria-valuenow={coverage}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span style={{ width: `${Math.min(100, coverage)}%` }} />
      </div>
      <div className="score-categories">
        {score.categories.map((category) => (
          <div className="score-category" key={category.category}>
            <div>
              {categoryLabel(category.category)}
              <br />
              <span>
                Gewicht{" "}
                {Math.round(
                  category.weight <= 1
                    ? category.weight * 100
                    : category.weight,
                )}{" "}
                %
              </span>
            </div>
            <strong>
              {category.applicableWeight === 0
                ? "N/A"
                : category.lower === category.upper
                  ? `${Math.round(category.lower)}/100`
                  : `${Math.round(category.lower)}–${Math.round(category.upper)}/100`}
            </strong>
          </div>
        ))}
      </div>
      {score.criticalCount > 0 && (
        <p className="plan-note">
          <strong>
            {score.criticalCount} kritische Befunde bleiben sichtbar.
          </strong>{" "}
          Ein guter Durchschnitt hebt einen Blocker nicht auf.
        </p>
      )}
      {score.warnings.length > 0 && (
        <details className="plan-note">
          <summary>Grenzen dieser Bewertung</summary>
          {score.warnings.map((warning, index) => (
            <p key={index}>{warning}</p>
          ))}
        </details>
      )}
    </div>
  );
}
