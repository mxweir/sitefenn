import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { gzipSync } from "node:zlib";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseSitemap, importSitemap } from "../server/services/sitemap.js";
import { permittedUrl, readScoped } from "../server/services/seo-network.js";
import {
  breadcrumbProfile,
  hasNoindex,
  rawSeoMeta,
} from "../server/services/seo-meta.js";
import { performScan } from "../server/scan-worker.js";
import { technicalSeo } from "../server/services/technical-seo.js";
import { calculateScore } from "../server/services/scoring.js";
import {
  buildJsonReport,
  buildMarkdownReport,
} from "../server/services/reports.js";
import { preparePage } from "../server/services/page-analysis.js";
import { createApp } from "../server/app.js";
import type { Scan } from "../shared/types.js";
const ns = 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"';
const breadcrumb = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Start",
      item: "https://example.test/",
    },
    { "@type": "ListItem", position: 2, name: "Seite" },
  ],
};
test("sitemap XML supports qualified namespaces and entities but rejects DTD, malformed XML and excessive nesting", () => {
  const parsed = parseSitemap(
    `<s:urlset xmlns:s="http://www.sitemaps.org/schemas/sitemap/0.9"><s:url><s:loc>https://example.test/?a=1&amp;b=2</s:loc></s:url></s:urlset>`,
  );
  assert.deepEqual(parsed.locations, ["https://example.test/?a=1&b=2"]);
  for (const xml of [
    `<!DOCTYPE x [<!ENTITY secret SYSTEM "file:///etc/passwd">]><urlset ${ns}/>`,
    `<urlset ${ns}><url></urlset>`,
    `<urlset><url/></urlset>`,
    `<urlset ${ns}>${"<a>".repeat(25)}${"</a>".repeat(25)}</urlset>`,
    `<urlset ${ns}><url><loc><a>bad</a></loc></url></urlset>`,
  ])
    assert.throws(() => parseSitemap(xml));
  const many = parseSitemap(
    `<urlset ${ns}>${Array.from({ length: 505 }, (_, i) => `<url><loc>https://example.test/${i}</loc></url>`).join("")}</urlset>`,
  );
  assert.equal(many.locations.length, 500);
  assert.equal(many.limited, true);
});
test("Googlebot noindex scope and raw HTML metadata do not confuse other bots or attribute quoting", () => {
  assert.equal(hasNoindex([], [], ["otherbot: noindex"]), false);
  assert.equal(
    hasNoindex([], [], ["otherbot: noindex, Googlebot: none"]),
    true,
  );
  assert.equal(hasNoindex([], [], ["noindex, nofollow"]), true);
  assert.equal(hasNoindex([], ["NOINDEX"], []), true);
  const meta = rawSeoMeta(
    `<html><head><LINK REL='CANONICAL' HREF='/a?x=>'><meta name=robots content='index,follow'><meta name=googlebot content=noindex></head></html>`,
  );
  assert.deepEqual(meta.canonicals, ["/a?x=>"]);
  assert.equal(hasNoindex(meta.robots, meta.googlebot, []), true);
});
test("supported Breadcrumb subset is separate from syntax, unsupported types and referenced contexts", () => {
  const block = (o: unknown) => [{ text: JSON.stringify(o), oversized: false }];
  assert.equal(breadcrumbProfile(block(breadcrumb), false).status, "pass");
  const invalid = structuredClone(breadcrumb);
  invalid.itemListElement[0]!.position = 0;
  assert.equal(breadcrumbProfile(block(invalid), false).status, "fail");
  assert.equal(
    breadcrumbProfile(
      block({
        "@context": "https://schema.org",
        "@type": "Product",
        name: "Object",
      }),
      false,
    ).status,
    "not_applicable",
  );
  assert.equal(
    breadcrumbProfile(
      block({ ...breadcrumb, "@context": { alias: "https://schema.org" } }),
      false,
    ).status,
    "not_run",
  );
  assert.equal(
    breadcrumbProfile([{ text: "{", oversized: false }], false).status,
    "not_run",
  );
  const relative = structuredClone(breadcrumb);
  relative.itemListElement[0]!.item = "/relative";
  assert.equal(breadcrumbProfile(block(relative), false).status, "not_run");
  assert.equal(breadcrumbProfile(block(breadcrumb), true).status, "not_run");
});
async function fixture() {
  const requests: string[] = [];
  let origin = "";
  let fixed = false;
  const server = createServer((req, res) => {
    const path = new URL(req.url!, origin).pathname;
    requests.push(path);
    if (path === "/robots.txt") {
      res.setHeader("content-type", "text/plain");
      return res.end("User-agent: Googlebot\nDisallow: /one\nAllow: /two\n");
    }
    if (path === "/sitemap.xml") {
      res.setHeader("content-type", "application/xml");
      return res.end(
        `<sitemapindex ${ns}><sitemap><loc>${origin}/child.xml.gz</loc></sitemap><sitemap><loc>${origin}/sitemap.xml</loc></sitemap></sitemapindex>`,
      );
    }
    if (path === "/child.xml.gz") {
      res.setHeader("content-type", "application/xml");
      return res.end(
        gzipSync(
          `<urlset ${ns}>${["/one", "/two", "/excluded/private", "/logout", "/one?token=private", "http://example.invalid/outside"].map((p) => `<url><loc>${p.startsWith("http") ? p : origin + p}</loc></url>`).join("")}</urlset>`,
        ),
      );
    }
    if (path === "/large.xml") {
      res.setHeader("content-type", "application/xml");
      res.setHeader("content-encoding", "gzip");
      return res.end(gzipSync("x".repeat(1100000)));
    }
    if (path === "/r1" || path === "/r2") {
      res.statusCode = path === "/r1" ? 301 : 302;
      res.setHeader("location", path === "/r1" ? "/r2" : "/target");
      return res.end();
    }
    if (path === "/loop") {
      res.statusCode = 302;
      res.setHeader("location", "/loop");
      return res.end();
    }
    if (path === "/outside") {
      res.statusCode = 302;
      res.setHeader("location", "http://127.0.0.1:11434/api/tags");
      return res.end();
    }
    if (path === "/restricted") {
      res.statusCode = 403;
      return res.end("No permission");
    }
    if (path === "/slow") {
      const timer = setTimeout(() => res.end("late"), 5000);
      res.on("close", () => clearTimeout(timer));
      return;
    }
    if (path === "/missing") {
      res.statusCode = fixed ? 200 : 404;
      return res.end("Not found");
    }
    if (path.startsWith("/excluded") || path === "/logout") {
      res.statusCode = 500;
      return res.end("must not be requested");
    }
    if (path === "/many-meta") {
      res.setHeader("content-type", "text/html");
      return res.end(
        "<html><body>" + "<i></i>".repeat(30050) + "</body></html>",
      );
    }
    if (path === "/limits") {
      res.setHeader("content-type", "text/html");
      return res.end(
        `<!doctype html><html lang="de"><head><title>Limits</title>${Array.from({ length: 21 }, (_, i) => `<script type="application/ld+json">${i === 20 ? "{" : JSON.stringify(breadcrumb)}</script>`).join("")}</head><body><h1>Limits</h1>${"<a href='/one'>Ziel</a>".repeat(101)}</body></html>`,
      );
    }
    res.setHeader("content-type", "text/html; charset=utf-8");
    const invalid = structuredClone(breadcrumb);
    invalid.itemListElement[0]!.position = 0;
    const json = path === "/one" ? invalid : breadcrumb;
    res.end(
      `<!doctype html><html lang="de"><head><title>${path === "/target" ? "Target" : "Gemeinsamer Seitentitel"}</title><meta name=description content="Gemeinsame Beschreibung">${path === "/one" || path === "/target" ? "<meta name=robots content=noindex>" : ""}<link rel=canonical href="${path === "/two" ? "/target" : path}"><script type="application/ld+json">${JSON.stringify(json)}</script></head><body><main><h1>Eigene SEO-Fixture</h1><a href="/two">Zweite Seite</a><a href="/missing?trace=private">Fehlendes Ziel</a><a href="/r1">Redirect</a><a href="/many-meta">Begrenzte Metadaten</a>${fixed ? "" : '<a href="/restricted">Eingeschränkt</a><a href="/excluded/private">Ausgeschlossen</a>'}</main></body></html>`,
    );
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  origin = `http://127.0.0.1:${address.port}`;
  return {
    origin,
    fix: () => {
      fixed = true;
    },
    requests,
    server,
    close: () => new Promise<void>((done) => server.close(() => done())),
  };
}
test("scoped sitemap import handles indices/gzip, caps and exclusions; unsafe redirects and private unapproved requests are never followed", async () => {
  const f = await fixture();
  const policy = {
    url: f.origin + "/one",
    allowedLocalOrigin: f.origin,
    excludedPaths: ["/excluded"],
  };
  try {
    const result = await importSitemap({
      ...policy,
      sitemapUrl: f.origin + "/sitemap.xml",
      maxPages: 10,
    });
    assert.deepEqual(result.urls, [f.origin + "/one", f.origin + "/two"]);
    assert.ok(result.excluded.length >= 4);
    assert.equal(f.requests.includes("/logout"), false);
    assert.equal(f.requests.includes("/excluded/private"), false);
    const limited = await importSitemap({
      ...policy,
      sitemapUrl: f.origin + "/child.xml.gz",
      maxPages: 1,
    });
    assert.equal(limited.urls.length, 1);
    assert.equal(limited.limited, true);
    const large = await importSitemap({
      ...policy,
      sitemapUrl: f.origin + "/large.xml",
      maxPages: 10,
    });
    assert.equal(large.urls.length, 0);
    assert.ok(large.documents.some((d) => d.status === "failed"));
    const r = await readScoped(
      f.origin + "/r1",
      policy,
      AbortSignal.timeout(5000),
    );
    assert.equal(r.statusCode, 200);
    assert.equal(r.redirects.length, 2);
    await assert.rejects(
      readScoped(f.origin + "/outside", policy, AbortSignal.timeout(5000)),
      /freigegeben/,
    );
    await assert.rejects(
      readScoped(f.origin + "/loop", policy, AbortSignal.timeout(5000)),
      /Schleife/,
    );
    const count = f.requests.length;
    await assert.rejects(
      readScoped(
        f.origin + "/one",
        { url: f.origin, excludedPaths: [] },
        AbortSignal.timeout(5000),
      ),
      /Lokales|lokale|gesperrte|Port/,
    );
    assert.equal(f.requests.length, count);
    await assert.rejects(
      readScoped(f.origin + "/slow", policy, AbortSignal.timeout(30)),
    );
    assert.throws(() =>
      permittedUrl(f.origin + "/one?token=secret", f.origin, policy),
    );
  } finally {
    await f.close();
  }
});
test(
  "actual Chromium SEO context preserves measured failures, heuristic candidates, unknown probes and portable exports",
  { timeout: 90000 },
  async () => {
    const f = await fixture(),
      directory = await mkdtemp(join(tmpdir(), "sitefenn-seo-"));
    try {
      const result = await performScan({
        id: "seo",
        url: f.origin + "/one",
        allowedLocalOrigin: f.origin,
        environment: "production",
        dataDir: directory,
        options: {
          pages: [f.origin + "/one", f.origin + "/two"],
          viewports: [{ id: "desktop", width: 1000, height: 700 }],
          maxPages: 2,
          maxDepth: 0,
          excludedPaths: ["/excluded"],
          performance: false,
          performanceRuns: 1,
          technicalSeo: true,
        },
      });
      const report = result.audit!,
        context = report.seo!;
      assert.ok(context);
      assert.equal(context.pages.length, 2);
      assert.equal(
        context.duplicates.filter((g) => g.kind === "title").length,
        1,
      );
      assert.ok(context.graph.length >= 4);
      assert.equal(f.requests.includes("/excluded/private"), false);
      const broken = report.findings.find(
        (p) => p.ruleId === "seo-internal-links",
      )!;
      assert.equal(broken.evidenceStatus, "measured");
      assert.match(broken.detail, /404/);
      const duplicate = report.findings.find(
        (p) => p.ruleId === "seo-duplicate-title",
      )!;
      assert.equal(duplicate.evidenceStatus, "heuristic");
      assert.ok(report.findings.some((p) => p.ruleId === "seo-robots-context"));
      assert.ok(
        report.findings.some((p) => p.ruleId === "seo-canonical-target"),
      );
      assert.ok(
        report.findings.some((p) => p.ruleId === "seo-breadcrumb-profile"),
      );
      assert.equal(
        report.rules.find(
          (r) =>
            r.ruleId === "structured-data-json" && r.pageUrl.endsWith("/one"),
        )?.status,
        "pass",
      );
      assert.ok(
        context.probes.some(
          (p) => p.statusCode === 403 && p.outcome === "restricted",
        ),
      );
      assert.equal(
        context.probes.find((p) => p.url === f.origin + "/r1")?.redirects
          .length,
        2,
      );
      const boundedMeta = context.probes.find(
        (p) => p.url === f.origin + "/many-meta",
      );
      assert.equal(boundedMeta?.statusCode, 200);
      assert.equal(boundedMeta?.outcome, "checked");
      assert.equal(boundedMeta?.noindex, undefined);
      assert.match(boundedMeta?.detail ?? "", /Metadaten unbekannt/);
      assert.ok(
        calculateScore(report).categories.find((c) => c.category === "seo")!
          .unknownWeight > 0,
      );
      const prepared = preparePage(report, f.origin + "/one");
      assert.ok(prepared.units.some((u) => u.id.startsWith("seo-probe:")));
      assert.ok(prepared.units.some((u) => u.id.startsWith("seo-duplicate:")));
      const scan: Scan = {
          id: "scan-seo",
          projectId: "p",
          status: "completed",
          createdAt: report.startedAt,
          finishedAt: report.finishedAt,
          error: null,
          result,
          options: report.options,
        },
        project = {
          id: "p",
          name: "Own SEO",
          url: f.origin,
          environment: "production" as const,
          createdAt: report.startedAt,
        };
      const json = JSON.parse(buildJsonReport(project, scan));
      assert.ok(json.seo.graph.length);
      assert.ok(
        json.seo.graph.every((e: { to: string }) => !e.to.includes("?")),
      );
      const chosen = report.findings.find(
        (f) => f.ruleId === "seo-internal-links",
      )!;
      const scoped = JSON.parse(
        buildJsonReport(project, scan, undefined, {
          selectedFindingIds: [chosen.id],
        }),
      );
      assert.ok(scoped.seo.pages.length > 0);
      assert.ok(
        scoped.seo.pages.every(
          (p: { pageUrl: string; viewportId: string }) =>
            p.pageUrl === chosen.pageUrl && p.viewportId === chosen.viewportId,
        ),
      );
      assert.ok(
        scoped.seo.graph.every(
          (e: { from: string }) => e.from === chosen.pageUrl,
        ),
      );
      const markdown = buildMarkdownReport(project, scan);
      assert.match(markdown, /Technical SEO context/);
      assert.ok(
        markdown.indexOf("## Technical SEO context") <
          markdown.indexOf("## Prioritized checklist"),
      );
      const single = structuredClone(report);
      single.seo!.pages = single.seo!.pages.slice(0, 1);
      single.options.pages = [f.origin + "/one"];
      single.coverage = { planned: 1, completed: 1, skipped: [] };
      const checks = await technicalSeo(
        single,
        {
          url: f.origin,
          allowedLocalOrigin: f.origin,
          excludedPaths: ["/excluded"],
        },
        "staging",
        { checkpoint: async () => {}, progress: () => {} },
      );
      assert.equal(
        checks.checks.find((c) => c.id === "seo-duplicate-title")?.status,
        "not_run",
      );
      assert.equal(
        checks.checks.find((c) => c.id === "seo-robots-context")?.status,
        "not_applicable",
      );
      assert.ok(
        !checks.checks
          .find((c) => c.id === "seo-canonical-target")
          ?.detail.includes("gemeinsam vorhanden"),
      );
    } finally {
      await f.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
);
test("sitemap API imports candidates without creating scans and rejects a foreign sitemap", async () => {
  const f = await fixture(),
    directory = await mkdtemp(join(tmpdir(), "sitefenn-sitemap-api-"));
  const { app, store } = await createApp({
    port: 4328,
    dataDir: directory,
    runJobs: false,
  });
  try {
    const host = "127.0.0.1:4328",
      home = await app.inject({ url: "/", headers: { host } }),
      headers = {
        host,
        cookie: String(home.headers["set-cookie"]).split(";")[0],
        origin: `http://${host}`,
        "x-hub-request": "1",
      };
    const p = store.createProject("Owned", f.origin + "/one", "local");
    const imported = await app.inject({
      method: "POST",
      url: `/api/projects/${p.id}/sitemap`,
      headers,
      payload: {
        sitemapUrl: f.origin + "/sitemap.xml",
        excludedPaths: ["/excluded"],
        maxPages: 10,
      },
    });
    assert.equal(imported.statusCode, 200, imported.body);
    assert.equal(imported.json().urls.length, 2);
    assert.equal(store.scans().length, 0);
    const foreign = await app.inject({
      method: "POST",
      url: `/api/projects/${p.id}/sitemap`,
      headers,
      payload: { sitemapUrl: "https://example.invalid/sitemap.xml" },
    });
    assert.equal(foreign.statusCode, 400);
  } finally {
    await app.close();
    await f.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test(
  "actual capture budgets leave over-limit JSON-LD and link observations unknown",
  { timeout: 60000 },
  async () => {
    const f = await fixture(),
      directory = await mkdtemp(join(tmpdir(), "sitefenn-seo-limits-"));
    try {
      const result = await performScan({
        id: "limits",
        url: f.origin + "/limits",
        allowedLocalOrigin: f.origin,
        dataDir: directory,
        environment: "production",
        options: {
          pages: [f.origin + "/limits"],
          viewports: [{ id: "desktop", width: 1000, height: 700 }],
          maxPages: 1,
          maxDepth: 0,
          excludedPaths: [],
          performance: false,
          performanceRuns: 1,
          technicalSeo: true,
        },
      });
      assert.equal(
        result.audit!.rules.find((r) => r.ruleId === "structured-data-json")
          ?.status,
        "not_run",
      );
      assert.equal(
        result.audit!.rules.find((r) => r.ruleId === "seo-internal-links")
          ?.status,
        "not_run",
      );
      assert.equal(result.audit!.seo?.pages[0]?.jsonld.status, "not_run");
      assert.equal(result.audit!.seo?.coverage.linksTruncated, true);
    } finally {
      await f.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
);

test(
  "new HTTP-link tasks retain SEO mode on a real scoped retest and verify only after a measured passing check",
  { timeout: 60000 },
  async () => {
    const f = await fixture(),
      directory = await mkdtemp(join(tmpdir(), "sitefenn-seo-retest-"));
    const { app, store, runner } = await createApp({
      port: 4329,
      dataDir: directory,
    });
    try {
      const host = "127.0.0.1:4329",
        home = await app.inject({ url: "/", headers: { host } }),
        headers = {
          host,
          cookie: String(home.headers["set-cookie"]).split(";")[0],
          origin: `http://${host}`,
          "x-hub-request": "1",
        };
      const project = store.createProject(
        "Owned link retest",
        f.origin + "/one",
        "local",
      );
      const wait = async (id: string) => {
        for (let i = 0; i < 600; i++) {
          const s = store.scan(id)!;
          if (s.status === "failed") throw new Error(s.error ?? "Scan failed");
          if (s.status === "completed" && !runner.isBusy()) return s;
          await new Promise((r) => setTimeout(r, 50));
        }
        throw new Error("timeout");
      };
      const started = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/scans`,
        headers,
        payload: {
          pages: [f.origin + "/one", f.origin + "/two"],
          viewports: ["desktop"],
          technicalSeo: true,
        },
      });
      assert.equal(started.statusCode, 202, started.body);
      const before = await wait(started.json().scan.id);
      await app.inject({ url: `/api/scans/${before.id}`, headers });
      const broken = before.result!.audit!.findings.find(
          (f) => f.ruleId === "seo-internal-links",
        )!,
        task = store
          .tasks(before.id)
          .find((t) => t.findingIds.includes(broken.id))!;
      assert.ok(task);
      f.fix();
      const next = await app.inject({
        method: "POST",
        url: `/api/tasks/${task.id}/retest`,
        headers,
      });
      assert.equal(next.statusCode, 202, next.body);
      assert.equal(next.json().scan.options.technicalSeo, true);
      const after = await wait(next.json().scan.id);
      assert.equal(
        after.result!.audit!.rules.find(
          (r) => r.ruleId === "seo-internal-links",
        )?.status,
        "pass",
      );
      assert.equal(store.task(task.id)?.status, "verified");
      assert.equal(store.task(task.id)?.verifiedByScanId, after.id);
    } finally {
      await app.close();
      await f.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
);
