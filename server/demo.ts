export const demoHTML = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Northstar Studio — Digitale Produkte mit Richtung</title><style>
*{box-sizing:border-box}body{margin:0;background:#f5f4ee;color:#19352c;font-family:system-ui,sans-serif}header{padding:28px 6%;display:flex;justify-content:space-between;border-bottom:1px solid #19352c22}header strong{font-size:22px}nav{display:flex;gap:30px}nav a{color:inherit;text-decoration:none}main{padding:80px 6%;max-width:1440px;margin:auto}.tag{font-size:12px;letter-spacing:2px;text-transform:uppercase}h1{font-size:clamp(40px,5vw,76px);line-height:1.06;letter-spacing:-3px;max-width:800px;margin:30px 0}p{font-size:19px;line-height:1.7;max-width:580px;color:#53645e}.button{display:inline-block;background:#244d3c;color:white;border-radius:50px;padding:16px 26px;text-decoration:none;margin-top:20px}.grid{display:grid;grid-template-columns:1.3fr 1fr;gap:24px;margin-top:60px}.card{min-height:230px;border-radius:22px;padding:30px;background:#dce8cd}.card:last-child{background:#e7dbbe}.card b{font-size:26px}.number{display:block;font-size:70px;margin-top:20px}.note{padding:20px 6%;background:#19352c;color:#e7f1df;font-size:13px}@media(max-width:700px){nav{display:none}.grid{grid-template-columns:1fr}main{padding-top:40px}h1{letter-spacing:-1px}}
@media(max-width:450px){.grid .card:first-child{min-width:420px}}</style></head><body><header><strong>northstar↗</strong><nav><a href="/demo-site/work">Projekte</a><a href="/demo-site/about">Über uns</a><a href="/demo-site/contact">Kontakt</a></nav></header><main><span class="tag">Independent digital studio / Berlin</span><h1>Gute Ideen verdienen einen klaren Auftritt.</h1><p>Wir gestalten digitale Erlebnisse, die Menschen verstehen. Strategie, Design und Entwicklung aus einer Hand.</p><a class="button" href="/demo-site/contact">Ein Projekt besprechen ↗</a><section class="grid" id="work"><div class="card"><b>Für Menschen gemacht.</b><span class="number">01 / 24</span></div><div class="card"><b>Weniger Komplexität.<br>Mehr Klarheit.</b><p>Digitale Produkte mit Substanz.</p></div></section></main><footer class="note">Integrierte Testseite · Description und Mobilbreite sind absichtlich fehlerhaft. Keine Kundendaten. <a style="color:inherit" href="/demo-site/work">Weitere Testseiten</a></footer></body></html>`;

const page = (title: string, body: string, head = "") =>
  `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} – Northstar Demo</title><meta name="description" content="Kontrollierte Beispielseite für den Website Audit Hub.">${head}<style>*{box-sizing:border-box}body{margin:0;background:#f5f4ee;color:#19352c;font:18px/1.6 system-ui}header,main,footer{padding:25px 6%}main{min-height:75vh;max-width:1100px}a{color:#244d3c}h1{font-size:clamp(36px,5vw,65px);line-height:1.1}input,button{font:inherit;padding:12px}footer{border-top:1px solid #ddd}</style></head><body><header><a href="/demo-site">northstar↗ / Demo</a></header><main>${body}</main><footer>Absichtliche Testfehler · Keine echten Kundendaten</footer></body></html>`;
export function demoPage(pathname: string): string | undefined {
  if (pathname === "/demo-site" || pathname === "/demo-site/") return demoHTML;
  if (pathname === "/demo-site/work")
    return page(
      "Unsere Arbeit",
      '<h1>Digitale Arbeit mit Substanz.</h1><p>Diese Seite enthält absichtlich ungültiges JSON-LD für den technischen SEO-Check.</p><a href="/demo-site/contact">Projekt besprechen</a>',
      '<script type="application/ld+json">{"@type":"Organization",broken}</script>',
    );
  if (pathname === "/demo-site/about")
    return page(
      "Über uns",
      '<h1>Ein kleines, gutes Team.</h1><p>Diese Seite ist die weitgehend saubere Vergleichsseite der Demo.</p><a href="/demo-site/contact">Kontakt aufnehmen</a>',
    );
  if (pathname === "/demo-site/contact")
    return page(
      "Kontakt",
      '<h1>Erzählen Sie von Ihrer Idee.</h1><p>Das Eingabefeld hat absichtlich kein zugängliches Label. Es wird nichts abgesendet.</p><p>Ihre E-Mail:</p><input type="text"><p><a href="/demo-site">Zur Startseite</a></p>',
    );
  return undefined;
}
