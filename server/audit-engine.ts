import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";
import { mkdir, readFile, mkdtemp, rm } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { join } from "node:path";
import { createRequire } from "node:module";
import { spawn, type ChildProcess } from "node:child_process";
import { tmpdir } from "node:os";
import type {
  AuditReport,
  DiscoveryResult,
  Environment,
  Evidence,
  Finding,
  PerformanceSample,
  RuleResult,
  ScanOptions,
  ScanResult,
  ViewportProfile,
  WorkerEvent,
} from "../shared/types.js";
import { VIEWPORTS } from "../shared/types.js";
import {
  TECHNICAL_RULES,
  emptySeo,
  technicalSeo,
} from "./services/technical-seo.js";
import { normalizeJourneys } from "./services/journey-options.js";
import {
  executeJourney,
  plannedJourney,
  journeyState,
} from "./services/journeys.js";
import { dangerousAction } from "../shared/journeys.js";
import { breadcrumbProfile, hasNoindex } from "./services/seo-meta.js";
import { importSitemap } from "./services/sitemap.js";
import { auditProvenance } from "./provenance.js";
import { startAuditProxy, type AuditProxy } from "./network-proxy.js";
import { parseTarget, validateTarget, type TargetPolicy } from "./security.js";

export interface WorkerJob {
  id: string;
  url: string;
  dataDir: string;
  demoOrigin?: string;
  allowedLocalOrigin?: string;
  hubOrigin?: string;
  environment?: Environment;
  options?: ScanOptions;
  resumeReport?: AuditReport;
}
export interface DiscoveryOptions extends TargetPolicy {
  url: string;
  maxPages?: number;
  maxDepth?: number;
  excludedPaths?: string[];
}
export type AuditEmitter = (event: WorkerEvent) => void;
export interface AuditControl {
  checkpoint(): Promise<void>;
  cancelled(): boolean;
}
const require = createRequire(import.meta.url);
const activeBrowsers = new Set<Browser>();
const activeProxies = new Set<AuditProxy>();
const activeChrome = new Set<ChildProcess>();
const blockedByContext = new WeakMap<BrowserContext, Set<string>>();
const interactionContexts = new WeakSet<BrowserContext>();
const documentGuards = new WeakMap<Page, Promise<void>>();
async function terminateChrome(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve();
    }, 2000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    if (!child.kill("SIGTERM")) {
      clearTimeout(timer);
      resolve();
    }
  });
}
export async function closeAuditResources() {
  await Promise.allSettled(
    [...activeBrowsers].map((browser) => browser.close()),
  );
  await Promise.allSettled([...activeChrome].map(terminateChrome));
  await Promise.allSettled([...activeProxies].map((proxy) => proxy.close()));
  activeBrowsers.clear();
  activeChrome.clear();
  activeProxies.clear();
}
export const RULE_VERSION = "rules-1.5.0";
export const PROFILE_VERSION = "responsive-1.0.0";
const digest = (text: string) =>
  createHash("sha256").update(text).digest("hex").slice(0, 24);
export function normalizeAuditUrl(value: string, base?: string) {
  const url = new URL(value, base);
  url.hash = "";
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("Unsupported URL");
  return url.href;
}
export function inScope(
  value: string,
  start: string,
  excludedPaths: string[] = [],
) {
  try {
    const url = new URL(value);
    return (
      url.origin === new URL(start).origin &&
      !excludedPaths.some((path) => path && url.pathname.startsWith(path))
    );
  } catch {
    return false;
  }
}

async function openBrowser(policy: TargetPolicy) {
  const proxy = await startAuditProxy(policy);
  activeProxies.add(proxy);
  try {
    const browser = await chromium.launch({
      headless: true,
      chromiumSandbox: true,
      proxy: {
        server: proxy.server,
        username: proxy.username,
        password: proxy.password,
        bypass: "<-loopback>",
      },
      args: [
        "--disable-quic",
        "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
        "--disable-background-networking",
      ],
    });
    activeBrowsers.add(browser);
    return { browser, proxy };
  } catch (error) {
    await proxy.close();
    activeProxies.delete(proxy);
    throw error;
  }
}
async function createContext(
  browser: Browser,
  target: string,
  policy: TargetPolicy,
  viewport: ViewportProfile,
  excluded: string[] = [],
) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.deviceScaleFactor || 1,
    isMobile: !!viewport.isMobile,
    hasTouch: !!viewport.hasTouch,
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
    serviceWorkers: "block",
    acceptDownloads: false,
    permissions: [],
    reducedMotion: "reduce",
    colorScheme: "light",
  });
  // tsx/esbuild preserves function names with this helper inside serialized evaluate callbacks.
  await context.addInitScript("globalThis.__name = value => value");
  const policyBlocked = new Set<string>();
  blockedByContext.set(context, policyBlocked);
  // A separate CDP Fetch session observes each document redirect hop, unlike Playwright route's first-hop-only interception.
  context.on("page", (page) => {
    const ready = (async () => {
      const session = await context.newCDPSession(page);
      await session.send("Fetch.enable", {
        patterns: [
          {
            urlPattern: "*",
            resourceType: "Document",
            requestStage: "Request",
          },
        ],
      });
      session.on("Fetch.requestPaused", (event) => {
        void (async () => {
          const url = new URL(event.request.url);
          if (
            interactionContexts.has(context) ||
            !inScope(url.href, target, excluded) ||
            (policy.demoOrigin && !/^\/demo-site(?:\/|$)/.test(url.pathname))
          ) {
            policyBlocked.add(url.href);
            await session.send("Fetch.failRequest", {
              requestId: event.requestId,
              errorReason: "BlockedByClient",
            });
            return;
          }
          await validateTarget(url, policy);
          await session.send("Fetch.continueRequest", {
            requestId: event.requestId,
          });
        })().catch(() => {
          policyBlocked.add(event.request.url);
          void session
            .send("Fetch.failRequest", {
              requestId: event.requestId,
              errorReason: "BlockedByClient",
            })
            .catch(() => undefined);
        });
      });
    })();
    documentGuards.set(page, ready);
    void ready.catch(() => undefined);
  });
  let requests = 0;
  await context.routeWebSocket("**/*", (socket) => socket.close());
  await context.route("**/*", async (route) => {
    try {
      const request = route.request();
      const abort = () => {
        policyBlocked.add(request.url());
        return route.abort();
      };
      if (++requests > 350 || !["GET", "HEAD"].includes(request.method()))
        return abort();
      const url = new URL(request.url());
      if (
        interactionContexts.has(context) &&
        (request.isNavigationRequest() ||
          url.origin !== new URL(target).origin ||
          dangerousAction.test(decodeURIComponent(url.pathname)) ||
          [...url.searchParams.keys()].some((k) =>
            /^(token|password|secret|access_token|api_key|authorization)$/i.test(
              k,
            ),
          ))
      )
        return abort();
      const local =
        url.origin === policy.allowedLocalOrigin ||
        url.origin === policy.demoOrigin;
      parseTarget(url.href, { allowLocal: local });
      if (
        policy.demoOrigin &&
        (url.origin !== policy.demoOrigin ||
          !/^\/demo-site(?:\/|$)/.test(url.pathname))
      )
        return abort();
      if (url.origin === policy.hubOrigin && url.origin !== policy.demoOrigin)
        return abort();
      if (
        request.isNavigationRequest() &&
        request.frame() === request.frame().page().mainFrame() &&
        !inScope(url.href, target, excluded)
      )
        return abort();
      await validateTarget(url, policy);
      await route.continue();
    } catch {
      policyBlocked.add(route.request().url());
      await route.abort().catch(() => undefined);
    }
  });
  context.on("page", (page) => {
    page.on("dialog", (dialog) => void dialog.dismiss().catch(() => undefined));
    page.on("popup", (popup) => void popup.close().catch(() => undefined));
  });
  return context;
}
async function stabilize(page: Page) {
  await page
    .addStyleTag({
      content:
        "*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important;caret-color:transparent!important}",
    })
    .catch(() => undefined);
  await page.evaluate(async () => {
    await Promise.race([
      document.fonts.ready,
      new Promise((resolve) => setTimeout(resolve, 1200)),
    ]);
    await Promise.race([
      Promise.all(
        [...document.images]
          .slice(0, 50)
          .map((image) => image.decode().catch(() => undefined)),
      ),
      new Promise((resolve) => setTimeout(resolve, 1200)),
    ]);
  });
}

