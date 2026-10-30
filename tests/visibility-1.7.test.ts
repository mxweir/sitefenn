import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GoogleSearch,
  SEARCH_SCOPE,
  propertyContains,
  type SecretVault,
} from "../server/services/google-search.js";
import {
  workPriorities,
  priorityWeights,
} from "../server/services/work-priority.js";
import { parseSearchConsoleCsv } from "../server/services/search-console.js";
import type { AuditReport, AuditTask } from "../shared/types.js";
test(
  "Google protocol: PKCE, state rejection, readonly scope, bounded scoped import and confirmed revoke",
  { timeout: 20000 },
  async () => {
    let secret: string | null = null,
      revocationFails = true;
    const vault: SecretVault = {
      async get() {
        return secret;
      },
      async set(v) {
        secret = v;
      },
      async remove() {
        secret = null;
      },
    };
    let verifier = "",
      imports = 0;
    const request: typeof fetch = async (input, init) => {
      const url = String(input);
      assert.equal(init?.redirect, "error");
      if (url.endsWith("/token")) {
        const params = init?.body as URLSearchParams;
        if (params.get("grant_type") === "authorization_code") {
          verifier = params.get("code_verifier")!;
          assert.ok(verifier.length >= 43);
          return Response.json({
            refresh_token: "PRIVATE-REFRESH",
            scope: SEARCH_SCOPE,
          });
        }
        assert.equal(params.get("refresh_token"), "PRIVATE-REFRESH");
        return Response.json({ access_token: "PRIVATE-ACCESS" });
      }
      if (url.endsWith("/revoke"))
        return new Response("", { status: revocationFails ? 503 : 200 });
      if (url.endsWith("/sites"))
        return Response.json({
          siteEntry: [
            { siteUrl: "sc-domain:example.org", permissionLevel: "siteOwner" },
          ],
        });
      assert.ok(
        url.includes("/sites/sc-domain%3Aexample.org/searchAnalytics/query"),
      );
      imports++;
      assert.equal(
        new Headers(init?.headers).get("authorization"),
        "Bearer PRIVATE-ACCESS",
      );
      const body = JSON.parse(String(init?.body));
      assert.equal(body.rowLimit, 25000);
      assert.equal(body.dataState, "final");
      assert.equal(body.type, "web");
      return Response.json({
        rows: [
          {
            keys: ["https://example.org/"],
            clicks: 10,
            impressions: 1000,
            ctr: 0.01,
            position: 8.3,
          },
        ],
      });
    };
    const google = new GoogleSearch(vault, request);
    try {
      await google.configure({
        installed: {
          clientId: "123456789.apps.googleusercontent.com",
          clientSecret: "private-client-secret",
        },
      });
      const auth = new URL((await google.start()).url);
      assert.equal(auth.searchParams.get("scope"), SEARCH_SCOPE);
      assert.equal(auth.searchParams.get("code_challenge_method"), "S256");
      const redirect = auth.searchParams.get("redirect_uri")!;
      const wrong = new URL(redirect);
      wrong.searchParams.set("state", "wrong");
      assert.equal((await fetch(wrong)).status, 400);
      assert.equal((await google.status()).pending, true);
      const valid = new URL(redirect);
      valid.searchParams.set("state", auth.searchParams.get("state")!);
      valid.searchParams.set("code", "owned-code");
      assert.equal((await fetch(valid)).status, 200);
      const { createHash } = await import("node:crypto");
      assert.equal(
        createHash("sha256").update(verifier).digest("base64url"),
        auth.searchParams.get("code_challenge"),
      );
      assert.equal((await google.status()).connected, true);
      assert.ok(!JSON.stringify(await google.status()).includes("PRIVATE"));
      assert.equal(
        (await google.sites()).properties[0]?.siteUrl,
        "sc-domain:example.org",
      );
      const metadata = {
        property: "sc-domain:example.org",
        startDate: "2026-09-01",
        endDate: "2026-09-28",
        dimension: "page" as const,
        filters: { country: "deu", device: "MOBILE" },
      };
      const dataset = await google.import(
        "owned-project",
        "https://example.org/",
        metadata,
      );
      assert.equal(dataset.rows[0]?.position, 8.3);
      assert.equal(dataset.summary.position, null);
      assert.equal(dataset.metadata.source, "google-api");
      assert.ok(!JSON.stringify(dataset).includes("PRIVATE"));
      await assert.rejects(
        google.import("owned-project", "https://other.org/", metadata),
      );
      await assert.rejects(
        google.import("owned-project", "https://example.org/", {
          ...metadata,
          filters: { url: "https://evil.test/" },
        }),
      );
      assert.equal(imports, 1);
      await assert.rejects(google.disconnect(), /Widerruf/);
      assert.equal((await google.status()).connected, true);
      revocationFails = false;
      await google.disconnect();
      assert.equal(secret, null);
      assert.equal((await google.status()).connected, false);
    } finally {
      google.close();
    }
  },
);
test("priority uses exact page rows once, unknown reach stays explicit, weights never change findings", () => {
  const dataset = parseSearchConsoleCsv(
    "Page,Clicks,Impressions,CTR,Position\nhttps://example.org/,10,1000,1%,8\nhttps://example.org/other,5,100,5%,3",
    {
      property: "sc-domain:example.org",
      dimension: "page",
      startDate: "2026-09-01",
      endDate: "2026-09-28",
      filters: {},
    },
    { projectId: "p" },
  );
  const report = {
    options: { pages: ["https://example.org/", "https://example.org/missing"] },
    findings: [
      {
        id: "a",
        pageUrl: "https://example.org/",
        priority: "important",
        evidenceStatus: "measured",
      },
      {
        id: "b",
        pageUrl: "https://example.org/",
        priority: "important",
        evidenceStatus: "measured",
      },
      {
        id: "c",
        pageUrl: "https://example.org/missing",
        priority: "critical",
        evidenceStatus: "measured",
      },
    ],
  } as unknown as AuditReport;
  const tasks = [
    {
      id: "1",
      findingIds: ["a", "b"],
      title: "One problem, two views",
      category: "layout",
      status: "open",
      priority: "important",
    },
    {
      id: "2",
      findingIds: ["c"],
      title: "Missing reach",
      category: "seo",
      status: "open",
      priority: "critical",
    },
  ] as AuditTask[];
  const before = JSON.stringify(report);
  const board = workPriorities(report, tasks, dataset);
  assert.equal(board.entries.find((e) => e.taskId === "1")?.impressions, 1000);
  assert.equal(board.entries.find((e) => e.taskId === "2")?.reach, null);
  assert.equal(board.entries.find((e) => e.taskId === "2")?.provisional, true);
  assert.equal(board.candidates.length, 1);
  assert.equal(JSON.stringify(report), before);
  assert.throws(() => priorityWeights({ ...board.weights, severity: 200 }));
  assert.throws(() =>
    workPriorities(report, tasks, {
      ...dataset,
      metadata: { ...dataset.metadata, dimension: "query" },
    }),
  );
  assert.equal(
    propertyContains("sc-domain:example.org", "https://badexample.org/"),
    false,
  );
});
