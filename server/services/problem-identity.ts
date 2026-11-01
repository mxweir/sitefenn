import { createHash } from "node:crypto";
import { canonical } from "../../shared/canonical.js";
import type { Finding } from "../../shared/types.js";
export function locationKey(f: Finding, withSelector = true) {
  const url = new URL(f.pageUrl);
  url.hash = "";
  return canonical([
    f.ruleId,
    f.category,
    url.href,
    f.viewportId,
    f.state,
    ...(withSelector ? [f.selector ?? null] : []),
  ]);
}
export function problemId(projectId: string, f: Finding) {
  return createHash("sha256")
    .update(canonical(["problem-location-2.4", projectId, locationKey(f)]))
    .digest("hex");
}
