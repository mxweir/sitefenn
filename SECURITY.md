# Security policy

## Operating boundary

**Local use, trusted websites you own or are authorized to administer only.** SiteFenn is not a hostile-website sandbox, public scan service or security-audit product. No independent security certification is claimed. Keep Node, dependencies and the installed browser updated. Support targets the latest available release; no response-time commitment or bounty is offered.

## Protections and limits

The app binds to loopback with Host/Origin/session/mutation checks. Browser traffic uses a proxy with destination/address validation and pinned resolution. Public targets use standard HTTP(S) ports. Local projects explicitly authorize one origin, not every private address. Jobs, scope and artifacts are bounded. Models are checked for local backing and output is validated; no model shell, source writes or autonomous browser tools are exposed.

These controls are **not kernel/network namespace isolation**, proof of no network escape, or protection from every malicious local process/browser vulnerability. Target JavaScript runs, and a page load can itself change state. Do not scan hostile sites, privileged admin screens or sensitive internal apps. Never expose the hub through a public tunnel/proxy/shared-network deployment.

No authentication-cookie import, login journey, purchases, form submission or destructive-action automation is supported. Do not provide credentials or secret-bearing URLs.

## Model trust

Loopback alone does not mean inference is local: Ollama can expose remote aliases. Metadata is checked before sending observations; cloud tags, remote targets and unverifiable locality fail closed. The local Ollama installation must still be trusted to report honestly. The hub does not change its global settings, download models or grant tools. Validate advice before editing code; structured output can still be wrong or influenced by page content.

## Sensitive artifacts

Databases, screenshots, imports, AI plans and backups can contain private information. They are not automatically encrypted/anonymized. Report location URLs omit queries, but arbitrary page text may still reveal secrets. ZIP screenshots require explicit inclusion; full backups deliberately contain workspace data.

Before sharing, review text/images, remove credentials/tokens/personal data and confirm permission to share website content. Do not commit your data directory or attach an unreviewed database/backup to a public issue. Restore only trusted archives into a new directory; checksums prove integrity, not authorship. Keep previous data until restoration is checked.

## Vulnerability reporting

Use GitHub private vulnerability reporting if enabled. Otherwise open a minimal issue requesting a private contact channel, without exploit details, secrets or private URLs. Once private contact exists, provide version, OS/runtime, expected/observed behavior and harmless owned-fixture reproduction. Do not exploit third-party systems without permission. This policy is not a claim that all possible vulnerabilities are addressed.