/** Bounded same-origin discovery. It never submits a form or follows arbitrary button actions. */
export async function discoverPages(
  options: DiscoveryOptions,
  emit?: AuditEmitter,
): Promise<DiscoveryResult> {
  const start = normalizeAuditUrl(options.url);
  await validateTarget(new URL(start), options);
  const limit = Math.min(30, Math.max(1, options.maxPages || 10));
  const depthLimit = Math.min(3, Math.max(0, options.maxDepth ?? 1));
  const result: DiscoveryResult = { urls: [], warnings: [], excluded: [] };
  const { browser, proxy } = await openBrowser(options);
  try {
    const context = await createContext(
      browser,
      start,
      options,
      VIEWPORTS[0]!,
      options.excludedPaths,
    );
    const page = await context.newPage();
    await documentGuards.get(page);
    const queue = [{ url: start, depth: 0 }];
    const seen = new Set([start]);
    if (!options.demoOrigin && depthLimit > 0) {
      const sitemap = await importSitemap({
        ...options,
        url: start,
        sitemapUrl: new URL("/sitemap.xml", start).href,
        maxPages: limit,
        excludedPaths: options.excludedPaths ?? [],
      });
      for (const url of sitemap.urls)
        if (!seen.has(url)) {
          seen.add(url);
          queue.push({ url, depth: 1 });
        }
      result.warnings.push(...sitemap.warnings);
    }
    while (queue.length && result.urls.length < limit) {
      const next = queue.shift()!;
      if (!inScope(next.url, start, options.excludedPaths)) {
        result.excluded.push(next.url);
        continue;
      }
      result.urls.push(next.url);
      emit?.({
        type: "progress",
        progress: {
          phase: "discovery",
          message: `Entdecke ${next.url}`,
          completed: result.urls.length,
          total: limit,
          pageUrl: next.url,
          updatedAt: new Date().toISOString(),
        },
      });
      try {
        await page.goto(next.url, {
          waitUntil: "domcontentloaded",
          timeout: 12_000,
        });
        if (next.depth >= depthLimit) continue;
        const links = await page
          .locator("a[href]")
          .evaluateAll((nodes) =>
            nodes.slice(0, 500).map((node) => (node as HTMLAnchorElement).href),
          );
        for (const link of links) {
          try {
            const url = normalizeAuditUrl(link);
            if (!inScope(url, start, options.excludedPaths)) {
              if (result.excluded.length < 50) result.excluded.push(url);
              continue;
            }
            // Avoid obvious mutating GET endpoints and unbounded calendar/filter query expansion.
            if (
              /\/(?:logout|signout|delete|remove|checkout|cart|unsubscribe)(?:\/|$)/i.test(
                new URL(url).pathname,
              )
            )
              continue;
            if (seen.has(url) || seen.size >= limit * 3) continue;
            seen.add(url);
            queue.push({ url, depth: next.depth + 1 });
          } catch {
            /* Not a navigable HTTP(S) URL. */
          }
        }
      } catch {
        result.warnings.push(`Nicht erreichbar: ${next.url}`);
      }
    }
    if (queue.length)
      result.warnings.push(
        `Entdeckung auf ${limit} Seiten begrenzt. Weitere Links wurden nicht besucht.`,
      );
    if (proxy.blockedRequests())
      result.warnings.push(
        `${proxy.blockedRequests()} Netzwerkzugriffe wurden durch die Zielrichtlinie blockiert.`,
      );
    return result;
  } finally {
    await browser.close();
    activeBrowsers.delete(browser);
    await proxy.close();
    activeProxies.delete(proxy);
  }
}

interface GeometryIssue {
  uncertain?: boolean;
  selector: string;
  rect: { x: number; y: number; width: number; height: number };
  detail: string;
}
async function inspectGeometry(page: Page) {
  return page.evaluate(() => {
    const viewWidth = Math.min(
      innerWidth,
      document.documentElement.clientWidth,
    );
    const selector = (element: Element) =>
      element.id
        ? `#${CSS.escape(element.id)}`
        : `${element.tagName.toLowerCase()}${
            element.classList.length
              ? "." +
                [...element.classList]
                  .slice(0, 2)
                  .map((x) => CSS.escape(x))
                  .join(".")
              : ""
          }`;
    const rect = (element: Element) => {
      const box = element.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    };
    const visible = (element: Element) => {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      let ancestor = element.parentElement;
      while (ancestor) {
        const inherited = getComputedStyle(ancestor);
        if (Number(inherited.opacity) <= 0.01 || inherited.display === "none")
          return false;
        ancestor = ancestor.parentElement;
      }
      return (
        box.width > 2 &&
        box.height > 2 &&
        box.bottom > 0 &&
        box.top < innerHeight &&
        style.visibility === "visible" &&
        style.display !== "none" &&
        Number(style.opacity) > 0.01
      );
    };
    const overflow: GeometryIssue[] = [];
    if (document.documentElement.scrollWidth > viewWidth + 2) {
      for (const element of [...document.querySelectorAll("body *")].slice(
        0,
        3500,
      )) {
        if (!visible(element)) continue;
        const box = element.getBoundingClientRect();
        if (box.right > viewWidth + 2 && box.left >= 0 && box.width > 10) {
          const parent = element.parentElement;
          if (parent && getComputedStyle(parent).overflowX !== "visible")
            continue;
          overflow.push({
            selector: selector(element),
            rect: rect(element),
            detail: `Rechter Rand ${Math.round(box.right)} px überschreitet die ${viewWidth} px breite Ansicht.`,
          });
          if (overflow.length >= 3) break;
        }
      }
    }
    const covered: GeometryIssue[] = [];
    // Background controls intentionally covered by a modal are not a defect.
    const modal = [
      ...document.querySelectorAll(
        'dialog[open], [role="dialog"][aria-modal="true"]',
      ),
    ]
      .filter(visible)
      .at(-1);
    for (const element of [
      ...document.querySelectorAll(
        'button, a[href], input:not([type="hidden"]), select, textarea',
      ),
    ].slice(0, 250)) {
      if (
        !visible(element) ||
        element.matches(":disabled") ||
        element.closest('[inert], [aria-hidden="true"]') ||
        (modal && !modal.contains(element))
      )
        continue;
      const box = element.getBoundingClientRect();
      if (
        box.left < 0 ||
        box.right > viewWidth ||
        box.top < 0 ||
        box.bottom > innerHeight
      )
        continue;
      const points = [
        [0.5, 0.5],
        [0.2, 0.2],
        [0.8, 0.2],
        [0.2, 0.8],
        [0.8, 0.8],
      ];
      const blocked = points.filter(([x, y]) => {
        const top = document.elementFromPoint(
          box.left + box.width * x!,
          box.top + box.height * y!,
        );
        return (
          top &&
          top !== element &&
          !element.contains(top) &&
          !top.contains(element)
        );
      });
      if (blocked.length === 5) {
        const fixedOccluder = points.some(([x, y]) => {
          let top = document.elementFromPoint(
            box.left + box.width * x!,
            box.top + box.height * y!,
          );
          while (top) {
            if (["fixed", "sticky"].includes(getComputedStyle(top).position))
              return true;
            top = top.parentElement;
          }
          return false;
        });
        covered.push({
          uncertain: fixedOccluder,
          selector: selector(element),
          rect: rect(element),
          detail:
            "Alle fünf untersuchten Punkte der sichtbaren Bedienfläche treffen ein anderes, nicht zugehöriges Element.",
        });
      }
      if (covered.length >= 5) break;
    }
    const clipped: GeometryIssue[] = [];
    for (const element of [
      ...document.querySelectorAll("h1,h2,h3,p,button,a,label"),
    ].slice(0, 1000)) {
      if (
        !(element instanceof HTMLElement) ||
        !visible(element) ||
        !element.textContent?.trim()
      )
        continue;
      const style = getComputedStyle(element);
      if (style.textOverflow === "ellipsis" || style.webkitLineClamp !== "none")
        continue;
      if (
        ["hidden", "clip"].includes(style.overflowY) &&
        element.scrollHeight > element.clientHeight + 4 &&
        element.clientHeight > 0
      )
        clipped.push({
          selector: selector(element),
          rect: rect(element),
          detail: `Textinhalt benötigt ${element.scrollHeight} px Höhe, sichtbar sind ${element.clientHeight} px. Absicht muss manuell geprüft werden.`,
        });
      if (clipped.length >= 3) break;
    }
    return {
      overflow,
      pageOverflow: document.documentElement.scrollWidth > viewWidth + 2,
      covered,
      clipped,
      scrollX,
      scrollY,
    };
  });
}

