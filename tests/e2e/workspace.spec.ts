import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import type {
  AuditReport,
  AuditTask,
  Finding,
  Project,
  PageAnalysis,
  Scan,
  ScoreSummary,
  SearchDataset,
} from "../../shared/types.js";

const project: Project = {
  id: "project-ui",
  name: "Portfolio Test",
  url: "https://example.com/",
  environment: "production",
  createdAt: "2026-10-28T10:00:00Z",
};
const finding: Finding = {
  id: "finding-ui",
  fingerprint: "title-mobile",
  ruleId: "seo-title-v1",
  category: "seo",
  priority: "important",
  title: "Seitentitel fehlt",
  detail: "Die geprüfte Seite enthält kein title-Element.",
  pageUrl: project.url,
  viewportId: "mobile",
  state: "initial",
  evidenceStatus: "measured",
  recommendation: "Einen eindeutigen Seitentitel ergänzen.",
  acceptance: "Im erneuten Check ist ein eindeutiger title vorhanden.",
};
const score: ScoreSummary = {
  version: "audit-score-v1",
  lower: 68,
  upper: 83,
  coverage: 85,
  final: false,
  categories: [
    {
      category: "seo",
      weight: 25,
      lower: 70,
      upper: 70,
      coverage: 100,
      passedWeight: 7,
      failedWeight: 3,
      unknownWeight: 0,
      applicableWeight: 10,
    },
  ],
  criticalCount: 0,
  warnings: ["Performance wurde nicht geprüft."],
};
const report: AuditReport = {
  schemaVersion: 1,
  ruleVersion: "rules-v1",
  profileVersion: "profile-v1",
  browserVersion: "Chromium fixture",
  options: {
    pages: [project.url],
    maxPages: 10,
    maxDepth: 2,
    excludedPaths: [],
    viewports: [{ id: "mobile", width: 390, height: 844 }],
    performance: false,
    performanceRuns: 1,
  },
  pages: [],
  rules: [],
  findings: [finding],
  evidence: [],
  discoveredUrls: [project.url],
  coverage: { planned: 1, completed: 1, skipped: [] },
  startedAt: "2026-10-28T10:00:00Z",
  finishedAt: "2026-10-28T10:01:00Z",
  durationMs: 1000,
  performance: [],
  warnings: ["Begrenzter Testumfang."],
};
const scan: Scan = {
  id: "scan-ui",
  projectId: project.id,
  status: "completed",
  createdAt: "2026-10-28T10:00:00Z",
  finishedAt: "2026-10-28T10:01:00Z",
  error: null,
  options: report.options,
  result: {
    title: "Portfolio",
    url: project.url,
    statusCode: 200,
    viewport: { width: 390, height: 844 },
    screenshotPath: "not-used",
    checks: [],
    durationMs: 1000,
    audit: report,
  },
};
const task: AuditTask = {
  id: "task-ui",
  scanId: scan.id,
  projectId: project.id,
  title: "Seitentitel ergänzen",
  category: "seo",
  priority: "important",
  status: "open",
  findingIds: [finding.id],
  summary: finding.detail,
  recommendation: finding.recommendation,
  acceptance: finding.acceptance,
  updatedAt: scan.createdAt,
};

const analysis: PageAnalysis = {
  kind: "page-analysis",
  id: "analysis-ui",
  scanId: scan.id,
  pageUrl: project.url,
  model: "local-test:8b",
  question: "",
  sourceHash: "a".repeat(64),
  createdAt: scan.createdAt,
  updatedAt: scan.createdAt,
  status: "completed",
  stage: "done",
  parts: [
    {
      id: "part-1",
      unitIds: ["finding-ui"],
      findingIds: [finding.id],
      status: "completed",
      summary: "Der Seitentitel ist ein belegter nächster Schritt.",
      solutions: [
        {
          findingId: finding.id,
          explanation: finding.detail,
          cause: "Vermutlich fehlt die Titelkonfiguration.",
          steps: [
            "Einen passenden Titel ergänzen.",
            "Dieselbe Seite nachtesten.",
          ],
          code: { language: "html", text: "<title>Portfolio</title>" },
          acceptance: finding.acceptance,
          uncertainty: "Kein Quellcode angebunden.",
        },
      ],
    },
  ],
  totalUnits: 1,
  omitted: [],
  unexplainedFindingIds: [],
  summary: "Der Seitentitel ist ein belegter nächster Schritt.",
  warnings: [],
};

