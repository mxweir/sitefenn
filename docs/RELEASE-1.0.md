# SiteFenn 1.0 release verification

Date: 2026-10-28. This records tests actually run, not an independent certification.

## Environment and scope

- Local macOS, Apple M5 Pro, 24 GiB RAM; Node.js 24.19.0.
- Pinned Playwright Chromium, axe-core and Lighthouse from the lockfile.
- Trusted owned fixtures and the built-in three-page Northstar demo.
- Local single-user application; the existing package and data identity is retained.

## Automated checks

`npm run check`, `npm test`, `npm run build`, `npm run test:e2e`.

Local result: **65/65 Node tests**, **9/9 browser tests**, typecheck and production build passed. `npm audit --omit=dev --audit-level=high` reported zero production vulnerabilities. CI results are available in the repository Actions history; they are separate from this local test record.

Coverage includes URL/origin restrictions, DNS-pinned proxy behavior, excluded redirects, local API session/CSRF protection, schema migration and backup/restore corruption checks, deterministic scoring and unknown bounds, conservative comparison, report export privacy, Search Console parsing, model locality/output validation, worker pause/resume/cancel and checkpoint reuse.

The engine runs **20 labelled browser fixtures**. A narrow internal layout regression matrix contains eight pages × two rules: two true positives, fourteen true negatives, zero false positives and zero false negatives. These cases were used during implementation; they are **not a held-out benchmark**, and do not establish 95% accuracy on real websites.

The performance test executes real separate Lighthouse desktop/mobile reference runs. Its successful execution demonstrates the integration, not stable field performance or a speed guarantee. Browser tests include a real three-page × three-profile demo, reload persistence, evidence rendering, mobile navigation and ZIP contents: no screenshots by default, PNGs only after opt-in.

## Manual integration checks

- Existing 0.1 workspace opened through the schema-2 migration; historical project and scan remained accessible.
- Actual 1.0 demo scans completed in the hub with nine page/profile runs, evidence, grouped tasks and score bounds.
- Repeating the same check and comparing its results worked. Missing performance measurements remained unknown.
- Pausing the actual demo after its first of nine page/profile steps and resuming it completed successfully; paused time is excluded from the execution time budget.
- macOS Anna voice generated a local 4.15-second AIFF file without playing audio or enabling speech in settings. This verifies the installed system voice, not a listening-quality study.
- Screenshots in `docs/screenshots/1.0-*.jpg` show the running application and owned synthetic demo, not a design mockup or customer data.

## Local model checks

Ollama was installed from its official macOS release and run on loopback with cloud disabled. The application checks local backing before sending observations.

An actual **qwen3:4b** request with synthetic evidence failed structured-output validation after approximately 60 seconds. The thinking-only variant did not deliver a usable JSON plan within the bounded generation budget. The failure was surfaced; no successful plan was saved. Availability alone is not treated as a model quality test.

## Remaining external validation

Not completed: an external developer pilot, independent held-out precision/recall study, full screenreader audit, Windows stability testing, resource/latency benchmark or hostile-site isolation assessment. These remain follow-up work. No external security certification, complete accessibility compliance or Google ranking improvement is claimed.

This release supports bounded audits of trusted websites the operator owns or is authorized to administer. It does not include native installers, authenticated browsing, automatic source repairs, screenshot vision analysis, OAuth or cloud synchronization.
