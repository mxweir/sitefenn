import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { APP_VERSION } from "../shared/version.js";
import type { AuditProvenance } from "../shared/types.js";

const require = createRequire(import.meta.url);
export const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");
let cached: Promise<AuditProvenance> | undefined;
export function auditProvenance(): Promise<AuditProvenance> {
  return (cached ??= (async () => {
    const extension = import.meta.url.endsWith(".ts") ? ".ts" : ".js";
    const names = [
      "audit-engine",
      "network-proxy",
      "security",
      "services/scoring",
    ];
    const sources = await Promise.all(
      names.map((name) =>
        readFile(new URL(`./${name}${extension}`, import.meta.url), "utf8"),
      ),
    );
    return {
      appVersion: APP_VERSION,
      engineSha256: sha256(sources.join("\n--module--\n")),
      playwrightVersion: require("playwright/package.json").version,
      axeVersion: require("axe-core/package.json").version,
      lighthouseVersion: require("lighthouse/package.json").version,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    };
  })());
}
