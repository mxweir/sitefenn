import { SaxesParser } from "saxes";
import type { SitemapImport } from "../../shared/types.js";
import { permittedUrl, readScoped, type SeoPolicy } from "./seo-network.js";
export function parseSitemap(xml: string): {
  kind: "urlset" | "sitemapindex";
  locations: string[];
  limited: boolean;
} {
  if (Buffer.byteLength(xml) > 1024 * 1024)
    throw new Error("XML größer als 1 MiB.");
  const parser = new SaxesParser({ xmlns: true }),
    stack: string[] = [],
    locations: string[] = [];
  let root = "",
    text = "",
    entries = 0,
    limited = false;
  parser.on("doctype", () => {
    throw new Error("DTD und externe Entitäten sind nicht erlaubt.");
  });
  parser.on("opentag", (tag) => {
    if (stack.length >= 20)
      throw new Error("XML-Verschachtelung überschreitet das Limit.");
    if (!root) {
      root = tag.local;
      if (
        !["urlset", "sitemapindex"].includes(root) ||
        tag.uri !== "http://www.sitemaps.org/schemas/sitemap/0.9"
      )
        throw new Error(
          "Sitemap-Namespace oder Wurzelelement nicht unterstützt.",
        );
    }
    if (stack.at(-1) === "loc")
      throw new Error(
        "Verschachtelte Elemente in loc werden nicht unterstützt.",
      );
    if (
      stack.length <= 2 &&
      ["url", "sitemap", "loc"].includes(tag.local) &&
      tag.uri !== "http://www.sitemaps.org/schemas/sitemap/0.9"
    )
      throw new Error("Fremder Namespace in Sitemap-Kernelementen.");
    stack.push(tag.local);
    if (tag.local === "loc") text = "";
  });
  const collect = (value: string) => {
    if (stack.at(-1) === "loc") {
      text += value;
      if (text.length > 2048) throw new Error("Sitemap-URL zu lang.");
    }
  };
  parser.on("text", collect);
  parser.on("cdata", collect);
  parser.on("closetag", (tag) => {
    if (
      tag.local === "loc" &&
      stack.length === 3 &&
      stack[1] === (root === "urlset" ? "url" : "sitemap")
    ) {
      entries++;
      if (entries <= 500) locations.push(text.trim());
      else limited = true;
    }
    stack.pop();
  });
  parser.write(xml).close();
  return { kind: root as "urlset" | "sitemapindex", locations, limited };
}
export async function importSitemap(
  input: { sitemapUrl: string; maxPages: number } & SeoPolicy,
): Promise<SitemapImport> {
  input = { ...input, requestBudget: { remaining: 20 } };
  const result: SitemapImport = {
      urls: [],
      documents: [],
      excluded: [],
      warnings: [],
      limited: false,
    },
    signal = AbortSignal.timeout(30000),
    queue = [
      { url: permittedUrl(input.sitemapUrl, input.url, input), depth: 0 },
    ],
    seen = new Set<string>();
  const limit = Math.max(1, Math.min(30, input.maxPages));
  let total = 0;
  while (
    queue.length &&
    seen.size < 5 &&
    result.urls.length < limit &&
    !signal.aborted
  ) {
    const next = queue.shift()!;
    if (seen.has(next.url)) continue;
    seen.add(next.url);
    if (total >= 4 * 1024 * 1024) {
      result.limited = true;
      break;
    }
    try {
      const response = await readScoped(
        next.url,
        input,
        signal,
        Math.min(1024 * 1024, 4 * 1024 * 1024 - total),
        true,
      );
      if (response.statusCode !== 200)
        throw new Error(
          `HTTP ${response.statusCode}; keine Sitemap importiert.`,
        );
      total += Buffer.byteLength(response.body);
      if (total > 4 * 1024 * 1024)
        throw new Error("Gesamtbudget von 4 MiB erreicht.");
      const parsed = parseSitemap(response.body);
      result.limited ||= parsed.limited;
      result.documents.push({
        url: next.url,
        status: "read",
        entries: parsed.locations.length,
        detail: parsed.kind,
      });
      for (const value of parsed.locations) {
        let url;
        try {
          if (!/^https?:\/\//i.test(value))
            throw new Error("Sitemap-URLs müssen absolut sein.");
          url = permittedUrl(value, response.url, input);
        } catch {
          if (result.excluded.length < 50)
            result.excluded.push(value.slice(0, 2048));
          continue;
        }
        if (parsed.kind === "sitemapindex") {
          if (next.depth < 2 && queue.length < 10 && !seen.has(url))
            queue.push({ url, depth: next.depth + 1 });
          else result.limited = true;
        } else if (!result.urls.includes(url)) {
          if (result.urls.length < limit) result.urls.push(url);
          else result.limited = true;
        }
      }
    } catch (error) {
      result.documents.push({
        url: next.url,
        status: "failed",
        entries: 0,
        detail: (error as Error).message,
      });
      result.warnings.push(
        `Eine Sitemap konnte nicht vollständig importiert werden: ${(error as Error).message}`,
      );
    }
  }
  if (queue.length || signal.aborted) result.limited = true;
  if (result.limited)
    result.warnings.push(
      "Importgrenze erreicht: maximal 5 Dokumente, 2 Indexebenen, 500 Einträge pro Dokument und das gewählte Seitenlimit. Kein vollständiger Website-Index.",
    );
  return result;
}
