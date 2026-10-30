# Page assistant evaluation — 1.6

2026-10-30. This document separates structural contract checks, actual local inference and semantic review. Cases and labels are authored as implementation regressions by the coding agent, not by independent human evaluators. No held-out generalization or whole-model factual accuracy percentage is claimed.

## Reproduction

```sh
# No model: checks expected acceptance/rejection of authored output examples.
npm run test:ai-contract

# Real installed local model, four owned synthetic inference inputs, no download.
npm run test:ai-contract -- --model qwen2.5:3b
npm run test:ai-contract -- --model qwen3:4b
npm run test:ai-contract -- --model qwen2.5:7b

# Full actual API/worker page-report smoke; defaults to our owned demo.
npm run test:page-ai-local -- qwen2.5:3b
```

The corpus is [page-eval-1.6.json](../tests/fixtures/page-eval-1.6.json). The runner is [evaluate-page-ai.ts](../scripts/evaluate-page-ai.ts). Real results stay in ignored `.local-data/`; review before publishing any privately supplied report. Model/prompt/context identities, validator-module hash, durations and loaded-model API samples are recorded. Hidden thinking/reasoning text is not stored in the result artifact.

## Contract fixtures

20 examples: three supported valid/negated cases and 17 constructed violations. They cover incorrect presence claims, invented references/source paths/URLs, a false repair hidden in steps, unknown-scope completion, unsafe instruction echoes, unsupported ranking claims, empty-description alternatives, overflow masking and changing the test viewport. All expected outcomes matched.

These fixtures were designed around known failures. They are neither an independent benchmark nor evidence that rejected-output patterns cover all hallucinations. A structurally accepted answer can still give bad CSS, confuse absence of measurement with absence of impact, or suggest an irrelevant alternative.

## Real local models and actual page workflow

All three tags were actually run on local Ollama 0.40.12. Each received the same four owned synthetic cases, with the frozen validator hash recorded in the linked artifact. Acceptance below means only that the structural/targeted guards accepted the output.

| Model | Guard-accepted cases | Case durations | API-reported loaded size | Artifact |
| --- | --- | --- | --- | --- |
| qwen2.5:3b | 3/4 | 1.3–9.0 s | 2.25 GiB | [Raw structured outputs](evaluation/qwen2-5-3b-1.6.json) |
| qwen3:4b | 2/4 | 34.2–46.0 s | 4.18 GiB | [Raw structured outputs](evaluation/qwen3-4b-1.6.json) |
| qwen2.5:7b | 4/4 | 0.8–10.2 s | 4.79 GiB | [Raw structured outputs](evaluation/qwen2-5-7b-1.6.json) |

Durations include actual provider work and possible cold loading; these were not isolated hardware speed benchmarks. Loaded-model size is not total process/system peak memory. The 3B and 7B profiles used 8,192 context / 3,072 generation tokens; the thinking-only 4B profile used 12,288 / 6,144.

**Semantic review found errors even in accepted 7B outputs.** Its layout summary called the 696 px document scroll width the menu width, while the measured element was 680 px, and suggested CSS for an unobserved `.menu-item` selector. Its description replies suggested vague search-relevance/click-rate benefits without measured outcome data and a blanket length target. All four guard checks passing therefore does not establish four correct answers or qualify a default model recommendation.

The real API/worker test uses an owned Orbit Studio page, two compatible full checks, desktop/mobile and an explicitly opened mobile menu. The report contains four findings, 31 rule records and 63 prepared unique context records after task/comparison expansion. The 4B run completed four of five parts; one part and synthesis timed out. Accepted advice still confused an element right edge with its width, ignored a positive left offset in max-width advice and asserted an unmeasured click-rate effect. These errors remain published limitations rather than fabricated successful fixes.

[Actual completed 7B processing](screenshots/1.6-page-analysis.jpg), [actual measured element context](screenshots/1.6-element-context.jpg), [actual partial 4B analysis](screenshots/1.6-partial-analysis.jpg) and [390 px mobile view](screenshots/1.6-mobile.jpg) show the application with owned fixture data. The 7B full API/worker run completed all five parts and synthesis, with no omitted records or unexplained findings. Its Markdown was exported through the actual API. Completion still did not mean semantic success: a description proposal called the description an important ranking factor, contrary to the report's explicit lack of ranking evidence; another confused SEO-ranking potential with the measured missing tag. Layout advice proposed a new overflow handler and questionable width/scroll changes. Its synthesis also described accessibility as unknown despite present rule records. These actual proposals were deliberately **not adopted**. The targeted guards missed these formulations. The optional 7B model is therefore not promoted to a verified default. A real 7B follow-up retained the same saved intent/task/comparison snapshot and source hash. It processed five of six parts; one reply was rejected for claiming error-free scope despite findings, so the result remained partial with one unexplained finding. Its actual Markdown export retained finding references. No failed piece was replaced with a canned answer. The deterministic API/UI tests separately exercise export, task adoption and deduplication using a controlled provider.

## Important observed failures

Early 3B outputs cited the correct finding while asserting a ranking effect for a missing description. Another recommended hiding horizontal overflow. The 4B thinking-only variant proposed adding an empty meta description as an alternative, and an earlier 4,096-token generation budget failed to finish one structured layout reply. These observations motivated narrow regression guards and the larger bounded thinking profile.

A pre-release full 3B run on a real owned page also proposed enlarging the viewport to accommodate content, and produced a max-width example that did not account for the observed positive left offset. The former now has a targeted guard. The latter demonstrates that reference/schema checks are insufficient; no generic CSS-correctness guarantee is made. Rejected pieces are not adopted into tasks, and remaining proposals still need source review and a compatible rule-based retest.

Only owned synthetic pages/inputs are used in public artifacts. No customer screenshots/reports are included. The small sample cannot establish prompt-injection resistance, reliable code generation or business effectiveness.

## Provider and model sources

- [Ollama structured output](https://ollama.com/blog/structured-outputs): schemas constrain shape, not factual correctness.
- [Ollama native request fields at v0.40.0](https://github.com/ollama/ollama/blob/v0.40.0/api/types.go): native no-truncation/no-shift requests used by the new page path.
- [Ollama loaded-model endpoint](https://docs.ollama.com/api/ps): memory/context samples describe the loaded model component, not a measured total-system peak or a hardware guarantee.
- [Qwen2.5 3B model/license](https://ollama.com/library/qwen2.5:3b): Qwen Research License, separate from this app's MIT license.
- [Qwen3 4B model/license](https://ollama.com/library/qwen3:4b): Apache 2.0 as distributed in the tested tag; model identity and quantization matter.
- [Qwen2.5 7B model information](https://ollama.com/library/qwen2.5:7b): separate optional model weights; no weight files are bundled with SiteFenn.
- [Google snippet guidance](https://developers.google.com/search/docs/appearance/snippet): potential snippet use is distinct from an observed ranking effect or guaranteed search-result display.

Native/Windows packaging, real Google authorization and screenshot vision remain outside this release. Further independent labeled/held-out evaluation is required before any broad model-quality recommendation.
