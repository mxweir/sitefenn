# SiteFenn 2.0 — release verification

2026-10-30. The user approved **tested local web/CLI software** as the 2.0 release scope, with Google-account, native signing/distribution, real Windows, independent pilot and full screenreader acceptance explicitly open. This document records what was actually exercised; it is not a certification or a claim that all original roadmap aspirations shipped.

## The product delivered across 1.7–2.0

| Release | Concrete addition | Boundary |
| --- | --- | --- |
| [1.7](RELEASE-1.7.md) | Explainable action ordering, selected page reach/project weights; optional read-only Google connector | Real Google account import/revoke unvalidated; CSV remains available |
| [1.8](RELEASE-1.8.md) | Selected developer Markdown packages, explicit read-only Git literal candidates, reproducible CLI gate | No automatic patch/commit/upload or claimed runtime/source mapping |
| [1.9](RELEASE-1.9.md) | Explicit portable web setup/start, manual release checks/backup, protected retention/trash/restore and opt-in running-app schedules | No signed native installer/updater; Windows unvalidated |
| 2.0 | Guided check → evidence → work → retest, exact original captured layout resampling, current contract/resource/integration verification and refreshed documentation | Unknown measurements and AI mistakes remain visible |

## Closed-loop verification

A new real-service test drives a live owned HTTP fixture through **project creation → full worker check → measured overflow → selected source preview/work package → owned source correction → targeted retest → verified task → compatible full check → portable backup/restore**. It asserts that source preview/export did not edit the source, rejects a changed source hash, preserves the original historical finding, records the actual verifying scan and restores the history/tasks into a new directory.

This exposed a genuine usability/verification defect: a layout fix can reduce the natural number of scroll captures, leaving an old grouped finding without its original state label even when both old images represented the same actual position. 2.0 now carries the original selected layout sample coordinates/state identity into the targeted retest (up to 270 selected source samples, at most the three supported regular state labels per page/device). The browser actually revisits them. Capture dimensions and actual measured scroll coordinates still have to match before verification; a clamped/unreachable old coordinate does **not** count as resampled. The comparison proof was not weakened.

A separate real UI/service run on the owned Orbit fixture performed the same correction and displayed **Verifiziert behoben** with its actual retest ID. A subsequent full three-profile check showed no observed overflow, while disabled performance still left an **85–100** score range. These are measurements of this fixture, not a claim every website is correct.

New scans use `rules-2.0.0` and current execution provenance. Historical reports retain their recorded rules and facts; old incompatible scans do not gain invented numeric improvements. No data-directory change or destructive database migration is introduced. Existing legacy-schema restore/migration and future-schema refusal tests remain in the suite.

## Checks at the final source state

- **124/124 Node tests** passed, including real Chromium, persistence/backup, API/security, source handoff, actual CLI regression/fix/error and the new closed-loop service test.
- **20/20 browser tests** passed. New guidance navigates evidence/actions on desktop/mobile and keeps manually reviewed tasks out of the verified counter. Existing tests cover modal keyboard access, state approval, source opt-in and typed permanent-deletion confirmation. This is not full screenreader or independent UX acceptance.
- Type checks, production build, dependency audit (zero reported vulnerabilities), service lifecycle/restore readiness and the 23-case AI output contract passed.
- Portable package validation extracts a fresh source/build ZIP, rejects missing setup, performs explicit locked npm/Chromium setup/build, starts the production service, creates an owned project and backup, stops/restarts and checks persistence. The Chromium installation cache is reusable; this is not a fresh-OS browser-download study. Node/Chromium/models are not bundled. Source/build/tests/docs are allowlisted; private workspaces/credentials are excluded.
- Hosted macOS/Ubuntu CI also runs tests/build, portable setup/start/restart and lifecycle smoke. The **GitHub release links the exact commit's actual remote outcome**; queued jobs are not reported as passed.

## Resource and reference measurements

[Public synthetic benchmark summary](evaluation/benchmark-2.0.json), run on **Apple M5 Pro / 24 GiB, macOS arm64, Node 24.19.0, Playwright 1.64.1, Chromium 156.0.8078.4**. Twenty owned synthetic pages × three profiles × one run, no Lighthouse and no model inference during this run:

