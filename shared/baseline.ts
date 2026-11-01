export interface BaselineChange {
  id: string;
  projectId: string;
  name: string;
  note: string;
  createdAt: string;
  candidateId: string;
  controlId: string;
  previousId: string | null;
  snapshotHash: string;
  meaning: string;
}
