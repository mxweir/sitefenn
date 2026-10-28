import { test, expect } from "@playwright/test";

test("demo executes a real browser scan, shows metadata and screenshot, and survives reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page).toHaveTitle(/SiteFenn/);
  await expect(page.getByRole("heading", { name: /DEINE SITE/ })).toBeVisible();
  await page.getByRole("button", { name: "Demo ausprobieren" }).click();
  await expect(page.getByText("Basisbefunde", { exact: true })).toBeVisible({
    timeout: 65_000,
  });
  await expect(
    page.getByText("Keine nicht-leere Meta Description gefunden.", {
      exact: false,
    }),
  ).toBeVisible();
  const image = page.getByAltText(/Gespeicherter Desktop-Screenshot/);
  await expect(image).toBeVisible();
  await expect
    .poll(() => image.evaluate((img) => (img as HTMLImageElement).naturalWidth))
    .toBe(1440);
  await page.reload();
  await expect(page.getByText("Basisbefunde", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "System & Setup" }).click();
  await expect(
    page.getByRole("heading", { name: "Prüf-Browser" }),
  ).toBeVisible();
  await expect(
    page.getByText("Chromium installiert", { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("Fenn is a loaded local asset and its static guidance can be collapsed", async ({
  page,
}) => {
  await page.goto("/");
  const mascot = page.getByAltText(
    "Fenn, der aufmerksame Wüstenfuchs von SiteFenn",
  );
  await expect(mascot).toBeVisible();
  await expect
    .poll(() =>
      mascot.evaluate((img) => (img as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  const guide = page.getByRole("region", { name: "Hinweis von Fenn" });
  await expect(guide).toContainText("STATISCHER TIPP · KEINE KI");
  await page.getByRole("button", { name: "Fenns Hinweis einklappen" }).click();
  await expect(
    page.getByRole("button", { name: "Fenns Hinweis anzeigen" }),
  ).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "Fenns Hinweis anzeigen" }).click();
  await expect(
    page.getByRole("button", { name: "Fenns Hinweis einklappen" }),
  ).toHaveAttribute("aria-expanded", "true");
});

test("project dialog enforces consent and explains blocked private target", async ({
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
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("mobile workspace fits viewport and setup remains reachable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /DEINE SITE/ })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "System & Setup" }).click();
  await expect(
    page.getByRole("heading", { name: /Ein gesundes Setup/ }),
  ).toBeVisible();
});
