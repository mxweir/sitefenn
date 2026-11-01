import type { Environment, ScanOptions } from "./types.js";
export interface CheckProfile {
  version: "sitefenn-profile-1";
  name?: string;
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
