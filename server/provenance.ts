import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
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
      "services/technical-seo",
      "services/seo-network",
      "services/seo-meta",
      "services/sitemap",
      "services/journeys",
      "services/journey-options",
      "services/element-context",
      "../shared/journeys",
      "../shared/report-contract",
    ];
    const sources = await Promise.all(
      names.map((name) =>
        readFile(new URL(`./${name}${extension}`, import.meta.url), "utf8"),
      ),
    );
    const hashModules = async (names: string[]) =>
      sha256(
        (
          await Promise.all(
            names.map((name) =>
              readFile(
                new URL(`./${name}${extension}`, import.meta.url),
                "utf8",
              ),
            ),
          )
        ).join("\n--module--\n"),
      );
    return {
      measurement: {
        version: "measurement-identity-2.4",
        captureSha256: await hashModules([
          ...names,
          "scan-worker",
          "../shared/viewports",
        ]),
        normalizationSha256: await hashModules([
          "options",
          "app",
          "services/journey-options",
          "../shared/journeys",
          "../shared/viewports",
        ]),
        verificationSha256: await hashModules([
          "runner",
          "services/reports",
          "services/comparison",
          "services/measurement-identity",
          "services/problem-identity",
          "../shared/canonical",
          "services/scoring",
          "services/release-gate",
          "../shared/report-contract",
        ]),
      },
      seoVersions: {
        saxes: require("saxes/package.json").version,
        robotsParser: require("robots-parser/package.json").version,
        parse5: JSON.parse(
          await readFile(
            join(dirname(require.resolve("parse5")), "..", "package.json"),
            "utf8",
          ),
        ).version,
      },
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
