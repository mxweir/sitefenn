# Architecture

SiteFenn is a single-user local app for trusted authorized websites, not an arbitrary-hostile-URL scanning service.

## Flow and records

React uses a local-session Fastify API. Project scope/options are validated and persisted. Discovery yields same-origin candidates; the selected bounded scope becomes a durable scan. Playwright loads pages through the audit network policy, captures defined viewport/scroll states and emits progress, transient preview frames and persisted evidence. SEO/axe/runtime/geometry produce structured findings. Separate Lighthouse reference runs happen after the inspected browser closes. Pure services score, compare and export; optional Ollama produces a separate interpretation.

Projects own scans and search imports. Audit reports record options, rule/profile/browser versions, page runs, weighted rule instances, findings, evidence, performance samples, coverage and warnings. Tasks reference findings; AI plans do not replace raw facts. SQLite and evidence live outside the checkout. Legacy scans retain their historical scope.

Restarted work is not marked successful. Compatible completed page/viewport checkpoints may be reused on resume; this does not restore an exact live browser state.

## Score and comparison

Measured, heuristic and AI evidence statuses stay distinct. Fixed category weights are layout 25, accessibility 20, SEO 25, runtime 15, performance 15. For applicable rule weight `D`, passed weight `P`, unknown weight `U`:

- Lower: `100 × P / D`.
- Upper: `100 × (P + U) / D`.
- Coverage: `100 × (D − U) / D`.

Missing categories are unknown, not passed. No applicable measurements is not assessable. All mandatory categories must have known applicable measurements for a final single score. Accepted risks and model opinions do not add points. Layout has a fixed per-page/viewport rule budget, preventing extra scroll samples from inflating scores.

Score deltas require matching rules, profiles, browser, options, planned rule weights and page-state cohort. A missing finding alone is not a fix: matching explicit PASS and completed coverage are required. Scroll findings additionally require equivalent captured coordinates; `scroll-2` at a new location does not qualify. Axe sub-rules use the aggregate automated check. Performance uses matching successful numeric samples rather than screenshot evidence. Manual task completion is ready-for-review, not verified.

## Visual references and partial retests (1.3)

Visual references are immutable approval records (`visual_references`): project, source full scan, approval timestamp and up to 30 screenshot-bound rectangles. They are stored in SQLite and included in portable snapshots. Approval does not accept rule findings or alter task statuses. Original PNGs are retained unchanged.

Evidence records carry optional capture conditions. Visual pairing uses exact page/profile/state plus compatible recorded engine/browser/environment, final document URL, font readiness, dimensions and scroll offsets. Historical missing metadata is unknown. Incompatible captures may be viewed beside one another, but receive no numeric pixel result.

A bounded PNG decoder (20 MiB input, 4,096 px per axis, 12 million pixels) compares four channels using a fixed 24/255 tolerance. Explicit masks are applied to both captures; the denominator excludes their union. Entirely masked images are refused. Changed 32 px tiles are merged into at most 50 displayed region boxes; the pixel count remains complete. This is neither DOM interpretation nor perceptual/AI defect detection. Images are transiently computed; original evidence is not overwritten.

A task-retest endpoint derives pages/profiles from stored findings and records `options.retest` with the source scan/task/finding IDs. The existing worker runs supported initial/scroll samples and optional selected lab profiles. No new interactive/authenticated journey is introduced. For task verification, completed runs must share execution identity and matching rule evidence. Omitted findings remain not retested; document destinations and captured scroll positions must match. Only the requested task may be verified by that targeted run, and an existing historical verification pointer is preserved.

The project overview, cards and active full-plan defaults exclude partial retests. Partial scores are labeled, exports preserve scope and source, and comparisons with a partial run never emit a project-score delta. A separate full scan remains necessary for a full-project assessment.

## Browser and API boundaries

The browser executes website JavaScript. The audit proxy checks destinations, pins permitted resolved addresses and constrains egress. Public targets use standard HTTP(S) ports; local mode explicitly authorizes its one origin, not the whole private network. Discovery remains within selected origin/exclusions.

This is not kernel/network-namespace isolation or proof against every browser/network escape. Trusted targets remain required. Even navigation can cause side effects on badly designed sites. No form submissions, authenticated journeys, payments or destructive automation are provided.

