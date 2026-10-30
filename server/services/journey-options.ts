import type { Journey } from "../../shared/types.js";
import { simpleSelector, dangerousAction } from "../../shared/journeys.js";
export function normalizeJourneys(
  input: unknown,
  pages: string[],
  devices: string[],
): Journey[] {
  if (input === undefined) return [];
  if (!Array.isArray(input) || input.length > 3)
    throw Error("Maximal drei freigegebene Abläufe konfigurieren.");
  const ids = new Set<string>();
  let samples = 0;
  const exact = (o: Record<string, unknown>, keys: string[]) => {
    if (Object.keys(o).some((k) => !keys.includes(k)))
      throw Error("Unbekanntes Ablauf-Feld.");
  };
  return input.map((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      throw Error("Ungültiger Ablauf.");
    const j = raw as Journey;
    exact(raw, ["id", "name", "pageUrl", "viewportIds", "steps", "confirmed"]);
    if (
      typeof j.id !== "string" ||
      !/^[a-zA-Z0-9-]{1,40}$/.test(j.id) ||
      ids.has(j.id)
    )
      throw Error("Ablauf benötigt eine eindeutige kurze ID.");
    ids.add(j.id);
    if (
      typeof j.name !== "string" ||
      !j.name.trim() ||
      j.name.length > 80 ||
      /[\u0000-\u001f]/.test(j.name)
    )
      throw Error("Ablauf mit kurzem Namen versehen.");
    if (
      typeof j.pageUrl !== "string" ||
      dangerousAction.test(decodeURIComponent(new URL(j.pageUrl).pathname))
    )
      throw Error("Gesperrter Ablaufpfad.");
    if (!pages.includes(j.pageUrl))
      throw Error(
        "Ablaufseite muss ausdrücklich im Browsercheck ausgewählt sein.",
      );
    if (j.confirmed !== true)
      throw Error(
        "Jeden Ablauf nach Prüfung seiner Schritte ausdrücklich freigeben.",
      );
    if (
      !Array.isArray(j.viewportIds) ||
      !j.viewportIds.length ||
      j.viewportIds.length > 3 ||
      new Set(j.viewportIds).size !== j.viewportIds.length ||
      j.viewportIds.some((v) => !devices.includes(v))
    )
      throw Error("Ablaufgeräte müssen im Check ausgewählt sein.");
    if (!Array.isArray(j.steps) || !j.steps.length || j.steps.length > 5)
      throw Error("Ein bis fünf Schritte pro Ablauf wählen.");
    samples += j.steps.length * j.viewportIds.length;
    if (samples > 18)
      throw Error("Maximal 18 Schritt-/Geräte-Kombinationen pro Check.");
    const steps = j.steps.map((s) => {
      if (!s || typeof s !== "object" || Array.isArray(s))
        throw Error("Ungültiger Schritt.");
      exact(s as unknown as Record<string, unknown>, [
        "action",
        "selector",
        "y",
        "expect",
      ]);
      if (!s.expect || typeof s.expect !== "object" || Array.isArray(s.expect))
        throw Error("Erwarteten Zustand angeben.");
      exact(s.expect, ["selector", "condition"]);
      if (
        !simpleSelector(s.expect.selector) ||
        !["visible", "hidden", "open", "closed"].includes(s.expect.condition)
      )
        throw Error(
          "Erwartung: einfache ID, data-testid oder aria-label und gültigen Zustand wählen.",
        );
      if (s.action === "click") {
        if (
          !simpleSelector(s.selector) ||
          dangerousAction.test(s.selector) ||
          s.y !== undefined
        )
          throw Error(
            "UI-Schalter braucht einen einfachen, nicht gesperrten Selektor.",
          );
        return {
          action: "click" as const,
          selector: s.selector,
          expect: { ...s.expect },
        };
      }
      if (
        s.action !== "scroll" ||
        s.selector !== undefined ||
        !Number.isInteger(s.y) ||
        s.y! < 0 ||
        s.y! > 10000
      )
        throw Error(
          "Nur UI-Schalter oder Scrollen von 0–10000 px sind erlaubt.",
        );
      return { action: "scroll" as const, y: s.y, expect: { ...s.expect } };
    });
    return {
      id: j.id,
      name: j.name.trim(),
      pageUrl: j.pageUrl,
      viewportIds: [...j.viewportIds],
      steps,
      confirmed: true,
    };
  });
}