| Measurement | Observed |
| --- | --- |
| Whole worker reference duration | 13,989 ms |
| Maximum sampled summed worker/descendant RSS | 655.9 MiB, 69 samples |
| Capture timestamp → worker IPC receipt p95 | 80 ms, 66 frames |
| Planned/completed base views | 60 / 57; three deliberately denied redirects remain unknown |

Summed RSS can double-count shared pages, excludes hub/Ollama/parent and is not exact total physical peak. IPC latency is not UI paint latency. This is one controlled run, not a general hardware guarantee. The implementation-labeled overflow/covered-control expectations matched their supported cases and expected unknowns; no independent or held-out accuracy claim is made. Lighthouse is exercised separately in the test suite, not mixed into these reference numbers. Actual model resource samples remain separately identified in the evaluation artifacts.

## Optional local AI: current successes and remaining failures

Prompt/contract identity is now `page-report-2.0.0`. The **23 authored contract cases** include the previous 20 plus a known false “Rankingfaktor” assertion, the same error in a summary and a supported negation. Their expected outcomes matched. These were written around observed failures by the coding agent, not independently labeled or held out. Old reports/proposals stay historical; a new contract may require a fresh analysis before follow-up.

A real installed **qwen2.5:7b** run on Ollama 0.40.12 processed the same four owned synthetic inference cases; all passed the structural/targeted guards. [Raw structured outputs and review](evaluation/qwen2-5-7b-2.0.json) explicitly record continuing mistakes: the layout summary confuses 696 px document scroll width with the observed 680 px element, proposes an unobserved selector and gives vague unmeasured SEO/click-rate benefits. **Four accepted replies are not four correct replies.**

A second real page worker/API run processed the actual three-profile owned report. It finished **3/4 parts and remained partial** because an error-free-scope assertion in a background part was rejected. The strict optional smoke therefore **failed its complete-result condition**, as intended; it was not silently replaced or counted as a passing model-quality test. Accepted replies/synthesis still included serious semantic mistakes: desktop/tablet overflow was claimed although findings were mobile-only, class `.wide` examples differed from observed ID `#wide`, and one suggestion added a minimum width without removing the observed fixed width. [Actual structured output and semantic review](evaluation/page-run-2.0.json).

No generated suggestion was adopted in these real model checks. Rule-based repair verification worked independently. The local model remains **optional and unverified**; no verified expert/default model, training success, general injection immunity or automatically correct CSS is claimed. The older [three-model evaluation](EVALUATION-1.6.md) remains reproducible from its release tag. Models have separate licenses and weights are not distributed with SiteFenn.

Google's [snippet guidance](https://developers.google.com/search/docs/appearance/snippet) distinguishes possible snippet use from guaranteed display, and the [Search Central explanation](https://developers.google.com/search/blog/2009/09/google-does-not-use-keywords-meta-tag) separately discusses description versus ranking. SiteFenn does not infer business/ranking results from metadata presence.

## Reproduce

```sh
npm ci
npm run browser:install
npm run check
npm test
npm run build
npm run test:e2e
npm run package:portable
npm run test:portable
npm run test:readiness -- .local-data/readiness-2.0
npm run test:ai-contract
npm run benchmark -- --repeats 1 --output .local-data/benchmark-2.0-new
# Optional installed local model; no implicit download:
npm run test:ai-contract -- --model qwen2.5:7b
npm run test:page-ai-local -- qwen2.5:7b
```

Private run outputs stay ignored. Review before sharing reports/screenshots/source snippets; all public 2.0 artifacts use owned synthetic data.

## Still open

- Independent labeled/held-out detection/model evaluation, external five-to-eight-project pilot, moderated UX and full screenreader review.
- Authorized live Google account retrieval/revocation and provider approval/quota validation; other-OS credential stores and CrUX.
- Signed/notarized native desktop packages, bundled runtime/browser delivery, signed automatic update/rollback and a real Windows run.
- Authenticated sessions, arbitrary autonomous actions, source-map/runtime file proof, screenshot vision and automatic source patches.

These are published limits of the approved local web/CLI release, not passed external acceptance criteria.

![Actual 2.0 guided workspace](screenshots/2.0-workspace.jpg)
![Actual task confirmed by a compatible retest](screenshots/2.0-verified-fix.jpg)
![Actual mobile verified-task view](screenshots/2.0-mobile-verified.jpg)
