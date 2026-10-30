# SiteFenn 1.9 verification

2026-10-30. Local web/CLI distribution and everyday maintenance. The user explicitly approved releasing 2.0 as tested local web/CLI software with external native/Google/pilot acceptance open. This package is **not a signed native desktop installer**, and Windows has not been run on real hardware.

## Start and manual update

The release includes a portable source/production-build ZIP and SHA-256 file, without workspace databases, credentials, `.env`, models, browser binaries or `node_modules`. Node.js 24 remains required. First setup is explicitly chosen:

```sh
node scripts/launch.mjs --setup
# Later starts, no implicit downloads:
node scripts/launch.mjs
# Headless service smoke / no automatic browser opening:
node scripts/launch.mjs --no-browser
```

Setup installs locked npm dependencies and Chromium and builds the app. Models are not downloaded. A missing runtime/setup gives an actionable instruction; optional Ollama is not needed for audits. The macOS `.command` and Windows `.cmd` are convenience launchers; Windows remains unvalidated. The application server remains IPv4-loopback only. No system service is installed.

**System & Setup → Manuelles Update mit Vorsicherung** checks the fixed public GitHub release endpoint on explicit click. It compares stable version metadata and builds a fixed repository release URL; it does not execute downloaded code. A separate action saves a checksummed portable backup in the existing workspace's `backups/` directory. Update by extracting the reviewed new package into a **new program folder**, stopping the old process and starting against the unchanged data directory. On failure retain the previous program folder and restore a verified backup into a new data directory at stopped service. Existing user paths stay in legacy `website-audit-hub` so versions do not reset projects.

SHA-256 detects changed bytes, not an independent publisher signature. No signed automatic updater, signing/notarization, bundled Node/Chromium, Tauri sidecar distribution or verified Windows installer is claimed. Native distribution is deferred under the approved web/CLI release scope.

## Storage and retention

The UI shows database file size and evidence byte/count totals, separately from backups/WAL/other files. The user chooses how many newest checks per project to retain and requests a **preview**. No timer automatically deletes history. The bounded preview has a five-minute single-use token and up to 20 candidates. Active checks, latest full check per project, visual reference sources, verification sources, retained retest/analysis comparison sources and schedule profiles are protected and checked again before removal.

Selected preview candidates move into a reversible database-backed trash with their tasks and analysis history; evidence remains for restoration and backups. Trash still consumes storage. Restore returns the original IDs/history; portable backups preserve trash. Permanent removal is a separate explicitly selected action requiring typed `ENDGÜLTIG LÖSCHEN`; it removes only selected trash records and their unreferenced supported evidence files. External backups are not erased. SQLite can keep freed pages allocated until ordinary database maintenance; no automatic vacuum is performed.

Only data created by tests was actually deleted in validation. No existing user projects or evidence were removed.

## Optional schedules

Choose a completed full profile, daily/weekly interval and explicit acknowledgment. Scheduling runs **only inside the running application**, checks every 30 seconds, waits for idle audit/model/resources and starts at most one job per tick. More than five minutes late becomes a visible missed occurrence, without a catch-up burst. Closing the app stops the scheduler; no hidden daemon or OS task. Scheduling does not trigger Google sync, model inference or source execution. Restored backups disable schedules until the user grants them again.

## Actual checks and limits

- 120 Node tests and type checks passed; production build passed. 19 browser tests cover the existing workflows plus the mobile trash selection/typed confirmation path. Controlled UI/provider tests are separate from live account or native testing.
- Real worker-generated evidence/history was previewed, protected, trashed, restored, backed up, restored into a new directory and selectively purged. Retained/shared evidence survives. API tests reject stale/invented preview tokens, missing confirmation and invalid schedule sources.
- Controlled-clock scheduling tests cover busy-resource deferral, exactly one due run, repeated ticks and missed occurrences. They do not imply a 24-hour endurance run.
- The actual portable ZIP was extracted into a new temporary folder. Missing setup refused startup; **fresh `npm ci` + explicit Chromium setup + build + production service startup** worked on macOS arm64. An owned project and a pre-update backup were created; stop/restart preserved the project. Chromium's existing installation cache was reusable, so this does not establish a first-ever browser download on a clean OS. No native installer or Windows system was tested.
- A real UI request fetched the current public GitHub release metadata and displayed it separately from installed development version. Storage preview correctly protected both latest demo checks without deleting anything.
- [Hosted CI](https://github.com/mxweir/sitefenn/actions/workflows/ci.yml) now also packages and exercises the explicit portable setup/start/restart smoke after build; release notes record the actual remote outcome.

[Native sidecar constraints](https://v2.tauri.app/develop/sidecar/) motivated keeping native packaging outside the current stable distribution; no completed native feasibility/installer certification is implied.

![Actual maintenance view](screenshots/1.9-maintenance.jpg)
