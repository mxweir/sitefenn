export type Environment = "production" | "staging" | "local";
export interface Project {
  id: string;
  name: string;
  url: string;
  environment: Environment;
  createdAt: string;
}
export interface Check {
  id: string;
  label: string;
  status: "pass" | "fail" | "info";
  detail: string;
}
export interface ScanResult {
  title: string;
  url: string;
  statusCode: number;
  viewport: { width: number; height: number };
  screenshotPath: string;
  checks: Check[];
  durationMs: number;
  audit?: AuditReport;
}
export interface Scan {
  id: string;
  projectId: string;
  status:
    | "queued"
    | "running"
    | "paused"
    | "completed"
    | "failed"
    | "interrupted"
    | "cancelled";
  createdAt: string;
  finishedAt: string | null;
  error: string | null;
  result: ScanResult | null;
  options?: ScanOptions;
  progress?: ScanProgress;
}

export type Category =
  | "layout"
  | "accessibility"
  | "seo"
  | "runtime"
  | "performance";
export type Priority = "critical" | "important" | "nice-to-have";
export type RuleStatus = "pass" | "fail" | "not_run" | "not_applicable";
export type EvidenceStatus = "measured" | "heuristic" | "ai";
export interface ViewportProfile {
  id: string;
  width: number;
  height: number;
  isMobile?: boolean;
  hasTouch?: boolean;
  deviceScaleFactor?: number;
}
export const VIEWPORTS: ViewportProfile[] = [
  { id: "desktop", width: 1440, height: 900, deviceScaleFactor: 1 },
  {
    id: "tablet",
    width: 768,
    height: 1024,
    hasTouch: true,
    deviceScaleFactor: 1,
  },
  {
    id: "mobile",
    width: 390,
    height: 844,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  },
];
export interface ScanOptions {
  pages: string[];
  maxPages: number;
  maxDepth: number;
  excludedPaths: string[];
  viewports: ViewportProfile[];
  performance: boolean;
  performanceRuns: 1 | 3;
}
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Evidence {
  id: string;
  path: string;
  pageUrl: string;
  viewportId: string;
  width: number;
  height: number;
  scrollX: number;
  scrollY: number;
  state: string;
  capturedAt: string;
}
export interface Finding {
  id: string;
  fingerprint: string;
  ruleId: string;
  category: Category;
  priority: Priority;
  title: string;
  detail: string;
  pageUrl: string;
  viewportId: string;
  state: string;
  evidenceId?: string;
  selector?: string;
  rect?: Rect;
  evidenceStatus: EvidenceStatus;
  recommendation: string;
  acceptance: string;
  source?: string;
}
export interface RuleResult {
  id: string;
  ruleId: string;
  category: Category;
  status: RuleStatus;
  weight: number;
  pageUrl: string;
  viewportId: string;
  state: string;
  detail: string;
  findingIds: string[];
  evidenceId?: string;
}
export interface PageRun {
  id: string;
  pageUrl: string;
  finalUrl: string;
  viewportId: string;
  state: string;
  title: string;
  statusCode: number | null;
  status: "completed" | "failed";
  durationMs: number;
  evidenceId?: string;
  error?: string;
}
export interface PerformanceSample {
  pageUrl: string;
  device: "desktop" | "mobile";
  score: number | null;
  runs: number;
  metrics: {
    lcp: number | null;
    cls: number | null;
    tbt: number | null;
    fcp: number | null;
    speedIndex: number | null;
  };
  error?: string;
  spread?: number;
}
export interface AuditReport {
  schemaVersion: 1;
  ruleVersion: string;
  profileVersion: string;
  browserVersion: string;
  options: ScanOptions;
  pages: PageRun[];
  rules: RuleResult[];
  findings: Finding[];
  evidence: Evidence[];
  discoveredUrls: string[];
  coverage: { planned: number; completed: number; skipped: string[] };
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  performance: PerformanceSample[];
  warnings: string[];
}
export interface ScanProgress {
  phase: string;
  message: string;
  completed: number;
  total: number;
  pageUrl?: string;
  viewportId?: string;
  updatedAt: string;
}
export interface LiveFrame {
  id: string;
  pageUrl: string;
  viewportId: string;
  width: number;
  height: number;
  scrollX: number;
  scrollY: number;
  state: string;
  capturedAt: string;
  image: string;
  rects: { rect: Rect; findingId: string; priority: Priority; label: string }[];
}
export type WorkerEvent =
  | { type: "progress"; progress: ScanProgress }
  | { type: "frame"; frame: LiveFrame }
  | { type: "finding"; finding: Finding }
  | { type: "checkpoint"; result: ScanResult };
export interface DiscoveryResult {
  urls: string[];
  warnings: string[];
  excluded: string[];
}
export interface ScoreCategory {
  category: Category;
  weight: number;
  lower: number;
  upper: number;
  coverage: number;
  passedWeight: number;
  failedWeight: number;
  unknownWeight: number;
  applicableWeight: number;
}
export interface ScoreSummary {
  version: string;
  lower: number | null;
  upper: number | null;
  coverage: number;
  final: boolean;
  categories: ScoreCategory[];
  criticalCount: number;
  warnings: string[];
}
export type TaskStatus =
  | "open"
  | "in-progress"
  | "review"
  | "verified"
  | "accepted";
export interface AuditTask {
  id: string;
  scanId: string;
  projectId: string;
  title: string;
  category: Category;
  priority: Priority;
  status: TaskStatus;
  findingIds: string[];
  summary: string;
  recommendation: string;
  acceptance: string;
  updatedAt: string;
  verifiedByScanId?: string;
}
export interface ComparisonEntry {
  fingerprint: string;
  title: string;
  state: "new" | "persistent" | "resolved" | "not-retested" | "not-comparable";
  beforeFindingId?: string;
  afterFindingId?: string;
}
export interface ScanComparison {
  beforeId: string;
  afterId: string;
  comparable: boolean;
  reason: string;
  scoreDelta: number | null;
  beforeScore: ScoreSummary;
  afterScore: ScoreSummary;
  entries: ComparisonEntry[];
}
export interface AiRecommendation {
  findingId: string;
  explanation: string;
  action: string;
  acceptance: string;
  uncertainty: string;
}
export interface AiPlan {
  id?: string;
  model: string;
  createdAt: string;
  summary: string;
  recommendations: AiRecommendation[];
  warnings: string[];
}
export interface HubSettings {
  model: string;
  speechEnabled: boolean;
}
export type SearchDimension = "date" | "page" | "query" | "country" | "device";
export interface SearchImportMetadata {
  property: string;
  startDate: string;
  endDate: string;
  dimension: SearchDimension;
  filters: Record<string, string> | null;
}
export interface SearchRow {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number | null;
  position: number | null;
}
export interface SearchDataset {
  id: string;
  projectId: string;
  metadata: SearchImportMetadata;
  importedAt: string;
  rows: SearchRow[];
  warnings: string[];
  summary: {
    clicks: number;
    impressions: number;
    ctr: number | null;
    position: number | null;
    label: string;
  };
}
export interface Dependency {
  id: string;
  label: string;
  status: "ready" | "missing" | "optional";
  detail: string;
  instruction?: string;
}
