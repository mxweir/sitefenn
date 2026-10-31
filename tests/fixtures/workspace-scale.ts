import { Store } from "../../server/store.js";
import type { AuditTask, ScanResult } from "../../shared/types.js";
import { normalizeScanOptions } from "../../server/options.js";
export function seedWorkspaceScale(
  store: Store,
  count = 1000,
  taskCount = 10000,
) {
  const old = store.createProject(
    "Old quiet project",
    "https://quiet.example/",
    "production",
  );
  const first = store.createScan(old.id);
  store.fail(first.id, "Synthetic old project");
  const project = store.createProject(
    "Owned scale fixture",
    "https://scale.example/",
    "production",
  );
  const options = normalizeScanOptions(
    { pages: [project.url], viewports: ["mobile"], performance: false },
    project.url,
  );
  const scanIds: string[] = [];
  const result: ScanResult = {
    title: "Owned synthetic scan",
    url: project.url,
    statusCode: 200,
    viewport: { width: 390, height: 844 },
    screenshotPath: "",
    durationMs: 1,
    checks: [
      {
        id: "synthetic",
        label: "FULL-REPORT-ONLY",
        status: "info",
        detail: "FULL-REPORT-ONLY-" + "x".repeat(16384),
      },
    ],
  };
  store.db.exec("BEGIN IMMEDIATE");
  try {
    for (let i = 0; i < count; i++) {
      const s = store.createScan(project.id, options);
      store.finish(s.id, {
        ...result,
        title: `Owned synthetic scan ${String(i).padStart(4, "0")}`,
      });
      scanIds.push(s.id);
    }
    for (let i = 0; i < taskCount; i++) {
      const task: AuditTask = {
        id: `scale-task-${String(i).padStart(5, "0")}`,
        projectId: project.id,
        scanId: scanIds[i % scanIds.length]!,
        findingIds: [`synthetic-finding-${i}`],
        title: `Scale task ${String(i).padStart(5, "0")}`,
        category: "layout",
        priority: "important",
        status: "open",
        summary: "Synthetic metadata only",
        recommendation: "Inspect owned fixture",
        acceptance: "Retest separately",
        updatedAt: new Date().toISOString(),
      };
      store.putTask(task);
    }
    store.db.exec("COMMIT");
  } catch (e) {
    store.db.exec("ROLLBACK");
    throw e;
  }
  return { project, old, scanIds };
}
