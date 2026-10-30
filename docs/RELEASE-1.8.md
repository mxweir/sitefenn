# SiteFenn 1.8 verification

2026-10-30. Developer handoff and an explicit standalone CLI gate. No automatic patches, commits, deployments or private artifact uploads.

## Delivered and bounded

**Actions → Entwickler-Arbeitspaket** selects 1–20 canonical findings. Its Markdown separates the observed URL/device/state/selector/evidence reference, recommendation, future acceptance test and allowed work scope. URL queries/fragments are omitted; query-dependent tests must use the local original check. Without source preview it makes no file/line claim. Reports and source text remain untrusted data for any receiving AI.

An optional explicitly acknowledged **Git root** is scanned read-only. Non-ignored HTML/JSX/TSX/Vue/Svelte files are eligible; hidden paths, sensitive filename patterns, build/dependency/private directories and symlinks are excluded. Tracked files matching ignore rules are excluded too. Bounds: 500 files, 3 MiB total, 128 KiB/file, 100 literal candidates, at most 20 selected exported candidates with bounded 1,600-character snippets. No project scripts are executed. Only literal `id` / `data-testid` matches for supported observed selectors are candidates, **not proven runtime/source mapping or causality**. A candidate's current file hash is checked again when the selected snippets are exported. Dynamic mappings, other selector forms and source-map resolution remain unsupported/unknown. Exclusion patterns cannot guarantee source files contain no embedded secrets; preview before including snippets. The root is not persisted or sent to a model.

Export dialog downloads a versioned check profile and a full CLI baseline without embedded images. The CLI writes local report/gate JSON and evidence in a new output directory; it refuses an existing output folder. Original data is never replaced. Outputs may contain private website content and are not automatically uploaded.

```sh
npm run audit:check -- --help
# First run: writes baseline report.json, exits 2 because no baseline was supplied.
npm run audit:check -- --profile profile.json --out first-run --authorized
# Same execution environment, tool/browser identity and complete scope required.
npm run audit:check -- --profile profile.json --out next-run --baseline first-run/report.json --authorized
```

Exit codes: **0** no new measured blockers under the explicit policy, **1** new measured blocker regression, **2** incomplete/incompatible/error. Default blocker severity is critical, categories layout/accessibility/SEO/runtime. Profiles can choose important and explicitly include performance, requiring performance enabled. Changed tool version/Node/OS/browser/profile or missing required rules cannot produce a fabricated pass. Initial document non-2xx/missing HTTP responses are inconclusive even if a proxy error page itself has no layout defect. A passing gate does not claim a flawless site or resolve existing baseline issues.

[Example GitHub Actions template](../examples/sitefenn-check.yml) uses reviewed profile/baseline files, no secrets and no automatic artifact upload. Replace the release tag with a reviewed full commit to pin it. Establish a baseline under the same execution identity; a macOS report is intentionally incompatible with Ubuntu. The example is an integration template, not an independently tested deployment in another repository.

## Actual checks

- 117 Node tests, 18 browser tests, types and production build passed locally.
- An actual CLI subprocess series checks an owned live HTTP fixture: first baseline exits 2; unchanged page exits 0; a new 680 px mobile overflow exits 1; corrected page exits 0; stopped/unreachable fixture exits 2. This caught a proxy 502-page case that originally looked layout-clean; non-success documents now remain inconclusive.
- Actual read-only Git fixtures cover ignored files including a force-tracked ignored file, hidden/sensitive paths, symlinked outside content, exact literal ID matching, stable source preservation and changed file hash. Work-package tests cover selection scope, no-source exports and query omission.
- Controlled browser UI checks selection-only handoff, no default source access, preview, disabled unacknowledged reads and Escape close. A separate real service/browser run inspected the owned `#wide` source candidate, explicitly selected it and generated the Markdown preview shown below.
- Hosted CI is linked in each release. A queued hosted job is never counted as a passed check.

![Actual handoff preview, owned fixture](screenshots/1.8-developer-handoff.jpg)