function defaults(): ScanOptions {
  return {
    pages: [],
    maxPages: 10,
    maxDepth: 1,
    excludedPaths: [],
    viewports: VIEWPORTS,
    performance: true,
    performanceRuns: 1,
  };
}
export async function runAudit(
  job: WorkerJob,
  emit: AuditEmitter = () => undefined,
  onBrowser?: (browser?: Browser) => void,
  control?: AuditControl,
): Promise<ScanResult> {
  const start = Date.now();
  const options = { ...defaults(), ...job.options };
  options.maxPages = Math.min(30, Math.max(1, options.maxPages));
  options.viewports = options.viewports.length
    ? options.viewports.slice(0, 3)
    : VIEWPORTS;
  const policy: TargetPolicy = {
    allowedLocalOrigin: job.allowedLocalOrigin,
    demoOrigin: job.demoOrigin,
    hubOrigin: job.hubOrigin,
  };
  const target = normalizeAuditUrl(job.url);
  await validateTarget(new URL(target), policy);
  const selected = [
    ...new Set(
      (options.pages.length ? options.pages : [target]).map((value) =>
        normalizeAuditUrl(value, target),
      ),
    ),
  ]
    .filter((value) => inScope(value, target, options.excludedPaths))
    .slice(0, options.maxPages);
  if (!selected.length)
    throw new Error(
      "Keine Seite innerhalb des freigegebenen Zielbereichs ausgewählt.",
    );
  const journeys = normalizeJourneys(
    options.journeys,
    selected,
    options.viewports.map((v) => v.id),
  );
  if (journeys.length) options.journeys = journeys;
  const report: AuditReport = {
    ...(options.technicalSeo ? { seo: emptySeo() } : {}),
    ...(options.journeys?.length
      ? {
          journeyRuns: options.journeys.flatMap((j) =>
            j.viewportIds.map((v) => plannedJourney(j, v)),
          ),
        }
      : {}),
    provenance: await auditProvenance(),
    schemaVersion: 1,
    ruleVersion: RULE_VERSION,
    profileVersion: PROFILE_VERSION,
    browserVersion: "",
    options: { ...options, pages: selected },
    pages: [],
    rules: [],
    findings: [],
    evidence: [],
    discoveredUrls: selected,
    coverage: {
      planned: selected.length * options.viewports.length,
      completed: 0,
      skipped: [],
    },
    startedAt: new Date().toISOString(),
    finishedAt: "",
    durationMs: 0,
    performance: [],
    warnings: [
      "Chromium-Emulation ersetzt keine echten Safari-/Gerätetests.",
      "Automatische Accessibility-Prüfung ist kein WCAG-Konformitätsnachweis.",
      "Navigation kann trotz gesperrter Formularmethoden Seiteneffekte auslösen. Nur berechtigte Ziele prüfen.",
      "Interaktionszustände und authentisierte Bereiche sind nicht automatisch abgedeckt.",
      "POST-/PUT-Anfragen und WebSockets werden blockiert. Das kann datengetriebene Websites verändern; solche Blockierungen sind kein Beweis für einen Websitefehler.",
      "Dokumente in Frames außerhalb des freigegebenen Origins werden blockiert und sind nicht Teil des Audits.",
    ],
  };
  if (
    job.resumeReport?.ruleVersion === RULE_VERSION &&
    JSON.stringify(job.resumeReport.provenance) ===
      JSON.stringify(report.provenance) &&
    job.resumeReport.profileVersion === PROFILE_VERSION &&
    JSON.stringify(job.resumeReport.options) === JSON.stringify(report.options)
  ) {
    const previous = job.resumeReport;
    const completedKeys = new Set(
      previous.pages
        .filter(
          (item) =>
            item.state === "initial" &&
            item.status === "completed" &&
            (previous.journeyRuns ?? [])
              .filter(
                (r) =>
                  r.pageUrl === item.pageUrl &&
                  r.viewportId === item.viewportId,
              )
              .every((r) => r.status !== "not_run"),
        )
        .map((item) => `${item.pageUrl}|${item.viewportId}`),
    );
    report.pages = previous.pages.filter((item) =>
      completedKeys.has(`${item.pageUrl}|${item.viewportId}`),
    );
    report.rules = previous.rules.filter(
      (item) =>
        item.category !== "performance" &&
        completedKeys.has(`${item.pageUrl}|${item.viewportId}`),
    );
    report.findings = previous.findings.filter(
      (item) =>
        item.category !== "performance" &&
        completedKeys.has(`${item.pageUrl}|${item.viewportId}`),
    );
    report.evidence = previous.evidence.filter((item) =>
      completedKeys.has(`${item.pageUrl}|${item.viewportId}`),
    );
    if (report.seo)
      report.seo.pages = (previous.seo?.pages ?? []).filter((item) =>
        completedKeys.has(`${item.pageUrl}|${item.viewportId}`),
      );
    if (report.journeyRuns)
      report.journeyRuns = report.journeyRuns.map(
        (r) =>
          previous.journeyRuns?.find(
            (old) =>
              completedKeys.has(`${r.pageUrl}|${r.viewportId}`) &&
              old.journeyId === r.journeyId &&
              old.viewportId === r.viewportId,
          ) ?? r,
      );
    report.coverage.completed = report.pages.filter(
      (p) => p.state === "initial",
    ).length;
    report.warnings.push(
      "Abgeschlossene Seiten-/Viewport-Schritte aus einem kompatiblen unterbrochenen Lauf übernommen.",
    );
  }
  const { browser, proxy } = await openBrowser(policy);
  onBrowser?.(browser);
  report.browserVersion = browser.version();
  if (
    job.resumeReport &&
    job.resumeReport.browserVersion !== report.browserVersion &&
    report.pages.length
  ) {
    report.pages = [];
    report.rules = [];
    report.findings = [];
    report.evidence = [];
    if (report.seo) report.seo.pages = [];
    if (report.journeyRuns)
      report.journeyRuns = options.journeys!.flatMap((j) =>
        j.viewportIds.map((v) => plannedJourney(j, v)),
      );
    report.coverage.completed = 0;
    report.warnings.push(
      "Browser-Version geändert: frühere Seitenschritte werden nicht als vergleichbare Messungen übernommen.",
    );
  }
  await mkdir(join(job.dataDir, "evidence"), { recursive: true });
  let first:
    | { title: string; url: string; statusCode: number; screenshotPath: string }
    | undefined;
  if (report.pages[0] && report.evidence[0])
    first = {
      title: report.pages[0].title || "Ohne Seitentitel",
      url: report.pages[0].finalUrl,
      statusCode: report.pages[0].statusCode || 0,
      screenshotPath: report.evidence[0].path,
    };
  let currentEvidence: Evidence | undefined;
  const addFinding = (input: Omit<Finding, "id" | "fingerprint">) => {
    const fingerprint = digest(
      [
        RULE_VERSION,
        input.ruleId,
        input.pageUrl,
        input.viewportId,
        input.state,
        input.selector || "document",
      ].join("|"),
    );
    const previous = report.findings.find(
      (item) => item.fingerprint === fingerprint,
    );
    if (previous) return previous;
    const finding: Finding = { ...input, id: randomUUID(), fingerprint };
    report.findings.push(finding);
    emit({ type: "finding", finding });
    return finding;
  };
  const addRule = (
    ruleId: string,
    category: RuleResult["category"],
    status: RuleResult["status"],
    detail: string,
    pageUrl: string,
    viewportId: string,
    state: string,
    findings: Finding[] = [],
    weight = 1,
  ) => {
    const rule: RuleResult = {
      id: digest(`${ruleId}|${pageUrl}|${viewportId}|${state}`),
      ruleId,
      category,
      status,
      detail,
      pageUrl,
      viewportId,
      state,
      weight,
      findingIds: findings.map((item) => item.id),
      evidenceId: currentEvidence?.id,
    };
    const index = report.rules.findIndex((item) => item.id === rule.id);
    if (index >= 0) report.rules[index] = rule;
    else report.rules.push(rule);
  };
  // All intended rule instances exist before the first checkpoint. A cancelled partial scan cannot look complete merely because future pages have no rows yet.
  for (const pageUrl of selected)
    for (const viewport of options.viewports) {
      if (
        report.pages.some(
          (item) =>
            item.pageUrl === pageUrl &&
            item.viewportId === viewport.id &&
            item.status === "completed",
        )
      )
        continue;
      for (const [id, category] of [
        ["horizontal-overflow", "layout"],
        ["covered-control", "layout"],
        ["document-title", "seo"],
        ["meta-description", "seo"],
        ["indexability", "seo"],
        ["canonical-valid", "seo"],
        ["structured-data-json", "seo"],
        ["http-status", "runtime"],
        ["script-errors", "runtime"],
        ["resource-errors", "runtime"],
        ["axe-automated", "accessibility"],
        ...(options.technicalSeo
          ? TECHNICAL_RULES.map((id) => [id, "seo"] as const)
          : []),
      ] as const) {
        addRule(
          id,
          category,
          "not_run",
          "Geplanter Prüfschritt noch nicht ausgeführt.",
          pageUrl,
          viewport.id,
          "initial",
          [],
          id === "axe-automated"
            ? 3
            : [
                  "horizontal-overflow",
                  "covered-control",
                  "http-status",
                ].includes(id)
              ? 2
              : 1,
        );
      }
    }
  for (const j of options.journeys ?? [])
    for (const v of j.viewportIds)
      for (const [i] of j.steps.entries()) {
        if (
          report.journeyRuns?.find(
            (r) => r.journeyId === j.id && r.viewportId === v,
          )?.status !== "not_run"
        )
          continue;
        for (const [id, category, weight] of [
          ["horizontal-overflow", "layout", 2],
          ["covered-control", "layout", 2],
          ["axe-automated", "accessibility", 3],
        ] as const)
          addRule(
            id,
            category,
            "not_run",
            "Geplanter, noch nicht bestätigter Interaktionszustand.",
            j.pageUrl,
            v,
            journeyState(j, i),
            [],
            weight,
          );
      }
  for (const device of ["desktop", "mobile"].filter(
    (device) =>
      !options.retest || options.viewports.some((p) => p.id === device),
  ))
    for (const metric of ["lcp", "cls", "tbt"])
      addRule(
        `performance-${metric}`,
        "performance",
        "not_run",
        "Geplanter Lighthouse-Referenzlauf noch nicht ausgeführt.",
        selected[0]!,
        device,
        "lighthouse",
      );
  try {
    for (const pageUrl of selected)
      for (const viewport of options.viewports) {
        await control?.checkpoint();
        if (control?.cancelled()) throw new Error("Prüfung abgebrochen.");
        if (
          report.pages.some(
            (item) =>
              item.pageUrl === pageUrl &&
              item.viewportId === viewport.id &&
              item.status === "completed",
          )
        )
          continue;
        const pageStart = Date.now();
        currentEvidence = undefined;
        emit({
          type: "progress",
          progress: {
            phase: "browser",
            message: `Prüfe ${viewport.id}: ${new URL(pageUrl).pathname}`,
            completed: report.coverage.completed,
            total: report.coverage.planned,
            pageUrl,
            viewportId: viewport.id,
            updatedAt: new Date().toISOString(),
          },
        });
        let context = await createContext(
          browser,
          target,
          policy,
          viewport,
          options.excludedPaths,
        );
        let page = await context.newPage();
        await documentGuards.get(page);
        page.setDefaultTimeout(8_000);
        let takingLiveFrame = false;
        const liveTimer = setInterval(() => {
          if (takingLiveFrame || page.isClosed()) return;
          takingLiveFrame = true;
          void (async () => {
            const position = await page.evaluate(() => ({
              x: scrollX,
              y: scrollY,
            }));
            const buffer = await page.screenshot({
              type: "jpeg",
              quality: 45,
              timeout: 2500,
            });
            if (buffer.length <= 375_000)
              emit({
                type: "frame",
                frame: {
                  id: randomUUID(),
                  pageUrl,
                  viewportId: viewport.id,
                  width: viewport.width,
                  height: viewport.height,
                  scrollX: position.x,
                  scrollY: position.y,
                  state: "live-preview",
                  capturedAt: new Date().toISOString(),
                  image: `data:image/jpeg;base64,${buffer.toString("base64")}`,
                  rects: [],
                },
              });
          })()
            .catch(() => undefined)
            .finally(() => {
              takingLiveFrame = false;
            });
        }, 1200);
        const scriptErrors: string[] = [];
        const resourceErrors: string[] = [];
        page.on("pageerror", (error) => {
          if (scriptErrors.length < 10)
            scriptErrors.push(error.message.slice(0, 250));
        });
        page.on("requestfailed", (request) => {
          if (
            !blockedByContext.get(context)?.has(request.url()) &&
            resourceErrors.length < 10 &&
            new URL(request.url()).origin === new URL(pageUrl).origin
          )
            resourceErrors.push(new URL(request.url()).pathname);
        });
        page.on("response", (response) => {
          if (
            response.status() >= 400 &&
            resourceErrors.length < 10 &&
            new URL(response.url()).origin === new URL(pageUrl).origin
          )
            resourceErrors.push(
              `${response.status()} ${new URL(response.url()).pathname}`,
            );
        });
        try {
          const response = await page.goto(pageUrl, {
            waitUntil: "domcontentloaded",
            timeout: 20_000,
          });
          if (!response || !inScope(page.url(), target, options.excludedPaths))
            throw new Error(
              "Seite ohne gültige Antwort oder außerhalb des freigegebenen Bereichs.",
            );
          if (
            response.headers()["content-type"] &&
            !/html/i.test(response.headers()["content-type"]!)
          )
            throw new Error("Ziel ist keine HTML-Seite.");
          await stabilize(page);
          const metadata = await page.evaluate(() => ({
            canonicals: [
              ...document.querySelectorAll('link[rel~="canonical" i]'),
            ]
              .slice(0, 10)
              .map((e) => e.getAttribute("href") ?? "")
              .filter((v) => v.length <= 2048),
            robotsValues: [
              ...document.querySelectorAll('meta[name="robots" i]'),
            ]
              .slice(0, 20)
              .map((e) => (e.getAttribute("content") ?? "").slice(0, 1000)),
            googlebotValues: [
              ...document.querySelectorAll('meta[name="googlebot" i]'),
            ]
              .slice(0, 20)
              .map((e) => (e.getAttribute("content") ?? "").slice(0, 1000)),
            signalsTruncated:
              document.title.length > 2000 ||
              (
                document
                  .querySelector('meta[name="description" i]')
                  ?.getAttribute("content") ?? ""
              ).length > 4000 ||
              document.querySelectorAll('link[rel~="canonical" i]').length >
                10 ||
              [...document.querySelectorAll('link[rel~="canonical" i]')].some(
                (e) => (e.getAttribute("href") ?? "").length > 2048,
              ) ||
              document.querySelectorAll(
                'meta[name="robots" i],meta[name="googlebot" i]',
              ).length > 20 ||
              [
                ...document.querySelectorAll(
                  'meta[name="robots" i],meta[name="googlebot" i]',
                ),
              ].some((e) => (e.getAttribute("content") ?? "").length > 1000),
            links: [...document.querySelectorAll<HTMLAnchorElement>("a[href]")]
              .slice(0, 100)
              .filter((e) => e.href.length <= 2048)
              .map((e) => ({
                url: e.href,
                text: (e.textContent ?? "").trim().slice(0, 160),
                rel: e.rel.slice(0, 100),
              })),
            linksTruncated:
              document.querySelectorAll("a[href]").length > 100 ||
              [...document.querySelectorAll<HTMLAnchorElement>("a[href]")].some(
                (e) => e.href.length > 2048,
              ),
            jsonldTruncated:
              document.querySelectorAll('script[type="application/ld+json"]')
                .length > 20,
            title: document.title.trim().slice(0, 2000),
            description: (
              document
                .querySelector('meta[name="description" i]')
                ?.getAttribute("content")
                ?.trim() || ""
            ).slice(0, 4000),
            canonical: (
              document
                .querySelector('link[rel~="canonical" i]')
                ?.getAttribute("href") || ""
            ).slice(0, 2048),
            robots: (
              document
                .querySelector('meta[name="robots" i]')
                ?.getAttribute("content") || ""
            ).slice(0, 1000),
            h1: document.querySelectorAll("h1").length,
            jsonld: [
              ...document.querySelectorAll(
                'script[type="application/ld+json"]',
              ),
            ]
              .slice(0, 20)
              .map((node) => ({
                text: (node.textContent || "").slice(0, 100000),
                oversized: (node.textContent || "").length > 100000,
              })),
          }));
          const height = await page.evaluate(() =>
            Math.min(document.documentElement.scrollHeight, 30_000),
          );
          const positions = [
            ...new Set([
              0,
              Math.min(Math.max(0, height - viewport.height), viewport.height),
              Math.max(0, height - viewport.height),
            ]),
          ];
          const captureState = async (
            state: string,
            initial = false,
            measure = true,
            ready = true,
          ): Promise<Evidence> => {
            const geometry = await inspectGeometry(page);
            const evidenceId = randomUUID();
            const path = `evidence/${job.id}-${evidenceId}.png`;
            await page.screenshot({
              path: join(job.dataDir, path),
              animations: "disabled",
              timeout: 8_000,
            });
            currentEvidence = {
              id: evidenceId,
              path,
              pageUrl,
              viewportId: viewport.id,
              width: viewport.width,
              height: viewport.height,
              scrollX: geometry.scrollX,
              scrollY: geometry.scrollY,
              state,
              capturedAt: new Date().toISOString(),
              capture: {
                ...(state.startsWith("journey:") ? { stateReady: ready } : {}),
                version: "capture-1.3",
                animations: "disabled",
                reducedMotion: "reduce",
                colorScheme: "light",
                locale: "de-DE",
                timezone: "Europe/Berlin",
                fontsReady: await page.evaluate(
                  () => document.fonts.status === "loaded",
                ),
                documentUrl: page.url(),
              },
            };
            report.evidence.push(currentEvidence);
            if (!first)
              first = {
                title: metadata.title || "Ohne Seitentitel",
                url: page.url(),
                statusCode: response.status(),
                screenshotPath: path,
              };
            if (measure) {
              const make = (
                ruleId: string,
                category: Finding["category"],
                title: string,
                detail: string,
                recommendation: string,
                acceptance: string,
                extra: Partial<Finding> = {},
              ) =>
                addFinding({
                  ruleId,
                  category,
                  priority: "important",
                  title,
                  detail,
                  recommendation,
                  acceptance,
                  pageUrl,
                  viewportId: viewport.id,
                  state,
                  evidenceStatus: "measured",
                  evidenceId,
                  ...extra,
                  rect: extra.rect
                    ? {
                        ...extra.rect,
                        x: extra.rect.x + geometry.scrollX,
                        y: extra.rect.y + geometry.scrollY,
                      }
                    : undefined,
                });
              const overflows = geometry.overflow.map((issue) =>
                make(
                  "horizontal-overflow",
                  "layout",
                  "Inhalt läuft horizontal über die Ansicht",
                  issue.detail,
                  "Breiten, Mindestbreiten und Layout des markierten Elements prüfen. Nicht pauschal mit overflow:hidden kaschieren.",
                  "Die Seite benötigt bei dieser Breite kein unbeabsichtigtes horizontales Scrollen; Inhalte bleiben erreichbar.",
                  { selector: issue.selector, rect: issue.rect },
                ),
              );
              if (geometry.pageOverflow && !overflows.length)
                overflows.push(
                  make(
                    "horizontal-overflow",
                    "layout",
                    "Seite ist breiter als die Ansicht",
                    "Die Dokumentbreite überschreitet den Viewport; der konkrete Auslöser wurde nicht eindeutig lokalisiert.",
                    "Überbreite Container und transformierte Elemente im Quellprojekt untersuchen.",
                    "Die Dokumentbreite überschreitet den Viewport nicht unbeabsichtigt.",
                  ),
                );
              addRule(
                "horizontal-overflow",
                "layout",
                geometry.pageOverflow ? "fail" : "pass",
                geometry.pageOverflow
                  ? "Horizontales Dokument-Overflow gemessen."
                  : "Kein horizontales Dokument-Overflow in diesem Zustand.",
                pageUrl,
                viewport.id,
                state,
                overflows,
                2,
              );
              const covers = geometry.covered.map((issue) =>
                make(
                  "covered-control",
                  "layout",
                  issue.uncertain
                    ? "Bedienfläche hinter fester Ebene — Absicht prüfen"
                    : "Bedienfläche wird von anderem Element verdeckt",
                  issue.detail +
                    (issue.uncertain
                      ? " Die feste/haftende Ebene kann ein beabsichtigter Hinweis, eine Navigation oder eine Kopfzeile sein. Kein automatisch bestätigter Websitefehler."
                      : ""),
                  "Zuerst beabsichtigten Zustand und Schließmöglichkeit prüfen; danach bei Bedarf Stacking und Pointer-Events im Quellprojekt untersuchen.",
                  "An den untersuchten Punkten trifft der Hit-Test das Bedienelement oder dessen Inhalt.",
                  {
                    selector: issue.selector,
                    rect: issue.rect,
                    evidenceStatus: issue.uncertain ? "heuristic" : "measured",
                    priority: issue.uncertain ? "nice-to-have" : "important",
                  },
                ),
              );
              addRule(
                "covered-control",
                "layout",
                covers.some((item) => item.evidenceStatus === "measured")
                  ? "fail"
                  : covers.length
                    ? "not_run"
                    : "pass",
                `${covers.length} an fünf Punkten verdeckte Bedienflächen. Feste/haftende Ebenen sind Prüfkandidaten mit unbekannter Fehlerbewertung. Kein vollständiger Funktionstest.`,
                pageUrl,
                viewport.id,
                state,
                covers,
                2,
              );
              for (const issue of geometry.clipped)
                make(
                  "clipped-text-candidate",
                  "layout",
                  "Möglicherweise abgeschnittener Text",
                  issue.detail,
                  "Feste Höhe und Overflow-Einstellungen prüfen; beabsichtigte Vorschauen gegebenenfalls bestätigen.",
                  "Der vollständige relevante Text bleibt lesbar oder ist über eine eindeutige Aktion erreichbar.",
                  {
                    selector: issue.selector,
                    rect: issue.rect,
                    evidenceStatus: "heuristic",
                    priority: "nice-to-have",
                  },
                );
              if (initial) {
                const seo = (
                  id: string,
                  pass: boolean,
                  title: string,
                  detail: string,
                  recommendation: string,
                  acceptance: string,
                  priority: Finding["priority"] = "important",
                ) => {
                  const findings = pass
                    ? []
                    : [
                        make(
                          id,
                          "seo",
                          title,
                          detail,
                          recommendation,
                          acceptance,
                          { priority },
                        ),
                      ];
                  addRule(
                    id,
                    "seo",
                    pass ? "pass" : "fail",
                    detail,
                    pageUrl,
                    viewport.id,
                    state,
                    findings,
                  );
                };
                seo(
                  "document-title",
                  !!metadata.title,
                  "Seitentitel fehlt",
                  metadata.title
                    ? `Titel vorhanden: ${metadata.title.slice(0, 200)}`
                    : "Kein nicht-leerer title im gerenderten Dokument.",
                  "Einen eindeutigen passenden Seitentitel ergänzen.",
                  "Der Seitentitel ist nicht leer und beschreibt diese Seite.",
                );
                seo(
                  "meta-description",
                  !!metadata.description,
                  "Meta Description fehlt",
                  metadata.description
                    ? "Nicht-leere Meta Description vorhanden."
                    : "Die Meta Description fehlt oder ist leer. Dies belegt keinen Rankingverlust.",
                  "Eine passende Zusammenfassung für diese Seite ergänzen, falls sie indexiert werden soll.",
                  "Eine redaktionell passende Meta Description ist im HTML vorhanden.",
                  "nice-to-have",
                );
                const noindex = hasNoindex(
                  metadata.robotsValues,
                  metadata.googlebotValues,
                  [response.headers()["x-robots-tag"] ?? ""],
                );
                if (metadata.signalsTruncated && !noindex)
                  addRule(
                    "indexability",
                    "seo",
                    "not_run",
                    "Robots-Metadatenbudget erreicht; vollständige Indexierungsangaben unbekannt.",
                    pageUrl,
                    viewport.id,
                    state,
                  );
                else if (job.environment === "production")
                  seo(
                    "indexability",
                    !noindex,
                    "Produktionsseite untersagt Indexierung",
                    noindex
                      ? "noindex in Meta Robots oder X-Robots-Tag gefunden. Ob dies beabsichtigt ist, muss geprüft werden."
                      : "Kein noindex in den geprüften Angaben. Das beweist keine Google-Indexierung.",
                    "Indexierungsabsicht prüfen; nur versehentliches noindex entfernen.",
                    "Robots-Angaben entsprechen der dokumentierten Indexierungsabsicht.",
                  );
                else
                  addRule(
                    "indexability",
                    "seo",
                    "not_applicable",
                    "Indexierungsabsicht für Staging/lokal nicht als Produktionsanforderung gewertet.",
                    pageUrl,
                    viewport.id,
                    state,
                  );
                const validCanonical =
                  !metadata.canonical ||
                  (() => {
                    try {
                      return ["http:", "https:"].includes(
                        new URL(metadata.canonical, page.url()).protocol,
                      );
                    } catch {
                      return false;
                    }
                  })();
                if (metadata.signalsTruncated)
                  addRule(
                    "canonical-valid",
                    "seo",
                    "not_run",
                    "Metadatenerfassung begrenzt; vollständiges Canonical-Syntaxurteil unbekannt.",
                    pageUrl,
                    viewport.id,
                    state,
                  );
                else
                  seo(
                    "canonical-valid",
                    validCanonical,
                    "Canonical-Ziel ist ungültig",
                    validCanonical
                      ? "Kein syntaktisch ungültiges Canonical gefunden; korrekte Zielabsicht ist nicht geprüft."
                      : "Canonical kann nicht zu einer HTTP(S)-URL aufgelöst werden.",
                    "Canonical auf die beabsichtigte kanonische URL setzen.",
                    "Canonical ist syntaktisch gültig und redaktionell korrekt.",
                  );
                const invalidJson = metadata.jsonld.some((item) => {
                  if (item.oversized) return false;
                  try {
                    JSON.parse(item.text);
                    return false;
                  } catch {
                    return true;
                  }
                });
                if (
                  !invalidJson &&
                  (metadata.jsonldTruncated ||
                    metadata.jsonld.some((item) => item.oversized))
                )
                  addRule(
                    "structured-data-json",
                    "seo",
                    "not_run",
                    "JSON-LD-Erfassung überschreitet 20 Blöcke oder 100 KB pro Block; kein vollständiges Syntaxurteil.",
                    pageUrl,
                    viewport.id,
                    state,
                  );
                else
                  seo(
                    "structured-data-json",
                    !invalidJson,
                    "Strukturierte Daten enthalten ungültiges JSON",
                    invalidJson
                      ? "Mindestens ein JSON-LD-Block lässt sich nicht als JSON parsen."
                      : "Kein syntaktisch ungültiges JSON-LD gefunden. Schema-Eignung ist nicht geprüft.",
                    "JSON-LD-Syntax korrigieren und danach Schema-Eignung separat validieren.",
                    "Alle JSON-LD-Blöcke sind gültiges JSON.",
                  );
                addRule(
                  "http-status",
                  "runtime",
                  response.status() < 400 ? "pass" : "fail",
                  `Dokument antwortet mit HTTP ${response.status()}.`,
                  pageUrl,
                  viewport.id,
                  state,
                  response.status() < 400
                    ? []
                    : [
                        make(
                          "http-status",
                          "runtime",
                          "Dokument liefert Fehlerstatus",
                          `HTTP ${response.status()}`,
                          "Routing und Erreichbarkeit dieser Seite prüfen.",
                          "Die Seite liefert den vorgesehenen erfolgreichen HTTP-Status.",
                          {
                            priority:
                              response.status() >= 500
                                ? "critical"
                                : "important",
                          },
                        ),
                      ],
                  2,
                );
              }
              if (initial || state.startsWith("journey:")) {
                try {
                  const axePath = require.resolve("axe-core/axe.min.js");
                  await page.addScriptTag({
                    content: await readFile(axePath, "utf8"),
                  });
                  const locale = JSON.parse(
                    await readFile(
                      require.resolve("axe-core/locales/de.json"),
                      "utf8",
                    ),
                  );
                  await page.evaluate((locale) => {
                    (
                      window as unknown as {
                        axe: { configure: (options: unknown) => void };
                      }
                    ).axe.configure({ locale });
                  }, locale);
                  const axeResult = await page.evaluate(async () => {
                    const axe = (
                      window as unknown as {
                        axe: {
                          run: (
                            context: Document,
                            options: unknown,
                          ) => Promise<{
                            violations: {
                              id: string;
                              impact: string;
                              description: string;
                              helpUrl: string;
                              nodes: {
                                target: string[];
                                failureSummary?: string;
                              }[];
                            }[];
                            incomplete: unknown[];
                          }>;
                        };
                      }
                    ).axe;
                    return Promise.race([
                      axe.run(document, {
                        runOnly: {
                          type: "tag",
                          values: [
                            "wcag2a",
                            "wcag2aa",
                            "wcag21a",
                            "wcag21aa",
                            "wcag22aa",
                          ],
                        },
                      }),
                      new Promise<never>((_, reject) =>
                        setTimeout(
                          () => reject(new Error("axe-Zeitlimit")),
                          6000,
                        ),
                      ),
                    ]);
                  });
                  const axeFindings: Finding[] = [];
                  for (const violation of axeResult.violations.slice(0, 30))
                    for (const node of violation.nodes.slice(0, 3)) {
                      const locator = node.target.join(" ");
                      let box;
                      try {
                        box = await page
                          .locator(locator)
                          .first()
                          .boundingBox({ timeout: 1000 });
                      } catch {
                        /* Shadow/iframe target cannot be represented by a plain locator. */
                      }
                      axeFindings.push(
                        make(
                          `axe-${violation.id}`,
                          "accessibility",
                          violation.description,
                          (node.failureSummary || violation.description).slice(
                            0,
                            1200,
                          ),
                          `Regel ${violation.id} am betroffenen Element korrigieren; Dokumentation beachten.`,
                          "axe meldet diese Verletzung beim gleichen Zustand nicht mehr; nötige manuelle Prüfung bleibt bestehen.",
                          {
                            selector: locator,
                            rect:
                              box &&
                              box.y < viewport.height &&
                              box.y + box.height > 0
                                ? box
                                : undefined,
                            source: violation.helpUrl,
                            priority:
                              violation.impact === "minor"
                                ? "nice-to-have"
                                : "important",
                          },
                        ),
                      );
                    }
                  addRule(
                    "axe-automated",
                    "accessibility",
                    axeResult.violations.length ? "fail" : "pass",
                    `${axeResult.violations.length} axe-Regelverletzungen; ${axeResult.incomplete.length} Ergebnisse brauchen manuelle Prüfung. Nur automatisierter Umfang.`,
                    pageUrl,
                    viewport.id,
                    state,
                    axeFindings,
                    3,
                  );
                } catch {
                  addRule(
                    "axe-automated",
                    "accessibility",
                    "not_run",
                    "axe konnte auf dieser Seite nicht vollständig ausgeführt werden.",
                    pageUrl,
                    viewport.id,
                    state,
                    [],
                    3,
                  );
                }
              }
            }
            const matching = report.findings.filter(
              (item) => item.evidenceId === evidenceId && item.rect,
            );
            const image = await readFile(join(job.dataDir, path));
            if (image.length <= 375_000)
              emit({
                type: "frame",
                frame: {
                  ...currentEvidence,
                  image: `data:image/png;base64,${image.toString("base64")}`,
                  rects: matching.map((item) => ({
                    rect: item.rect!,
                    findingId: item.id,
                    priority: item.priority,
                    label: item.title,
                  })),
                },
              });
            return currentEvidence!;
          };
          for (const [stateIndex, y] of positions.entries()) {
            await page.evaluate((y) => scrollTo(0, y), y);
            await page.waitForTimeout(80);
            await captureState(
              stateIndex === 0 ? "initial" : `scroll-${stateIndex}`,
              stateIndex === 0,
            );
          }
          const state = "initial";
          // A fixed rule budget per page/viewport: extra scroll samples cannot inflate the score with more passes.
          for (const ruleId of ["horizontal-overflow", "covered-control"]) {
            const sampled = report.rules.filter(
              (item) =>
                item.pageUrl === pageUrl &&
                item.viewportId === viewport.id &&
                item.ruleId === ruleId &&
                !item.state.startsWith("journey:"),
            );
            report.rules = report.rules.filter(
              (item) => !sampled.includes(item),
            );
            currentEvidence = report.evidence.find(
              (item) =>
                item.id ===
                (sampled.find((item) => item.status === "fail") || sampled[0])
                  ?.evidenceId,
            );
            const findings = report.findings.filter((item) =>
              sampled.some((sample) => sample.findingIds.includes(item.id)),
            );
            addRule(
              ruleId,
              "layout",
              sampled.some((item) => item.status === "fail")
                ? "fail"
                : sampled.some((item) => item.status === "not_run")
                  ? "not_run"
                  : "pass",
              `${sampled.length} begrenzte Scroll-Stichprobe(n); ${findings.length} zugehörige Befunde. Kein vollständiger Seiten-/Interaktionstest.`,
              pageUrl,
              viewport.id,
              state,
              findings,
              2,
            );
          }
          currentEvidence = report.evidence.find(
            (item) =>
              item.pageUrl === pageUrl &&
              item.viewportId === viewport.id &&
              item.state === state,
          );
          const runtimeFindings: Finding[] = [];
          for (const [id, messages, title] of [
            ["script-errors", scriptErrors, "JavaScript-Ausnahme beobachtet"],
            [
              "resource-errors",
              resourceErrors,
              "Eigene Ressource oder Anfrage fehlgeschlagen",
            ],
          ] as const) {
            if (messages.length)
              runtimeFindings.push(
                addFinding({
                  ruleId: id,
                  category: "runtime",
                  priority: "important",
                  title,
                  detail: [...new Set(messages)].join("\n"),
                  pageUrl,
                  viewportId: viewport.id,
                  state,
                  evidenceId: report.evidence.find(
                    (item) =>
                      item.pageUrl === pageUrl &&
                      item.viewportId === viewport.id,
                  )?.id,
                  evidenceStatus: "measured",
                  recommendation:
                    "Den Fehler im Quellprojekt reproduzieren und seine tatsächliche Auswirkung prüfen.",
                  acceptance:
                    "Die beobachteten Fehler treten im gleichen Testablauf nicht mehr auf.",
                }),
              );
            const blockedCount = blockedByContext.get(context)?.size || 0;
            addRule(
              id,
              "runtime",
              messages.length ? "fail" : blockedCount ? "not_run" : "pass",
              `${messages.length} beobachtete Ereignisse; ${blockedCount} Anfragen von der Prüfrichtlinie blockiert. Bei Blockierungen sind Folgefehler möglich; kein vollständiger Funktionstest.`,
              pageUrl,
              viewport.id,
              state,
              runtimeFindings.filter((item) => item.ruleId === id),
            );
          }
          report.pages.push({
            id: randomUUID(),
            pageUrl,
            finalUrl: page.url(),
            viewportId: viewport.id,
            state: "initial",
            title: metadata.title,
            statusCode: response.status(),
            status: "completed",
            durationMs: Date.now() - pageStart,
            evidenceId: report.evidence.find(
              (item) =>
                item.pageUrl === pageUrl && item.viewportId === viewport.id,
            )?.id,
          });
          if (report.seo)
            report.seo.pages.push({
              pageUrl,
              finalUrl: page.url(),
              viewportId: viewport.id,
              evidenceId: report.evidence.find(
                (e) =>
                  e.pageUrl === pageUrl &&
                  e.viewportId === viewport.id &&
                  e.state === "initial",
              )?.id,
              title: metadata.title,
              description: metadata.description,
              canonicals: metadata.canonicals,
              robots: metadata.robotsValues,
              googlebot: metadata.googlebotValues,
              headerRobots: [response.headers()["x-robots-tag"] ?? ""],
              signalsTruncated: metadata.signalsTruncated,
              links: metadata.links,
              linksTruncated: metadata.linksTruncated,
              jsonld: breadcrumbProfile(
                metadata.jsonld,
                metadata.jsonldTruncated,
              ),
              jsonldTruncated: metadata.jsonldTruncated,
            });
          for (const j of (options.journeys ?? []).filter(
            (j) => j.pageUrl === pageUrl && j.viewportIds.includes(viewport.id),
          )) {
            const run = report.journeyRuns!.find(
              (r) => r.journeyId === j.id && r.viewportId === viewport.id,
            )!;
            try {
              await control?.checkpoint();
              await context.close();
              context = await createContext(
                browser,
                target,
                policy,
                viewport,
                options.excludedPaths,
              );
              page = await context.newPage();
              await documentGuards.get(page);
              page.setDefaultTimeout(8000);
              const initialResponse = await page.goto(j.pageUrl, {
                waitUntil: "domcontentloaded",
                timeout: 10000,
              });
              if (
                !initialResponse ||
                initialResponse.status() >= 400 ||
                !inScope(page.url(), target, options.excludedPaths)
              )
                throw Error(
                  "Ablaufstart nicht erreichbar oder nicht freigegeben.",
                );
              await stabilize(page);
              interactionContexts.add(context);
              await executeJourney(j, run, page, {
                checkpoint: async () => {
                  await control?.checkpoint();
                },
                blocked: () => !!blockedByContext.get(context)?.size,
                settle: async () => {
                  await stabilize(page);
                },
                progress: (message) =>
                  emit({
                    type: "progress",
                    progress: {
                      phase: "journey",
                      message,
                      completed: report.coverage.completed,
                      total: report.coverage.planned,
                      pageUrl,
                      viewportId: viewport.id,
                      updatedAt: new Date().toISOString(),
                    },
                  }),
                capture: async (state, ready, measure) => {
                  const evidence = await captureState(
                    state,
                    false,
                    measure,
                    ready,
                  );
                  return evidence;
                },
              });
            } catch (error) {
              run.status = "unknown";
              run.detail = (error as Error).message
                .split("\n")[0]!
                .slice(0, 350);
              if (control?.cancelled()) throw error;
            } finally {
              await context.close();
              interactionContexts.delete(context);
            }
            for (const step of run.steps) {
              if (step.status !== "completed") {
                for (const rule of report.rules.filter(
                  (r) =>
                    r.pageUrl === pageUrl &&
                    r.viewportId === viewport.id &&
                    r.state === step.state,
                )) {
                  rule.status = "not_run";
                  rule.detail = step.detail;
                  rule.findingIds = [];
                }
                report.findings = report.findings.filter(
                  (f) =>
                    !(
                      f.pageUrl === pageUrl &&
                      f.viewportId === viewport.id &&
                      f.state === step.state
                    ),
                );
                for (const e of report.evidence.filter(
                  (e) =>
                    e.pageUrl === pageUrl &&
                    e.viewportId === viewport.id &&
                    (e.state === step.state ||
                      e.state === step.state + ":before"),
                ))
                  if (e.capture) e.capture.stateReady = false;
              }
              const evidence = report.evidence.find(
                (e) => e.id === step.afterId,
              );
              report.pages.push({
                id: randomUUID(),
                pageUrl,
                finalUrl: evidence?.capture?.documentUrl ?? page.url(),
                viewportId: viewport.id,
                state: step.state,
                title: metadata.title,
                statusCode: null,
                status: step.status === "completed" ? "completed" : "failed",
                durationMs: step.durationMs,
                evidenceId: step.afterId,
                ...(step.status !== "completed" ? { error: step.detail } : {}),
              });
            }
          }
          report.coverage.completed++;
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message.split("\n")[0]!.slice(0, 300)
              : "Seite konnte nicht geprüft werden.";
          report.pages = report.pages.filter(
            (p) =>
              !(
                p.pageUrl === pageUrl &&
                p.viewportId === viewport.id &&
                p.state === "initial"
              ),
          );
          report.pages.push({
            id: randomUUID(),
            pageUrl,
            finalUrl: page.url(),
            viewportId: viewport.id,
            state: "initial",
            title: "",
            statusCode: null,
            status: "failed",
            durationMs: Date.now() - pageStart,
            error: message,
          });
          report.coverage.skipped.push(
            `${viewport.id}: ${pageUrl}: ${message}`,
          );
          report.rules = report.rules.filter(
            (item) =>
              item.category === "performance" ||
              item.state.startsWith("journey:") ||
              item.pageUrl !== pageUrl ||
              item.viewportId !== viewport.id,
          );
          for (const [id, category] of [
            ["horizontal-overflow", "layout"],
            ["covered-control", "layout"],
            ["document-title", "seo"],
            ["meta-description", "seo"],
            ["indexability", "seo"],
            ["canonical-valid", "seo"],
            ["structured-data-json", "seo"],
            ["http-status", "runtime"],
            ["script-errors", "runtime"],
            ["resource-errors", "runtime"],
            ["axe-automated", "accessibility"],
            ...(options.technicalSeo
              ? TECHNICAL_RULES.map((id) => [id, "seo"] as const)
              : []),
          ] as const)
            addRule(
              id,
              category,
              "not_run",
              "Seite/Zustand konnte nicht geprüft werden.",
              pageUrl,
              viewport.id,
              "initial",
              [],
              id === "axe-automated"
                ? 3
                : [
                      "horizontal-overflow",
                      "covered-control",
                      "http-status",
                    ].includes(id)
                  ? 2
                  : 1,
            );
        } finally {
          clearInterval(liveTimer);
          await context.close();
        }
        if (first)
          emit({
            type: "checkpoint",
            result: {
              ...first,
              viewport: {
                width: options.viewports[0]!.width,
                height: options.viewports[0]!.height,
              },
              durationMs: Date.now() - start,
              audit: { ...report, durationMs: Date.now() - start },
              checks: [
                {
                  id: "scope",
                  label: "Teilprüfung",
                  status: "info",
                  detail: `${report.coverage.completed}/${report.coverage.planned} Schritte abgeschlossen.`,
                },
              ],
            },
          });
        emit({
          type: "progress",
          progress: {
            phase: "checkpoint",
            message: "Seitenschritt gespeichert.",
            completed: report.coverage.completed,
            total: report.coverage.planned,
            pageUrl,
            viewportId: viewport.id,
            updatedAt: new Date().toISOString(),
          },
        });
      }
    if (proxy.blockedRequests())
      report.warnings.push(
        `${proxy.blockedRequests()} Netzwerkzugriffe von der Egress-Richtlinie blockiert. Das kann die Seitendarstellung beeinflussen.`,
      );
  } finally {
    await browser.close();
    activeBrowsers.delete(browser);
    onBrowser?.(undefined);
    await proxy.close();
    activeProxies.delete(proxy);
  }
  // Performance must not share the streamed/inspected browser or run alongside model inference.
  for (const device of ["desktop", "mobile"] as const) {
    if (options.retest && !options.viewports.some((p) => p.id === device))
      continue;
    await control?.checkpoint();
    if (control?.cancelled()) throw new Error("Prüfung abgebrochen.");
    const sample = options.performance
      ? await measurePerformance(
          selected[0]!,
          device,
          options.performanceRuns,
          policy,
          emit,
          control,
          onBrowser,
        )
      : {
          pageUrl: selected[0]!,
          device,
          score: null,
          runs: 0,
          metrics: {
            lcp: null,
            cls: null,
            tbt: null,
            fcp: null,
            speedIndex: null,
          },
          error: "Performance-Messung für diesen Lauf deaktiviert.",
        };
    report.performance.push(sample);
    for (const [id, metric, max] of [
      ["lcp", sample.metrics.lcp, 2500],
      ["cls", sample.metrics.cls, 0.1],
      ["tbt", sample.metrics.tbt, 200],
    ] as const) {
      const status =
        metric === null ? "not_run" : metric <= max ? "pass" : "fail";
      const findings =
        status === "fail"
          ? [
              addFinding({
                ruleId: `performance-${id}`,
                category: "performance",
                priority: "important",
                title: `Performance-Schwelle überschritten: ${id.toUpperCase()}`,
                detail: `Lokale Lighthouse-Labormessung: ${metric}; Schwelle ${max}. Kein Feldwert realer Nutzer.`,
                pageUrl: selected[0]!,
                viewportId: device,
                state: "lighthouse",
                evidenceStatus: "measured",
                recommendation:
                  "Die betroffene Lighthouse-Metrik im Quellprojekt untersuchen und unter gleichen Bedingungen erneut messen.",
                acceptance: `Die Labormetrik ${id.toUpperCase()} liegt im vergleichbaren Referenzlauf bei höchstens ${max}.`,
              }),
            ]
          : [];
      currentEvidence = undefined;
      addRule(
        `performance-${id}`,
        "performance",
        status,
        sample.error ||
          `${id}=${metric}, Schwelle=${max}; ${sample.runs} Lauf/Läufe`,
        selected[0]!,
        device,
        "lighthouse",
        findings,
      );
    }
  }
  if (options.technicalSeo && report.seo) {
    const outcome = await technicalSeo(
      report,
      { ...policy, url: target, excludedPaths: options.excludedPaths },
      job.environment ?? "production",
      {
        checkpoint: async () => {
          await control?.checkpoint();
          if (control?.cancelled()) throw new Error("Prüfung abgebrochen.");
        },
        progress: (detail) =>
          emit({
            type: "progress",
            progress: {
              phase: "technical-seo",
              message: detail,
              completed: report.coverage.completed,
              total: report.coverage.planned,
              updatedAt: new Date().toISOString(),
            },
          }),
      },
    );
    report.seo = outcome.context;
    for (const check of outcome.checks) {
      const evidence = report.evidence.find(
        (e) => e.id === check.page.evidenceId,
      );
      const finding =
        check.status === "fail"
          ? addFinding({
              ruleId: check.id,
              category: "seo",
              priority:
                check.kind === "measured" ? "important" : "nice-to-have",
              title: check.title,
              detail: check.detail,
              pageUrl: check.page.pageUrl,
              viewportId: check.page.viewportId,
              state: "initial",
              evidenceId: evidence?.id,
              evidenceStatus: check.kind,
              recommendation: check.action,
              acceptance: check.acceptance,
              source: check.source,
            })
          : undefined;
      currentEvidence = evidence;
      addRule(
        check.id,
        "seo",
        check.status,
        check.detail,
        check.page.pageUrl,
        check.page.viewportId,
        "initial",
        finding ? [finding] : [],
      );
    }
  }
  report.finishedAt = new Date().toISOString();
  report.durationMs = Date.now() - start;
  emit({
    type: "progress",
    progress: {
      phase: "complete",
      message:
        "Prüfung abgeschlossen. Grenzen und nicht ausgeführte Regeln stehen im Report.",
      completed: report.coverage.completed,
      total: report.coverage.planned,
      updatedAt: report.finishedAt,
    },
  });
  if (!first)
    throw new Error(
      `Keine ausgewählte Seite konnte erfolgreich gerendert werden. ${report.pages[0]?.error || ""}`,
    );
  return {
    ...first,
    viewport: {
      width: options.viewports[0]!.width,
      height: options.viewports[0]!.height,
    },
    durationMs: report.durationMs,
    audit: report,
    checks: [
      {
        id: "scope",
        label: "Prüfumfang",
        status: "info",
        detail: `${report.coverage.completed}/${report.coverage.planned} Seiten-/Viewport-Prüfungen abgeschlossen; ${report.findings.length} Befunde.`,
      },
    ],
  };
}

