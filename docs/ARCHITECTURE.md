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
