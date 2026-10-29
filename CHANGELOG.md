# Changelog

Changes, migrations and tested limits for each release. See [GitHub Releases](https://github.com/mxweir/sitefenn/releases) for publication details.

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
