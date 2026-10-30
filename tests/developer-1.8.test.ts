import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createServer } from "node:http";
import {
  sourcePreview,
  handoffMarkdown,
  selectedFindings,
} from "../server/services/developer-handoff.js";
import { releaseGate } from "../server/services/release-gate.js";
import { normalizeScanOptions } from "../server/options.js";
import type { Finding, AuditReport, Scan } from "../shared/types.js";
const exec = promisify(execFile);
test("source preview is read-only, excludes ignored/sensitive/symlink files, labels literal matches and scopes handoff", async () => {
  const dir = await mkdtemp(join(tmpdir(), "sitefenn-source-")),
    outside = await mkdtemp(join(tmpdir(), "sitefenn-outside-"));
  try {
    await exec("git", ["init", "--quiet", dir]);
    await writeFile(join(dir, ".gitignore"), "ignored.html\n");
    await writeFile(join(dir, "ignored.html"), '<div id="menu">IGNORED</div>');
    await exec("git", ["-C", dir, "add", "-f", "ignored.html"]);
    await writeFile(
      join(dir, "secrets.html"),
      '<div id="menu">SECRET-FILE</div>',
    );
    await writeFile(join(dir, ".env.html"), '<div id="menu">ENV</div>');
    await writeFile(join(outside, "leak.html"), '<div id="menu">OUTSIDE</div>');
    await symlink(outside, join(dir, "linked"), "dir");
    await writeFile(
      join(dir, "App.tsx"),
      '<main>\n  <nav id="menu">Owned literal</nav>\n  <div data-id="menu">Not id</div>\n</main>',
    );
    const f = {
      id: "a",
      selector: "#menu",
      title: "Overflow",
      ruleId: "horizontal-overflow",
      pageUrl: "https://example.org/?secret=PRIVATE",
      viewportId: "mobile",
      state: "initial",
      evidenceStatus: "measured",
      detail: "Owned observation",
      recommendation: "Adjust width",
      acceptance: "Retest width",
    } as Finding;
    const preview = await sourcePreview(dir, [f]);
    assert.equal(preview.candidates.length, 1);
    assert.equal(preview.candidates[0]?.path, "App.tsx");
    assert.equal(preview.candidates[0]?.line, 2);
    assert.equal(preview.candidates[0]?.status, "literal-candidate");
    assert.ok(!JSON.stringify(preview).includes("OUTSIDE"));
    assert.ok(!JSON.stringify(preview).includes("SECRET-FILE"));
    const report = {
      findings: [f],
      ruleVersion: "test",
      profileVersion: "test",
    } as AuditReport;
    assert.throws(() => selectedFindings(report, ["foreign"]));
    const plain = handoffMarkdown(report, [f]);
    assert.ok(plain.includes("Keine Datei- oder Zeilenbehauptung"));
    assert.ok(!plain.includes("PRIVATE"));
    assert.ok(!plain.includes("App.tsx"));
    const withSource = handoffMarkdown(report, [f], preview.candidates);
    assert.ok(withSource.includes("App.tsx:2"));
    assert.ok(withSource.includes("Unbestätigter literaler"));
    assert.equal(
      await readFile(join(dir, "App.tsx"), "utf8"),
      '<main>\n  <nav id="menu">Owned literal</nav>\n  <div data-id="menu">Not id</div>\n</main>',
    );
    await writeFile(join(dir, "App.tsx"), '<nav id="menu">Changed</nav>');
    assert.notEqual(
      (await sourcePreview(dir, [f])).candidates[0]?.sha256,
      preview.candidates[0]?.sha256,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});
test(
  "actual CLI establishes baseline, detects regression, passes fix and returns distinct unknown on browser failure",
  { timeout: 60000 },
  async () => {
    let broken = false;
    const fixture = createServer((_req, res) => {
      res.setHeader("content-type", "text/html");
      res.end(
        `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="Owned CLI fixture"><title>Owned CLI fixture</title><style>body{margin:0}#menu{width:${broken ? 680 : 300}px}</style></head><body><main><h1>Owned fixture</h1><nav id="menu">One readable navigation</nav></main></body></html>`,
      );
    });
    await new Promise<void>((r) => fixture.listen(0, "127.0.0.1", r));
    const address = fixture.address();
    assert.ok(address && typeof address !== "string");
    const url = `http://127.0.0.1:${address.port}/`,
      dir = await mkdtemp(join(tmpdir(), "sitefenn-cli-"));
    let closed = false;
    const profile = {
      version: "sitefenn-profile-1",
      projectId: "owned-cli",
      url,
      environment: "local",
      options: normalizeScanOptions(
        { pages: [url], viewports: ["mobile"], performance: false },
        url,
      ),
      gate: { minimumPriority: "important", categories: ["layout"] },
    };
    await writeFile(join(dir, "profile.json"), JSON.stringify(profile));
    const run = async (name: string, baseline?: string) => {
      try {
        const r = await exec(
          process.execPath,
          [
            "--import",
            "tsx",
            "scripts/check-site.ts",
            "--profile",
            join(dir, "profile.json"),
            "--out",
            join(dir, name),
            "--authorized",
            ...(baseline
              ? ["--baseline", join(dir, baseline, "report.json")]
              : []),
          ],
          { timeout: 20000, maxBuffer: 20000 },
        );
        return { code: 0, stdout: r.stdout };
      } catch (error) {
        const e = error as { code: number; stdout: string };
        return { code: e.code, stdout: e.stdout };
      }
    };
    try {
      assert.equal((await run("baseline")).code, 2);
      const unchanged = await run("unchanged", "baseline");
      assert.equal(unchanged.code, 0, unchanged.stdout);
      broken = true;
      assert.equal((await run("regression", "baseline")).code, 1);
      const regression = JSON.parse(
        await readFile(join(dir, "regression/gate.json"), "utf8"),
      );
      assert.equal(regression.status, "regression");
      assert.ok(
        regression.blockers.some(
          (f: Finding) => f.ruleId === "horizontal-overflow",
        ),
      );
      broken = false;
      assert.equal((await run("fixed", "baseline")).code, 0);
      const baseline = JSON.parse(
        await readFile(join(dir, "baseline/report.json"), "utf8"),
      ) as Scan;
      const incomplete = structuredClone(baseline);
      incomplete.id = "incomplete";
      incomplete.result!.audit!.rules.push({
        ...incomplete.result!.audit!.rules[0]!,
        status: "not_run",
        category: "layout",
      });
      assert.equal(
        releaseGate(incomplete, baseline, profile.gate as never).status,
        "inconclusive",
      );
      await new Promise<void>((r) => fixture.close(() => r()));
      closed = true;
      const unreachable = await run("unreachable", "baseline");
      assert.equal(unreachable.code, 2, unreachable.stdout);
    } finally {
      if (!closed) await new Promise<void>((r) => fixture.close(() => r()));
      await rm(dir, { recursive: true, force: true });
    }
  },
);