async function measurePerformance(
  url: string,
  device: "desktop" | "mobile",
  repeats: number,
  policy: TargetPolicy,
  emit: AuditEmitter,
  control?: AuditControl,
  onBrowser?: (browser?: Browser) => void,
): Promise<PerformanceSample> {
  const empty = {
    lcp: null,
    cls: null,
    tbt: null,
    fcp: null,
    speedIndex: null,
  };
  const samples: { score: number; metrics: PerformanceSample["metrics"] }[] =
    [];
  let proxy: AuditProxy | undefined;
  let chrome: ChildProcess | undefined;
  let directory: string | undefined;
  let attached: Browser | undefined;
  try {
    emit({
      type: "progress",
      progress: {
        phase: "performance",
        message: `Separater Lighthouse-Referenzlauf: ${device}`,
        completed: 0,
        total: repeats,
        pageUrl: url,
        viewportId: device,
        updatedAt: new Date().toISOString(),
      },
    });
    // Lighthouse uses Chrome's default context. Its short-lived loopback proxy retains the same destination checks and DNS pinning.
    proxy = await startAuditProxy(policy, false);
    activeProxies.add(proxy);
    directory = await mkdtemp(join(tmpdir(), "audit-lighthouse-"));
    chrome = spawn(
      chromium.executablePath(),
      [
        "--headless=new",
        "--no-first-run",
        "--disable-background-networking",
        "--disable-quic",
        "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
        `--proxy-server=${proxy.server}`,
        "--proxy-bypass-list=<-loopback>",
        "--remote-debugging-address=127.0.0.1",
        "--remote-debugging-port=0",
        `--user-data-dir=${directory}`,
        "about:blank",
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    activeChrome.add(chrome);
    const endpoint = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Lighthouse-Browser startet nicht.")),
        12_000,
      );
      chrome!.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      chrome!.once("exit", () => {
        clearTimeout(timer);
        reject(new Error("Lighthouse-Browser unerwartet beendet."));
      });
      chrome!.stderr?.on("data", (data) => {
        const match = String(data).match(
          /DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/[^\s]+)/,
        );
        if (match) {
          clearTimeout(timer);
          resolve(match[1]!);
        }
      });
    });
    attached = await chromium.connectOverCDP(endpoint);
    activeBrowsers.add(attached);
    onBrowser?.(attached);
    const context = attached.contexts()[0]!;
    await context.routeWebSocket("**/*", (socket) => socket.close());
    await context.route("**/*", async (route) => {
      try {
        const req = route.request();
        const targetUrl = new URL(req.url());
        if (
          !["GET", "HEAD"].includes(req.method()) ||
          !["http:", "https:"].includes(targetUrl.protocol)
        )
          return route.abort();
        if (
          policy.demoOrigin &&
          (targetUrl.origin !== policy.demoOrigin ||
            !/^\/demo-site(?:\/|$)/.test(targetUrl.pathname))
        )
          return route.abort();
        if (
          req.isNavigationRequest() &&
          req.frame() === req.frame().page().mainFrame() &&
          !inScope(targetUrl.href, url)
        )
          return route.abort();
        await route.continue();
      } catch {
        await route.abort().catch(() => undefined);
      }
    });
    const lighthouseModule = await import("lighthouse");
    const lighthouse = lighthouseModule.default;
    for (let index = 0; index < repeats; index++) {
      if (control?.cancelled()) throw new Error("Prüfung abgebrochen.");
      const result = await lighthouse(url, {
        hostname: "127.0.0.1",
        port: Number(new URL(endpoint).port),
        onlyCategories: ["performance"],
        output: "json",
        logLevel: "silent",
        formFactor: device,
        screenEmulation:
          device === "desktop"
            ? {
                mobile: false,
                width: 1440,
                height: 900,
                deviceScaleFactor: 1,
                disabled: false,
              }
            : {
                mobile: true,
                width: 390,
                height: 844,
                deviceScaleFactor: 1,
                disabled: false,
              },
        maxWaitForLoad: 25_000,
      });
      if (!result || result.lhr.runtimeError)
        throw new Error(
          result?.lhr.runtimeError?.message ||
            "Lighthouse lieferte kein Ergebnis.",
        );
      const audits = result.lhr.audits;
      const value = (id: string) =>
        typeof audits[id]?.numericValue === "number"
          ? audits[id]!.numericValue!
          : null;
      samples.push({
        score: Math.round(
          (result.lhr.categories.performance?.score || 0) * 100,
        ),
        metrics: {
          lcp: value("largest-contentful-paint"),
          cls: value("cumulative-layout-shift"),
          tbt: value("total-blocking-time"),
          fcp: value("first-contentful-paint"),
          speedIndex: value("speed-index"),
        },
      });
    }
    const median = (values: number[]) =>
      [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
    const metrics = Object.fromEntries(
      Object.keys(empty).map((key) => {
        const values = samples
          .map((sample) => sample.metrics[key as keyof typeof empty])
          .filter((value): value is number => value !== null);
        return [key, values.length ? median(values) : null];
      }),
    ) as PerformanceSample["metrics"];
    const scores = samples.map((sample) => sample.score);
    return {
      pageUrl: url,
      device,
      score: median(scores),
      runs: samples.length,
      metrics,
      spread: Math.max(...scores) - Math.min(...scores),
    };
  } catch (error) {
    return {
      pageUrl: url,
      device,
      score: null,
      runs: samples.length,
      metrics: empty,
      error:
        error instanceof Error
          ? error.message.split("\n")[0]!.slice(0, 300)
          : "Lighthouse nicht ausgeführt.",
    };
  } finally {
    await attached?.close().catch(() => undefined);
    if (attached) activeBrowsers.delete(attached);
    onBrowser?.(undefined);
    if (chrome) {
      await terminateChrome(chrome);
      activeChrome.delete(chrome);
    }
    await proxy?.close();
    if (proxy) activeProxies.delete(proxy);
    if (directory) await rm(directory, { recursive: true, force: true });
  }
}
