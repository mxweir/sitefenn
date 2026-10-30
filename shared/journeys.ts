import type { Journey, JourneyStep } from "./types.js";
export const simpleSelector = (s: unknown): s is string =>
  typeof s === "string" &&
  (/^#[A-Za-z][\w-]{0,79}$/.test(s) ||
    /^\[(?:data-testid|aria-label)="[^"\\\[\]\r\n]{1,80}"\]$/.test(s));
export const dangerousAction =
  /(?:delete|remove|checkout|payment|purchase|submit|logout|signout|unsubscribe|bestell|kaufen|bezahlen|löschen|loeschen|absenden|abmelden|senden|anmelden|login|entfernen|zahlung|buchen|registrier|\b(?:buy|pay|orders?|send|subscribe|register)\b)/i;
export function stepLabel(step: JourneyStep): string {
  return `${step.action === "click" ? `UI-Schalter ${step.selector}` : `Scrollen auf ${step.y} px`} → ${step.expect.selector}: ${step.expect.condition}`;
}
export function journeyDefinition(j: Journey) {
  return { id: j.id, name: j.name, pageUrl: j.pageUrl, steps: j.steps };
}
