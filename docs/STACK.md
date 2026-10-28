# Stack

## Current 0.1 stack

| Layer | Choice | Responsibility |
| --- | --- | --- |
| UI | React + TypeScript + Vite | Local dashboard, projects, scan status, findings, and screenshot presentation. |
| Runtime | Node.js 24 | Application process and supported JavaScript runtime. |
| HTTP API | Fastify | Loopback-only application API and built frontend delivery. |
| Persistence | SQLite through `node:sqlite` | Local projects, scan metadata, state, and findings. |
| Browser | Playwright + Chromium | Single-page desktop rendering, screenshot capture, and metadata extraction. |
| Artifacts | Local filesystem | Screenshot evidence referenced by persisted scan records. |
| Optional local integration | Ollama HTTP endpoint | Read-only availability/model-list check; no inference in 0.1. |

Use the repository lockfile to reproduce dependency versions. Node's built-in SQLite API avoids an additional database server, but runtime support and warnings must be evaluated against the pinned Node release; do not assume compatibility with older Node versions.

## Why this shape

The hub is a browser-automation application with a local web interface, not a publicly hosted website scanner. A separate browser worker can gather facts while the UI remains responsive. SQLite provides durable local state without an external service. Screenshots are files rather than large database blobs.

TypeScript is shared across the interface and API. Findings must remain structured data, independent of any future model-generated explanation. Basic scans should continue to work without Ollama.

## Commands

| Command | Purpose |
| --- | --- |
| `npm install` | Install application dependencies for a local checkout. |
| `npm ci` | Install exactly from the committed lockfile, especially in CI. |
| `npm run browser:install` | Install the browser required by the scan engine. |
| `npm run dev` | Start the development application on loopback, default port 4310. |
| `npm run check` | Run configured static/type checks. |
| `npm test` | Run the automated test suite. |
| `npm run build` | Build the application. |
| `npm start` | Run the built application locally. |

## Planned, not implemented in 0.1

- Multiple layout profiles and a bounded same-site crawler.
- Browser-frame streaming with an evidence overlay; this is not an iframe of the target website.
- Dedicated accessibility, technical SEO, and isolated performance checks.
- Deterministic versioned scoring and comparable scan cohorts.
- Local model inference over recorded evidence, with schema validation and traceable suggestions.
- Search Console import/integration.

These are roadmap choices, not currently installed capabilities. Model selection and throughput require benchmarks on the target machine. No custom model training is required for the foundation release.
