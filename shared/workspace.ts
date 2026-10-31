import type { AuditTask, Scan, ScoreSummary } from "./types.js";
export interface ScanSummary extends Scan {
  score?: ScoreSummary;
  counts?: { completed: number; planned: number; findings: number };
}
export interface CursorPage<T> {
  items: T[];
  total: number;
  nextCursor: string | null;
}
export interface ProjectStats {
  scans: number;
  tasks: number;
  verified: number;
}
export type TaskPage = CursorPage<AuditTask>;
