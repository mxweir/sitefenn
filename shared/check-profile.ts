import type { Environment, ScanOptions } from "./types.js";
export interface CheckProfile {
  version: "sitefenn-profile-1";
  projectId: string;
  url: string;
  environment: Environment;
  options: ScanOptions;
  gate: {
    minimumPriority: "critical" | "important";
    categories: (
      | "layout"
      | "accessibility"
      | "seo"
      | "runtime"
      | "performance"
    )[];
  };
}
