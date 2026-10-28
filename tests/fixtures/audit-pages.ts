export interface AuditFixture {
  name: string;
  body: string;
  head?: string;
  css?: string;
  title?: string | null;
  description?: boolean;
  status?: number;
  rule: string;
  expected: string;
}
export const fixtures: AuditFixture[] = [
  {
    name: "clean",
    body: '<h1>Eine klare Seite</h1><p>Vollständig lesbarer Text.</p><a href="/clean">Mehr erfahren</a>',
    rule: "horizontal-overflow",
    expected: "pass",
  },
  {
    name: "overflow",
    body: '<h1>Überbreite</h1><div id="too-wide" style="width:1800px;height:80px;background:#ddd">Breiter Inhalt</div>',
    rule: "horizontal-overflow",
    expected: "fail",
  },
  {
    name: "carousel",
    body: '<h1>Absichtliches Karussell</h1><div style="overflow-x:auto;max-width:100%"><div style="width:1800px">Horizontal scrollbarer Bereich</div></div>',
    rule: "horizontal-overflow",
    expected: "pass",
  },
  {
    name: "covered-button",
    body: '<h1>Verdeckte Aktion</h1><button id="primary" style="position:absolute;top:150px;left:40px;width:180px;height:60px">Weiter</button><div style="position:absolute;top:150px;left:40px;width:180px;height:60px;background:#fff;z-index:5">Blocker</div>',
    rule: "covered-control",
    expected: "fail",
  },
  {
    name: "modal",
    body: '<h1>Dialog</h1><button style="position:absolute;top:150px;left:40px;width:180px;height:60px">Hintergrund</button><div role="dialog" aria-modal="true" aria-label="Beispiel" style="position:absolute;top:140px;left:30px;width:230px;height:130px;background:#ddd;z-index:5">Absichtlicher Dialog</div>',
    rule: "covered-control",
    expected: "pass",
  },
  {
    name: "pointer-transparent",
    body: '<h1>Dekorative Ebene</h1><button style="position:absolute;top:150px;left:40px;width:180px;height:60px">Weiter</button><div style="pointer-events:none;position:absolute;top:150px;left:40px;width:180px;height:60px;background:#ffffff55;z-index:5"></div>',
    rule: "covered-control",
    expected: "pass",
  },
  {
    name: "clipped",
    body: '<h1>Textvorschau</h1><p id="clip" style="height:15px;overflow:hidden;width:100px">Dieser relevante Text ist länger als die eingestellte feste Höhe und wird abgeschnitten.</p>',
    rule: "horizontal-overflow",
    expected: "pass",
  },
  {
    name: "ellipsis",
    body: '<h1>Absichtliche Vorschau</h1><p style="width:140px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Ein absichtlich verkürzter Vorschautext</p>',
    rule: "horizontal-overflow",
    expected: "pass",
  },
  {
    name: "missing-title",
    title: null,
    body: "<h1>Ohne Titel</h1>",
    rule: "document-title",
    expected: "fail",
  },
  {
    name: "missing-description",
    description: false,
    body: "<h1>Ohne Zusammenfassung</h1>",
    rule: "meta-description",
    expected: "fail",
  },
  {
    name: "noindex",
    head: '<meta name="robots" content="noindex,follow">',
    body: "<h1>Nicht indexieren</h1>",
    rule: "indexability",
    expected: "fail",
  },
  {
    name: "indexable",
    head: '<meta name="robots" content="index,follow">',
    body: "<h1>Indexierbare Absicht</h1>",
    rule: "indexability",
    expected: "pass",
  },
  {
    name: "invalid-jsonld",
    head: '<script type="application/ld+json">{"broken":}</script>',
    body: "<h1>JSON-Fehler</h1>",
    rule: "structured-data-json",
    expected: "fail",
  },
  {
    name: "valid-jsonld",
    head: '<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage","name":"Test"}</script>',
    body: "<h1>JSON-Syntax korrekt</h1>",
    rule: "structured-data-json",
    expected: "pass",
  },
  {
    name: "invalid-canonical",
    head: '<link rel="canonical" href="javascript:alert(1)">',
    body: "<h1>Canonical-Fehler</h1>",
    rule: "canonical-valid",
    expected: "fail",
  },
  {
    name: "unlabelled-input",
    body: '<h1>Fehlendes Label</h1><input type="text">',
    rule: "axe-automated",
    expected: "fail",
  },
  {
    name: "bad-contrast",
    body: '<h1>Schlechter Kontrast</h1><p style="background:#fff;color:#eee">Dieser Text hat kaum Kontrast.</p>',
    rule: "axe-automated",
    expected: "fail",
  },
  {
    name: "missing-image",
    body: '<h1>Bildfehler</h1><img src="/asset-does-not-exist.png" alt="Fehlendes Bild">',
    rule: "resource-errors",
    expected: "fail",
  },
  {
    name: "script-error",
    body: '<h1>Scriptfehler</h1><script>throw new Error("Intentional fixture error")</script>',
    rule: "script-errors",
    expected: "fail",
  },
  {
    name: "server-error",
    status: 500,
    body: "<h1>Serverfehler</h1>",
    rule: "http-status",
    expected: "fail",
  },
];
export function fixtureHTML(fixture: AuditFixture) {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${fixture.title === null ? "" : `<title>${fixture.title || fixture.name}</title>`}${fixture.description === false ? "" : '<meta name="description" content="Kontrollierte Audit-Testseite">'}${fixture.head || ""}<style>*{box-sizing:border-box}body{margin:24px;color:#17251e;background:#fff;font:18px system-ui}button,input{font:inherit} ${fixture.css || ""}</style></head><body><main>${fixture.body}</main></body></html>`;
}
