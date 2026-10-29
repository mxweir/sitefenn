# Changelog

Changes, migrations and tested limits for each release. See [GitHub Releases](https://github.com/mxweir/sitefenn/releases) for publication details.

## 1.4.0 — 2026-10-29

### Technical SEO with context

- Added bounded same-origin XML/gzip sitemap/index import with explicit candidate selection, exclusions, DTD rejection and visible limits. Import alone starts no scan.
- Added the **SEO-Kontext** workspace: directed internal links, timestamped HTTP samples, observed redirect chains and navigation to the canonical finding/action.
- Added per-profile normalized title/description similarity groups across captured documents. They remain heuristic review candidates, without inferred template cause or ranking penalty.
- Added HTML canonical-target checks, Googlebot-aware meta/header noindex parsing and received robots.txt context. Own production noindex conflicts are not imposed on staging/local projects.
- Kept JSON-LD syntax separate from a limited inline BreadcrumbList profile. Unsupported types, unresolved contexts/references and capped captures are explicit unknowns/out of scope.
- Included saved SEO observations in page-analysis context and portable Markdown/JSON. Selected-finding exports restrict SEO snapshots/edges to their pages/profiles and retain related target/group URLs; coverage counters stay explicitly scan-wide. Structured URL fields omit queries/fragments. Text still needs review before sharing.
- Scoped task retests retain SEO mode; a measured matching link pass can verify the requested task. Excluded/restricted/incomplete link scope cannot produce a false full pass.

### Data and verification

Optional SEO report fields require no database schema migration. Existing data paths and historical reports remain unchanged; new checks use `rules-1.4.0` and `technical-seo-1.4`. Parser identities are recorded with execution provenance. Historical comparisons are restricted when identities differ.

86 Node tests and 14 browser tests passed locally, including real HTTP/gzip/XML/Chromium/worker/API and corrected-link retest cases. Type checks, production build, lifecycle smoke and dependency audit passed. See [verification and precise limits](docs/RELEASE-1.4.md).

![Actual 1.4 metadata comparison](docs/screenshots/1.4-metadata.jpg)

<details>
<summary>Link graph and deliberate sitemap scope</summary>

![Actual link observations](docs/screenshots/1.4-seo-links.jpg)
![Actual sitemap selection](docs/screenshots/1.4-sitemap.jpg)

</details>

## 1.3.0 — 2026-10-29

### Visual before and after

- Added side-by-side captures, a keyboard-accessible wipe slider, changed-pixel images and bounded changed-region outlines.
- Added explicit full-scan reference approval and per-capture rectangular masks. New approvals preserve earlier references; masks affect image comparisons only.
- New screenshots record animation suppression, reduced motion, light color scheme, locale/timezone, font readiness and the final document URL. Pixel assessment requires compatible engine/browser/environment, profile, capture metadata and scroll coordinates. Historical unknowns are not fabricated.
- Added a fixed-tolerance local PNG comparison with explicit changed/compared/masked pixel counts, image-size limits and downloadable difference images. Changed pixels are not rule violations.

### Targeted task retests

- Added **Retest this task** using server-derived affected URLs and profiles with bounded supported states. Each run records its source scan/task/finding IDs and its own coverage.
- Matching measured passes can verify the requested task. Omitted pages, changed document destinations, cancelled runs and incompatible execution identities cannot claim a fix.
- Partial runs stay separate from the full project score and default project overview. Their comparisons never invent a project-score delta. Later full checks preserve an existing original verification reference.
- Added scope labels and source navigation to reports/history, partial-scope score labels and export metadata. The visual workspace keeps its actions clear of the floating assistant.

### Data and verification

References use an additive SQLite table included in portable backups; existing projects/reports remain readable and the data directory stays unchanged. Older captures can be viewed, but missing conditions prevent numeric pixel assessment. New rule identity: `rules-1.3.0`.

[Verification and limits](docs/RELEASE-1.3.md)

![Actual 1.3 before-and-after workspace](docs/screenshots/1.3-visual-comparison.jpg)

<details>
<summary>Masked difference image and targeted retest</summary>

![Actual masked difference image](docs/screenshots/1.3-difference-mask.jpg)

![Actual scoped retest](docs/screenshots/1.3-partial-retest.jpg)

</details>

## 1.2.0 — 2026-10-29

### Fix workspace and navigation

- Brought original evidence, observation, action and future acceptance into one fix view.
- Added page/device/category/priority/workflow filters and per-page grouping with individually selectable captured locations.
- Added direct navigation to checks, tasks and visibility; secondary workspaces no longer repeat the home hero/project grid. Workspace switches reset scroll/focus; linked findings open and receive focus.
- Localized new axe findings into German and corrected device labels for captured screenshots. Historical reports retain their original text and identities.

### Explain the selected page

- Added a dedicated Fenn area using the selected page's complete structured report, including pass/fail/unknown checks and numeric-only measurements.
- Added bounded multi-part jobs, persisted progress/history, cancellation, explicit omissions, restart interruption and scan/page/context-bound follow-ups.
- Added concrete steps, cause hypotheses, illustrative code, future retest proposals and Markdown export. Accepted proposals annotate existing tasks without duplicates or verified-fix claims.
- Added exact reference/schema validation, stable model identity checks and one bounded correction attempt. Targeted contradiction guards reject some known factual errors; accepted output remains unverified.

### Compatibility and tested limits

No database migration or data-directory rename. Older reports and saved legacy AI plans remain readable. The real 3B model test produced partial accepted output and factual mistakes; this is an optional assistant, not a validated audit expert. Independent moderated usability validation remains open.

[Verification and limits](docs/RELEASE-1.2.md)

![Actual 1.2 fix workspace](docs/screenshots/1.2-fix-workspace.jpg)

<details>
<summary>The actual page-analysis workspace</summary>

![Actual local page analysis](docs/screenshots/1.2-page-analysis.jpg)

</details>

## 1.1.0 — 2026-10-29

### Reliability and reference evidence

- Fixed covered-control false positives for inert and transparent ancestors, hidden dialogs suppressing inspection, and missed obstructions inside an active dialog.
- Fixed scroll-state overlay coordinates. Regression coverage now verifies below-the-fold element geometry against the saved scroll offset.
- Fixed/sticky occluders are heuristic candidates. Their error assessment remains unknown unless an independent measured failure exists; unknowns do not count as passing checks.
- Added a separate 20-page supplemental synthetic corpus across three profiles, with per-rule TP/TN/FP/FN/unknown counts and repeated resource measurements. This is implementation-authored regression evidence, not independent human accuracy validation.
- Completed nine authorized real-site scans (81/81 planned page/profile steps). Raw reports and screenshots remain local; published results are aggregate only.

### Traceability and compatibility

- New reports record app/engine/library/runtime identities and retain them in exports. Comparisons and checkpoint reuse require matching recorded identities; legacy reports stay readable without fabricated metadata.
- New AI plans record prompt/context hashes and model metadata/weight identity. A changing known model digest rejects the result. Missing weight identity is explicitly unknown.
- Added a reference-basis card, report identity panel and local-AI identity panel.
- Added repeatable benchmark, real local-model smoke, service lifecycle/restart/cancel/resume smoke and a local OAuth protocol feasibility check. No native installer or Google connector is shipped.

### Repository and data

Repository/package renamed to **sitefenn**. The legacy `website-audit-hub` data directory remains unchanged, preserving existing projects. No new database schema migration is required; optional metadata is stored alongside new reports.

[Measured baseline](docs/BASELINE-1.1.md) · [Verification](docs/RELEASE-1.1.md) · [Feasibility decisions](docs/FEASIBILITY-1.1.md)

![Actual 1.1 quality reference](docs/screenshots/1.1-quality.jpg)

<details>
<summary>Execution identity in the actual application</summary>

![Actual 1.1 report identity](docs/screenshots/1.1-provenance.jpg)

</details>

## 1.0.0 — 2026-10-28

### Workspace and checks

- Same-origin page discovery, explicit scope/exclusions and desktop/tablet/mobile profiles.
- Live browser-frame preview, overlays, persisted evidence and bounded scroll sampling.
- Durable jobs, queue controls and compatible completed-step reuse after interruption.
- Measured overflow/covered-control findings and separate text-clipping candidates.
- Automated axe checks, basic technical SEO, runtime observations and optional isolated Lighthouse reference runs.

### Reports and progress

- Grouped tasks with acceptance criteria and distinct manual/retest status.
- Portable Markdown/JSON and opt-in screenshot ZIP exports.
- Deterministic versioned score ranges, coverage and compatible scan comparison.
- German/English Search Console CSV import with metadata and conservative comparisons.
- Portable backup, checksum manifest and command-line restore into a new directory.

### Optional assistant

- Actual Ollama HTTP integration over bounded evidence-backed structured observations.
- Local-backing preflight rejects remote/cloud aliases before transmitting website data.
- Schema/evidence validation, thinking-capability handling, cancellation and resource limits.
- Optional macOS system speech using Anna after explicit activation.
- Real Qwen2.5 integration tested through the built hub; canonical observations remain visible beside unverified model advice. Qwen3 thinking-only validation failure is documented.

### Validation and actual screens

65 Node tests and nine browser tests passed locally, including real Chromium fixtures, Lighthouse and portable restore. See the [verification record](docs/RELEASE-1.0.md) for model failures, fixture scope and external validation still pending.

![Actual 1.0 audit report](docs/screenshots/1.0-report.jpg)

<details>
<summary>Check, checklist and local assistant</summary>

![Actual paused check](docs/screenshots/1.0-live-paused.jpg)
![Actual repair checklist](docs/screenshots/1.0-tasks.jpg)
![Actual local model response](docs/screenshots/1.0-local-ai.jpg)

</details>

### Limits

Trusted-owned-sites-only remains the security boundary. No claim of kernel isolation, full accessibility compliance or guaranteed model correctness. No authenticated journeys, autonomous fixes, vision inference, Google OAuth, SERP scraping, CrUX, cloud sync or native installer.

The package/data identity remains `website-audit-hub`. Older scans stay historical captures; rerun them to get a 1.0 audit report. Historical measurements are not silently upgraded. Back up data before updating.

## 0.1.0 — Foundation

- Local React project dashboard and persistent SQLite records.
- Single desktop capture and title/description/H1 basics.
- Interrupted-job status, optional Ollama availability check and initial tests.
- SiteFenn/Fenn branding with clearly labelled static guidance, not falsely presented model inference.