async function mockWorkspace(page: Page, initialScans: Scan[] = [scan]) {
  const state = {
    scans: structuredClone(initialScans),
    tasks: initialScans.length ? [structuredClone(task)] : [],
    options: null as unknown,
    settings: { model: "", speechEnabled: false },
    datasets: [] as SearchDataset[],
    analyses: [] as PageAnalysis[],
    analysisRequest: null as unknown,
  };
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, json: body });
    if (pathname === "/api/bootstrap")
      return json({
        version: "1.0.0",
        projects: [project],
        scans: state.scans.map((item) => ({
          ...item,
          result: item.result ? { ...item.result, audit: undefined } : null,
        })),
        tasks: state.tasks,
        scores: Object.fromEntries(state.scans.map((s) => [s.id, score])),
        dependencies: [
          {
            id: "chromium",
            label: "Prüf-Browser",
            status: "ready",
            detail: "Chromium installiert",
          },
        ],
        settings: state.settings,
        speechAvailable: false,
      });
    if (/^\/api\/scans\/[^/]+$/.test(pathname))
      return json({
        scan: state.scans.find((s) => s.id === pathname.split("/").pop()),
        score,
        tasks: state.tasks,
      });
    if (pathname === `/api/scans/${scan.id}/page-analyses`) {
      if (request.method() === "GET") return json({ analyses: state.analyses });
      state.analysisRequest = request.postDataJSON();
      state.analyses = [structuredClone(analysis)];
      return json({ analysis: state.analyses[0] }, 202);
    }
    if (pathname === "/api/page-analyses/analysis-ui")
      return json({ analysis: state.analyses[0] });
    if (pathname === "/api/page-analyses/analysis-ui/cancel") {
      state.analyses[0].status = "cancelled";
      state.analyses[0].stage = "done";
      state.analyses[0].parts[0].status = "cancelled";
      return json({ cancelled: true });
    }
    if (pathname === "/api/page-analyses/analysis-ui/adopt") {
      state.tasks[0].aiProposal = {
        ...analysis.parts[0].solutions[0],
        analysisId: analysis.id,
      };
      return json({ task: state.tasks[0], duplicate: false });
    }
    if (pathname.endsWith("/discover"))
      return json({
        urls: [project.url, "https://example.com/contact"],
        warnings: ["Entdeckung ist begrenzt."],
        excluded: [],
      });
    if (
      pathname === `/api/projects/${project.id}/scans` &&
      request.method() === "POST"
    ) {
      state.options = request.postDataJSON();
      const next = {
        ...structuredClone(scan),
        id: "scan-new",
        status: "completed" as const,
        createdAt: "2026-10-28T11:00:00Z",
      };
      state.scans.unshift(next);
      return json({ scan: next });
    }
    if (pathname === `/api/tasks/${task.id}`) {
      const body = request.postDataJSON();
      state.tasks[0].status = body.status;
      return json({ task: state.tasks[0] });
    }
    if (pathname.endsWith("/export"))
      return route.fulfill({
        contentType: "text/markdown",
        body: "# Maßnahmenplan\n\n- [ ] Seitentitel ergänzen\n  - Beleg: finding-ui\n  - Abnahme: title vorhanden.",
      });
    if (pathname === "/api/compare")
      return json({
        beforeId: "scan-old",
        afterId: scan.id,
        comparable: false,
        reason: "Die Seitenmengen unterscheiden sich.",
        scoreDelta: null,
        beforeScore: score,
        afterScore: score,
        entries: [
          {
            fingerprint: "title-mobile",
            title: finding.title,
            state: "not-retested",
          },
        ],
      });
    if (pathname === "/api/models")
      return json({ available: true, models: ["local-test:8b"] });
    if (pathname === "/api/settings") {
      state.settings = request.postDataJSON();
      return json({ settings: state.settings });
    }
    if (pathname === `/api/projects/${project.id}/search`) {
      if (request.method() === "GET") return json({ datasets: state.datasets });
      const body = request.postDataJSON();
      const dataset: SearchDataset = {
        id: "search-ui",
        projectId: project.id,
        metadata: body.metadata,
        importedAt: scan.createdAt,
        rows: [
          {
            key: "portfolio",
            clicks: 4,
            impressions: 100,
            ctr: 0.04,
            position: 8,
          },
        ],
        summary: {
          clicks: 4,
          impressions: 100,
          ctr: 0.04,
          position: 8,
          label: "Importierte durchschnittliche Position",
        },
        warnings: ["Nur importierte Zeilen."],
      };
      state.datasets.unshift(dataset);
      return json({ dataset });
    }
    if (pathname.endsWith("/ai"))
      return json({
        plan: {
          model: "local-test:8b",
          createdAt: scan.createdAt,
          summary: "Der Seitentitel ist ein belegter nächster Schritt.",
          recommendations: [
            {
              findingId: finding.id,
              explanation: finding.detail,
              action: finding.recommendation,
              acceptance: finding.acceptance,
              uncertainty: "Kein Quellcode angebunden.",
            },
          ],
          warnings: [],
        },
      });
    if (pathname === "/api/projects")
      return json(
        { error: "Ungültiges Ziel: gesperrte/private Netzwerkadresse." },
        400,
      );
    return json({ error: `Nicht erwarteter Testaufruf ${pathname}` }, 404);
  });
  return state;
}

