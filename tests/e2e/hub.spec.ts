import { test, expect } from "@playwright/test";
import { unzipSync } from "fflate";

test("real responsive demo produces evidence, a report and persisted history", async ({
  page,
}) => {
  test.setTimeout(110_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page).toHaveTitle(/SiteFenn/);
  await expect(page.getByRole("heading", { name: /DEINE SITE/ })).toBeVisible();
  await page
    .getByRole("button", { name: "Demo ausprobieren", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Zum vollständigen Bericht",
      exact: true,
    }),
  ).toBeVisible({ timeout: 70_000 });
  await expect(
    page.getByRole("heading", { name: "Gespeicherte Nachweise", exact: true }),
  ).toBeVisible();
  const savedImage = page
    .getByAltText(/Gespeicherter Desktop-Screenshot/)
    .first();
  await expect(savedImage).toBeVisible();
  await expect
    .poll(() =>
      savedImage.evaluate((img) => (img as HTMLImageElement).naturalWidth),
    )
    .toBe(1440);
  const captures = page.locator(".capture-button");
  await expect.poll(() => captures.count()).toBeGreaterThanOrEqual(9);
  await expect(captures.filter({ hasText: "mobile" }).first()).toBeVisible();
  await expect(captures.filter({ hasText: "tablet" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Befunde", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Dein Prüfbericht", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Basisbefunde", exact: true }),
  ).toBeVisible();
  const description = page
    .locator(".issue-card")
    .filter({
      has: page.getByRole("heading", {
        name: "Meta Description fehlt",
        exact: true,
      }),
    })
    .first();
  await expect(description).toContainText("Dies belegt keinen Rankingverlust.");
  await description.getByRole("button", { name: /Details öffnen/ }).click();
  const evidence = description.getByAltText(/Gespeicherter Desktop-Screenshot/);
  await expect(evidence).toBeVisible();
  await expect
    .poll(() =>
      evidence.evaluate((img) => (img as HTMLImageElement).naturalWidth),
    )
    .toBe(1440);
  await expect(
    page.getByRole("progressbar", { name: "Prüfabdeckung" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Bericht exportieren", exact: true })
    .click();
  const exportDialog = page.getByRole("dialog");
  await expect(
    exportDialog.getByLabel("Markdown Exportvorschau"),
  ).toContainText("Meta Description");
  await expect(
    exportDialog.getByRole("link", { name: "ZIP-Bericht", exact: true }),
  ).toHaveAttribute("href", /format=zip$/);
  const plainExportUrl = await exportDialog
    .getByRole("link", { name: "ZIP-Bericht", exact: true })
    .getAttribute("href");
  const plainArchive = await page.request.get(plainExportUrl!);
  expect(plainArchive.ok()).toBe(true);
  const plainFiles = unzipSync(new Uint8Array(await plainArchive.body()));
  expect(Object.keys(plainFiles).sort()).toEqual(["REPORT.md", "report.json"]);
  await expect(
    exportDialog.getByLabel("Screenshots ins ZIP aufnehmen"),
  ).not.toBeChecked();
  await exportDialog.getByLabel("Screenshots ins ZIP aufnehmen").check();
  await expect(
    exportDialog.getByRole("link", { name: "ZIP mit Belegen", exact: true }),
  ).toHaveAttribute("href", /includeEvidence=true$/);
  const imageExportUrl = await exportDialog
    .getByRole("link", { name: "ZIP mit Belegen", exact: true })
    .getAttribute("href");
  const imageArchive = await page.request.get(imageExportUrl!);
  expect(imageArchive.ok()).toBe(true);
  const imageFiles = unzipSync(new Uint8Array(await imageArchive.body()));
  expect(
    Object.keys(imageFiles).some(
      (name) => name.startsWith("evidence/") && name.endsWith(".png"),
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await page.reload();
  await page.getByRole("button", { name: "Befunde", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Basisbefunde", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("heading", { name: "Meta Description fehlt", exact: true })
      .first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "System & Setup", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Prüf-Browser", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Chromium installiert", { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("Fenn asset is served locally and collapsed guidance is explicitly non-AI", async ({
  page,
}) => {
  await page.goto("/");
  const asset = await page.request.get("/brand/fenn-flat-v2.png");
  expect(asset.ok()).toBe(true);
  expect(asset.headers()["content-type"]).toContain("image/png");
  expect((await asset.body()).length).toBeGreaterThan(1000);
  await expect(
    page.getByRole("button", { name: "Fenns Hinweis anzeigen" }),
  ).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "Fenns Hinweis anzeigen" }).click();
  const guide = page.getByRole("region", { name: "Hinweis von Fenn" });
  await expect(guide).toContainText("STATISCHER TIPP · KEINE KI");
  await expect(
    guide.getByRole("button", { name: "Lokal erklären lassen" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Fenns Hinweis einklappen" }).click();
  await expect(guide).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Fenns Hinweis anzeigen" }),
  ).toHaveAttribute("aria-expanded", "false");
});

test("public project dialog enforces consent and restores focus after blocked target", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Website hinzufügen", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await expect(page.getByLabel("Projektname", { exact: true })).toBeFocused();
  await page.getByLabel("Projektname", { exact: true }).fill("Internal test");
  await page
    .getByLabel("Website-URL", { exact: true })
    .fill("http://127.0.0.1");
  await expect(
    dialog.getByRole("button", { name: "Projekt erstellen" }),
  ).toBeDisabled();
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Projekt erstellen" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "gesperrte/private Netzwerkadresse",
  );
  await expect(page.getByLabel("Projektname", { exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("mobile workspace and project tabs stay within the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /DEINE SITE/ })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Befunde", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Basisbefunde", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "System & Setup", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /Ein gesundes Setup/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
