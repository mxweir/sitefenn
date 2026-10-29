# SiteFenn 1.1 — Reference baseline and limits

Measured on 2026-10-29. This is implementation evidence, not an independent accuracy certification. The machine was an Apple M5 Pro, 24 GiB RAM, macOS arm64, Node 24.19.0, Playwright 1.64.1 / Chromium 156.0.8078.4, axe 4.14.0 and Lighthouse 13.6.0.

## What changed because of the evaluation

The first supplemental synthetic run exposed false positives for inert controls and transparent ancestors, plus false negatives for blocked controls inside dialogs and hidden dialogs suppressing inspection. Across three profiles these produced six false positives and six false negatives for the covered-control rule. They were corrected and protected by browser regression tests.

Inspection of authorized real-site captures exposed another ambiguity: fixed consent panels and sticky headers can intentionally cover controls. These now produce **heuristic candidates**. If no independently measured failure exists, that rule's error assessment stays **unknown**, including its contribution to score coverage. Such candidates are not quietly promoted to confirmed website defects or passing checks.

Scrolled bounding boxes are now stored in document coordinates, matching the existing image overlay renderer. A new below-the-fold fixture verifies the original element position, saved scroll offset and visible marker position.

## Final synthetic reference

The final dataset `supplemental-layout-1.1-v3` has 20 synthetic pages, three device profiles and two labelled layout conditions per page/profile. It contains **120 distinct expectations**, repeated three times: **360 observations**. Repeats measure consistency, not additional independent cases. Labels were authored by the implementation agent; the set was extended while fixing issues. It is **not a held-out or independently human-labelled benchmark**.

| Rule                |  TP |  TN |  FP |  FN | Unknown / excluded | Total |
| ------------------- | --: | --: | --: | --: | -----------------: | ----: |
| Covered control     |  45 | 117 |   0 |   0 |                 18 |   180 |
| Horizontal overflow |  18 | 153 |   0 |   0 |                  9 |   180 |

Within assessed observations, precision and recall are 1.0 for these narrow labelled conditions. These figures must not be advertised as general SiteFenn or real-world website accuracy. Unknown cases are reported separately and excluded from those fractions.

Each reference run planned 60 page/profile steps. Three intentionally blocked redirect steps remained uncompleted, as expected; completed scope was 57/60. The fixed-overlay case executed but its covered-control error assessment stayed unknown. No skipped execution counted as passed.

The initial and final corpora differ in size, so their percentages are not a controlled before/after performance comparison.

- Dataset SHA-256: `81790d8504263760ed3fe70085164f1dd5e0883151229113eb7c00219868cf49`.
- Source-run engine SHA-256: `41b9e4ba61fe8211076f4b4379ad7b1d348e991cda39cb1e8a5d49a2b3e347a3`.
- Rules: `rules-1.1.0`; profiles: `responsive-1.0.0`.
- [Machine-readable aggregate](baseline-1.1.json), [fixture source](../tests/fixtures/baseline-pages.ts), [regression test](../tests/evaluation.test.ts).

## Authorized real websites

The operator explicitly authorized three websites in this task. Each final run selected three same-origin pages, three profiles and three repetitions: **nine scans and 81/81 completed page/profile steps**.

All scans used bounded GET/HEAD navigation with the existing network policy. No forms, purchases, login, consent clicks or mutations were performed. Discovery and page selection were bounded; this is not a whole-domain audit. Blocking requests can alter application behavior and remains a report limitation.

Full reports, selected URLs and screenshots remain in the operator's ignored `.local-data/baseline-1.1-final/` directory. This public report contains aggregated execution measurements, not per-domain defect reports. Equal findings across repetitions demonstrate limited repeatability, not correctness. No manually validated real-site ground-truth set exists yet.

## Resource and latency measurements

No Lighthouse or model generation ran inside these measured audits. Measurements come from one shared desktop host, without a controlled network or isolated operating system.

| Scope                                               | Runs | Elapsed time per run | Observed summed process RSS peak | Per-run capture→IPC p95 |
| --------------------------------------------------- | ---: | -------------------- | -------------------------------- | ----------------------- |
| Synthetic reference, 60 planned page/profile steps  |    3 | 13.169–13.191 s      | 564.4–564.9 MiB                  | 71–73 ms                |
| Authorized real site, 9 page/profile steps per scan |    9 | 7.802–14.342 s       | 815.0–897.5 MiB                  | 129–183 ms              |

RSS was sampled every 200 ms for the audit worker and observed descendant processes. The sum can double-count shared memory; the sampled maximum can miss shorter peaks. It excludes the hub, UI, Ollama and unrelated processes. This is **not total physical memory or a complete product RAM budget**.

The frame metric measures capture timestamp to worker IPC reception. It excludes HTTP polling, decoding and browser paint. The service lifecycle smoke also records fresh-frame age at actual HTTP receipt with one-second polling, with its sample count. That short demo sample is not a general UI latency benchmark. No hardware-independent response-time guarantee is inferred.

## Provenance and historical compatibility

New reports persist application, engine source hash, browser, rule/profile, Playwright, axe, Lighthouse, Node and platform/architecture identities. Exported JSON/Markdown retains the report identity. Source and compiled distributions have different engine hashes; comparison conservatively requires equal recorded identities.

Changed or missing identities prevent a scored comparison or verified resolution. Old 1.0 reports stay intact and readable, but need new scans for comparisons under the stronger criteria. A resumed checkpoint is reused only with matching recorded execution identity.

New local AI plans persist prompt version/hash, context hash, model metadata hash, weight digest when available, generation configuration and elapsed time. If a known digest changes during generation or cannot be reconfirmed, the result is rejected. Missing digest information is visibly unknown. This establishes provenance, not semantic truth.

## Reproduction

```sh
npm ci
npm run browser:install
npm run check
npm test
npm run build
npm run test:e2e
npm run test:readiness -- .local-data/NEW-readiness
npm run benchmark -- --repeats 3 --output .local-data/NEW-benchmark
```

Output directories must be new for benchmarks. Optional real targets require a local JSON array with `url`, `authorized: true` and an `authorization` record. Only explicitly authorized clean public HTTPS URLs are accepted. Do not put customer targets or reports in Git. To include them:

```sh
npm run benchmark -- --repeats 3 --targets /absolute/path/authorized-targets.json --output .local-data/NEW-authorized-benchmark
```

The optional real-model smoke uses synthetic observations and never downloads weights:

```sh
npm run test:ai-local -- qwen2.5:3b
```

It requires a running local Ollama and suitable installed model. An actual 1.1 run returned one validated referenced recommendation in 3.824 seconds with digest `357c53fb659c5076de1d65ccb0b397446227b71a42be9d1603d46168015c9e4b`. This single run tests identity recording and structured references, not answer accuracy or speed in general.

## Remaining work

Independent human labelling, a separate held-out study, developer usability pilot, full screenreader evaluation, browser-paint latency, whole-product memory budgeting and real Windows installation remain open. The reference matrix assesses two narrow layout rules, not every axe, SEO, runtime or performance rule. The existing wider fixture suite continues as regression coverage.
