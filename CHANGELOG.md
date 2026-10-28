# Changelog

Changes, migrations and tested limits for each release. See [GitHub Releases](https://github.com/mxweir/website-audit-hub/releases) for publication details.

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
