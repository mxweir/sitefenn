import { chromium, type Browser } from "playwright";
import { join } from "node:path";
import { assertPublicTarget, parseTarget } from "./security.js";
import type { ScanResult } from "../shared/types.js";

export interface WorkerJob {
  id: string;
  url: string;
  dataDir: string;
  demoOrigin?: string;
}
let activeBrowser: Browser | undefined;

export async function performScan(job: WorkerJob): Promise<ScanResult> {
  const start = Date.now();
  const target = new URL(job.url);
  if (!job.demoOrigin) await assertPublicTarget(parseTarget(job.url));
  else if (target.origin !== job.demoOrigin || target.pathname !== "/demo-site")
    throw new Error("Invalid demo target.");
  const browser = await chromium.launch({ headless: true });
  activeBrowser = browser;
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      locale: "de-DE",
      timezoneId: "Europe/Berlin",
      serviceWorkers: "block",
      acceptDownloads: false,
      permissions: [],
    });
    let requests = 0;
    await context.routeWebSocket("**/*", (socket) => socket.close());
    await context.route("**/*", async (route) => {
      const request = route.request();
      if (++requests > 150 || !["GET", "HEAD"].includes(request.method()))
        return route.abort();
      let url: URL;
      try {
        url = new URL(request.url());
      } catch {
        return route.abort();
      }
      if (job.demoOrigin) {
        if (url.origin === job.demoOrigin && url.pathname === "/demo-site")
          return route.continue();
        return route.abort();
      }
      try {
        parseTarget(url.href);
        await assertPublicTarget(url);
        if (
          request.isNavigationRequest() &&
          request.frame() === page.mainFrame() &&
          url.hostname !== target.hostname
        )
          return route.abort();
        await route.continue();
      } catch {
        await route.abort();
      }
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    page.on("popup", (popup) => void popup.close());
    page.on("dialog", (dialog) => void dialog.dismiss());
    const response = await page.goto(job.url, {
      waitUntil: "domcontentloaded",
      timeout: 25_000,
    });
    if (!response) throw new Error("Die Seite lieferte keine HTTP-Antwort.");
    if (
      response.headers()["content-type"] &&
      !response.headers()["content-type"].includes("text/html")
    )
      throw new Error("Dieses Ziel ist keine HTML-Seite.");
    await page.evaluate(async () => {
      await Promise.race([
        document.fonts.ready,
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]);
      await Promise.race([
        Promise.all(
          [...document.images]
            .slice(0, 50)
            .map((image) => image.decode().catch(() => undefined)),
        ),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]);
    });
    const metadata = await page.evaluate(() => ({
      title: document.title.trim(),
      description:
        document
          .querySelector('meta[name="description" i]')
          ?.getAttribute("content")
          ?.trim() || "",
      h1: document.querySelectorAll("h1").length,
      language: document.documentElement.lang,
    }));
    const screenshotPath = join("evidence", `${job.id}.png`);
    await page.screenshot({
      path: join(job.dataDir, screenshotPath),
      fullPage: false,
      animations: "disabled",
      timeout: 10_000,
    });
    const statusCode = response.status();
    return {
      title: metadata.title || "Ohne Seitentitel",
      url: page.url(),
      statusCode,
      viewport: { width: 1440, height: 900 },
      screenshotPath,
      durationMs: Date.now() - start,
      checks: [
        {
          id: "http-status",
          label: "HTTP-Antwort",
          status: statusCode >= 200 && statusCode < 400 ? "pass" : "fail",
          detail: `HTTP ${statusCode}`,
        },
        {
          id: "document-title",
          label: "Seitentitel",
          status: metadata.title ? "pass" : "fail",
          detail: metadata.title
            ? metadata.title
            : "Kein nicht-leerer Seitentitel gefunden.",
        },
        {
          id: "meta-description",
          label: "Meta Description",
          status: metadata.description ? "pass" : "fail",
          detail: metadata.description
            ? metadata.description.slice(0, 300)
            : "Keine nicht-leere Meta Description gefunden. Das ist kein Beweis für ein Rankingproblem.",
        },
        {
          id: "heading",
          label: "Hauptüberschrift",
          status: metadata.h1 ? "pass" : "fail",
          detail: `${metadata.h1} H1-Element(e) im DOM. Sichtbarkeit und inhaltliche Qualität sind noch nicht bewertet.`,
        },
        {
          id: "scope",
          label: "Prüfumfang 0.1",
          status: "info",
          detail:
            "Eine Seite · Desktop 1440 × 900 · Screenshot und Basis-Metadaten. Kein vollständiges SEO-/UX-Audit, kein Score.",
        },
      ],
    };
  } finally {
    await browser.close();
    activeBrowser = undefined;
  }
}

if (process.send) {
  process.once("SIGTERM", () => {
    void (activeBrowser?.close() || Promise.resolve()).finally(() =>
      process.exit(0),
    );
  });
  process.once("disconnect", () => {
    void (activeBrowser?.close() || Promise.resolve()).finally(() =>
      process.exit(0),
    );
  });
  process.once("message", async (job: WorkerJob) => {
    try {
      const result = await performScan(job);
      process.send?.({ result }, () => process.exit(0));
    } catch (error) {
      process.send?.(
        {
          error:
            error instanceof Error ? error.message : "Prüfung fehlgeschlagen.",
        },
        () => process.exit(1),
      );
    }
  });
}
