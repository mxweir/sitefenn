import { randomUUID } from "node:crypto";
import type {
  SearchDimension,
  SearchImportMetadata,
  SearchRow,
  SearchDataset,
} from "../../shared/types.js";
export type {
  SearchDimension,
  SearchImportMetadata,
  SearchRow,
  SearchDataset,
} from "../../shared/types.js";

const dimensions: SearchDimension[] = [
  "date",
  "page",
  "query",
  "country",
  "device",
];
const headers: Record<string, string> = {
  date: "date",
  datum: "date",
  dates: "date",
  page: "page",
  pages: "page",
  "top pages": "page",
  seiten: "page",
  "häufigste seiten": "page",
  query: "query",
  queries: "query",
  "top queries": "query",
  suchanfragen: "query",
  "häufigste suchanfragen": "query",
  country: "country",
  countries: "country",
  land: "country",
  länder: "country",
  device: "device",
  devices: "device",
  gerät: "device",
  geräte: "device",
  clicks: "clicks",
  klicks: "clicks",
  impressions: "impressions",
  impressionen: "impressions",
  ctr: "ctr",
  klickrate: "ctr",
  position: "position",
  "average position": "position",
  "durchschnittliche position": "position",
};

function isoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function validateMetadata(metadata: SearchImportMetadata): void {
  if (!metadata || !dimensions.includes(metadata.dimension))
    throw new Error("An explicit supported CSV dimension is required.");
  if (
    !isoDate(metadata.startDate) ||
    !isoDate(metadata.endDate) ||
    metadata.startDate > metadata.endDate
  ) {
    throw new Error("A valid inclusive ISO date range is required.");
  }
  if (typeof metadata.property !== "string" || metadata.property.length > 2048)
    throw new Error("A Search Console property is required.");
  if (metadata.property.startsWith("sc-domain:")) {
    if (!/^sc-domain:[a-z\d](?:[a-z\d.-]*[a-z\d])?$/i.test(metadata.property))
      throw new Error("Invalid domain property.");
  } else {
    let url: URL;
    try {
      url = new URL(metadata.property);
    } catch {
      throw new Error("Invalid URL-prefix property.");
    }
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error("Invalid URL-prefix property.");
  }
  if (
    metadata.filters !== null &&
    (typeof metadata.filters !== "object" || Array.isArray(metadata.filters))
  )
    throw new Error("Filters must be declared, or null when unknown.");
  for (const [key, value] of Object.entries(metadata.filters ?? {})) {
    if (typeof value !== "string" || key.length > 100 || value.length > 2000)
      throw new Error("Invalid filter metadata.");
  }
}

/** Strict quoted CSV, including escaped quotes and embedded line breaks. */
export function parseCsvRows(csv: string): string[][] {
  if (
    typeof csv !== "string" ||
    Buffer.byteLength(csv, "utf8") > 10 * 1024 * 1024
  )
    throw new Error("CSV exceeds the 10 MiB limit.");
  csv = csv.replace(/^\uFEFF/, "");
  let quote = false,
    commas = 0,
    semicolons = 0;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (c === '"') {
      if (quote && csv[i + 1] === '"') i++;
      else quote = !quote;
    }
    if (!quote && (c === "\n" || c === "\r")) break;
    if (!quote && c === ",") commas++;
    if (!quote && c === ";") semicolons++;
  }
  const separator = semicolons > commas ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    afterQuote = false;
  const pushCell = () => {
    row.push(cell);
    cell = "";
    afterQuote = false;
    if (row.length > 100) throw new Error("Too many CSV columns.");
  };
  const pushRow = () => {
    pushCell();
    if (row.some((v) => v.trim() !== "")) rows.push(row);
    row = [];
    if (rows.length > 50001) throw new Error("Too many CSV rows.");
  };
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (quoted) {
      if (c === '"') {
        if (csv[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          afterQuote = true;
        }
      } else cell += c;
    } else if (c === separator) pushCell();
    else if (c === "\r" || c === "\n") {
      if (c === "\r" && csv[i + 1] === "\n") i++;
      pushRow();
    } else if (c === '"') {
      if (cell.length || afterQuote) throw new Error("Malformed CSV quoting.");
      quoted = true;
    } else {
      if (afterQuote && c.trim())
        throw new Error("Unexpected content after a quoted CSV value.");
      if (!afterQuote) cell += c;
    }
  }
  if (quoted) throw new Error("Unclosed CSV quote.");
  if (cell.length || row.length || afterQuote) pushRow();
  if (rows.length < 2)
    throw new Error("CSV must contain a header and at least one data row.");
  return rows;
}

function count(value: string, name: string): number {
  const clean = value.trim().replace(/[\s\u00a0\u202f]/g, "");
  const integer = /^\d+$/.test(clean)
    ? clean
    : /^(?:\d{1,3})(?:[.,]\d{3})+$/.test(clean)
      ? clean.replace(/[.,]/g, "")
      : "";
  const result = Number(integer);
  if (!integer || !Number.isSafeInteger(result) || result < 0)
    throw new Error(`Invalid ${name} count.`);
  return result;
}

