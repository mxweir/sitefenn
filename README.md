<p align="center"><img src="public/brand/fenn-flat-v2.png" width="140" alt="Fenn, the SiteFenn fennec companion"></p>

# SiteFenn

**Deine Site. Klarer Blick.** A local-first website audit workspace with Fenn, your fennec companion.

Manage websites you own, inspect desktop/tablet/mobile layouts, collect evidence, and turn observations into a practical repair checklist. The rule-based workflow works without AI. Optional Ollama explanations require a verified locally backed model, not a cloud alias.

The repository and package are now **`sitefenn`**. Existing data stays in the legacy `website-audit-hub` directory so the rename does not reset your projects. Name/domain clearance is still pending.

![SiteFenn 1.3 visual before-and-after comparison](docs/screenshots/1.3-visual-comparison.jpg)

_Actual application, owned synthetic demo. Missing measurements remain unknown._

[Quick start](#quick-start) · [Local AI](#optional-local-ai-and-speech) · [Release verification](docs/RELEASE-1.3.md) · [Changelog](CHANGELOG.md)

## What's new in 1.3

**See what changed. Retest what matters.** Compare saved captures side by side, reveal them with a keyboard-accessible wipe slider, or highlight changed pixel regions. Explicitly approve a full scan as your visual reference and save rectangular masks for regions you want to exclude from future image comparisons.

**Retest this task** creates a separate scan for its affected URLs and device profiles. An explicit matching passing rule can verify the requested task; an omitted page cannot. Partial runs are labeled and keep their own coverage. They do not replace the full project score or produce a project-score improvement.

Changed pixels are **not detected website errors**. Missing capture metadata, changed environments/browsers, unsettled fonts or different scroll coordinates prevent a numeric pixel comparison. Reference approval does not close rule-based findings. See [1.3 verification and limits](docs/RELEASE-1.3.md).

The [1.2 fix workspace and report-per-page assistant](docs/RELEASE-1.2.md) remain available. Local AI remains optional and unverified; the tested small models were not established as reliable full-page advisors.

## The workflow

1. **Add a project:** production, staging, or an explicitly authorized local target.
2. **Choose scope:** discover same-origin links, select pages and exclusions, and choose up to three versioned viewport profiles.
3. **Watch the check:** streamed browser frames show bounded scroll samples and finding overlays. This is a preview, not an interactive remote browser or target iframe.
4. **Review evidence:** measured observations, heuristic candidates and optional AI suggestions are separate.
5. **Work the checklist:** related findings are grouped into tasks with acceptance criteria. Export Markdown/JSON or an optional evidence ZIP.
6. **Retest:** launch a scoped task retest or another full check. A manual checkbox means ready for review; an explicit compatible passing check verifies a fix.
7. **Compare visually:** choose a saved reference, inspect paired page/device/scroll captures, explicitly mask regions and review changed pixels separately from rule findings.

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

## Visual references and targeted retests

In **Vergleich**, choose two completed scans and load their image pairs. Each pair records its page, viewport, state, scroll coordinates and capture conditions. Use **Nebeneinander**, **Wischregler** or **Änderungsbereiche**. The diff uses a fixed 24/255 per-channel tolerance and marks changed 32 px tile regions; this is a simple local pixel comparison, not AI vision or a perceptual-quality score.

Mask by dragging on the before image or entering an integer rectangle in original screenshot pixels. At most 30 masks are allowed per reference. They affect both images of that capture state, not the scan or rule checks. The result reports excluded pixels and the remaining comparison denominator; an entirely masked image is not assessed. Approve the baseline and masks explicitly to save a new reference record. Earlier approvals remain available (up to 50 per project).

From **Maßnahmenplan**, select **Diese Maßnahme nachtesten**. The server derives scope from the original findings; it does not discover extra pages. The affected page/device combinations run the existing bounded initial/scroll checks. Performance tasks request lab runs for the selected supported device profiles. A matching completed rule pass can verify the requested task; changed document destinations, missing coverage or incompatible identities do not. Scroll findings still need their captured position to have been sampled again. Partial results and their source task are recorded in history and exports.

![Actual masked pixel comparison](docs/screenshots/1.3-difference-mask.jpg)

<details>
<summary>A targeted run keeps a distinct scope and score</summary>

![Actual targeted retest report](docs/screenshots/1.3-partial-retest.jpg)

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

`HUB_DATA_DIR` selects another directory. Projects, scans, evidence, tasks, saved page analyses, visual references/masks, settings and imported search data stay local, but are not encrypted by this app.

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
