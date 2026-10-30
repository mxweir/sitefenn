# SiteFenn 1.6 verification

2026-10-30. Local macOS Apple M5 Pro, 24 GiB RAM. This release strengthens the page-report assistant's observed context, traceability and failure handling. Models remain optional and unverified; this is not a trained SEO/UX expert or an independent effectiveness study.

## Checks

- `npm run check`: passed.
- `npm test`: 113/113 passed. The new cases include a real Chromium style/privacy fixture, context/chunk accounting, compatible comparison snapshots, provider/version/no-truncation handling and 20 versioned contract examples.
- `npm run build`: passed.
- `npm run test:e2e`: 17/17 passed. The new controlled UI case covers explicit page intent, compatible comparison selection, proposal references, alternatives/missing information and 390 px layout. Mock-provider UI tests are separate from actual model tests.
- `npm run test:ai-contract`: all 20 expected contract outcomes matched. Three supported valid examples and 17 constructed violations; this is not a factual accuracy percentage.
- `npm run test:readiness -- .local-data/readiness-1.6-final`: passed; actual service lifecycle and local OAuth protocol contract. No native installer or real Google authorization is implied.
- `npm audit --audit-level=high`: zero reported vulnerabilities at test time.

[macOS/Ubuntu CI](https://github.com/mxweir/sitefenn/actions/workflows/ci.yml) is separate from local checks. Published release notes record the remote outcome for the release commit.

## Observed context and privacy fixture

A real worker captures an owned mobile page with a 680 px overwide element, a private password-field value and the same private sentinel in page text. New finding context records the computed 680 px width and measured dimensions. The context JSON contains neither the sentinel nor raw input/HTML text. The related finding/rule/evidence records remain together in the inference part. Missing/ambiguous selectors and resource caps are explicit unavailable context.

The fixture also checks that all prepared unique records appear in a processed chunk or the omission list, that unknown rule records remain present, that base-view counts do not accidentally count interactive state rows as extra completed profiles, and that context references stay page-scoped. Real captured reports support the comparison fixture; a changed browser identity and a later-as-earlier scan are rejected.

## API, UI and workflow checks

The API rejects oversized/unknown intent fields, a focus finding from another page, invalid task-inclusion values and incompatible comparison snapshots. Task context is restricted to findings on the selected page. Follow-ups retain the saved snapshot; callers cannot silently change intent/comparison data through a follow-up. Original report/context hashes still bind them to the measurement.

The mocked-provider API test persists new explanations and known references, exports Markdown and adopts a proposal into the original open task. Repeated adoption is deduplicated; canonical findings and scores are untouched. The UI retains original evidence and the acceptance criterion beside the unverified proposal, and exposes reference excerpts separately from factual verification.

See [the real-model evaluation and actual application run](EVALUATION-1.6.md) for successes, failures, provenance and the limits of these checks. No cloud fallback or canned answer substitutes for a failed model.

## Budgets and boundaries

### Element context

- Up to eight selected finding anchors per screenshot and 80 captured contexts per scan. A unique query result is required; unavailable context records the reason. These bounds do not promise that every finding gets extra styles.
- Tag, bounding rectangle, client/scroll dimensions and a fixed allowlist of computed layout styles for the element/immediate parent. Style values are capped at 120 characters. No text, raw HTML, form values, arbitrary attributes, URLs or full DOM tree are collected by this additional context routine.
- This is an observed computed state, not an authored stylesheet, source-file mapping or proven cause. Original selectors/report text and screenshots can still contain confidential content. Trusted authorized targets remain required.

### Page interpretation

- One focus finding per inference packet, paired with fitting relevant rules, evidence, numeric/state context and task/comparison records. All remaining page records still participate in background parts, or are explicitly omitted. Focus is processed first; snippets are not silently taken as the whole page.
- Up to 24 parts and 8,500 record characters per part; oversize individual records and further parts are listed as omissions. A part receives whole-page counts, scope and unknowns. User purpose/goal/audience are optional user-provided context, never measured business facts.
- Up to 40 page-related task snapshots and 100 comparison entries; limits are explicit and prevent claiming a complete interpretation. Comparisons require the same project and a compatible earlier full scan; the UI offers the last 20 candidate scans. No causal link between a change and business/ranking impact is inferred.
- Non-thinking models: 8,192 context tokens, at most 3,072 generated tokens. Thinking-only models: 12,288 context tokens, at most 6,144 generated tokens, after the smaller output budget failed to produce complete structured replies. This remains bounded and can still fail. Actual provider/model/request identity is recorded.
- Per-call provider timeout is 90 seconds; total page job deadline is ten minutes. Invalid part output has one correction attempt; provider failures do not retry indefinitely. Cancellation/partial/interrupted results retain accepted parts and identify unexplained findings.
- The new page path requires a verifiable Ollama version of at least 0.40.0 and sends native `truncate:false` and `shift:false`. Provider context errors remain failures rather than silently discarding report content. An actual oversized synthetic request to the installed Ollama 0.40.12 returned HTTP 400 instead of a truncated answer. Older legacy selected-finding APIs retain their previous scope; no blanket compatibility claim is made for every Ollama version/fork.

### Proposal contract

New proposals require a known finding ID/reference, relevance, a hypothesized cause, concrete steps, optional illustrative HTML/CSS/JS, future retest, uncertainty, optional alternatives and missing information. The generated one-finding packet pins its primary citation to that finding. Reference membership is structural grounding, not proof that the explanation faithfully interprets it.

Targeted guards cover known contradictions, invented IDs/URLs/source paths, false completed repairs, unknown-scope success claims, some injection echoes, unsupported meta-description ranking claims, empty-description alternatives, viewport-changing layout fixes and content-hiding overflow code. Positive negation cases are included. These rules do not establish comprehensive semantic validation or injection immunity. Remaining wrong explanations can pass; the evaluation publishes examples.

## Data, compatibility and export

No database schema migration or data-directory change. New finding context and analysis context/reference fields are optional JSON. Old reports/analyses remain readable; they do not gain invented DOM snapshots or citations. Source hashes/prompt identity can require starting a fresh analysis before a new-contract follow-up; historical proposals remain historical.

New scans use `rules-1.6.0`. The element-context service participates in engine provenance. Reports with incompatible execution identities do not gain fabricated score improvements or verified fixes.

Page-analysis Markdown separates observations from model suggestions, includes known reference IDs, measured element context when present, user intent and missing information/alternatives. Code stays an illustrative fenced example, not an executed patch. Reference previews are bounded display excerpts and explicitly mark truncation; the transmitted complete record is still subject to the explicit part budget. Review all text/images before sharing.

No source repository is read, no model is trained, no screenshot vision is shipped and no automatic repair/code execution is introduced. Independent held-out model evaluation, moderated UX testing, full screenreader review, Windows/native packaging and real Google OAuth remain open.
