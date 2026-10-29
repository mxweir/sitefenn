# SiteFenn 1.1 verification

2026-10-29. Local macOS Apple M5 Pro, 24 GiB RAM. This records actual checks and separates implementation evidence from independent validation.

- `npm run check`: passed.
- `npm test`: 69/69 passed, including the supplemental three-profile corpus, unknown classification, scrolled marker geometry, historical identity guards and stable/changing model digests.
- `npm run build`: passed.
- `npm run test:e2e`: release browser checks include actual identity rendering and the reference-basis panel, alongside the existing workflow/export/privacy checks.
- `npm audit --audit-level=high`: zero reported vulnerabilities at the test time.
- Real local `qwen2.5:3b` smoke: validated structured references and a recorded weight digest; one synthetic finding, 3.824 s. Semantic answer quality was not evaluated by this smoke.
- Built service lifecycle: actual demo, provisional cancellation, clean port shutdown, restart persistence and checkpoint resume passed in a separate workspace. Final cancellation-to-terminal time was 161 ms in that short local smoke.
- The local OAuth protocol contract checked PKCE S256 construction, loopback callback, wrong-state rejection and one-use state. No Google requests, authorization or token storage were performed.
- Existing default 1.0 workspace remained readable after starting 1.1. A new actual demo completed nine page/profile steps and displayed its recorded identity.

See [baseline data and methodology](BASELINE-1.1.md) and the [machine-readable aggregate](baseline-1.1.json) for the repeated audits. The final reference run set contains 360 observations over 120 distinct expectations; 27 are intentionally unknown. The three authorized real websites completed 81/81 planned page/profile steps across nine scans. No real-site accuracy percentage is claimed.

Screenshots `1.1-quality.jpg`, `1.1-provenance.jpg` and `1.1-report.jpg` show the actual application and owned synthetic demo. Customer-site screenshots and individual real-site findings were not published.

## Remaining validation

Independent human labels, held-out detection evaluation, user pilot, complete screenreader audit, browser-paint latency, whole-product RAM budgeting, native packaged installers, real Windows installation and actual Google OAuth remain open. Desktop/OAuth checks are early feasibility evidence described in [FEASIBILITY-1.1.md](FEASIBILITY-1.1.md).

The repository/package rename does not rename or reset the existing `website-audit-hub` data directory. Old reports remain historical. Missing or changed execution identities deliberately prevent a scored comparison or verified fix; start comparable new checks rather than inventing identity for old captures.
