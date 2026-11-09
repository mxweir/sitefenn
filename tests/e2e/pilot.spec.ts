import { test, expect, type Locator, type Page } from "@playwright/test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  correctedSource,
  createPilotFixture,
} from "../../scripts/pilot-fixture.js";

async function keyboardTo(page: Page, target: Locator) {
  await expect(target).toBeVisible();
  for (let index = 0; index < 100; index++) {
    if (await target.evaluate((element) => document.activeElement === element))
      return;
    await page.keyboard.press("Tab");
  }
  await expect(target).toBeFocused();
}

test("2.9 internal rehearsal: evidence, scoped handoff, unchanged retest and verified repair survive reload", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(95000);
  const directory = await mkdtemp(join(tmpdir(), "sitefenn-pilot-"));
  const fixture = await createPilotFixture(directory);
  try {
    await page.goto("/");
    const mutation = async (path: string, data?: object) => {
      const response = await page.request.post(path, {
        headers: { "x-hub-request": "1", origin: baseURL! },
        ...(data === undefined ? {} : { data }),
      });
      expect(response.ok(), await response.text()).toBe(true);
      return response.json();
    };
    const { project } = await mutation("/api/projects", {
      name: "2.9 rehearsal fixture",
      environment: "local",
      url: fixture.url,
      acknowledged: true,
    });
    const { scan } = await mutation(`/api/projects/${project.id}/scans`, {
      pages: [fixture.url],
      viewports: ["mobile"],
      performance: false,
    });
    const scanReady = async (id: string) => {
      await expect
        .poll(
          async () => {
            const data = await (
              await page.request.get(`/api/scans/${id}`)
            ).json();
            const ready = await (
              await page.request.get("/api/bootstrap")
            ).json();
            return (
              data.scan.status === "completed" &&
              ready.readiness.allowed.startExclusive
            );
          },
          { timeout: 30000 },
        )
        .toBe(true);
      return (await (await page.request.get(`/api/scans/${id}`)).json()).scan;
    };
    const original = await scanReady(scan.id);
    const finding = original.result.audit.findings.find(
      (entry: { ruleId: string }) => entry.ruleId === "document-title",
    );
    expect(finding.evidenceStatus).toBe("measured");
    const { tasks } = await (
      await page.request.get(`/api/scans/${scan.id}`)
    ).json();
    const task = tasks.find((entry: { findingIds: string[] }) =>
      entry.findingIds.includes(finding.id),
    );
    const originalPath = `/?project=${project.id}&scan=${scan.id}&task=${task.id}&finding=${finding.id}&view=tasks`;
    await page.goto(originalPath);
    await expect(page.getByRole("main")).toBeFocused();
    await expect(page.getByText(/GEMESSENER BEFUND.*mobile/)).toBeVisible();
    const evidence = page.getByRole("button", {
      name: "Originalnachweis",
      exact: true,
    });
    const handoff = page
      .getByRole("button", { name: "Entwicklerübergabe", exact: true })
      .first();
    await keyboardTo(page, handoff);
    await page.keyboard.press("Enter");
    await keyboardTo(
      page,
      page.getByRole("button", { name: "Arbeitspaket als Vorschau erstellen" }),
    );
    await page.keyboard.press("Enter");
    const preview = page.getByRole("region", { name: "Arbeitspaket Vorschau" });
    await keyboardTo(page, preview);
    await expect(preview).toContainText(finding.id);
    await expect(preview).toContainText("390 × 844 CSS px");
    await expect(preview).toContainText("Reproduzierbarer Abnahmetest");
    const download = page.getByRole("link", { name: "Markdown herunterladen" });
    await keyboardTo(page, download);
    const saved = page.waitForEvent("download");
    await page.keyboard.press("Enter");
    expect((await saved).suggestedFilename()).toBe("sitefenn-work-package.md");
    await keyboardTo(page, page.getByRole("button", { name: "Zum Nachweis" }));
    await page.keyboard.press("Enter");
    await expect(evidence).toBeFocused();

    async function retest() {
      const trigger = page.getByRole("button", {
        name: "Diese Maßnahme nachtesten",
      });
      await keyboardTo(page, trigger);
      const result = page.waitForResponse(
        (response) =>
          response.url().endsWith(`/api/tasks/${task.id}/retest`) &&
          response.request().method() === "POST",
      );
      await page.keyboard.press("Enter");
      const reply = await result;
      expect(reply.status()).toBe(202);
      const { scan } = await reply.json();
      await scanReady(scan.id);
      return scan.id as string;
    }
    await retest();
    const currentTask = async () =>
      (await (await page.request.get(`/api/tasks/${task.id}`)).json()).task;
    expect((await currentTask()).status).not.toBe("verified");
    await writeFile(fixture.path, correctedSource);
    await page.goto(originalPath);
    const confirmed = await retest();
    expect((await currentTask()).verifiedByScanId).toBe(confirmed);
    await page.goto(originalPath);
    await expect(
      page.getByText(`Bestätigt durch Nachtest ${confirmed.slice(0, 8)}`),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByText(`Bestätigt durch Nachtest ${confirmed.slice(0, 8)}`),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Zur Prüfung markieren/ }),
    ).toHaveCount(0);
    const proof = page.getByRole("link", {
      name: `Bestätigt durch Nachtest ${confirmed.slice(0, 8)}`,
    });
    await keyboardTo(page, proof);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`scan=${confirmed}.*view=report`));
    await expect(
      page.getByRole("heading", { name: "Dein Prüfbericht" }),
    ).toBeVisible();
  } finally {
    await fixture.close();
    await rm(directory, { recursive: true, force: true });
  }
});
