import type { PageSolution } from "./types.js";
export const FEEDBACK_CLASSES = [
  "factual-contradiction",
  "bad-code",
  "bad-acceptance",
  "missing-context",
] as const;
export type FeedbackClass = (typeof FEEDBACK_CLASSES)[number];
export interface ProposalEdits {
  steps: string[];
  acceptance: string;
  code: PageSolution["code"];
  codeMode: "none" | "captured" | "illustrative";
}
export interface ReviewIssue {
  code: string;
  detail: string;
}
export interface ProposalReview {
  id: string;
  analysisId: string;
  scanId: string;
  findingId: string;
  createdAt: string;
  status: "draft" | "approved" | "needs-context";
  sourceHash: string;
  originalSha256: string;
  factsSha256: string;
  binding: {
    pageUrl: string;
    viewportId: string;
    state: string;
    selector: string | null;
    reference: string;
  };
  edits: ProposalEdits;
  issues: ReviewIssue[];
  meaning: string;
}
export interface AnalysisFeedback {
  id: string;
  analysisId: string;
  scanId: string;
  findingId?: string;
  createdAt: string;
  category: FeedbackClass;
  note: string;
  reviewId?: string;
}
