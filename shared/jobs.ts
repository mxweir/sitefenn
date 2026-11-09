export type JobKind = "browser" | "ai" | "export" | "backup" | "maintenance";
export type JobPhase =
  | "queued"
  | "running"
  | "paused"
  | "cancelling"
  | "cleaning-up"
  | "completed"
  | "failed"
  | "cancelled"
  | "interrupted";

export interface WorkspaceJob {
  id: string;
  kind: JobKind;
  phase: JobPhase;
  createdAt: string;
  updatedAt: string;
  projectId?: string;
  scanId?: string;
  progress?: { completed: number; total: number; unit: "steps" | "bytes" };
  reason?: string;
  failure?: "disk-full" | "interrupted" | "worker" | "operation";
  downloadable?: boolean;
  cancellable?: boolean;
}

export const activeJob = (phase: JobPhase) =>
  ["queued", "running", "paused", "cancelling", "cleaning-up"].includes(phase);
