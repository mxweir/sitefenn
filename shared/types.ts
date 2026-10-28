export type Environment = 'production' | 'staging' | 'local';
export interface Project { id: string; name: string; url: string; environment: Environment; createdAt: string }
export interface Check { id: string; label: string; status: 'pass' | 'fail' | 'info'; detail: string }
export interface ScanResult {
  title: string; url: string; statusCode: number; viewport: { width: number; height: number };
  screenshotPath: string; checks: Check[]; durationMs: number;
}
export interface Scan {
  id: string; projectId: string; status: 'queued' | 'running' | 'completed' | 'failed' | 'interrupted';
  createdAt: string; finishedAt: string | null; error: string | null; result: ScanResult | null;
}
export interface Dependency { id: string; label: string; status: 'ready' | 'missing' | 'optional'; detail: string; instruction?: string }
