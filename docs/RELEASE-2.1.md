# SiteFenn 2.1 — trust the saved evidence

Release scope: local Web/CLI, 31 October 2026. This release implements the integrity foundation from [the 3.0 plan](../PLAN-3.0.md). Native distribution, live Google authorization and independent acceptance remain separate tracks.

## What changed

### Complete reference protection

Safety queries now read the full database reference graph, independently of the 3,000-task/50-reference display caps. Visual references, verifier scan IDs, retest sources, analysis comparisons and schedule sources stay protected. References inside reversible trash also count, so restoring an archived check does not depend on an already-purged verifier. The latest completed full check and active jobs remain protected. Retention stays previewed, explicit and bounded; nothing is automatically archived.

### Recoverable maintenance

Batch archiving uses one SQLite transaction. A permanent purge atomically commits its file-cleanup intent and removes the selected trash records before deleting files. Before that commit, rollback preserves the records and their evidence. After that commit, the already-confirmed purge rolls forward; it is not restorable. Cleanup is idempotent and resumes before startup serves data. If a maintenance operation fails while the app remains open, readiness blocks new expensive work and System & Setup offers **Wartung fortsetzen**.

Pre-update backups are written as `.partial`, flushed, read back, checksum-compared, restored to an isolated temporary directory and checked for manifest/SQLite integrity. Only verified bytes are atomically renamed to a final ZIP. Restart discards unfinished unverified files or finishes publication of verified ones. Recovery never overwrites an existing backup. SQLite uses WAL with synchronous FULL; POSIX directories are flushed around filesystem publication. Windows directory-flush semantics are different and have not been validated on a real Windows machine.

Restoring a portable backup clears source-workspace maintenance intents and the runtime lock; schedules still require renewed approval. Existing backups remain untouched. The 250 MiB/2,000-image limits remain; streaming large-workspace backups are planned for 2.5. SIGKILL/fault injection are process-interruption tests, not a claim of hardware power-loss certification.

### One measurement contract

`report-contract-2.1` supplies the base/technical-SEO rule inventory and validates expected page/device/state instances, rule budgets, unique IDs, references, coverage counters and confirmed journey states. Score, CLI gate, comparisons, explanation context, JSON export and UI use the same validator. Missing rules/categories or invalid references produce unknown/inconclusive results, never a pass or verified repair. Invalid score inputs remain readable with diagnostics instead of making the workspace bootstrap fail.

New runs use `rules-2.1.0`, `audit-score-v2.1` and `release-gate-2.1`. Recorded 2.0 rule inventories are supported; earlier/unrecognized contracts remain readable but need a fresh check for trusted grading/comparison. Existing execution-identity comparison rules remain strict: a 2.0 baseline does not automatically become comparable with a 2.1 run. No historical measurements are rewritten and the workspace path stays the same. The additive journal table retains database schema version 2.

### Readiness and canonical facts

A shared readiness response distinguishes queued/running work, saved results during worker cleanup, exclusive operations, pending maintenance and free resources. Reading results remains possible while browser cleanup finishes; expensive actions still wait for resource release. This is a thin readiness contract, not the persisted scheduler planned for 2.5.

The explanation view and Markdown export project device dimensions, counts and original observations from saved report fields. Model prose remains visibly unverified and cannot change measurements, scores or repair status. Processing completion, mechanical report-contract validation, semantic AI fact checking and human approval are separate states. Semantic fact checking is explicitly **not performed**, and human approval is **not recorded**; this release does not qualify a model as an expert.

## Verification

- **142 Node tests** and **21 browser tests** passed locally on macOS arm64 / Node 24.19.0.
- Regression protection with **3,010 tasks, 60 visual references and 60 analyses**, including archived references and transaction rollback.
- Fault injection before/inside/after the purge transaction, after file deletion and before journal completion; backup interruption before write, after write, after verification, after publication and before journal completion.
- Two actual child-process **SIGKILL** tests, followed by reopening the same workspace, for committed purge and verified backup.
- Separate seven-case internal report-contract corpus checks missing rule/category/page, foreign finding/evidence reference, forged weight and duplicate semantic instance across score/gate/comparison/explanation.
- Actual Chromium CLI baseline → regression → correction → failed-target test, closed-loop handoff/retest/backup integration and responsive UI checks remain in the full suite.
- Types, production build, 23-case AI output guard corpus, service lifecycle/restore and portable package setup/start/restart checks are included in release verification.

The separate corpus in `tests/fixtures/report-contract-2.1.json` is an internal synthetic seed, excluded from production validators/prompts. Its labels were authored during implementation. Independent human labels, held-out model evaluation and model requalification are still open; the known [2.0 model failures](RELEASE-2.0.md) remain relevant. No new model downloads, inference-accuracy claims or customer-site scans are part of this release.

Remote CI status is recorded on the GitHub release for its exact source commit. An unfinished job is not a successful job.

## Actual application screenshots

Owned local demo, real saved results; no mocked score or model response in these screenshots. Disabled Lighthouse remains unknown even with a valid measurement contract.

![Actual report contract and bounded score](screenshots/2.1-report-contract.jpg)

<details>
<summary>390 px mobile view</summary>

![Actual mobile report contract](screenshots/2.1-mobile-contract.jpg)

</details>

## Still open

Independent pilot/screenreader and AI accuracy evaluation, Google Cloud OAuth/property acceptance, real Windows testing, native signing/distribution and hardware power-loss testing. The larger UX/navigation/history changes are planned for 2.2; semantic explanation quality and editable model proposals for 2.3. Program updates remain manual in a new application folder with the same data path.
