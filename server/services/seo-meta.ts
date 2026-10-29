import { parse } from "parse5";
import type { RuleStatus } from "../../shared/types.js";
export function hasNoindex(
  meta: string[],
  googlebot: string[],
  headers: string[],
): boolean {
  if (
    [...meta, ...googlebot].some((value) =>
      /(?:^|[,\s])(?:noindex|none)(?:$|[,\s])/i.test(value),
    )
  )
    return true;
  for (const header of headers) {
    let agent = "*";
    for (const part of header.split(",")) {
      let token = part.trim().toLowerCase();
      const match = token.match(/^([a-z*][\w*-]*):\s*(.*)$/);
      if (match) {
        if (match[1] === "unavailable_after") continue;
        agent = match[1]!;
        token = match[2]!;
      }
      if (
        ["*", "googlebot"].includes(agent) &&
        /^(?:noindex|none)(?:\s|$)/.test(token)
      )
        return true;
    }
  }
  return false;
}
interface Node {
  tagName?: string;
  attrs?: { name: string; value: string }[];
  childNodes?: Node[];
}
export function rawSeoMeta(html: string): {
  canonicals: string[];
  robots: string[];
  googlebot: string[];
} {
  const root = parse(html) as unknown as Node,
    queue = [root],
    result = {
      canonicals: [] as string[],
      robots: [] as string[],
      googlebot: [] as string[],
    };
  let count = 0;
  while (queue.length) {
    const n = queue.pop()!;
    if (++count > 30000) throw new Error("HTML-Knotenbudget erreicht.");
    if (n.childNodes) queue.push(...n.childNodes);
    const attr = (key: string) =>
      n.attrs?.find((a) => a.name === key)?.value ?? "";
    if (
      n.tagName === "link" &&
      attr("rel").toLowerCase().split(/\s+/).includes("canonical")
    )
      result.canonicals.push(attr("href").slice(0, 2048));
    if (
      n.tagName === "meta" &&
      ["robots", "googlebot"].includes(attr("name").toLowerCase())
    )
      result[attr("name").toLowerCase() as "robots" | "googlebot"].push(
        attr("content").slice(0, 1000),
      );
  }
  return result;
}
export function breadcrumbProfile(
  blocks: { text: string; oversized: boolean }[],
  truncated: boolean,
): { status: RuleStatus; detail: string; types: string[] } {
  const types = new Set<string>(),
    issues: string[] = [];
  let supported = 0,
    unknown = truncated || blocks.some((b) => b.oversized),
    nodes = 0;
  const inspect = (value: unknown, context: unknown) => {
    if (++nodes > 1000) {
      unknown = true;
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value.slice(0, 100)) inspect(item, context);
      if (value.length > 100) unknown = true;
      return;
    }
    if (!value || typeof value !== "object") return;
    const obj = value as Record<string, unknown>,
      ctx = obj["@context"] ?? context,
      type = obj["@type"];
    if (Array.isArray(type)) {
      unknown = true;
      return;
    }
    if (typeof type === "string") types.add(type.slice(0, 100));
    if (type === "BreadcrumbList") {
      if (
        ![
          "https://schema.org",
          "https://schema.org/",
          "http://schema.org",
          "http://schema.org/",
        ].includes(String(ctx))
      ) {
        unknown = true;
        return;
      }
      const items = obj.itemListElement;
      if (!Array.isArray(items) || items.length < 2) {
        issues.push(
          "BreadcrumbList benötigt im eingeschränkten Google-Breadcrumb-Profil mindestens zwei ListItems.",
        );
        supported++;
        return;
      }
      if (items.length > 100) {
        unknown = true;
        return;
      }
      let unresolved = false;
      const positions = new Set<number>();
      for (const [i, item] of items.entries()) {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          issues.push(`ListItem ${i + 1} ist kein Objekt.`);
          continue;
        }
        if (item["@id"] && Object.keys(item).length === 1) {
          unresolved = true;
          continue;
        }
        if (item["@type"] !== "ListItem") {
          unknown = true;
          unresolved = true;
          continue;
        }
        if (
          !Number.isInteger(item.position) ||
          item.position < 1 ||
          positions.has(item.position)
        )
          issues.push(
            `ListItem ${i + 1}: Position fehlt, ist nicht positiv-ganzzahlig oder doppelt.`,
          );
        positions.add(item.position);
        const nested =
          item.item && typeof item.item === "object" ? item.item : null;
        if (
          !(typeof item.name === "string" && item.name.trim()) &&
          !(nested && typeof nested.name === "string" && nested.name.trim())
        )
          issues.push(
            `ListItem ${i + 1}: Name fehlt im unterstützten Inline-Format.`,
          );
        if (i < items.length - 1) {
          const url =
            typeof item.item === "string" ? item.item : nested?.["@id"];
          if (typeof url !== "string" || !url.trim())
            issues.push(`ListItem ${i + 1}: Ziel-URL fehlt im Inline-Format.`);
          else if (!/^https?:\/\//.test(url)) {
            unknown = true;
            unresolved = true;
          }
        }
      }
      if (unresolved) unknown = true;
      else supported++;
    }
    if (Array.isArray(obj["@graph"])) inspect(obj["@graph"], ctx);
  };
  for (const block of blocks) {
    if (block.oversized) continue;
    try {
      inspect(JSON.parse(block.text), undefined);
    } catch {
      unknown = true;
    }
  }
  return {
    status: issues.length
      ? "fail"
      : unknown
        ? "not_run"
        : supported
          ? "pass"
          : "not_applicable",
    detail: issues.length
      ? issues.slice(0, 10).join(" ")
      : unknown
        ? "JSON-LD nicht vollständig im eingeschränkten Inline-Breadcrumb-Profil prüfbar (z. B. Kontext, Referenz, Syntax oder Budget)."
        : supported
          ? `${supported} Inline-BreadcrumbList(s) im eingeschränkten Profil geprüft. Kein Rich-Result- oder Indexierungsnachweis.`
          : "Kein unterstütztes Inline-BreadcrumbList-Profil gefunden; andere Schema-Typen wurden nicht validiert.",
    types: [...types],
  };
}