Loopback Host/Origin checks, HttpOnly SameSite sessions and mutation headers constrain API access. They do not establish remote multi-user authentication. Do not publish the port.

## Model boundary

Only loopback Ollama is used. Before website observations are transmitted, `/api/show` must report a local architecture without remote targets. Cloud tags, remote aliases and unverifiable metadata fail closed. A trusted local Ollama installation is assumed; no global configuration is silently changed and no model is downloaded by the hub.

The 1.2 page-analysis workspace uses all structured records for the selected report page: page runs, pass/fail/not-run rules, evidence metadata (without file paths), performance, warnings and findings. Observation and future acceptance are explicitly separated in the model context. Context hashes bind follow-ups to the same measurement. The legacy selected-finding endpoint remains readable for older clients/history.

Record batches have an 8,500-character budget, at most two findings and 24 parts. Oversized records/extra parts are explicit omissions. Local Ollama calls use 8,192 context tokens, bounded generation, a 90-second provider timeout and a ten-minute total job deadline. Validated successful summaries participate in bounded hierarchical synthesis. One correction attempt is allowed for invalid part output; provider failure does not loop indefinitely. Known model-weight identity cannot change between parts.

Replies require exact known finding IDs and schema fields; targeted contradiction guards reject a few known false claims. These guards are deliberately not described as comprehensive semantic validation. All accepted advice remains unverified and can be wrong. No screenshot vision, source repository, tools, shell or autonomous browser actions are provided. Website strings and prior answers remain untrusted input.

Page analyses use discriminated JSON records in the existing `ai_plans` table; no database migration is needed. Progress persists per part; restarts mark unfinished jobs interrupted while retaining accepted parts. Analyses serialize with scans/discovery/backups. Adoption annotates the existing canonical task, preserves the measured report and cannot claim a verified fix. Markdown escapes prose and fences illustrative code; consumers must review it before use.

## Search, export and backup boundaries

Search datasets are separate from scoring and preserve property, dates, dimension, filters and import time. Unknown filters remain unknown. Exported-row subsets are not fabricated property totals; positions are not averaged naively or unrelated dimensions joined. No OAuth/SERP/CrUX integration is present.

Reports are portable Markdown/JSON. Screenshots are explicit opt-in ZIP artifacts with allowlisted relative paths. Location URLs omit queries/fragments, but arbitrary text is not guaranteed secret-free. Review before sharing.

Backups snapshot SQLite and evidence with checksums under bounded limits. Restore checks paths, size, manifest and database integrity and writes only into a new directory. Checksums are not authenticity or encryption. Keep old data until the restored copy is checked.

## Known coverage limits

Three standard viewport profiles and bounded scroll samples do not cover every state. Interactive/authenticated flows and vision inference are absent. Automated accessibility is incomplete; Lighthouse is lab measurement. Chromium emulation does not establish Safari/device behavior. No external pilot or independent security audit is implied.

## Technical SEO context (1.4)

`technicalSeo` is an optional persisted scan option. After selected browser captures, a bounded HTTP phase correlates their metadata/anchors with samples in the approved origin. Failed/cancelled/uncaptured pages cannot gain fabricated passes. New rules are seeded before capture; compatible resume retains completed snapshots and redoes bounded context sampling. Task retests inherit the source option.

`seo-network.ts` reuses `resolvePinnedTarget`, pins each approved DNS result for the connection, validates every redirect against origin/path/network policy, and applies per-request/global budgets. `sitemap.ts` uses strict namespace-aware saxes XML with no DTD/external entities; explicit import returns candidates without starting scans. `seo-meta.ts` parses raw target HTML with parse5, handles Googlebot noindex scope and the limited inline Breadcrumb profile. `technical-seo.ts` builds directed observed edges, per-profile duplicate candidates, robots-parser context and rule outcomes. Raw target HTML is not executed or retained. See [1.4 verification](RELEASE-1.4.md) for exact caps and methodological limits.

SEO snapshots/probes/graph/groups are optional JSON report fields; no database migration. Their parser versions and all new service sources participate in provenance. Measured HTTP failures, heuristic review candidates and unknown target/metadata scope remain distinct in scoring, tasks and the dedicated UI. Page-analysis context includes bounded SEO units; no new model/tool execution ability is added. Selected-finding exports restrict snapshots/edges while preserving related target/group URLs and scan-wide coverage; URL sanitization does not guarantee arbitrary text is secret-free.
