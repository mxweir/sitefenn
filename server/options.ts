import { normalizeJourneys } from "./services/journey-options.js";
import { VIEWPORTS, type ScanOptions } from "../shared/types.js";

export function normalizeScanOptions(
  input: unknown,
  projectUrl: string,
  demoOrigin?: string,
): ScanOptions {
  const body =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const allowed = new Set([
    "technicalSeo",
    "journeys",
    "pages",
    "maxPages",
    "maxDepth",
    "excludedPaths",
    "viewports",
    "performance",
    "performanceRuns",
  ]);
  if (Object.keys(body).some((key) => !allowed.has(key)))
    throw new Error("Unbekannte Scan-Option.");
  const maxPages = Number(body.maxPages ?? 10),
    maxDepth = Number(body.maxDepth ?? 2);
  if (
    !Number.isInteger(maxPages) ||
    maxPages < 1 ||
    maxPages > 30 ||
    !Number.isInteger(maxDepth) ||
    maxDepth < 0 ||
    maxDepth > 3
  )
    throw new Error("Seitenlimit 1–30 und Tiefe 0–3 wählen.");
  const origin = new URL(projectUrl).origin;
  const rawPages = body.pages ?? [projectUrl];
  if (
    !Array.isArray(rawPages) ||
    !rawPages.length ||
    rawPages.length > maxPages
  )
    throw new Error("Bitte 1 bis zum gewählten Seitenlimit URLs auswählen.");
  const pages = [
    ...new Set(
      rawPages.map((value) => {
        if (typeof value !== "string" || value.length > 2048)
          throw new Error("Ungültige Seiten-URL.");
        const url = new URL(value);
        url.hash = "";
        if (
          url.origin !== origin ||
          url.username ||
          url.password ||
          (demoOrigin &&
            url.pathname !== "/demo-site" &&
            !url.pathname.startsWith("/demo-site/"))
        )
          throw new Error(
            "Seiten müssen innerhalb des freigegebenen Projekt-Ursprungs liegen.",
          );
        if (
          [...url.searchParams.keys()].some((key) =>
            /^(?:access_token|token|password|secret|api_key|authorization)$/i.test(
              key,
            ),
          )
        )
          throw new Error(
            "URLs mit erkennbaren Zugangsdaten werden nicht gescannt.",
          );
        return url.href;
      }),
    ),
  ];
  const rawViewports = body.viewports ?? VIEWPORTS;
  if (
    !Array.isArray(rawViewports) ||
    rawViewports.length < 1 ||
    rawViewports.length > 3
  )
    throw new Error("Ein bis drei Geräteprofile auswählen.");
  const viewports = rawViewports.map((value) => {
    const id = typeof value === "string" ? value : value?.id;
    const profile = VIEWPORTS.find((item) => item.id === id);
    if (
      !profile ||
      (typeof value === "object" &&
        Object.entries(value).some(
          ([key, entry]) =>
            !Object.hasOwn(profile, key) ||
            profile[key as keyof typeof profile] !== entry,
        ))
    )
      throw new Error(
        "Nur die versionierten Standard-Geräteprofile werden in 1.0 unterstützt.",
      );
    return { ...profile };
  });
  if (new Set(viewports.map((item) => item.id)).size !== viewports.length)
    throw new Error("Doppelte Geräteprofile sind nicht erlaubt.");
  const excludedPaths = body.excludedPaths ?? [];
  if (
    !Array.isArray(excludedPaths) ||
    excludedPaths.length > 30 ||
    excludedPaths.some(
      (item) =>
        typeof item !== "string" ||
        item.length > 200 ||
        !item.startsWith("/") ||
        /[\\\u0000-\u001f]/.test(item),
    )
  )
    throw new Error("Ausschlüsse müssen einfache Pfadpräfixe sein.");
  if (
    pages.some((value) =>
      excludedPaths.some((prefix) =>
        new URL(value).pathname.startsWith(prefix),
      ),
    )
  )
    throw new Error("Ausgewählte Seiten widersprechen den Pfadausschlüssen.");
  if (body.performance !== undefined && typeof body.performance !== "boolean")
    throw new Error("Performance muss ein Boolean sein.");
  const performanceRuns = body.performanceRuns ?? 1;
  if (performanceRuns !== 1 && performanceRuns !== 3)
    throw new Error("Ein oder drei Performance-Messläufe wählen.");
  if (body.technicalSeo !== undefined && typeof body.technicalSeo !== "boolean")
    throw new Error("Technisches SEO muss ein Boolean sein.");
  const journeys = normalizeJourneys(
    body.journeys,
    pages,
    viewports.map((v) => v.id),
  );
  return {
    ...(journeys.length ? { journeys } : {}),
    ...(body.technicalSeo === true ? { technicalSeo: true } : {}),
    pages,
    maxPages,
    maxDepth,
    excludedPaths,
    viewports,
    performance: body.performance === true,
    performanceRuns,
  };
}