test("workspace config discovers pages and sends selected responsive profiles", async ({
  page,
}) => {
  const state = await mockWorkspace(page, []);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "DEINE SITE. KLARER BLICK." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Seiten entdecken", exact: true })
    .click();
  await expect(
    page.getByText("https://example.com/contact", { exact: true }),
  ).toBeVisible();
  await page.getByRole("checkbox", { name: /Tablet/ }).uncheck();
  await page
    .getByRole("button", { name: "On-Screen-Check starten", exact: true })
    .click();
  await expect
    .poll(() => state.options)
    .toMatchObject({
      pages: [project.url, "https://example.com/contact"],
      viewports: [{ id: "desktop" }, { id: "mobile" }],
      performance: false,
    });
  await expect(
    page.getByRole("heading", { name: "Gespeicherte Nachweise" }),
  ).toBeVisible();
  await expect(
    page.getByText(/Gespeicherte Aufnahme, kein Live-Bild/),
  ).toBeVisible();
});

test("report evidence, task review and export preview stay distinct from verified fixes", async ({
  page,
}) => {
  const state = await mockWorkspace(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Befunde", exact: true }).click();
  await expect(page.locator(".score-number").first()).toContainText("68–83");
  await expect(
    page.getByRole("progressbar", { name: "Prüfabdeckung" }),
  ).toHaveAttribute("aria-valuenow", "85");
  await page
    .getByRole("button", { name: /Details öffnen: Seitentitel fehlt/ })
    .click();
  await expect(
    page.getByText(finding.acceptance, { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: "test-results/workspace-report-qa.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Bericht exportieren" }).click();
  await expect(page.getByRole("dialog")).toContainText("Maßnahmenplan");
  await expect(page.getByLabel("Markdown Exportvorschau")).toContainText(
    "finding-ui",
  );
  await expect(page.getByRole("link", { name: "ZIP-Bericht" })).toHaveAttribute(
    "href",
    `/api/scans/${scan.id}/export?format=zip`,
  );
  await page.getByLabel("Screenshots ins ZIP aufnehmen").check();
  await expect(
    page.getByRole("link", { name: "ZIP mit Belegen" }),
  ).toHaveAttribute(
    "href",
    `/api/scans/${scan.id}/export?format=zip&includeEvidence=true`,
  );
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Maßnahmenplan", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Zur Prüfung markieren: Seitentitel ergänzen",
    })
    .click();
  await expect.poll(() => state.tasks[0].status).toBe("review");
  await expect(page.getByLabel("STATUS", { exact: true })).toHaveValue(
    "review",
  );
  await expect(
    page
      .getByLabel("STATUS", { exact: true })
      .locator('option[value="verified"]'),
  ).toHaveCount(0);
});

test("incompatible scans do not invent a score improvement", async ({
  page,
}) => {
  await mockWorkspace(page, [
    scan,
    { ...scan, id: "scan-old", createdAt: "2026-10-20T10:00:00Z" },
  ]);
  await page.goto("/");
  await page.getByRole("button", { name: "Vergleich", exact: true }).click();
  await page
    .getByRole("button", { name: "Tests vergleichen", exact: true })
    .click();
  await expect(page.getByText("Nur eingeschränkt vergleichbar")).toBeVisible();
  await expect(
    page.getByText("Kein belastbares Score-Delta verfügbar."),
  ).toBeVisible();
  await expect(
    page.getByText("Nicht erneut geprüft", { exact: true }),
  ).toBeVisible();
});

