import { useLanguage } from "./language.js";
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...init,
    headers: {
      ...(init?.method ? { "X-Hub-Request": "1" } : {}),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const data = await response.json().catch(() => ({
    error: `Serverantwort nicht lesbar (${response.status}).`,
  }));
  if (!response.ok)
    throw new Error(
      data.error || `Anfrage fehlgeschlagen (${response.status}).`,
    );
  return data as T;
}
export const post = <T>(url: string, values?: unknown) =>
  api<T>(url, {
    method: "POST",
    ...(values === undefined ? {} : { body: JSON.stringify(values) }),
  });
export const patch = <T>(url: string, values: unknown) =>
  api<T>(url, { method: "PATCH", body: JSON.stringify(values) });
export const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Die Aktion konnte nicht abgeschlossen werden.";
export const stamp = (value?: string | null, locale = "de-DE") =>
  value
    ? new Intl.DateTimeFormat(locale, {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : "—";
export const active = (scan: { status: string }) =>
  scan.status === "queued" ||
  scan.status === "running" ||
  scan.status === "paused";
export const statusLabel = (status: string) =>
  ({
    queued: "In Warteschlange",
    running: "Prüfung läuft",
    paused: "Pausiert",
    completed: "Abgeschlossen",
    failed: "Fehlgeschlagen",
    interrupted: "Unterbrochen",
    cancelled: "Abgebrochen",
  })[status] ?? status;
export const categoryLabel = (category: string) =>
  ({
    layout: "Responsive & Layout",
    responsive: "Responsive & Layout",
    accessibility: "Barrierefreiheit",
    seo: "Technisches SEO",
    runtime: "Funktion & Technik",
    technical: "Funktion & Technik",
    functionality: "Funktion & Technik",
    performance: "Performance",
    ux: "UX-Empfehlung",
  })[category] ?? category;

const englishStatus: Record<string, string> = {
  queued: "Queued",
  running: "Running",
  paused: "Paused",
  completed: "Completed",
  failed: "Failed",
  interrupted: "Interrupted",
  cancelled: "Cancelled",
};
const englishCategory: Record<string, string> = {
  layout: "Responsive & layout",
  responsive: "Responsive & layout",
  accessibility: "Accessibility",
  seo: "Technical SEO",
  runtime: "Function & runtime",
  technical: "Function & runtime",
  functionality: "Function & runtime",
  performance: "Performance",
  ux: "UX recommendation",
};
export function useAuditLabels() {
  const language = useLanguage();
  return {
    statusLabel:
      language === "en"
        ? (value: string) => englishStatus[value] ?? value
        : statusLabel,
    categoryLabel:
      language === "en"
        ? (value: string) => englishCategory[value] ?? value
        : categoryLabel,
    stamp: (value?: string | null) =>
      stamp(value, language === "en" ? "en-GB" : "de-DE"),
  };
}
