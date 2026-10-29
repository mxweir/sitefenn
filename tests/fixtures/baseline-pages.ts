import type { EvaluationLabel } from "../../server/services/evaluation.js";

// Authored separately from the 1.0 fixtures before the first 1.1 evaluation run.
// Synthetic implementation-team labels, NOT independent human/held-out accuracy evidence.
export const DATASET_VERSION = "supplemental-layout-1.1-v3";
const button =
  '<button id="target" style="position:absolute;left:50px;top:150px;width:160px;height:60px">Weiter</button>';
const blocker =
  '<div style="position:absolute;left:50px;top:150px;width:160px;height:60px;z-index:10;background:#ddd">Ebene</div>';
const cases = [
  [
    "scroll-only-blocker",
    '<section style="height:1700px">' +
      button.replace("top:150px", "top:1100px") +
      blocker.replace("top:150px", "top:1100px") +
      "</section>",
    "pass",
    "fail",
  ],
  [
    "fluid-grid",
    '<section style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px"><article>Links</article><article>Rechts</article></section>',
    "pass",
    "pass",
  ],
  [
    "long-fixed-panel",
    '<section style="width:2100px;height:60px">Zu breit</section>',
    "fail",
    "pass",
  ],
  [
    "nested-scroll-region",
    '<section style="overflow:auto;width:100%"><div><article style="width:2100px">Absichtlicher Scrollbereich</article></div></section>',
    "pass",
    "pass",
  ],
  [
    "translated-card",
    '<article style="width:200px;height:60px;transform:translateX(1600px)">Überbreiter Zustand</article>',
    "fail",
    "pass",
  ],
  [
    "closed-offcanvas",
    '<nav style="position:fixed;left:-300px;width:250px;top:100px">Geschlossen</nav>',
    "pass",
    "pass",
  ],
  [
    "wrapped-label",
    '<label style="display:block;padding:20px">Name <input aria-label="Name"></label>',
    "pass",
    "pass",
  ],
  [
    "child-icon",
    '<button style="padding:20px"><span aria-hidden="true">→</span> Weiter</button>',
    "pass",
    "pass",
  ],
  ["blocking-layer", button + blocker, "pass", "fail"],
  [
    "transparent-blocking-layer",
    button + blocker.replace("background:#ddd", "background:transparent"),
    "pass",
    "fail",
  ],
  [
    "decorative-layer",
    button + blocker.replace("z-index:10", "z-index:10;pointer-events:none"),
    "pass",
    "pass",
  ],
  [
    "disabled-under-layer",
    button.replace("<button ", "<button disabled ") + blocker,
    "pass",
    "pass",
  ],
  [
    "inert-background",
    "<section inert>" + button + "</section>" + blocker,
    "pass",
    "pass",
  ],
  [
    "transparent-parent",
    '<section style="opacity:0">' + button + "</section>" + blocker,
    "pass",
    "pass",
  ],
  [
    "modal-background",
    button +
      '<div role="dialog" aria-modal="true" aria-label="Dialog" style="position:absolute;left:40px;top:140px;width:190px;height:100px;background:white;z-index:20">Dialog offen</div>',
    "pass",
    "pass",
  ],
  [
    "modal-internal-blocker",
    '<div role="dialog" aria-modal="true" aria-label="Dialog" style="position:absolute;left:0;top:0;width:300px;height:400px;background:white">' +
      button +
      blocker +
      "</div>",
    "pass",
    "fail",
  ],
  [
    "hidden-modal",
    '<div role="dialog" aria-modal="true" style="display:none">Nicht offen</div>' +
      button +
      blocker,
    "pass",
    "fail",
  ],
  [
    "partial-decoration",
    button +
      '<span style="position:absolute;left:50px;top:150px;width:10px;height:10px;z-index:20">*</span>',
    "pass",
    "pass",
  ],
  ["denied-redirect", "", "unknown", "unknown"],
  [
    "fixed-overlay-intent-unknown",
    button + blocker.replace("position:absolute", "position:fixed"),
    "pass",
    "unknown",
  ],
] as const;
export const baselineCases = cases.map(([id, body, overflow, covered]) => ({
  id,
  body,
  labels: [
    { caseId: id, ruleId: "horizontal-overflow", expected: overflow },
    { caseId: id, ruleId: "covered-control", expected: covered },
  ] satisfies EvaluationLabel[],
}));
export function baselineHtml(id: string): string | undefined {
  const entry = baselineCases.find((item) => item.id === id);
  if (!entry) return undefined;
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Referenz ${entry.id}</title><meta name="description" content="Autorisierte synthetische Referenz"><style>*{box-sizing:border-box}body{margin:24px;font:18px system-ui;color:#17251e;background:white}button,input{font:inherit}</style></head><body><main><h1>Referenzprüfung</h1>${entry.body}</main></body></html>`;
}