test("optional CSV visibility and explicit local model selection work without cloud auth", async ({
  page,
}) => {
  const state = await mockWorkspace(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Sichtbarkeit", exact: true }).click();
  await page.getByLabel("CSV-Datei", { exact: true }).setInputFiles({
    name: "queries.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Query,Clicks,Impressions,CTR,Position\nportfolio,4,100,4%,8",
    ),
  });
  await page.getByLabel("Zeitraum von").fill("2026-10-01");
  await page.getByLabel("Zeitraum bis").fill("2026-10-28");
  await page
    .getByRole("button", { name: "CSV importieren", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "portfolio", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Search-Console-Daten wurden lokal importiert."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "System & Setup", exact: true })
    .click();
  await page.getByLabel("Installiertes Modell").selectOption("local-test:8b");
  await page.getByRole("button", { name: "Einstellungen speichern" }).click();
  await expect(page.getByText("Einstellungen gespeichert.")).toBeVisible();
  await page.getByRole("button", { name: "Fenn öffnen", exact: true }).click();
  await expect(page.getByLabel("Seite auswählen")).toHaveValue(project.url);
  await expect(
    page.getByText(/KI-Vorschläge sind ungeprüft und können/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Seite lokal analysieren" }).click();
  await expect(
    page.getByText("Der Seitentitel ist ein belegter nächster Schritt.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".solution-code")).toContainText(
    "<title>Portfolio</title>",
  );
  await expect(page.getByRole("link", { name: /Markdown/ })).toHaveAttribute(
    "href",
    "/api/page-analyses/analysis-ui/export",
  );
  await page.getByRole("button", { name: /Maßnahme übernehmen/ }).click();
  await expect
    .poll(() => state.tasks[0].aiProposal?.analysisId)
    .toBe(analysis.id);
  expect(state.tasks).toHaveLength(1);
  expect(state.tasks[0].status).toBe("open");
  await page
    .getByLabel("Frage zum Seitenbericht (optional)")
    .fill("Welcher Nachtest ist nötig?");
  await page.getByRole("button", { name: "Frage lokal auswerten" }).click();
  await expect
    .poll(() => state.analysisRequest)
    .toMatchObject({
      parentId: analysis.id,
      pageUrl: project.url,
      question: "Welcher Nachtest ist nötig?",
    });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("mobile workspace and failed project dialog retain keyboard access", async ({
  page,
}) => {
  await mockWorkspace(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Website hinzufügen", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(page.getByLabel("Projektname", { exact: true })).toBeFocused();
  await page.getByLabel("Projektname", { exact: true }).fill("Private Website");
  await page
    .getByLabel("Website-URL", { exact: true })
    .fill("http://127.0.0.1");
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Projekt erstellen" }).click();
  await expect(dialog.getByRole("alert")).toContainText("gesperrte/private");
  await expect(page.getByLabel("Projektname", { exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "System & Setup" }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/workspace-mobile-qa.png",
    fullPage: true,
  });
});

test("partial and cancelled model work stays visible without successful repair actions", async ({
  page,
}) => {
  const state = await mockWorkspace(page);
  const incomplete = structuredClone(analysis);
  incomplete.status = "partial";
  incomplete.summary = "";
  incomplete.parts[0].status = "failed";
  incomplete.parts[0].error = "Ungültige Modellantwort: erfundene Fundstelle.";
  incomplete.parts[0].solutions = [];
  incomplete.unexplainedFindingIds = [finding.id];
  state.analyses = [incomplete];
  await page.goto("/");
  await page
    .getByRole("button", { name: "Seite erklären", exact: true })
    .click();
  await expect(
    page.getByText("Diese Interpretation ist unvollständig", { exact: true }),
  ).toBeVisible();
  await page
    .getByText("Verarbeitete Teile und Identität", { exact: true })
    .click();
  await expect(
    page.getByText(incomplete.parts[0].error, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Als Maßnahme übernehmen/ }),
  ).toHaveCount(0);
  incomplete.status = "running";
  incomplete.stage = "context";
  incomplete.parts[0].status = "running";
  await page.reload();
  await page
    .getByRole("button", { name: "Seite erklären", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Auswertung abbrechen", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Abgebrochen", exact: true }),
  ).toBeVisible();
  expect(state.tasks[0].status).toBe("open");
});
