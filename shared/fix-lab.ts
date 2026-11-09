export const LAB_PROPERTIES = [
  "width",
  "max-width",
  "min-width",
  "box-sizing",
  "overflow-wrap",
] as const;
export type LabOperation =
  | { type: "css"; property: (typeof LAB_PROPERTIES)[number]; value: string }
  | { type: "rename"; value: string };
export interface LabMeasurement {
  documentOverflow: number;
  targetWidth: number;
  targetOutside: boolean;
  targetVisible: boolean;
  visibleControls: number;
  unresolvedAnchors: number;
}
export interface LabResult {
  before: LabMeasurement;
  after: LabMeasurement;
  originalImage: string;
  changedImage: string;
}
