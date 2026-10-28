# Architecture

## Status

This document describes the 0.1 foundation and explicitly separates future design from shipped behavior. The application is for one local user scanning trusted websites they own or administer. It is not a hardened arbitrary-URL scanning service.

## Components and data flow

1. The React interface sends project and scan requests to the local Fastify API.
2. The API validates input and persists project/scan records in SQLite.
3. A browser task opens the project page in Playwright-managed Chromium.
4. The task captures a desktop screenshot and extracts page title, meta description, and H1 information.
5. Findings, task status, and artifact references are stored locally.
6. The interface reads persisted results and displays the screenshot and basic observations.

The optional Ollama check is a separate read-only request to its fixed local endpoint. It must not be required to create a project or complete the rule-based scan.

## Persistence

The conceptual record hierarchy is:

- **Project:** a saved website and its user-facing identity.
- **Scan:** one execution, lifecycle state, timing, target, and error/interruption information.
- **Finding:** a structured observation associated with a scan.
- **Artifact:** a locally stored screenshot referenced by its scan.

Durable status must not depend solely on a browser tab or an in-memory promise. On application restart, unfinished scans are marked interrupted. They are not silently labelled successful or assumed to resume at their previous browser state.

Keep application data outside the source checkout by default. Database and screenshot files form one backup unit. Stopping the application before copying its data directory avoids claiming that an arbitrary live copy is transactionally consistent.

## Observation versus interpretation

Current checks cover basic page metadata only. An absent description is an observed fact, not evidence that Google will rank the page poorly. A screenshot documents one rendered state, not every possible interaction.

Future records should preserve these distinctions:

- **Observation:** what a tool measured or captured.
- **Interpretation:** what a rule or model infers from that evidence.
- **Recommendation:** a proposed change.
- **Verification:** a later matching check that confirms the relevant condition changed.

A user marking a future checklist item done must not by itself count as a verified fix. A failed or incomplete test must never be treated as a passed test.

## Trust boundaries

### Local interface and API

The API binds to loopback. This does not turn it into a multi-user authenticated service. Do not publish the port, put it behind a public tunnel, or assume other processes on the same machine are trusted by virtue of location.

### Target website and browser

The browser executes target page JavaScript and loads network resources. Chromium's own process isolation is not a complete product-level sandbox or a guarantee against malicious pages. Full egress isolation and arbitrary-untrusted-target hardening are pending. Scan only trusted authorized sites and keep the browser up to date.

The application must not promise that merely loading a page is side-effect-free. A badly designed website can change state even during navigation. No autonomous purchases, destructive actions, or form-submission workflows are part of 0.1.

### Filesystem and artifacts

Application files and screenshots stay in the configured local data directory. Artifacts may contain personal or confidential information from the target website. Local storage is not encrypted-at-rest storage merely because there is no cloud backend. Review files before sharing or attaching them to an issue.

### Future model integration

Website text is untrusted input, not an instruction source. A future local model must not receive filesystem, credential, shell, or browser-control privileges merely to explain findings. Model output must be schema-checked and refer to existing evidence. No autonomous source changes or shell execution are implied by a Markdown repair plan.

## Operational boundaries for 0.1

- Single-page desktop capture, not a crawl.
- Basic title/description/H1 observations, not a complete SEO engine.
- Stored screenshot, not a live browser stream.
- Optional Ollama connectivity, not model inference or training.
- Persisted results, not a score or scan-diff system.
- Trusted owned/administered sites, not an exposed public scan API.

## Planned evolution

The [1.0 plan](../PLAN-1.0.md) describes richer auditing. Important architectural constraints for that work are:

1. Save the scan profile and tool/rule versions alongside evidence.
2. Keep deterministic checks functional without a model.
3. Treat live frames as a preview, not the authoritative evidence store.
4. Isolate performance measurement from preview streaming and local inference load.
5. Compare like-for-like pages, states, and profiles; untested is not fixed.
6. Make secrets, credentials, and screenshot export choices explicit.
7. Do not let hidden tests or ignored findings improve a raw score.
8. Complete browser/network isolation work before broadening the trusted-target model.

These are design requirements for subsequent versions, not claims that all protections have already been implemented.
