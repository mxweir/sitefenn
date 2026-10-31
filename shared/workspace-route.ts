export const WORKSPACE_TABS = [
  "overview",
  "live",
  "tasks",
  "history",
  "report",
  "analysis",
  "compare",
  "states",
  "seo",
  "search",
] as const;
export type WorkspaceTab = (typeof WORKSPACE_TABS)[number];
export interface WorkspaceRoute {
  projectId: string | null;
  scanId: string | null;
  taskId: string | null;
  findingId?: string;
  page?: string;
  tab: WorkspaceTab;
  screen: "projects" | "system";
  panel: "evidence" | "explain" | "handoff";
}
export const emptyRoute: WorkspaceRoute = {
  projectId: null,
  scanId: null,
  taskId: null,
  tab: "overview",
  screen: "projects",
  panel: "evidence",
};
export function parseWorkspaceRoute(search: string): WorkspaceRoute {
  const p = new URLSearchParams(search);
  const id = (name: string) => {
    const value = p.get(name);
    return value && /^[a-zA-Z0-9_-]{1,160}$/.test(value) ? value : null;
  };
  const view = p.get("view");
  return {
    projectId: id("project"),
    scanId: id("scan"),
    taskId: id("task"),
    findingId: id("finding") ?? undefined,
    page: p.get("page")?.slice(0, 2048) || undefined,
    tab: WORKSPACE_TABS.includes(view as WorkspaceTab)
      ? (view as WorkspaceTab)
      : "overview",
    screen: p.get("screen") === "system" ? "system" : "projects",
    panel: ["evidence", "explain", "handoff"].includes(p.get("panel") ?? "")
      ? (p.get("panel") as WorkspaceRoute["panel"])
      : "evidence",
  };
}
export function workspaceSearch(route: WorkspaceRoute): string {
  const p = new URLSearchParams();
  if (route.projectId) p.set("project", route.projectId);
  if (route.scanId) p.set("scan", route.scanId);
  p.set("view", route.tab);
  if (route.taskId) p.set("task", route.taskId);
  if (route.findingId) p.set("finding", route.findingId);
  if (route.page) p.set("page", route.page);
  if (route.panel !== "evidence") p.set("panel", route.panel);
  if (route.screen === "system") p.set("screen", "system");
  return `?${p}`;
}
