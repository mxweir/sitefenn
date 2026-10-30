import type {
  AnalysisContext,
  AuditReport,
  AuditTask,
  Scan,
} from "../../shared/types.js";
import { compareScans } from "./comparison.js";
export function analysisContext(
  input: unknown,
  report: AuditReport,
  pageUrl: string,
  tasks: AuditTask[] = [],
  comparison?: { before: Scan; after: Scan },
): AnalysisContext {
  const value = input === undefined ? {} : input;
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some(
      (k) => !["purpose", "goal", "audience", "focusFindingId"].includes(k),
    )
  )
    throw Error("Ungültiger Analysekontext.");
  const context: AnalysisContext = {};
  for (const [k, v] of Object.entries(value)) {
    if (
      typeof v !== "string" ||
      v.length > (k === "focusFindingId" ? 100 : 500) ||
      /[\u0000-\u001f]/.test(v)
    )
      throw Error("Kontextfelder: maximal 500 Zeichen ohne Steuerzeichen.");
    if (v.trim()) (context as Record<string, unknown>)[k] = v.trim();
  }
  const ids = new Set(
    report.findings.filter((f) => f.pageUrl === pageUrl).map((f) => f.id),
  );
  if (context.focusFindingId && !ids.has(context.focusFindingId))
    throw Error("Schwerpunkt muss ein Befund derselben Seite sein.");
  const related = tasks.filter((t) => t.findingIds.some((id) => ids.has(id)));
  context.tasks = related.slice(0, 40).map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    findingIds: t.findingIds.filter((id) => ids.has(id)),
  }));
  context.omissions =
    related.length > 40
      ? [`${related.length - 40} Aufgaben außerhalb der 40-Einträge-Grenze.`]
      : [];
  if (comparison) {
    const { before, after } = comparison;
    if (
      before.id === after.id ||
      before.createdAt >= after.createdAt ||
      before.projectId !== after.projectId ||
      !before.result?.audit ||
      !after.result?.audit
    )
      throw Error("Vergleich braucht zwei Checks desselben Projekts.");
    const compared = compareScans(before, after);
    if (!compared.comparable)
      throw Error(
        "Dieser Vergleich hat keine kompatible vollständige Messidentität.",
      );
    const oldIds = new Set(
      before.result.audit.findings
        .filter((f) => f.pageUrl === pageUrl)
        .map((f) => f.id),
    );
    const entries = compared.entries.filter(
      (e) =>
        (e.beforeFindingId && oldIds.has(e.beforeFindingId)) ||
        (e.afterFindingId && ids.has(e.afterFindingId)),
    );
    context.comparison = {
      scanId: before.id,
      finishedAt: before.finishedAt ?? before.createdAt,
      entries: entries.slice(0, 100),
    };
    if (entries.length > 100)
      context.omissions.push(
        `${entries.length - 100} Vergleichseinträge außerhalb der 100-Einträge-Grenze.`,
      );
  }
  return context;
}
