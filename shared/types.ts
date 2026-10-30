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
  "layout" | "accessibility" | "seo" | "runtime" | "performance";
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
export interface RetestScope {
  sourceScanId: string;
  taskId: string;
  findingIds: string[];
}
export interface JourneyStep {
  action: "click" | "scroll";
  selector?: string;
  y?: number;
  expect: {
    selector: string;
    condition: "visible" | "hidden" | "open" | "closed";
  };
}
export interface Journey {
  id: string;
  name: string;
  pageUrl: string;
  viewportIds: string[];
  steps: JourneyStep[];
  confirmed: boolean;
}
export interface JourneyRun {
  journeyId: string;
  name: string;
  signature: string;
  pageUrl: string;
  viewportId: string;
  status: "not_run" | "completed" | "unknown";
  detail: string;
  steps: {
    index: number;
    state: string;
    status: "not_run" | "completed" | "unknown";
    detail: string;
    durationMs: number;
    beforeId?: string;
    afterId?: string;
  }[];
}
export interface ScanOptions {
  journeys?: Journey[];
  technicalSeo?: boolean;
  retest?: RetestScope;
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
export interface CaptureConditions {
  stateReady?: boolean;
  version: "capture-1.3";
  animations: "disabled";
  reducedMotion: "reduce";
  colorScheme: "light";
  locale: "de-DE";
  timezone: "Europe/Berlin";
  fontsReady: boolean;
  documentUrl: string;
}
export interface Evidence {
  capture?: CaptureConditions;
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
export interface AuditProvenance {
  seoVersions?: { saxes: string; robotsParser: string; parse5: string };
  appVersion: string;
  engineSha256: string;
  playwrightVersion: string;
  axeVersion: string;
  lighthouseVersion: string;
  nodeVersion: string;
  platform: string;
  arch: string;
}
export interface AuditReport {
  journeyRuns?: JourneyRun[];
  seo?: SeoContext;
  provenance?: AuditProvenance;
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
  scope?: "partial";
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
  "open" | "in-progress" | "review" | "verified" | "accepted";
export interface AuditTask {
  aiProposal?: PageSolution & { analysisId: string };
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
  partial?: boolean;
  verificationComparable?: boolean;
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
  provenance?: {
    promptVersion: string;
    promptSha256: string;
    contextSha256: string;
    modelDigest: string | null;
    modelMetadataSha256: string;
    temperature: number;
    contextTokens: number;
    predictionLimit: number;
    durationMs: number;
  };
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
export interface PageSolution {
  findingId: string;
  explanation: string;
  cause: string;
  steps: string[];
  code: { language: "none" | "html" | "css" | "javascript"; text: string };
  acceptance: string;
  uncertainty: string;
}
export interface AnalysisPart {
  attempts?: number;
  id: string;
  unitIds: string[];
  findingIds: string[];
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  summary?: string;
  solutions: PageSolution[];
  error?: string;
  provenance?: AiPlan["provenance"];
}
export interface PageAnalysis {
  kind: "page-analysis";
  id: string;
  scanId: string;
  pageUrl: string;
  model: string;
  question: string;
  parentId?: string;
  sourceHash: string;
  createdAt: string;
  updatedAt: string;
  status:
    | "queued"
    | "running"
    | "completed"
    | "partial"
    | "failed"
    | "cancelled"
    | "interrupted";
  stage: "context" | "summary" | "done";
  parts: AnalysisPart[];
  totalUnits: number;
  omitted: { unitId: string; reason: string }[];
  unexplainedFindingIds: string[];
  summary: string;
  summaryProvenance?: AiPlan["provenance"];
  warnings: string[];
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

export interface VisualMask {
  evidenceId: string;
  rect: Rect;
}
export interface VisualReference {
  id: string;
  projectId: string;
  scanId: string;
  approvedAt: string;
  masks: VisualMask[];
}
export interface VisualPair {
  before: Evidence;
  after?: Evidence;
  comparable: boolean;
  reason: string;
}
export interface VisualDiff {
  width: number;
  height: number;
  changedPixels: number;
  comparedPixels: number;
  maskedPixels: number;
  changedPercent: number;
  threshold: number;
  regions: Rect[];
  image: string;
}

export interface SitemapImport {
  urls: string[];
  documents: {
    url: string;
    status: "read" | "skipped" | "failed";
    entries: number;
    detail: string;
  }[];
  excluded: string[];
  warnings: string[];
  limited: boolean;
}
export interface SeoSnapshot {
  signalsTruncated: boolean;
  pageUrl: string;
  finalUrl: string;
  viewportId: string;
  evidenceId?: string;
  title: string;
  description: string;
  canonicals: string[];
  robots: string[];
  googlebot: string[];
  headerRobots: string[];
  links: { url: string; text: string; rel: string }[];
  linksTruncated: boolean;
  jsonld: { status: RuleStatus; detail: string; types: string[] };
  jsonldTruncated: boolean;
}
export interface SeoProbe {
  url: string;
  finalUrl?: string;
  statusCode: number | null;
  redirects: { url: string; statusCode: number; to: string }[];
  outcome: "checked" | "restricted" | "unknown";
  detail: string;
  checkedAt: string;
  noindex?: boolean;
  canonicals?: string[];
}
export interface SeoContext {
  version: "technical-seo-1.4";
  pages: SeoSnapshot[];
  probes: SeoProbe[];
  robots: {
    url: string;
    statusCode: number | null;
    googlebot: { pageUrl: string; allowed: boolean | null }[];
    detail: string;
  };
  graph: {
    from: string;
    to: string;
    text: string;
    rel: string;
    viewportIds: string[];
    probeUrl?: string;
  }[];
  duplicates: {
    kind: "title" | "description";
    value: string;
    pages: string[];
    viewportId: string;
  }[];
  coverage: {
    linkTargets: number;
    checkedTargets: number;
    limit: number;
    omittedTargets: number;
    linksTruncated: boolean;
  };
  warnings: string[];
}
