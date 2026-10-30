import type {
  AuditTask,
  AuditReport,
  SearchDataset,
  Category,
} from "../../shared/types.js";
import { propertyContains } from "./google-search.js";
export interface PriorityWeights {
  severity: number;
  reach: number;
  categories: Record<Category, number>;
}
export const DEFAULT_WEIGHTS: PriorityWeights = {
  severity: 70,
  reach: 30,
  categories: {
    layout: 1,
    accessibility: 1,
    seo: 1,
    runtime: 1,
    performance: 1,
  },
};
export function priorityWeights(value: unknown): PriorityWeights {
  if (value === undefined) return structuredClone(DEFAULT_WEIGHTS);
  const v = value as PriorityWeights;
  if (
    !v ||
    typeof v !== "object" ||
    Object.keys(v).some(
      (k) => !["severity", "reach", "categories"].includes(k),
    ) ||
    ![v.severity, v.reach].every(
      (n) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 100,
    ) ||
    v.severity + v.reach !== 100 ||
    !v.categories ||
    Object.keys(v.categories).length !== 5 ||
    Object.keys(DEFAULT_WEIGHTS.categories).some((k) => {
      const n = v.categories[k as Category];
      return typeof n !== "number" || !Number.isFinite(n) || n < 0.5 || n > 2;
    })
  )
    throw Error(
      "Gewichte: Schwere + Reichweite = 100; alle Kategoriegewichte zwischen 0,5 und 2.",
    );
  return structuredClone(v);
}
export function workPriorities(
  report: AuditReport,
  tasks: AuditTask[],
  dataset: SearchDataset | undefined,
  weights = DEFAULT_WEIGHTS,
) {
  if (
    dataset &&
    (dataset.metadata.dimension !== "page" ||
      !report.options.pages.every((p) =>
        propertyContains(dataset.metadata.property, p),
      ))
  )
    throw Error("Für Reichweite einen passenden Seiten-Import wählen.");
  const max = Math.max(1, ...(dataset?.rows.map((r) => r.impressions) ?? []));
  const entries = tasks
    .filter((t) => !["verified", "accepted"].includes(t.status))
    .map((task) => {
      const findings = report.findings.filter((f) =>
        task.findingIds.includes(f.id),
      );
      const measured = findings.filter((f) => f.evidenceStatus === "measured");
      const severity = Math.max(
        0,
        ...measured.map(
          (f) =>
            ({ critical: 100, important: 60, "nice-to-have": 20 })[f.priority],
        ),
      );
      const pages = [...new Set(findings.map((f) => f.pageUrl))];
      const rows = dataset?.rows.filter((r) => pages.includes(r.key)) ?? [];
      // Same-page viewport duplicates never multiply reach. Max observed page avoids summing overlapping aggregates.
      const impressions = rows.length
        ? Math.max(...rows.map((r) => r.impressions))
        : null;
      const reach =
        impressions === null
          ? null
          : (100 * Math.log1p(impressions)) / Math.log1p(max);
      const score = Math.round(
        ((severity * weights.severity) / 100 +
          ((reach ?? 0) * weights.reach) / 100) *
          weights.categories[task.category],
      );
      return {
        taskId: task.id,
        title: task.title,
        category: task.category,
        priority: task.priority,
        score,
        severity,
        reach: reach === null ? null : Math.round(reach),
        impressions,
        pages,
        provisional: reach === null || measured.length !== findings.length,
        reason: `Schwere ${severity} × ${weights.severity}% + ${reach === null ? "Reichweite unbekannt" : `Reichweite ${Math.round(reach)} × ${weights.reach}%`} · Kategorie × ${weights.categories[task.category]}. Reichweite: größter beobachteter Seitenwert; keine Addition von Ansichten.`,
      };
    })
    .sort((a, b) => b.score - a.score || a.taskId.localeCompare(b.taskId));
  const candidates =
    dataset?.rows
      .filter((r) => r.impressions >= 100 && r.clicks / r.impressions < 0.02)
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 20)
      .map((r) => ({
        page: r.key,
        impressions: r.impressions,
        clicks: r.clicks,
        ctr: r.clicks / r.impressions,
        reason:
          "Mindestens 100 Impressionen, berechnete CTR unter 2%: untersuchen, keine bewiesene Ursache oder erwartete Steigerung.",
      })) ?? [];
  return {
    version: "work-priority-1.7",
    weights,
    datasetId: dataset?.id ?? null,
    metadata: dataset?.metadata ?? null,
    importedAt: dataset?.importedAt ?? null,
    entries,
    candidates,
    warnings: [
      "Arbeitsreihenfolge, kein Audit-Score. Werte sind relative, erklärbare Sortierpunkte, keine Qualitäts- oder Umsatzprognose.",
      "Fehlende Zeilen bedeuten unbekannte Reichweite. Vorläufige Punkte enthalten keinen erfundenen Reichweitenbonus.",
      "CTR-Schwellen sind feste Prüfhilfen; Suchabsicht, Markenanfragen, Zeitraum und Datenlücken selbst prüfen.",
    ],
  };
}
