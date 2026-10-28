# Stack

| Layer           | Choice                                    | Responsibility                                                        |
| --------------- | ----------------------------------------- | --------------------------------------------------------------------- |
| UI              | React + TypeScript + Vite                 | Projects, preview, findings, tasks, comparison, imports and settings. |
| Design          | Local CSS, DM Sans, Archivo Black, Lucide | SiteFenn branding with local fonts and icons.                         |
| Runtime/API     | Node.js 24 + Fastify                      | Loopback API, local sessions, validation and frontend serving.        |
| Persistence     | SQLite through `node:sqlite`              | Projects, durable jobs, reports, tasks, settings and search datasets. |
| Browser         | Playwright Chromium                       | Discovery, three viewports, scroll/geometry sampling and screenshots. |
| Accessibility   | axe-core                                  | Automated checks; not a complete human accessibility evaluation.      |
| Performance     | Lighthouse                                | Separate desktop/mobile lab reference measurements.                   |
| Network         | Audit proxy and address validation        | Constrained egress and pinned resolution; not OS isolation.           |
| Optional model  | Ollama                                    | Verified local metadata and structured text explanations.             |
| Optional speech | macOS `say` / Anna                        | User-enabled local speech, dependent on system voice availability.    |
| Portable data   | fflate + JSON/Markdown                    | Reports, selected evidence ZIP and backup/restore.                    |

Use Node 24 and the committed lockfile. Older Node versions are not a supported substitute for built-in SQLite. Tools, fonts, browsers and models keep their own licenses.

## Commands

| Command                                    | Purpose                                       |
| ------------------------------------------ | --------------------------------------------- |
| `npm ci`                                   | Install locked dependencies.                  |
| `npm run browser:install`                  | Install Chromium.                             |
| `npm run dev`                              | Develop locally, default port 4310.           |
| `npm run check`                            | Static/type checks.                           |
| `npm test`                                 | Unit/API/security/engine test files.          |
| `npm run build`                            | Build frontend and server.                    |
| `npm start`                                | Run built local app.                          |
| `npm run test:e2e`                         | Browser end-to-end tests.                     |
| `npm run restore -- ARCHIVE NEW_DIRECTORY` | Validate/restore backup into a new directory. |

Linux may require `npx playwright install --with-deps chromium` for OS libraries.

## Deliberate constraints

No mandatory cloud service or custom training. Rules work without a model. Expensive scans, discovery, model analysis and backup operations are serialized. Performance does not share live preview/model load. AI receives bounded text, not images or browsing tools. Search Console enters by CSV, not OAuth. Live preview uses browser frames, not a target iframe. Model throughput requires actual hardware measurements.
