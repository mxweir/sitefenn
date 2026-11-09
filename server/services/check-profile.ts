import type { CheckProfile } from "../../shared/check-profile.js";
import { normalizeScanOptions } from "../options.js";
import { parseTarget } from "../security.js";

const categories = ["layout", "accessibility", "seo", "runtime", "performance"];

export function parseGatePolicy(input: unknown): CheckProfile["gate"] {
  const gate = input as CheckProfile["gate"] | undefined;
  if (
    !gate ||
    !["critical", "important"].includes(gate.minimumPriority) ||
    !Array.isArray(gate.categories) ||
    !gate.categories.length ||
    new Set(gate.categories).size !== gate.categories.length ||
    gate.categories.some((category) => !categories.includes(category))
  )
    throw Error("Ungültige Gate-Policy.");
  return { minimumPriority: gate.minimumPriority, categories: gate.categories };
}

export function parseCheckProfile(input: unknown): CheckProfile {
  const profile = input as CheckProfile | undefined;
  if (
    profile?.version !== "sitefenn-profile-1" ||
    typeof profile.projectId !== "string" ||
    !profile.projectId ||
    profile.projectId.length > 100 ||
    (profile.name !== undefined &&
      (typeof profile.name !== "string" || profile.name.length > 100)) ||
    !["production", "staging", "local"].includes(profile.environment) ||
    !Array.isArray(profile.options?.pages) ||
    !Array.isArray(profile.options?.viewports)
  )
    throw Error("Ungültiges Prüfprofil.");
  const target = parseTarget(profile.url, {
    allowLocal: profile.environment === "local",
  });
  const options = normalizeScanOptions(profile.options, target.href);
  const gate = parseGatePolicy(profile.gate);
  if (gate.categories.includes("performance") && !options.performance)
    throw Error("Performance-Gate benötigt aktivierte Performance-Messung.");
  return { ...profile, url: target.href, options, gate };
}
