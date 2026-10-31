# 2.3 local explanation comparison — internal regression evidence

This is a **development comparison, not independent human-labelled accuracy evaluation**. Three already installed local models received the same three frozen synthetic cases. No models were downloaded, promoted to qualified audit experts, fine-tuned or selected as a universal winner.

[Final raw outputs, input hashes, digests, inference budgets and timings](evaluation/proposal-models-2.3.json) · [implementation-agent qualitative review](evaluation/proposal-review-2.3.json) · [earlier pilot outputs](evaluation/proposal-pilot-2.3.json).

## Protocol

`tests/fixtures/proposal-eval-2.3.json`, version `proposal-eval-2.3-frozen-2`, contains a mobile overflow at `#wide` (680px element, 390px viewport/parent), a missing HTML Meta Description and an unknown-only report. Synthetic `owned.example` data contains no customer content. The final report contract is valid: each finding corresponds to a failed expected rule, the other 16 instances are unknown; the unknown-only case has 17 unknown instances. Counts are derived from the same deterministic facts. Per-case input SHA-256 is identical across all three models. Output order never feeds earlier model answers into later calls.

Reproduce from the repository with the listed models already installed and Ollama running:

```sh
npm run test:ai-eval -- qwen2.5:3b qwen3:4b qwen2.5:7b
```

Calls run serially on this Mac arm64 / Node 24 environment. Each request asks for `keep_alive:0`; durations include cold loading and are not steady-state benchmarks. Native no-truncation and architecture-specific context/output budgets are recorded in each provenance object. A 90-second inference limit and 95-second outer signal bound each case. This is a single final sample per model/case, not a repeated latency or whole-machine memory study. Raw outputs are parsed JSON values, not hidden model reasoning.

The comparison uses the page prompt and output validator on a fixed single-request synthetic envelope. It is **not** a whole-page throughput benchmark of the production multi-part API. Production separately tests all chunks, retries, cancellation, context omissions and the measured summary. Model-generated summaries in these raw results are retained for diagnosis and never used as measured application facts.

### Development iterations are disclosed

The earlier pilot used the same finding scenarios but a different envelope. Its header incorrectly declared one unknown rule while its deterministic inventory contained 17, and the measured finding was not tied to a failed rule row. That makes its count-related model answers ambiguous; they cannot establish comparative accuracy. It also exposed a URL being mistaken for a selector and unsuitable HTML/CSS examples. Guards were refined during development. A second run under that old protocol was stopped after a 90-second 4B timeout when the protocol issue was identified; it is excluded from the final comparison.

The final frozen-2 envelope corrects the rule inventory and derives counts from facts. The completed 9-response final run below contains no timeout. These are **development regressions after inspecting pilot outputs**, not held-out generalization evidence. The fixture is labelled accordingly. The public pilot retains its original protocol identity; do not pool its timings or scores with the final run.

## Separate results

| Installed model | Overflow | Missing description | Unknown only | Structurally accepted final responses |
| --- | ---: | ---: | ---: | ---: |
| qwen2.5:3b | 9.409s | 8.827s | 2.617s | 3/3 |
| qwen3:4b | 32.520s | 58.998s | 49.347s | 3/3 |
| qwen2.5:7b | 12.880s | 12.691s | 4.191s | 3/3 |

All 9 final calls responded and passed the bounded structural/reference output contract. All 6 supplied a solution for the supplied finding; all 3 unknown-only calls supplied no solution. **This is response/shape coverage, not factual accuracy or useful-action coverage.** None was a partial response under the single-request final protocol. The multi-part application can still be partial or interrupted.

The implementation-agent review finds:

- **3B:** overflow code retains the 680px layout and reuses the captured ID in new HTML. Meta advice claims unsupported ranking effects and includes ranking-recheck steps. Its unknown-only answer avoids inventing a fix but invents reasons for missing context.
- **4B:** useful basic HTML-presence/edit/retest steps in the Meta case, but an unsupported conversion claim. Overflow advice treats computed width as evidence of fixed CSS/root cause and offers an unsuitable hiding alternative. The new example class must not silently be applied to the real captured element. Its unknown-only abstention is appropriate for this case.
- **7B:** asks for dimensions that were supplied and conflates measured overflow with unknown status; its fixed 350px example is not a verified responsive patch. Some Meta steps require removing search-result/relevance checks. Its unknown-only abstention is appropriate for this case.

The review JSON separates factual assessment, code assessment and usable-action/abstention assessment per response. There is no general accuracy percentage: only 3 scenarios, one final sample each, implementation-agent judgements, no independent labels and no held-out set. Candidate steps were not executed as repairs. Appropriate abstention on unknown data does not excuse refusing every measured finding. Conversely, empty solutions and valid JSON alone do not establish correct abstention; the summary still needs review.

Automatic `factualAnchorIssues` identify narrow contradictions; `codeAndActionIssues` cover origin/code/action guards. A `wrong-selector` warning for an explicitly new `sf-example-` class in the default captured mode requires an origin decision and is not automatically a factual hallucination. Zero warnings does not mean semantically correct. Known spellings and guard rules cannot cover every phrasing, selector grammar or CSS/HTML error.

## Product consequence

The fact card and rule matrix come entirely from the stored report. Model summaries cannot overwrite them. Original proposals stay visibly unverified. The review editor allows incorrect code to be discarded and only curated steps/code/acceptance to transfer, under explicit confirmation and unchanged fact/original hashes. This editorial action leaves the task open. Actual compatible retests remain separate evidence.

Independent domain-expert labels, held-out scenarios, repeated model measurements and representative customer pilot tasks remain prerequisites for any future model-quality claim. This release provides a usable measured/review workflow despite those open external qualifications.
