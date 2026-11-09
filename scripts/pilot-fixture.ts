/** Local rehearsal website. Its single HTML file is the editable source. */
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const source = `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="Öffentliche Übungsseite für einen SiteFenn-Nachtest.">
  <!-- Titel fehlt in der Ausgangsfassung -->
  <style>body{margin:2rem;font:1rem system-ui} main{max-width:45rem;margin:auto}</style>
</head>
<body><main><h1>Northstar Studio · Übungsseite</h1><p>Ein kontrollierter lokaler Ablauf für Befund, Übergabe und Nachtest.</p></main></body>
</html>
`;
export const correctedSource = source.replace(
  "<!-- Titel fehlt in der Ausgangsfassung -->",
  "<title>Northstar Studio · Übungsseite</title>",
);

export async function createPilotFixture(directory: string, port = 0) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const path = join(directory, "index.html");
  await writeFile(path, source, { flag: "wx", mode: 0o600 });
  const server = createServer(async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    if (request.url !== "/") {
      response.writeHead(404).end();
      return;
    }
    try {
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.end(await readFile(path));
    } catch {
      response
        .writeHead(503)
        .end("Übungsdatei vorübergehend nicht erreichbar.");
    }
  });
  await new Promise<void>((done, reject) =>
    server.once("error", reject).listen(port, "127.0.0.1", done),
  );
  const address = server.address();
  if (!address || typeof address === "string")
    throw Error("Kein lokaler Port.");
  return {
    path,
    url: `http://127.0.0.1:${address.port}/`,
    close: () => new Promise<void>((done) => server.close(() => done())),
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  if (!process.argv[2])
    throw Error(
      "Usage: node --import tsx scripts/pilot-fixture.ts NEW_DIRECTORY",
    );
  const fixture = await createPilotFixture(resolve(process.argv[2]));
  console.log(
    `Übungsseite: ${fixture.url}\nBearbeitbare Datei: ${fixture.path}`,
  );
  for (const signal of ["SIGTERM", "SIGINT"] as const)
    process.once(signal, () => void fixture.close());
}
