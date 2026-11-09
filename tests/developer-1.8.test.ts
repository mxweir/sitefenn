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
  { timeout: 120000 },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), "sitefenn-cli-"));
    const source = join(dir, "source");
    await mkdir(source);
    const git = async (...args: string[]) =>
      (await exec("git", ["-C", source, ...args])).stdout.trim();
    await git("init", "-q");
    const pagePath = join(source, "index.html");
    const commit = async (width: number, label: string) => {
      await writeFile(
        pagePath,
        `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="Owned CLI fixture"><title>Owned CLI fixture</title><style>body{margin:0}#menu{width:${width}px}</style></head><body><main><h1>Owned fixture</h1><nav id="menu">One readable navigation</nav></main></body></html>`,
      );
      await git("add", "index.html");
      await git(
        "-c",
        "user.name=SiteFenn fixture",
        "-c",
        "user.email=fixture@example.invalid",
        "commit",
        "-qm",
        label,
      );
      return git("rev-parse", "HEAD");
    };
    await commit(300, "Reviewed base");
    const fixture = createServer(async (_req, res) => {
      res.setHeader("content-type", "text/html");
      res.end(await readFile(pagePath));
    });
    await new Promise<void>((r) => fixture.listen(0, "127.0.0.1", r));
    const address = fixture.address();
    assert.ok(address && typeof address !== "string");
    const url = `http://127.0.0.1:${address.port}/`;
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
    const runCli = async (args: string[]) => {
      try {
        const r = await exec(
          process.execPath,
          [
            "--import",
            "tsx",
            "scripts/check-site.ts",
            ...args,
            "--profile",
            join(dir, "profile.json"),
          ],
          { timeout: 20000, maxBuffer: 20000 },
        );
        return { code: 0, stdout: r.stdout };
      } catch (error) {
        const e = error as { code: number; stdout: string; stderr: string };
        return { code: e.code, stdout: e.stdout, stderr: e.stderr };
      }
    };
    const old = join(dir, "approved.json");
    const run = (name: string, baseline?: string) =>
      runCli([
        "--out",
        join(dir, name),
        "--authorized",
        "--source-repo",
        source,
        ...(baseline ? ["--baseline", baseline] : []),
      ]);
    const review = (name: string, baseline?: string) => [
      "--candidate",
      join(dir, name, "report.json"),
      ...(baseline ? ["--baseline", baseline] : []),
    ];
    const adopt = (
      name: string,
      digest: string,
      destination: string,
      baseline?: string,
    ) =>
      runCli([
        "baseline-adopt",
        ...review(name, baseline),
        "--name",
        "Mobile preview",
        "--confirm",
        digest,
        "--out",
        destination,
      ]);
    try {
      assert.equal((await run("baseline")).code, 2);
      const first = await runCli(["baseline-review", ...review("baseline")]);
      assert.equal(first.code, 0, first.stderr);
      const digest = JSON.parse(first.stdout).sha256;
      assert.equal((await adopt("baseline", "0".repeat(64), old)).code, 2);
      assert.equal((await adopt("baseline", digest, old)).code, 0);
      const unchanged = await run("unchanged", old);
      assert.equal(unchanged.code, 0, unchanged.stdout);
      const regressionRevision = await commit(680, "Introduce regression");
      assert.equal((await run("regression", old)).code, 1);
      const regression = JSON.parse(
        await readFile(join(dir, "regression/gate.json"), "utf8"),
      );
      assert.equal(regression.status, "regression");
      assert.ok(
        regression.blockers.some(
          (f: Finding) => f.ruleId === "horizontal-overflow",
        ),
      );
      assert.equal(regression.sourceCheckout.revision, regressionRevision);
      const summary = await readFile(
        join(dir, "regression/summary.md"),
        "utf8",
      );
      assert.match(summary, /regression/);
      assert.doesNotMatch(summary, /127\.0\.0\.1|Owned CLI fixture/);
      assert.equal(
        (await runCli(["baseline-review", ...review("regression", old)])).code,
        2,
      );
      const brokenCandidate = await runCli([
        "baseline-review",
        ...review("regression"),
      ]);
      const brokenBaseline = join(dir, "existing-debt.json");
      assert.equal(
        (
          await adopt(
            "regression",
            JSON.parse(brokenCandidate.stdout).sha256,
            brokenBaseline,
          )
        ).code,
        0,
      );
      assert.equal((await run("existing", brokenBaseline)).code, 0);
      assert.ok(
        JSON.parse(await readFile(join(dir, "existing/gate.json"), "utf8"))
          .existing.length,
      );
      await commit(300, "Fix regression");
      assert.equal((await run("fixed", old)).code, 0);
      const replacement = await runCli([
        "baseline-review",
        ...review("fixed", old),
      ]);
      assert.equal(replacement.code, 0, replacement.stderr);
      const replacementDigest = JSON.parse(replacement.stdout).sha256;
      assert.equal((await adopt("fixed", replacementDigest, old, old)).code, 2);
      const next = join(dir, "approved-next.json");
      assert.equal(
        (await adopt("fixed", replacementDigest, next, old)).code,
        0,
      );
      const promoted = JSON.parse(await readFile(next, "utf8"));
      assert.equal(promoted.previousSha256, digest);
      promoted.report.labels = { name: "tampered" };
      const tampered = join(dir, "tampered.json");
      await writeFile(tampered, JSON.stringify(promoted));
      assert.equal((await run("tampered", tampered)).code, 2);
      await writeFile(
        join(dir, "profile.json"),
        JSON.stringify({
          ...profile,
          url: "http://127.0.0.1:7/",
          options: { ...profile.options, pages: ["http://127.0.0.1:7/"] },
        }),
      );
      assert.equal(
        (await runCli(["baseline-review", ...review("fixed")])).code,
        2,
      );
      await writeFile(join(dir, "profile.json"), JSON.stringify(profile));
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
      const unreachable = await run("unreachable", old);
      assert.equal(unreachable.code, 2, unreachable.stdout);
      assert.equal(
        JSON.parse(await readFile(join(dir, "unreachable/gate.json"), "utf8"))
          .status,
        "inconclusive",
      );
    } finally {
      if (!closed) await new Promise<void>((r) => fixture.close(() => r()));
      await rm(dir, { recursive: true, force: true });
    }
  },
);
