/** Real optional Ollama test with synthetic observations only. Never downloads a model. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { generateAiPlan } from "../server/services/ai.js";
import type { Finding, Evidence } from "../shared/types.js";

const model = process.argv[2] ?? "qwen2.5:3b";
const evidence: Evidence = {
  id: "synthetic-evidence",
  path: "evidence/synthetic.png",
  pageUrl: "https://synthetic.invalid/",
  viewportId: "mobile",
  width: 390,
  height: 844,
  scrollX: 0,
  scrollY: 0,
  state: "initial",
  capturedAt: new Date().toISOString(),
};
const finding: Finding = {
  id: "synthetic-description",
  fingerprint: "synthetic-description",
  ruleId: "meta-description",
  category: "seo",
  priority: "nice-to-have",
  title: "Meta Description fehlt",
  detail:
    "Die Meta Description fehlt oder ist leer. Dies belegt keinen Rankingverlust.",
  pageUrl: evidence.pageUrl,
  viewportId: evidence.viewportId,
  state: evidence.state,
  evidenceId: evidence.id,
  evidenceStatus: "measured",
  recommendation:
    "Eine passende Zusammenfassung ergänzen, falls diese Seite indexiert werden soll.",
  acceptance: "Eine passende Meta Description ist im HTML vorhanden.",
};
const plan = await generateAiPlan({
  model,
  findings: [finding],
  evidence: [evidence],
});
assert.match(plan.provenance!.modelDigest ?? "", /^[a-f0-9]{64}$/);
assert.equal(plan.recommendations[0]?.findingId, finding.id);
const output = resolve(`.local-data/ai-identity-${Date.now()}`);
await mkdir(output, { recursive: true, mode: 0o700 });
await writeFile(
  join(output, "result.json"),
  JSON.stringify(
    { synthetic: true, semanticQualityEvaluated: false, plan },
    null,
    2,
  ),
  { mode: 0o600 },
);
console.log(
  JSON.stringify(
    {
      model,
      provenance: plan.provenance,
      validatedRecommendations: plan.recommendations.length,
      semanticQualityEvaluated: false,
      output,
    },
    null,
    2,
  ),
);
