<p align="center"><img src="public/brand/fenn-flat-v2.png" width="140" alt="Fenn, the SiteFenn fennec companion"></p>

# SiteFenn

**Deine Site. Klarer Blick.** A local-first website audit workspace with Fenn, your fennec companion.

Manage websites you own, inspect desktop/tablet/mobile layouts, collect evidence, and turn observations into a practical repair checklist. The rule-based workflow works without AI. Optional Ollama explanations require a verified locally backed model, not a cloud alias.

The repository and package are now **`sitefenn`**. Existing data stays in the legacy `website-audit-hub` directory so the rename does not reset your projects. Name/domain clearance is still pending.

![SiteFenn 1.2 fix workspace with grouped findings and original evidence](docs/screenshots/1.2-fix-workspace.jpg)

_Actual application, owned synthetic demo. Missing measurements remain unknown._

[Quick start](#quick-start) · [Local AI](#optional-local-ai-and-speech) · [Release verification](docs/RELEASE-1.2.md) · [Changelog](CHANGELOG.md)

## What's new in 1.2

**From evidence to a concrete next step.** The fix workspace brings the original capture, observation, action and acceptance criterion together. Filter by page, device, category, priority and task status; group similar findings while keeping every captured location accessible.

**Explain this page** gives Fenn a dedicated workspace. It processes the selected page's structured report across devices: findings, passed/failed/unknown checks, numeric-only measurements and evidence references. Saved analyses show progress, omissions and failed parts. Ask follow-up questions, copy illustrative code, export Markdown, or attach an unverified proposal to an existing task without creating duplicates.

Small models can still contradict the measurements. Schema checks and targeted contradiction guards catch some failures, not every false statement. A real `qwen2.5:3b` multi-part test produced only a partial accepted analysis; this feature remains an **optional, unverified assistant**. See [1.2 verification and known limits](docs/RELEASE-1.2.md). The earlier [1.1 detection baseline](docs/BASELINE-1.1.md) remains available.

## The workflow

1. **Add a project:** production, staging, or an explicitly authorized local target.
2. **Choose scope:** discover same-origin links, select pages and exclusions, and choose up to three versioned viewport profiles.
3. **Watch the check:** streamed browser frames show bounded scroll samples and finding overlays. This is a preview, not an interactive remote browser or target iframe.
4. **Review evidence:** measured observations, heuristic candidates and optional AI suggestions are separate.
5. **Work the checklist:** related findings are grouped into tasks with acceptance criteria. Export Markdown/JSON or an optional evidence ZIP.
6. **Retest:** compatible scans show changes. A manual checkbox means ready for review; a matching passing check verifies a fix.

The built-in demo is an authorized fixture for trying the workflow without an external website. No external user pilot or security certification is implied; [release verification](docs/RELEASE-1.0.md) lists the actual checks and remaining validation.

<details>
<summary>See the real check and repair workflow</summary>

**Pause between steps and inspect the captured browser state:**

![Actual paused browser check](docs/screenshots/1.0-live-paused.jpg)

**Turn related observations into a checklist with acceptance criteria:**

![Actual grouped repair checklist](docs/screenshots/1.0-tasks.jpg)

**Explain a page, with visible context and partial-result handling:**

![Actual SiteFenn page-analysis workspace](docs/screenshots/1.2-page-analysis.jpg)

</details>

## What gets checked

| Area              | Implemented scope                                                                                            | Limit                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Layout            | Desktop 1440×900, tablet 768×1024, mobile 390×844; bounded scrolling; overflow and covered-control hit tests | A few captured positions, not every interaction. Clipped-text candidates need review.      |
| Accessibility     | axe automated WCAG-tagged checks and affected elements                                                       | Not a complete WCAG audit; semantic and incomplete cases need human judgement.             |
| Technical SEO     | Title/description presence, production noindex indication, canonical syntax, JSON-LD parseability            | Not a ranking prediction, full SEO crawler, schema-eligibility test, or proof of indexing. |
| Runtime           | Document status, observed script errors and failed own-origin resources                                      | Not a comprehensive functional/security test.                                              |
| Performance       | Optional separate Lighthouse desktop/mobile reference runs, one or three repetitions                         | Local lab data, not field Core Web Vitals. Tablet is a layout profile.                     |
| Google visibility | German/English Search Console CSV with provenance and conservative comparisons                               | Historical exported rows, not a universal live Google rank.                                |

### An explainable score

The **audit score for the captured scope** uses versioned rules: layout 25%, automated accessibility 20%, technical SEO 25%, runtime 15%, performance 15%. The LLM does not assign points.

Passed checks add known credit; failures do not; missing checks stay unknown. Incomplete runs show a range and coverage, not a pretend final score. Disabled performance does not give free points. Ignoring a finding or accepting its risk does not improve the raw score.

Score deltas require compatible rules, browser/profiles and page-state cohorts. Missing pages are not fixed pages. Critical measured findings remain visible separately. A 100 score does not certify accessibility, SEO success, or untested pages.

## Quick start

Requirements: **Node.js 24**, npm and Playwright Chromium. Ollama is optional.

```sh
git clone https://github.com/mxweir/sitefenn.git
cd sitefenn
npm ci
npm run browser:install
npm run dev
```

Open [http://127.0.0.1:4310](http://127.0.0.1:4310) and choose **Demo laden**, or add a trusted website you are authorized to test. Linux may require `npx playwright install --with-deps chromium` with appropriate OS privileges.

On recent Ubuntu versions, downloaded Chromium may also need a suitable AppArmor user-namespace profile. If startup reports `No usable sandbox`, follow the [official Chromium sandbox guidance](https://github.com/chromium/chromium/blob/main/docs/security/apparmor-userns-restrictions.md) for your system. SiteFenn keeps Chromium's sandbox enabled and does not change your host policy automatically. The repository's sandbox setup script is exclusively for ephemeral GitHub-hosted CI runners.

For the built local application:

```sh
npm run build
npm start
```

Stop the development process first if it uses the same port. `PORT` defaults to `4310`; binding remains loopback. Never expose this single-user app through a public tunnel or reverse proxy.

## Optional local AI and speech

Install/run Ollama separately, explicitly download a suitable model, and select it in settings. The hub does not download or train models, change global Ollama settings, or enable cloud inference automatically.

The integration was exercised with `qwen2.5:3b` (approximately 1.9 GB, Q4_K_M). It is lightweight, but the full-page test exposed semantic errors; it is not a verified audit expert. If you still want to try it and its separate license fits your use, download it explicitly:

```sh
ollama pull qwen2.5:3b
```

The 3B model uses the **Qwen Research License, not this app's MIT license or Apache 2.0**; read the [official model information and license](https://ollama.com/library/qwen2.5:3b). Model weights are not bundled with SiteFenn.

On 2026-10-29, the multi-part page-report test on an M5 Pro/24 GiB exposed contradictory summaries and unsuitable retest criteria from this 3B model. Targeted guards rejected such parts. Correctly shaped JSON and known finding IDs **do not prove factual correctness**. The tested `qwen3:4b` thinking-only variant previously failed its structured-output budget; it is not an established replacement. Model quality needs further evaluation.

- Fixed endpoint: `http://127.0.0.1:11434`.
- Local-backing metadata is checked before sharing observations; remote-backed aliases, cloud tags and unverifiable locality are rejected.
- The selected page's structured report is processed in **up to 24 parts**, each with an 8,500-character record budget and at most two findings. This includes numeric-only performance findings. Oversize individual records and the part limit produce explicit omissions and a partial result.
- No screenshot images, raw page dump, source repository, cookies or browser-control tools are supplied.
- Each part has a bounded provider request, schema/reference checks and one correction attempt for invalid output. The overall job has a ten-minute limit. Failed parts remain visible; there is no cloud fallback or canned replacement answer.
- Progress and accepted partial answers persist. A restart marks unfinished analyses interrupted; run a new analysis to complete them. Follow-ups stay bound to the same scan/page/context hash.
- Proposals stay unverified. Adopting one annotates an existing task, does not execute code or mark it fixed, and does not change scores. Historical verified tasks are preserved.
- Optional real-model smoke: `npm run test:page-ai-local`. It exits unsuccessfully for partial/failed output and leaves private diagnostics in ignored `.local-data/`. This is separate from deterministic CI tests using a mocked provider.

The integration is text-based; screenshot vision analysis is not implemented. Thinking-only models can require much larger inference budgets and may fail validation within the bounded request. Do not interpret model availability as a quality benchmark.

On macOS, selected text can be read through system `say` using Anna after explicit activation. The voice must be available on your system. Speech is off by default and can be stopped; this is not a cloud voice service. Other platforms currently lack this integration.

## Google visibility: bring your own CSV

Export a supported Search Console performance table and specify its property, inclusive ISO date range, dimension and filters. Supported dimensions: date, page, query, country, device. Each import is one table, not a join across independent exports. UI file limit: 2 MiB.

Common German/English headers, decimal formats and quoted comma/semicolon CSV are supported. Unknown filters remain unknown. Totals are explicitly labelled exported-row subsets; average position is not incorrectly averaged into a fake property rank. Comparable daily exports can show equal-length period changes.

No Google OAuth, automatic SERP scraping, paid rank tracker or CrUX integration is included. Google visibility is separate from the audit score. CSV processing itself does not contact Google.

## Reports and privacy

Markdown/JSON reports work without the hub. ZIP screenshots are **opt-in**. Locations omit URL queries/fragments, but arbitrary page-derived text can still reveal secrets; review all text and images before sharing with another person or AI.

Exports distinguish observations, recommendations, acceptance criteria and limits. With no source repository attached, exact filenames, line numbers and root causes are not verified. Website-derived strings are untrusted data, not instructions for another AI to execute.

## Local data and backups

| Platform | Default directory                                                                |
| -------- | -------------------------------------------------------------------------------- |
| macOS    | `~/Library/Application Support/website-audit-hub`                                |
| Linux    | `$XDG_DATA_HOME/website-audit-hub`, otherwise `~/.local/share/website-audit-hub` |
| Windows  | `%LOCALAPPDATA%/website-audit-hub`                                               |

`HUB_DATA_DIR` selects another directory. Projects, scans, evidence, tasks, saved page analyses, settings and imported search data stay local, but are not encrypted by this app.

The UI can create a portable backup while no scan/analysis is active: database snapshot, evidence and checksum manifest. Limits: 250 MiB and 2,000 evidence files. For larger workspaces, stop the app and back up the full data directory normally.

Restore into a **new, nonexistent directory**:

```sh
npm run restore -- /absolute/path/sitefenn-backup.zip /absolute/path/NEW-workspace
```

Stop the old hub before starting with `HUB_DATA_DIR` pointing at the restored directory. Paths, limits, checksums and database integrity are validated. Hashes detect corruption, not trustworthy authorship. Restore only trusted backups and keep the old workspace until the restored copy is checked.

## Safe use and boundaries

**Trusted websites you own/administer only.** Proxy/DNS checks, local session protections and bounded jobs reduce risk but are not kernel isolation or a guarantee against hostile websites and browser vulnerabilities. Loading a page can itself cause side effects.

Public targets use standard HTTP(S) ports. Local mode explicitly authorizes one origin, not the private network in general; the hub and Ollama ports are not valid local project targets. No authenticated sessions, autonomous form submissions, purchases, destructive actions or automatic repairs are provided.

Live checks do not explore every menu, dialog, login or user journey. Chromium emulation is not a Safari/iPhone test. macOS/Linux automation does not establish Windows stability. Read [SECURITY.md](SECURITY.md).

## Development and contribution

```sh
npm run check
npm test
npm run build
npm run test:e2e
```

Tests cover pure services, API/persistence/security, owned browser fixtures and end-to-end flows. Fixture success is not proof that every website works. Mocked model adapters and real-model checks must be reported separately.

- [Contributing](CONTRIBUTING.md)
- [Stack](docs/STACK.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Changelog](CHANGELOG.md)
- [Original 1.0 plan](PLAN-1.0.md) — design intent, not evidence every aspiration shipped
- [Brand guide](docs/branding/BRAND.md)

## License and attribution

MIT; see [LICENSE](LICENSE). Dependencies, Chromium, local models and website content retain their own licenses. The app license grants no rights to republish someone else's website screenshots.

Archivo Black and DM Sans are locally bundled under SIL OFL 1.1; see [public/licenses](public/licenses). Fenn's generated illustration and provenance are documented in [docs/branding](docs/branding). No proprietary font files or existing mascot artwork from the style reference are included.
