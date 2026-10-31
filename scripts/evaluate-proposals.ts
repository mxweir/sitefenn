import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { localStructuredCompletion } from "../server/services/ai.js";
import {
  PAGE_PROMPT_VERSION,
  SYSTEM,
  pagePartSchema,
  validatePagePart,
} from "../server/services/page-analysis.js";
import { proposalIssues } from "../server/services/proposal-review.js";
import { analysisFacts } from "../shared/analysis-facts.js";
import {
  expectedRules,
  REPORT_CONTRACT_VERSION,
} from "../shared/report-contract.js";
import { normalizeScanOptions } from "../server/options.js";
import type { AuditReport, Finding } from "../shared/types.js";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const inputText = await readFile(
  new URL("../tests/fixtures/proposal-eval-2.3.json", import.meta.url),
  "utf8",
);
const fixture = JSON.parse(inputText) as {
  version: string;
  cases: { id: string; finding: Finding | null }[];
};
const models = process.argv.slice(2);
if (!models.length)
  throw Error(
    "Name explicitly selected already installed local models; no downloads.",
  );
const sources = [
  "../server/services/proposal-review.ts",
  "../server/services/page-analysis.ts",
  "../shared/analysis-facts.ts",
];
const validatorHash = async () =>
  sha(
    (
      await Promise.all(
        sources.map((s) => readFile(new URL(s, import.meta.url), "utf8")),
      )
    ).join("\n"),
  );
