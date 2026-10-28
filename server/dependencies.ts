import { access } from "node:fs/promises";
import { chromium } from "playwright";
import type { Dependency } from "../shared/types.js";

let cached: { expires: number; data: Dependency[] } | undefined;
export async function dependencies(): Promise<Dependency[]> {
  if (cached && cached.expires > Date.now()) return cached.data;
  let browserReady = false;
  try {
    await access(chromium.executablePath());
    browserReady = true;
  } catch {
    /* instruction below */
  }
  let models = 0;
  let ollamaReady = false;
  try {
    const response = await fetch("http://127.0.0.1:11434/api/tags", {
      signal: AbortSignal.timeout(1200),
      redirect: "error",
    });
    if (response.ok) {
      const body = (await response.json()) as { models?: unknown[] };
      ollamaReady = true;
      models = body.models?.length || 0;
    }
  } catch {
    /* optional, never blocks scans */
  }
  const data: Dependency[] = [
    { id: "node", label: "Node.js", status: "ready", detail: process.version },
    {
      id: "storage",
      label: "SQLite",
      status: "ready",
      detail: "Lokale Datenbank verbunden · Schema 2 · Migration mit Sicherung",
    },
    {
      id: "browser",
      label: "Prüf-Browser",
      status: browserReady ? "ready" : "missing",
      detail: browserReady ? "Chromium installiert" : "Chromium fehlt",
      instruction: browserReady ? undefined : "npm run browser:install",
    },
    {
      id: "ollama",
      label: "Lokale KI · optional",
      status: ollamaReady ? "ready" : "optional",
      detail: ollamaReady
        ? `${models} Modelle erkannt · lokales Modell ausdrücklich in den Einstellungen wählen`
        : "Ollama nicht erreichbar · regelbasierte Prüfungen funktionieren ohne KI",
      instruction: ollamaReady
        ? undefined
        : "Optional: Ollama installieren und bewusst ein lokales Modell laden. Keine Cloud-Ausweichlösung; der Report funktioniert auch ohne KI.",
    },
  ];
  cached = { data, expires: Date.now() + 5000 };
  return data;
}
