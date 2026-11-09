import { chromium } from "playwright";
import { parseFragment, serialize, type DefaultTreeAdapterMap } from "parse5";
import {
  LAB_PROPERTIES,
  type LabOperation,
  type LabResult,
} from "../../shared/fix-lab.js";
import { VIEWPORTS } from "../../shared/types.js";

const allowed = new Set(
  "a article aside b blockquote br button code dd details div dl dt em fieldset figcaption figure footer h1 h2 h3 h4 h5 h6 header hr i input label legend li main nav ol p pre section small span strong style summary table tbody td textarea th thead tr ul".split(
    " ",
  ),
);
const attributes = new Set([
  "id",
  "class",
  "style",
  "href",
  "type",
  "disabled",
  "open",
  "hidden",
  "aria-hidden",
]);
const token = /^[A-Za-z_][\w-]{0,63}$/;

function localFragment(html: string) {
  const tree = parseFragment(html);
  let count = 0;
  const clean = (node: DefaultTreeAdapterMap["parentNode"], depth: number) => {
    if (depth > 32) throw Error("HTML ist zu tief verschachtelt.");
    node.childNodes = node.childNodes.filter((child) => {
      if (++count > 600) throw Error("Maximal 600 HTML-Knoten.");
      if (!("tagName" in child)) return child.nodeName === "#text";
      if (
        !allowed.has(child.tagName) ||
        child.namespaceURI !== "http://www.w3.org/1999/xhtml"
      )
        return false;
      child.attrs = child.attrs.filter(
        ({ name, value, namespace }) =>
          !namespace &&
          attributes.has(name) &&
          (name !== "href" || /^#[\w-]{1,64}$/.test(value)),
      );
      clean(child, depth + 1);
      return true;
    });
  };
  clean(tree, 0);
  return serialize(tree);
}

export async function runFixLab(input: unknown): Promise<LabResult> {
  const body = input as {
    html?: string;
    target?: string;
    viewportId?: string;
    operation?: LabOperation;
    acknowledged?: boolean;
  } | null;
  if (
    body?.acknowledged !== true ||
    typeof body.html !== "string" ||
    !body.html.trim() ||
    Buffer.byteLength(body.html) > 24 * 1024
  )
    throw Error("Freigegebener HTML-Ausschnitt erforderlich (maximal 24 KiB).");
  const target = body.target;
  if (
    typeof target !== "string" ||
    ![".", "#"].includes(target[0] ?? "") ||
    !token.test(target.slice(1))
  )
    throw Error("Eine eindeutige #ID oder .Klasse auswählen.");
  const viewport = VIEWPORTS.find((item) => item.id === body.viewportId);
  if (!viewport) throw Error("Geräteprofil auswählen.");
  const operation = body.operation;
  if (
    !operation ||
    typeof operation.value !== "string" ||
    operation.value.length > 32
  )
    throw Error("Eine unterstützte Änderung auswählen.");
  if (operation.type === "rename") {
    if (!token.test(operation.value) || operation.value === target.slice(1))
      throw Error("Einen anderen gültigen ID- oder Klassennamen angeben.");
  } else if (operation.type === "css") {
    if (!LAB_PROPERTIES.includes(operation.property))
      throw Error("Nicht unterstützte CSS-Eigenschaft.");
    const valid =
      operation.property === "box-sizing"
        ? /^(?:border-box|content-box)$/.test(operation.value)
        : operation.property === "overflow-wrap"
          ? /^(?:normal|anywhere|break-word)$/.test(operation.value)
          : /^(?:0|(?:[1-9]\d{0,3})(?:px|%))$/.test(operation.value);
    if (!valid) throw Error("Wert außerhalb der erlaubten CSS-Werte.");
  } else throw Error("Nicht unterstützte Änderung.");
  const fragment = localFragment(body.html);
  const browser = await chromium.launch({
    headless: true,
    chromiumSandbox: true,
    timeout: 12000,
    proxy: { server: "http://127.0.0.1:1", bypass: "<-loopback>" },
    args: [
      "--disable-background-networking",
      "--disable-quic",
      "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
    ],
  });
  try {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      javaScriptEnabled: false,
      serviceWorkers: "block",
      reducedMotion: "reduce",
      acceptDownloads: false,
    });
    await context.route("**/*", (route) => route.abort());
    const page = await context.newPage();
    await page.setContent(
      `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'"><style>*{animation:none!important;transition:none!important;scroll-behavior:auto!important}</style></head><body>${fragment}</body></html>`,
      { timeout: 4000, waitUntil: "load" },
    );
    if ((await page.locator(target).count()) !== 1)
      throw Error("Ziel muss im Ausschnitt genau einmal vorhanden sein.");
    if (
      operation.type === "rename" &&
      (await page.locator(target[0] + operation.value).count()) !== 0
    )
      throw Error("Der neue Name wird im Ausschnitt bereits verwendet.");
    const element = page.locator(target);
    const measure = (node: Element) => {
      const controls = Array.from(
        document.querySelectorAll(
          "a[href], button:enabled, input:enabled, textarea:enabled, summary",
        ),
      );
      const [targetVisible, ...visibleControls] = [node, ...controls].map(
        (item) => {
          const rect = item.getBoundingClientRect(),
            css = getComputedStyle(item);
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            css.display !== "none" &&
            css.visibility === "visible" &&
            item.checkVisibility({
              opacityProperty: true,
              visibilityProperty: true,
            }) &&
            !item.closest("[hidden], [aria-hidden=true]") &&
            rect.right > 0 &&
            rect.left < innerWidth &&
            rect.bottom > 0
          );
        },
      );
      const bounds = node.getBoundingClientRect();
      return {
        documentOverflow: Math.max(
          0,
          document.documentElement.scrollWidth - innerWidth,
        ),
        targetWidth: Math.round(bounds.width),
        targetOutside: bounds.left < -1 || bounds.right > innerWidth + 1,
        targetVisible: targetVisible!,
        visibleControls: visibleControls.filter(Boolean).length,
        unresolvedAnchors: Array.from(
          document.querySelectorAll("a[href^='#']"),
        ).filter(
          (a) => !document.getElementById(a.getAttribute("href")!.slice(1)),
        ).length,
      };
    };
    const before = await element.evaluate(measure, undefined, {
      timeout: 3000,
    });
    const capture = async () =>
      (
        await page.screenshot({
          type: "jpeg",
          quality: 60,
          timeout: 5000,
          animations: "disabled",
        })
      ).toString("base64");
    const originalImage = await capture();
    const handle = await element.elementHandle({ timeout: 3000 });
    await handle.evaluate(
      (node, { target, operation }) => {
        if (operation.type === "css")
          (node as HTMLElement).style.setProperty(
            operation.property,
            operation.value,
            "important",
          );
        else if (target.startsWith("#")) node.id = operation.value;
        else node.classList.replace(target.slice(1), operation.value);
      },
      { target, operation },
    );
    const after = await handle.evaluate(measure);
    return { before, after, originalImage, changedImage: await capture() };
  } finally {
    await browser.close();
  }
}
