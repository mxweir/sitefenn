# Security policy

## Current support

The 0.1 line is an early local-use foundation. There is no published security audit or guarantee that arbitrary websites can be scanned safely. Security fixes target the latest available release; update the application, Node.js, and its installed browser regularly.

## Intended use

- Run the hub on your own computer, bound to loopback.
- Scan only trusted websites you own or are authorized to administer.
- Do not expose the API to the Internet or other users through tunnels, proxies, or network bindings.
- Do not scan unknown or hostile URLs, sensitive internal applications, or privileged administration pages with this early release.
- Do not provide credentials, session cookies, payment details, or secrets to the scan workflow.

**Complete browser/network egress isolation is not implemented.** A target page can execute JavaScript and load resources. A local scanner is not automatically safe from SSRF-like network access, malicious page behavior, or browser vulnerabilities. Loading a page can itself have side effects on a poorly designed site. Current scope restrictions are not a substitute for technical isolation.

## Data and sharing

The database and screenshots are stored in the configured local data directory. They are not automatically encrypted, anonymized, or safe to publish. Screenshots can reveal account details, personal information, URLs, or confidential content.

Before sharing a report, screenshot, log, or backup:

1. Review its content and remove sensitive information.
2. Exclude API tokens, cookies, credentials, and private application data.
3. Confirm you have permission to share the target website's content.

Do not commit your data directory to Git or attach an unreviewed database to a public issue. Stop the app before making a full manual backup.

## Optional Ollama check

Version 0.1 only checks the fixed local Ollama endpoint for availability/model listing. It does not train a model, download one automatically, or send website evidence to a cloud inference provider. The hub itself still accesses the websites it scans. Review any separately installed software's network behavior independently.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting for this repository if it is enabled. Do not post exploit details, secrets, or private target data in a public issue. If private reporting is unavailable, open a minimal public issue requesting a private reporting channel without disclosing the vulnerability or affected private URLs.

Include the affected version, operating system, reproduction steps against a harmless test site, and expected versus observed behavior when a private channel is available. Do not test an exploit against third-party systems without authorization.

No response-time commitment or bounty program is offered. This policy documents the current boundaries; it is not a certification or a claim that all security risks have been addressed.