function decimal(value: string, name: string): number | null {
  let clean = value.trim().replace(/[\s\u00a0\u202f]/g, "");
  if (["", "-", "—", "N/A", "n/a"].includes(clean)) return null;
  const percentage = clean.endsWith("%");
  if (percentage) clean = clean.slice(0, -1);
  if (clean.includes(",") && clean.includes(".")) {
    const decimalSeparator =
      clean.lastIndexOf(",") > clean.lastIndexOf(".") ? "," : ".";
    clean = clean
      .replace(decimalSeparator === "," ? /\./g : /,/g, "")
      .replace(",", ".");
  } else clean = clean.replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/.test(clean)) throw new Error(`Invalid ${name}.`);
  let result = Number(clean);
  if (percentage) result /= 100;
  if (
    !Number.isFinite(result) ||
    result < 0 ||
    (name === "CTR" && result > 1) ||
    (name !== "CTR" && percentage)
  )
    throw new Error(`Invalid ${name}.`);
  return result;
}

export function parseSearchConsoleCsv(
  csv: string,
  metadata: SearchImportMetadata,
  context?: { id?: string; projectId?: string },
): SearchDataset {
  validateMetadata(metadata);
  const table = parseCsvRows(csv);
  const first = table[0]!;
  const columns = first.map((header) => headers[header.trim().toLowerCase()]);
  const indexes = [
    "clicks",
    "impressions",
    "ctr",
    "position",
    metadata.dimension,
  ].map((name) => {
    const index = columns.indexOf(name);
    if (index < 0) throw new Error(`Missing CSV column: ${name}.`);
    if (columns.lastIndexOf(name) !== index)
      throw new Error(`Duplicate CSV column: ${name}.`);
    return index;
  });
  const otherDimensions = columns.filter(
    (v) =>
      dimensions.includes(v as SearchDimension) && v !== metadata.dimension,
  );
  if (otherDimensions.length)
    throw new Error(
      "Only one exported dimension is supported per dataset; do not combine independent tables.",
    );
  const seen = new Set<string>();
  const rows: SearchRow[] = table.slice(1).map((record, i) => {
    if (record.length !== first.length)
      throw new Error(`Unexpected column count in CSV row ${i + 2}.`);
    const get = (j: number) => record[indexes[j]!]!;
    const key = get(4).trim();
    if (!key || key.length > 10000 || seen.has(key))
      throw new Error("Empty, oversized, or duplicate dimension key.");
    seen.add(key);
    if (
      metadata.dimension === "date" &&
      (!isoDate(key) || key < metadata.startDate || key > metadata.endDate)
    )
      throw new Error(
        "Date row lies outside the declared date range or is invalid.",
      );
    const clicks = count(get(0), "clicks");
    const impressions = count(get(1), "impressions");
    if (clicks > impressions)
      throw new Error("Clicks cannot exceed impressions.");
    return {
      key,
      clicks,
      impressions,
      ctr: decimal(get(2), "CTR"),
      position: decimal(get(3), "position"),
    };
  });
  const warnings = [
    "Imported rows are an exported subset, not guaranteed complete property totals.",
    "Average position is historical and aggregated, not a current universal Google rank.",
  ];
  if (metadata.filters === null)
    warnings.push(
      "Export filters are unknown; comparisons cannot be treated as like-for-like.",
    );
  const totals = rows.reduce(
    (sum, row) => ({
      clicks: sum.clicks + row.clicks,
      impressions: sum.impressions + row.impressions,
    }),
    { clicks: 0, impressions: 0 },
  );
  if (
    !Number.isSafeInteger(totals.clicks) ||
    !Number.isSafeInteger(totals.impressions)
  )
    throw new Error("CSV totals exceed safe integer precision.");
  return {
    id: context?.id ?? randomUUID(),
    projectId: context?.projectId ?? "",
    importedAt: new Date().toISOString(),
    metadata: {
      ...metadata,
      filters: metadata.filters === null ? null : { ...metadata.filters },
    },
    rows,
    warnings,
    summary: {
      ...totals,
      ctr: totals.impressions ? totals.clicks / totals.impressions : null,
      position: null,
      label:
        "Exported row totals only; not complete property totals. Average position is intentionally not aggregated.",
    },
  };
}

function filterKey(filters: Record<string, string>): string {
  return JSON.stringify(
    Object.entries(filters).sort(([a], [b]) => a.localeCompare(b)),
  );
}

export interface SearchDatasetComparison {
  compatible: boolean;
  reason: string;
  clicksDelta: number | null;
  impressionsDelta: number | null;
  ctrDelta: number | null;
}

export function compareSearchDatasets(
  before: SearchDataset,
  after: SearchDataset,
): SearchDatasetComparison {
  const a = before.metadata,
    b = after.metadata;
  const duration = (meta: SearchImportMetadata) =>
    Date.parse(meta.endDate) - Date.parse(meta.startDate);
  const compatible =
    a.property === b.property &&
    a.dimension === b.dimension &&
    a.filters !== null &&
    b.filters !== null &&
    filterKey(a.filters) === filterKey(b.filters) &&
    duration(a) === duration(b);
  if (!compatible)
    return {
      compatible: false,
      reason:
        "Property, dimension, declared filters, and inclusive period length must match.",
      clicksDelta: null,
      impressionsDelta: null,
      ctrDelta: null,
    };
  if (a.dimension !== "date")
    return {
      compatible: true,
      reason:
        "Dimension rows may be compared individually; aggregate totals are intentionally not inferred.",
      clicksDelta: null,
      impressionsDelta: null,
      ctrDelta: null,
    };
  return {
    compatible: true,
    reason:
      "Comparison of exported daily rows only; no causal or ranking guarantee.",
    clicksDelta: after.summary.clicks - before.summary.clicks,
    impressionsDelta: after.summary.impressions - before.summary.impressions,
    ctrDelta:
      before.summary.ctr !== null && after.summary.ctr !== null
        ? after.summary.ctr - before.summary.ctr
        : null,
  };
}
