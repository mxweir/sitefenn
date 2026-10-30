import { createHash } from "node:crypto";
import type { Page } from "playwright";
import type { Journey, JourneyRun, Evidence } from "../../shared/types.js";
import { journeyDefinition, dangerousAction } from "../../shared/journeys.js";
import { canonical } from "./comparison.js";
export const signature = (j: Journey) =>
  createHash("sha256")
    .update(canonical(journeyDefinition(j)))
    .digest("hex")
    .slice(0, 16);
export const journeyState = (j: Journey, index: number) =>
  `journey:${j.id}:${signature(j)}:${index + 1}`;
export function plannedJourney(j: Journey, viewportId: string): JourneyRun {
  return {
    journeyId: j.id,
    name: j.name,
    signature: signature(j),
    pageUrl: j.pageUrl,
    viewportId,
    status: "not_run",
    detail: "Geplant; noch nicht ausgeführt.",
    steps: j.steps.map((_, i) => ({
      index: i,
      state: journeyState(j, i),
      status: "not_run",
      detail: "Noch nicht ausgeführt.",
      durationMs: 0,
    })),
  };
}
export async function executeJourney(
  j: Journey,
  run: JourneyRun,
  page: Page,
  hooks: {
    timeoutMs?: number;
    checkpoint: () => Promise<void>;
    blocked: () => boolean;
    capture: (
      state: string,
      ready: boolean,
      measure: boolean,
    ) => Promise<Evidence>;
    settle: () => Promise<void>;
    progress: (text: string) => void;
  },
) {
  const documentUrl = page.url();
  let remaining = Math.min(30000, hooks.timeoutMs ?? 30000);
  let stopped = false;
  for (const [i, step] of j.steps.entries()) {
    if (stopped) break;
    await hooks.checkpoint();
    const record = run.steps[i]!,
      time = Date.now();
    hooks.progress(`${j.name} · Schritt ${i + 1}/${j.steps.length}`);
    const deadline = setTimeout(
      () => {
        void page
          .context()
          .close()
          .catch(() => undefined);
      },
      Math.max(1, remaining),
    );
    try {
      if (remaining <= 0)
        throw Error("Ablauf-Zeitlimit von 30 Sekunden erreicht.");
      if (page.url() !== documentUrl)
        throw Error("Unerwartete URL-Änderung; Ablauf bleibt unbekannt.");
      if (hooks.blocked())
        throw Error(
          "Prüfrichtlinie hat Anfragen blockiert; reproduzierbarer Zustand unbekannt.",
        );
      record.beforeId = (
        await hooks.capture(record.state + ":before", true, false)
      ).id;
      // Validate the actual DOM node immediately before action; selectors never evaluate code.
      const allowed = await page
        .locator(
          step.action === "click" ? step.selector! : step.expect.selector,
        )
        .evaluate(
          (el, { action, expect, danger }) => {
            if (document.querySelectorAll(expect.selector).length !== 1)
              return "Erwartungsziel fehlt oder ist mehrdeutig.";
            const target = document.querySelector(expect.selector)!;
            if (action === "scroll") return "";
            if (
              el.querySelector(
                "a,button,input,select,textarea,[contenteditable]",
              )
            )
              return "Verschachtelte interaktive Inhalte werden nicht angeklickt.";
            if (
              el.closest("form,a") ||
              el.hasAttribute("form") ||
              new RegExp(danger, "i").test(
                [
                  el.id,
                  el.getAttribute("name"),
                  el.getAttribute("aria-label"),
                  el.getAttribute("title"),
                  el.textContent?.slice(0, 500),
                ].join(" "),
              )
            )
              return "Formular-, Link- oder gesperrte Aktion wird nicht ausgeführt.";
            if (
              el instanceof HTMLElement &&
              (el.closest("[inert]") ||
                el.getAttribute("aria-disabled") === "true")
            )
              return "Schalter ist nicht bedienbereit.";
            if (el.tagName === "SUMMARY")
              return el.parentElement === target &&
                target.tagName === "DETAILS" &&
                ["open", "closed"].includes(expect.condition)
                ? ""
                : "Summary benötigt sein eigenes details-Ziel mit offen/geschlossen-Erwartung.";
            if (
              el.tagName !== "BUTTON" ||
              el.getAttribute("type") !== "button" ||
              (el as HTMLButtonElement).disabled
            )
              return 'Nur native, aktive button type="button" oder details/summary werden unterstützt.';
            if (
              !target.id ||
              !(el.getAttribute("aria-controls") || "")
                .split(/\s+/)
                .includes(target.id)
            )
              return "UI-Schalter muss über aria-controls genau das erwartete Zielelement referenzieren.";
            if (
              !el.hasAttribute("aria-expanded") &&
              el.getAttribute("aria-haspopup") !== "dialog" &&
              target.tagName !== "DIALOG" &&
              target.getAttribute("role") !== "dialog"
            )
              return "Nur deklarierte Auf-/Zuklappschalter oder Dialogschalter werden unterstützt.";
            return "";
          },
          {
            action: step.action,
            expect: step.expect,
            danger: dangerousAction.source,
          },
          { timeout: 2000 },
        );
      if (allowed) throw Error(allowed);
      if (step.action === "click") {
        if ((await page.locator(step.selector!).count()) !== 1)
          throw Error("UI-Schalter fehlt oder ist mehrdeutig.");
        const isAlready = await expected(page, step.expect);
        if (isAlready)
          throw Error(
            "Erwarteter Nachzustand bestand bereits vor der Aktion; Übergang nicht bestätigt.",
          );
        await page
          .locator(step.selector!)
          .click({ timeout: 3000, noWaitAfter: true });
      } else await page.evaluate((y) => scrollTo(0, y), step.y!);
      await hooks.settle();
      if (page.url() !== documentUrl)
        throw Error(
          "Unerwartete URL-Änderung nach UI-Aktion; Ablauf bleibt unbekannt.",
        );
      await page.waitForFunction(
        ({ selector, condition }) => {
          const nodes = document.querySelectorAll(selector);
          if (nodes.length !== 1) return false;
          const el = nodes[0]!,
            r = el.getBoundingClientRect(),
            s = getComputedStyle(el);
          const visible =
            el.checkVisibility({
              checkOpacity: true,
              checkVisibilityCSS: true,
            }) &&
            r.width > 0 &&
            r.height > 0;
          return condition === "visible"
            ? visible
            : condition === "hidden"
              ? !visible
              : el.tagName === "DETAILS" || el.tagName === "DIALOG"
                ? el.hasAttribute("open") === (condition === "open")
                : false;
        },
        step.expect,
        { timeout: 3000 },
      );
      if (
        step.action === "scroll" &&
        Math.abs((await page.evaluate(() => scrollY)) - step.y!) > 2
      )
        throw Error("Gewählte Scrollposition wurde nicht erreicht.");
      if (hooks.blocked())
        throw Error(
          "Anfragen oder Navigation wurden blockiert; Zustand bleibt unbekannt.",
        );
      if (Date.now() - time >= remaining)
        throw Error("Ablauf-Zeitlimit erreicht.");
      record.afterId = (await hooks.capture(record.state, true, true)).id;
      if (Date.now() - time >= remaining)
        throw Error("Ablauf-Zeitlimit nach Aufnahme erreicht.");
      record.status = "completed";
      record.detail =
        "Erwarteter Zustand erreicht und erfasst; kein vollständiger Funktionstest.";
    } catch (error) {
      record.status = "unknown";
      record.detail =
        Date.now() - time >= remaining
          ? "Ablauf-Zeitlimit erreicht; Browserkontext geschlossen."
          : (error as Error).message.split("\n")[0]!.slice(0, 350);
      stopped = true;
      try {
        record.afterId = (await hooks.capture(record.state, false, false)).id;
      } catch {
        /* No invented evidence on failed capture. */
      }
    }
    clearTimeout(deadline);
    record.durationMs = Date.now() - time;
    remaining -= record.durationMs;
  }
  run.status = run.steps.every((s) => s.status === "completed")
    ? "completed"
    : "unknown";
  run.detail =
    run.status === "completed"
      ? "Alle ausdrücklich freigegebenen Zustände erreicht."
      : "Ablauf abgebrochen; dieser und folgende Zustände sind nicht bestätigt.";
}
async function expected(
  page: Page,
  expect: Journey["steps"][number]["expect"],
) {
  return page.locator(expect.selector).evaluate(
    (el, condition) => {
      const r = el.getBoundingClientRect(),
        visible =
          el.checkVisibility({
            checkOpacity: true,
            checkVisibilityCSS: true,
          }) &&
          r.width > 0 &&
          r.height > 0;
      return condition === "visible"
        ? visible
        : condition === "hidden"
          ? !visible
          : el.hasAttribute("open") === (condition === "open");
    },
    expect.condition,
    { timeout: 1500 },
  );
}
