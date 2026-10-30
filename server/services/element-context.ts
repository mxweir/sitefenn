import type { Page } from "playwright";
import type { Finding, ElementContext } from "../../shared/types.js";
/** Styles/geometry only: no text, HTML, input values, URL attributes or arbitrary DOM attributes. */
export async function captureElementContext(
  page: Page,
  selector: string,
): Promise<ElementContext> {
  try {
    return await page.evaluate((selector) => {
      const nodes = document.querySelectorAll(selector);
      if (nodes.length !== 1)
        return {
          version: "element-context-1.6" as const,
          status: "unavailable" as const,
          reason: `Selektor trifft ${nodes.length} Elemente; kein eindeutiger DOM-Kontext.`,
        };
      const element = nodes[0]!;
      const properties = [
        "display",
        "position",
        "box-sizing",
        "width",
        "min-width",
        "max-width",
        "height",
        "min-height",
        "max-height",
        "overflow-x",
        "overflow-y",
        "white-space",
        "flex-shrink",
        "flex-wrap",
        "grid-template-columns",
        "z-index",
        "visibility",
        "left",
        "right",
        "padding-left",
        "padding-right",
        "margin-left",
        "margin-right",
        "gap",
        "flex-basis",
      ];
      const styles = (el: Element) =>
        Object.fromEntries(
          properties.map((p) => [
            p,
            getComputedStyle(el).getPropertyValue(p).slice(0, 120),
          ]),
        );
      const r = element.getBoundingClientRect();
      return {
        version: "element-context-1.6" as const,
        status: "captured" as const,
        tag: element.tagName.toLowerCase(),
        styles: styles(element),
        rect: { x: r.x, y: r.y, width: r.width, height: r.height },
        dimensions: {
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight,
        },
        ...(element.parentElement
          ? {
              parent: {
                tag: element.parentElement.tagName.toLowerCase(),
                styles: styles(element.parentElement),
              },
            }
          : {}),
      };
    }, selector);
  } catch {
    return {
      version: "element-context-1.6",
      status: "unavailable",
      reason: "Selektor/DOM in diesem Zustand nicht auswertbar.",
    };
  }
}
export async function addElementContexts(
  page: Page,
  findings: Finding[],
  alreadyCaptured: number,
) {
  let count = 0;
  for (const f of findings) {
    if (!f.selector) continue;
    if (count >= 8 || alreadyCaptured + count >= 80)
      f.elementContext = {
        version: "element-context-1.6",
        status: "unavailable",
        reason:
          "Kontextgrenze: maximal 8 Fundstellen pro Bild und 80 pro Check.",
      };
    else {
      f.elementContext = await captureElementContext(page, f.selector);
      count++;
    }
  }
}
