# Early feasibility checks: desktop and Google access

2026-10-29. These checks inform the 2.0 plan; they do not ship a native installer or Google connector.

## Desktop service lifecycle

The built Node service was launched as a child process with a separate private workspace and loopback port. The real demo completed nine page/profile steps. A second scan was cancelled after a checkpoint; the partial score remained provisional. Graceful shutdown closed the port, restart retained the project and completed report, and the cancelled scan resumed to completion.

`npm run test:readiness` reproduces this without touching the default user data directory. CI runs it on macOS and Ubuntu. It does not establish Windows behavior or Tauri integration.

**Architecture decision:** retain React/Fastify/SQLite and evaluate a Tauri shell with a bundled Node runtime, JS resources, dependencies and Playwright browser assets. Tauri documents both external sidecars and embedding the Node runtime; platform-specific binaries and explicit permissions are required. [Node sidecar guidance](https://v2.tauri.app/learn/sidecar-nodejs/), [external binaries](https://v2.tauri.app/develop/sidecar/).

Bundling only the current server entry point is insufficient: `node:sqlite`, forked workers, Chromium, Lighthouse, dynamic axe loading, resources and runtime paths must work from the installed package. The current Node executable alone is approximately 121 MB; an installer size is not established. No Rust/Tauri build, signing, notarization, installer update or Windows package was performed in 1.1.

Before 1.9 commits to a packaging solution, build a fresh-machine proof covering those assets, sandbox behavior, startup/shutdown, cancellation, update rollback and user data separation. Packaging failure must not silently disable Chromium's sandbox.

## Google OAuth feasibility

Google documents a system-browser desktop authorization flow with a loopback callback, PKCE and user consent. A desktop client cannot protect a bundled client secret like a server can. [Official desktop flow](https://developers.google.com/identity/protocols/oauth2/native-app).

The local protocol smoke generated a PKCE S256 challenge and used a real temporary loopback HTTP listener. Wrong state returned 403, a synthetic matching callback returned 200 and replay returned 409. It constructed a request restricted to `webmasters.readonly`, without sending it. No Google login, authorization request, code exchange, credential persistence or token request occurred.

**Decision:** optional installed-app OAuth is a plausible path for 1.7; keep CSV as the unconnected alternative. Scope remains read-only. [Search Console authorization](https://developers.google.com/webmaster-tools/v1/how-tos/authorizing).

**Unresolved prerequisites:** registered desktop OAuth client, enabled API, authorized real property, consent and any required Google verification; appropriate OS secret-store integration; expiry, revocation, offline refresh, callback timeout and hostile callback/error handling. The smoke is not production OAuth code and must not be copied into a connector without those controls. Public access will not be described as a one-click ready integration until that path is actually tested.
