/** Release evidence, not a live metric or accuracy promise for the user's website. */
export const QUALITY_REFERENCE = {
  date: "2026-10-29",
  dataset: "supplemental-layout-1.1-v3",
  cases: 20,
  profiles: 3,
  repeats: 3,
  uniqueLabels: 120,
  realSites: 3,
  realRuns: 9,
  fixes: [
    "Inaktive und unsichtbare Bedienelemente verursachen keine Überdeckungsalarme.",
    "Dialoge werden innen geprüft; versteckte Dialoge unterdrücken keine Befunde.",
    "Feste und haftende Ebenen bleiben Prüfkandidaten; ihre Fehlerbewertung ist unbekannt.",
    "Markierungen in gescrollten Aufnahmen verwenden Dokumentkoordinaten.",
  ],
};
