# 2.4 measurement and comparison identity

Application version, recorded measurements and the decision that verifies a repair are different things. SiteFenn 2.4 records `measurement-identity-2.4` in new report provenance; historical reports keep their original provenance. Nothing infers missing hashes or rewrites an old report into the new format.

## Inventory before allowing UI-only upgrades

`server/provenance.ts` records the legacy engine hash plus three conservative source groups:

| Group | Recorded source inventory |
| --- | --- |
| Capture / measurement | audit engine, proxy/security, scoring, technical SEO/network/meta/sitemap, journey execution/options, element context, shared journey/report contract, worker and runtime viewport definitions |
| Normalization | scan options, server request/retest construction, journey options/definitions and runtime viewport definitions |
| Verification | runner/task verification, task/report service, comparison, compatibility policy, problem location identity, canonical serialization, scoring, release gate and report contract |

Browser version, Playwright/axe/Lighthouse, SEO parser versions, Node version, platform and architecture remain part of comparison identity. Profile options, planned rule instances, page/state scope and measurement contract are checked separately. The source groups are intentionally conservative: a server API or report-service edit can still end exact compatibility even if some of its effects look cosmetic. Source TS and compiled JS hashes are not silently declared equivalent. This is not a complete machine/font fingerprint or a publisher signature.

Runtime viewport values now live in `shared/viewports.ts`. Type-only/UI interfaces are not a measurement fingerprint. Changes confined to frontend rendering/style or application-version metadata can therefore retain exact compatibility, while changing profile dimensions/touch/scaling, normalization or verification code cannot quietly inherit the old identity.

## Comparison matrix

| Difference | Classification | Verified fix / score delta |
| --- | --- | --- |
| Both new identities complete/equal; only app version differs; same complete scope | Exact | Only with original passing-rule/capture proof; score delta only if both scores are final |
| Browser, engine, runtime, parser or source-group hash differs | Diagnostic if the supported rule/report/profile contract is otherwise valid | None |
| One report predates the new identity, or identity information is incomplete | Diagnostic if the rule/report/profile contract is valid | None across that boundary |
| Both historical reports have identical complete legacy provenance | Existing strict historical policy | Existing passing-rule/capture requirements remain active |
| Valid but different full scope/options | Diagnostic | None |
| Source-bound targeted retest, identical execution and compatible selected profiles/options/journeys | Exact for eligible selected observations | No project score delta; omitted/mismatched samples stay unverified |
| Changed/unsupported rule or profile contract; missing/invalid planned state/rule/page; unfinished/reversed runs | Incompatible | None |

A new example selector, a changed ID/class or duplicate candidates does not establish a shared issue. Such locations receive **Zuordnung prüfen** and keep both original IDs. No automatic source mapping or common-cause claim follows.

## Persistent locations and history

`problem-location-2.4` hashes project, normalized URL (query retained; fragment removed), rule/category, device, state and exact selector. It deliberately excludes the random finding ID and the engine's occurrence fingerprint. It identifies an observed location, not a root cause. Each occurrence remains bound to its original scan/finding. A transaction writes the report and derived index together; startup migration and trash restoration derive the same IDs without editing original reports.

The history lookup uses the complete SQL occurrence index, not the currently loaded UI page. **Wieder aufgetreten** requires an earlier occurrence and a compatible explicit passing-rule/capture proof in the selected intermediate check. An earlier location without that proof is **Erneut beobachtet · Zwischenhistorie ungeklärt**. It is not a newly discovered location or a verified closed/reopened repair. `Neu` is relative to the selected comparison and available stored history, not a claim that the site has never had that problem. Archived/purged/unavailable evidence cannot be reconstructed; restore the relevant history when needed.

Layout verification still requires the original captured state, dimensions and scroll coordinates to be sampled again. Document redirect identity and reached journey states also remain required. Numeric lab metrics use their measured sample. No disappearing DOM element or missing screenshot is treated as a passing measurement.

## Deliberate reference changes

The reference workflow requires two distinct, completed full checks with exact identity/scope, stable unambiguous finding locations and no unknown enabled rules. Disabled Performance measurements remain explicitly unknown and do not become a perfect score. A reference can contain known open findings; it is a reproducible starting point, not a release approval.

The preview hashes both source results and the current reference event. Confirmation, a name and an unchanged preview are required. Changed source data, changed selection or a competing reference change invalidates adoption. Immutable history keeps candidate/control IDs and the previous reference event; retention protects every source ID, including old reference events. The active control check can be selected directly even when it is outside the loaded history page. A changed engine/rule contract requires a new controlled pair under that contract, not relabelling of the previous reference.

There is an explicit limit of 200 reference events per project. Nothing is silently dropped; backups retain all stored events. Run/profile labels are separate editable metadata, do not change execution options and are included in scan/profile/report exports where applicable. A labelled profile is not a new measurement contract.
