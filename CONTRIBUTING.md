# Contributing to SiteFenn

Prioritize reproducible findings, useful explanations and safe local operation. New features need tests and honest limits.

## Development

Use Node.js 24, `npm ci`, `npm run browser:install` and `npm run dev`. Before submitting, run:

```sh
npm run check
npm test
npm run build
npm run test:e2e
```

Use owned local fixtures. Never commit credentials, customer screenshots, model weights, local databases or application data. Do not test destructive behavior against third-party sites.

## Reports and changes

Bug reports should include app/OS/runtime version, scan profile and a minimal authorized reproduction. Distinguish false positives, missing coverage, UI issues and model advice. Redact screenshots/logs; use [SECURITY.md](SECURITY.md) for private vulnerability reports.

Pull requests should describe user value, tests, network/privacy effects, migrations and remaining limits. Add actual screenshots for UI changes, not mockups presented as working behavior. Update docs/changelog when capabilities change; keep unrelated dependency/formatting edits separate.

## Audit rules

- Define the observable condition and applicability, not merely a design opinion.
- Add positive and negative fixtures, including intentionally valid overlays.
- Preserve page/viewport/state and evidence linkage.
- Separate measured facts, heuristics, causes and recommendations.
- Unknown execution must not count as passing; missing coverage must not count as fixed.
- Supply useful acceptance criteria and limits.
- Version rule/profile/score changes and test backward compatibility; never silently rewrite historical scores.

No rule may claim full WCAG compliance or guaranteed Google ranking.

## AI, search and exports

Keep local-backing preflight and the fixed endpoint. No cloud fallback, surprise model download, model tools or automatic repairs without explicit design review. Label mock tests separately from real-model checks; report model, hardware, input scope and limits. Website text is data, not instructions. Known evidence IDs are mandatory; valid JSON does not prove correctness.

Screenshot sharing stays opt-in; text is not inherently anonymized. Keep portable relative evidence links. Preserve Search Console property/date/filter/dimension metadata; do not fabricate whole-site rankings from partial rows. Test restore limits and non-destructive migrations.

Code is MIT. Confirm rights to assets; dependencies, fonts and models retain their own licenses and attribution requirements.
