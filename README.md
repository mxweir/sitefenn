<p align="center"><img src="public/brand/fenn-flat-v2.png" width="140" alt="Fenn, the SiteFenn fennec companion"></p>

# SiteFenn

**Deine Site. Klarer Blick.** A local-first website audit workspace with Fenn, your fennec companion.

Manage websites you own, inspect desktop/tablet/mobile layouts, collect evidence, and turn observations into a practical repair checklist. The rule-based workflow works without AI. Optional Ollama explanations require a verified locally backed model, not a cloud alias.

The repository and package are now **`sitefenn`**. Existing data stays in the legacy `website-audit-hub` directory so the rename does not reset your projects. Name/domain clearance is still pending.

![SiteFenn 1.6 measured element context beside original evidence](docs/screenshots/1.6-element-context.jpg)

_Actual application, owned synthetic demo. Missing measurements remain unknown._

[Quick start](#quick-start) · [Local AI](#optional-local-ai-and-speech) · [Release verification](docs/RELEASE-1.7.md) · [Changelog](CHANGELOG.md)

## What's new in 1.7

**Work on the right fixes first.** Open the actions workspace's work-priority view, explicitly choose page reach and adjust project weights. The view explains its ordering, keeps missing reach unknown and leaves the Audit-Score intact. Low-CTR/high-impression rows become investigation candidates.

Search Console CSV remains available. An optional **experimental read-only Google connector** adds bounded direct imports with Desktop OAuth/PKCE and macOS Keychain storage. Real account authorization/import/revocation remains unvalidated; other platforms keep CSV. [Setup, checks and limitations](docs/RELEASE-1.7.md).

![Actual 1.7 priorities — owned synthetic metrics](docs/screenshots/1.7-priority-results.jpg)

## What's new in 1.6

**Give Fenn better evidence, and keep its limits visible.** New scans capture bounded computed styles and geometry for uniquely observed elements. Page explanations keep each finding with its related rules/evidence/state, accept optional page purpose/user goal/audience, and can include existing task snapshots and a compatible earlier check.

New proposals show known evidence references, possible relevance, hypotheses, concrete steps, optional alternatives, missing information and an illustrative code example. A known reference is **not proof that the explanation is true**. Targeted guards reject several observed contradictions; unknown, rejected and omitted records remain explicit.

The page-analysis path requires **Ollama 0.40.0+** and disables native prompt truncation/context shifting. Oversized provider context fails visibly. The published [1.6 evaluation](docs/EVALUATION-1.6.md) separates contract fixtures, real local-model output and remaining factual errors. Models stay optional; canonical reports/tasks work without them.

[Release checks and budgets](docs/RELEASE-1.6.md) · [Versioned test corpus](tests/fixtures/page-eval-1.6.json)

<details>
<summary>Actual 1.6 page interpretation and mobile evidence</summary>

![Actual completed processing, still unverified](docs/screenshots/1.6-page-analysis.jpg)
![Actual partial-result handling](docs/screenshots/1.6-partial-analysis.jpg)
![Actual 390 px evidence view](docs/screenshots/1.6-mobile.jpg)

</details>

## The workflow

1. **Add a project:** production, staging, or an explicitly authorized local target.
2. **Choose scope:** discover same-origin links or import sitemap candidates, select pages and exclusions, and choose up to three versioned viewport profiles.
3. **Optionally approve page states:** define the start page, devices, UI/scroll actions and expected results; review the preview before approving.
4. **Watch the check:** streamed browser frames show bounded scroll samples and finding overlays. This is a preview, not an interactive remote browser or target iframe.
5. **Review evidence:** measured observations, heuristic candidates and optional AI suggestions are separate.
6. **Work the checklist:** related findings are grouped into tasks with acceptance criteria. Export Markdown/JSON or an optional evidence ZIP.
7. **Retest:** launch a scoped task retest or another full check. A manual checkbox means ready for review; an explicit compatible passing check verifies a fix.
8. **Compare visually:** choose a saved reference, inspect paired page/device/scroll captures, explicitly mask regions and review changed pixels separately from rule findings.

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

## Explain a page with evidence

In **Seite erklären → Analyse ausrichten**, optionally add the page's purpose, the user's goal and audience. Include the existing task snapshot and choose a compatible earlier full check when useful. **Diesen Befund erklären** sets that finding as the first analysis focus while retaining the rest of the page report.

Each explanation is displayed beside the canonical observation and its future acceptance criterion. Open **Belegverweise ansehen** for the referenced record excerpt, and inspect the original evidence/DOM measurements. References are checked against the transmitted records; causes, code and business impact remain unverified proposals. **Noch zu klären** makes missing source/context explicit.

New element context includes allowlisted computed styles, dimensions and immediate-parent styles. No raw HTML, page text, input values, arbitrary DOM attributes or screenshot images are added to this context. Selectors and other original report strings can still contain private content; review exports before sharing. Ambiguous or capped element context is marked unavailable rather than guessed.

A large report is split into bounded parts, with omissions listed. Page analyses never replace measurements or the score. Follow-ups retain the saved measurement/intent/task/comparison snapshot. Adopting a reviewed proposal annotates the existing task, keeps it open and avoids duplicates. A new compatible rule-based retest is still needed to verify a fix.

## Approved page states

In **Übersicht → Seitenabläufe**, choose a selected start page and devices, then add up to five steps. Supported actions are a declared UI switch and a vertical scroll position. Each step states a target and an expectation: rendered visible/hidden, or a native details/dialog open/closed. The preview shows the complete sequence and stop conditions. Approve the recipe explicitly; editing it revokes approval. Starting a check is disabled while a recipe is unapproved.

Selectors are deliberately small: `#id`, `[data-testid="…"]` or `[aria-label="…"]`. Clicks support native `button type="button"` controls with `aria-controls` and disclosure/dialog semantics, or a `summary` controlling its own `details`. Links, forms, arbitrary scripts, login and transactional actions are outside this feature. Navigation is the explicit fresh start page per recipe, not autonomous multi-page exploration.

In **Seitenzustände**, inspect the saved sequence, before/after images and findings for each step. Opening a finding leads to its rule, screenshot and repair criterion. **Retest this task** retains the relevant recipe and checks the same state identity. A partial run does not replace the full-project score.

![Actual approved state evidence](docs/screenshots/1.5-state-evidence.jpg)

<details>
<summary>Editor, mobile layout and corrected-state retest</summary>

![Actual recipe preview and approval](docs/screenshots/1.5-journey-editor.jpg)
![Actual mobile state report](docs/screenshots/1.5-mobile.jpg)
![Actual corrected-state retest](docs/screenshots/1.5-state-retest.jpg)

</details>

Each recipe/device starts in a fresh browser context. Up to three recipes, five steps each and 18 step/device combinations are allowed. A 30-second execution deadline closes that recipe's context; start navigation has its own bounded timeout. Missing/ambiguous controls, unfulfilled expectations, blocked requests or URL changes stop the remaining steps. Before/after images and records remain local; sharing exports needs review. Approval of a recipe is not proof its site's JavaScript has no side effects. Use authorized trusted sites only. See [precise boundaries and tests](docs/RELEASE-1.5.md).

## Technical SEO in context

In **Übersicht**, expand **Seiten aus einer Sitemap auswählen** and import an XML or gzip sitemap from the authorized origin. Bounded sitemap indexes are supported. Newly imported candidates stay unchecked: importing does not start a browser scan. Choose pages and enable **SEO-Kontextprüfung** before starting. This adds bounded GET requests to internal targets, explained beside the checkbox.

In **SEO-Kontext**, filter by captured page/device or search the observed URLs/text:

- **Links & Redirects:** directed source → target edges, timestamped GET samples, HTTP errors and observed redirect hops. Open the original finding and its acceptance criterion directly.
- **Metadaten im Vergleich:** title/description snapshots and normalized similarity groups within the same captured device profile. Related findings are grouped into repair tasks; a shared template cause is not inferred.
- **Canonical & Robots:** captured HTML canonical values, target availability/noindex samples and a bounded Googlebot interpretation of the received robots.txt. Production intent is kept distinct from staging/local intent.
- **Strukturierte Daten:** JSON syntax separately from a narrow inline schema.org BreadcrumbList profile. Other schema types and unresolved contexts/references are not validated.

![Actual internal link graph and redirect observations](docs/screenshots/1.4-seo-links.jpg)

<details>
<summary>Sitemap selection in the actual application</summary>

![Imported candidates remain unchecked](docs/screenshots/1.4-sitemap.jpg)

</details>

HTTP sampling is limited to 40 target URLs, 60 request attempts including redirect hops/robots, and 90 seconds; individual requests have a five-second deadline. Only the approved origin and paths may be contacted. Samples are unauthenticated and target HTML is not executed. The graph is partial: zero observed incoming edges do not prove an orphan page. Robots is neither access control nor proof of Google's indexing. See the [full budgets and methodology](docs/RELEASE-1.4.md).

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
| Layout            | Desktop 1440×900, tablet 768×1024, mobile 390×844; bounded scrolling and explicitly approved UI states; overflow and covered-control hit tests | A few captured positions, not every interaction. Clipped-text candidates need review.      |
| Accessibility     | axe automated WCAG-tagged checks and affected elements                                                       | Not a complete WCAG audit; semantic and incomplete cases need human judgement.             |
| Technical SEO     | Metadata presence/similarity, internal link/redirect samples, canonical/robots context, JSON syntax and limited Breadcrumb profile            | Not a ranking prediction, full SEO crawler, schema-eligibility test, or proof of indexing. |
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

The 1.2 tests exposed factual contradictions from the 3B model; 1.6 adds explicit style context, known references, narrower inference packets and targeted regression guards. Real small-model failures remain published in the [1.6 evaluation](docs/EVALUATION-1.6.md). Guard acceptance, valid JSON and model availability do not establish factual reliability. Weights are not bundled with SiteFenn. The Qwen3 4B variant used here is thinking-only; its larger bounded page-inference profile is recorded in provenance.

- Fixed endpoint: `http://127.0.0.1:11434`.
- Local-backing metadata is checked before sharing observations; remote-backed aliases, cloud tags and unverifiable locality are rejected.
- The selected page's structured report is processed in **up to 24 parts**, each with an 8,500-character record budget and at most two findings. This includes numeric-only performance findings. Oversize individual records and the part limit produce explicit omissions and a partial result.
- No screenshot images, raw page dump, source repository, cookies or browser-control tools are supplied.
- Each part has a bounded provider request, schema/reference checks and one correction attempt for invalid output. The overall job has a ten-minute limit. Failed parts remain visible; there is no cloud fallback or canned replacement answer.
- Progress and accepted partial answers persist. A restart marks unfinished analyses interrupted; run a new analysis to complete them. Follow-ups stay bound to the same scan/page/context hash.
- Proposals stay unverified. Adopting one annotates an existing task, does not execute code or mark it fixed, and does not change scores. Historical verified tasks are preserved.
- Contract regressions: `npm run test:ai-contract` (no model required). Optional real-model comparison: `npm run test:ai-contract -- --model <installed-tag>`; raw synthetic outputs stay in ignored `.local-data/`.
- Optional real-model smoke: `npm run test:page-ai-local`. It exits unsuccessfully for partial/failed output and leaves private diagnostics in ignored `.local-data/`. This is separate from deterministic CI tests using a mocked provider.

The page-analysis path needs Ollama 0.40.0+ for explicit no-truncation/no-shift requests; old or unverifiable versions fail before report transmission. The integration is text-based; screenshot vision analysis is not implemented. Thinking-only models can require much larger inference budgets and may fail validation within the bounded request. Do not interpret model availability as a quality benchmark.

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