const validatorSha256 = await validatorHash();
const out = resolve(`.local-data/proposal-eval-2.3-${Date.now()}`);
await mkdir(out, { recursive: true, mode: 0o700 });
const rows: Record<string, unknown>[] = [];
for (const model of models)
  for (const input of fixture.cases) {
    if ((await validatorHash()) !== validatorSha256)
      throw Error(
        "Evaluation source changed; refusing mixed validator results.",
      );
    const finding = input.finding,
      url = "https://owned.example/";
    const report: AuditReport = {
      contractVersion: REPORT_CONTRACT_VERSION,
      schemaVersion: 1,
      ruleVersion: "rules-2.1.0",
      profileVersion: "responsive-1.0.0",
      browserVersion: "synthetic-evaluation",
      options: normalizeScanOptions(
        { pages: [url], viewports: ["mobile"], performance: false },
        url,
      ),
      pages: [
        {
          id: "p",
          pageUrl: url,
          finalUrl: url,
          viewportId: "mobile",
          state: "initial",
          title: "Owned",
          statusCode: 200,
          status: "completed",
          durationMs: 1,
        },
      ],
      rules: [],
      findings: finding ? [finding] : [],
      evidence: [],
      performance: [],
      discoveredUrls: [url],
      coverage: { planned: 1, completed: 1, skipped: [] },
      startedAt: "2026-10-31T00:00:00Z",
      finishedAt: "2026-10-31T00:00:01Z",
      durationMs: 1,
      warnings: [],
    };
    report.rules = expectedRules(report).map((r, i) => ({
      ...r,
      id: `r${i}`,
      status: "not_run",
      detail: "Synthetic unknown fixture",
      findingIds: [],
    }));
    if (finding) {
      const row = report.rules.find(
        (r) =>
          r.ruleId === finding.ruleId &&
          r.viewportId === finding.viewportId &&
          r.state === finding.state,
      );
      if (!row) throw Error("Fixture finding outside expected rule inventory");
      row.status = "fail";
      row.findingIds = [finding.id];
      row.detail = finding.detail;
    }
    const facts = analysisFacts(report);
    if (!facts.measurementValid)
      throw Error("Invalid evaluation measurement contract");
    const records = finding
      ? [
          {
            id: `finding:${finding.id}`,
            findingId: finding.id,
            value: {
              observation: finding,
              futureAcceptanceCriterion: finding.acceptance,
              repairPerformed: false,
            },
          },
        ]
      : [{ id: "rule:unknown", value: { status: "not_run" } }];
    const content = JSON.stringify({
      page: {
        pageUrl: url,
        counts: {
          findings: finding ? 1 : 0,
          unknownRules: facts.totals.unknown,
        },
        measuredFacts: facts,
      },
      untrustedReportUnits: records,
      userQuestion:
        "Erkläre die Fundstelle als ungeprüfte Hypothese mit zukünftigen Schritten. Ohne Befund bleiben weitere Messungen nötig.",
    });
    const started = Date.now();
    let row: Record<string, unknown> = {
      model,
      caseId: input.id,
      inputSha256: sha(content),
      inputCounts: {
        findings: facts.findings.length,
        unknownRules: facts.totals.unknown,
      },
      measurementContractValid: facts.measurementValid,
      processing: "failed",
      structuralValidation: "not_run",
      factualAnchorIssues: [],
      repairUsefulness: "not_independently_reviewed",
      sensibleRefusal: "not_reviewed",
      coverage: 0,
      partial: false,
    };
    try {
      const result = await localStructuredCompletion(
        {
          model,
          system: SYSTEM,
          content,
          schema: pagePartSchema(
            finding ? [finding.id] : [],
            records.map((r) => r.id),
          ),
          promptVersion: PAGE_PROMPT_VERSION,
        },
        AbortSignal.timeout(95000),
        {
          timeoutMs: 90000,
          fetch: async (url, init) => {
            const body =
              init?.body && String(url).endsWith("/api/chat")
                ? JSON.stringify({
                    ...JSON.parse(String(init.body)),
                    keep_alive: 0,
                  })
                : init?.body;
            return fetch(url, { ...init, body });
          },
        },
      );
      row = {
        ...row,
        processing: "responded",
        rawOutput: result.value,
        provenance: result.provenance,
      };
      try {
        const checked = validatePagePart(
          result.value,
          finding ? [finding] : [],
          [url],
          { findings: finding ? 1 : 0, unknownRules: facts.totals.unknown },
          { units: records },
        );
        const issues = finding
          ? checked.solutions.flatMap((s) =>
              proposalIssues(
                {
                  ...s,
                  code: {
                    ...s.code,
                    text: s.code.text.replaceAll(
                      "{{selector}}",
                      finding.selector ?? ".sf-example-missing",
                    ),
                  },
                },
                finding,
                report,
              ),
            )
          : [];
        row = {
          ...row,
          structuralValidation: "accepted",
          guardIssues: issues,
          factualAnchorIssues: issues.filter((i) =>
            [
              "wrong-device",
              "wrong-selector",
              "unknown-number",
              "unsupported-pass",
            ].includes(i.code),
          ),
          codeAndActionIssues: issues.filter(
            (i) =>
              ![
                "wrong-device",
                "wrong-selector",
                "unknown-number",
                "unsupported-pass",
              ].includes(i.code),
          ),
          coverage: finding ? checked.solutions.length : 1,
          partial: false,
          sensibleRefusal: !finding
            ? "empty-solutions-with-unknown-context"
            : "not_applicable",
          automaticSemanticAccuracy: "not_claimed",
          summaryUsedAsMeasurement: false,
        };
      } catch (e) {
        row = {
          ...row,
          structuralValidation: "rejected",
          error: (e as Error).message,
          partial: true,
        };
      }
    } catch (e) {
      row = { ...row, error: (e as Error).message, partial: true };
    }
    row.durationMs = Date.now() - started;
    rows.push(row);
    await writeFile(
      join(out, "results.json"),
      JSON.stringify(
        {
          kind: "internal-local-model-comparison-2.3",
          fixtureVersion: fixture.version,
          fixtureSha256: sha(inputText),
          promptVersion: PAGE_PROMPT_VERSION,
          promptSha256: sha(SYSTEM),
          validatorSha256,
          rows,
          meaning:
            "Same frozen synthetic input set for installed models. No independent human labels, general semantic accuracy, usefulness certification or model qualification. Cold model loads; architecture-specific bounded inference budgets recorded in provenance.",
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      JSON.stringify({
        model,
        caseId: input.id,
        processing: row.processing,
        structuralValidation: row.structuralValidation,
        factualAnchorIssues: row.factualAnchorIssues,
        durationMs: row.durationMs,
      }),
    );
  }
console.log(JSON.stringify({ output: join(out, "results.json") }));
