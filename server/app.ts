import Fastify from "fastify";
import { readFile, access } from "node:fs/promises";
import { join, resolve } from "node:path";
import { timingSafeEqual, randomBytes } from "node:crypto";
import { Store } from "./store.js";
import { Runner } from "./runner.js";
import { dependencies } from "./dependencies.js";
import { parseTarget, assertPublicTarget, requestAllowed } from "./security.js";
import { demoHTML } from "./demo.js";
import type { Environment } from "../shared/types.js";

export async function createApp(options: {
  port: number;
  dataDir: string;
  dev?: boolean;
  runJobs?: boolean;
}) {
  const app = Fastify({ logger: false, bodyLimit: 16_384 });
  const store = new Store(options.dataDir);
  const origin = `http://127.0.0.1:${options.port}`;
  const runner = new Runner(store, origin);
  const session = randomBytes(32).toString("hex");
  app.addHook("onRequest", async (request, reply) => {
    if (
      !requestAllowed(
        request.headers.host,
        request.headers.origin,
        options.port,
      )
    )
      return reply
        .code(403)
        .send({ error: "Zugriff nur über die lokale Hub-Adresse erlaubt." });
    const fetchSite = request.headers["sec-fetch-site"];
    if (fetchSite === "cross-site")
      return reply
        .code(403)
        .send({ error: "Website-übergreifender Zugriff ist gesperrt." });
    if (request.url.startsWith("/api/")) {
      const cookie = request.headers.cookie
        ?.split(";")
        .map((v) => v.trim())
        .find((v) => v.startsWith("hub_session="))
        ?.slice(12);
      const equal =
        cookie &&
        /^[a-f0-9]{64}$/.test(cookie) &&
        timingSafeEqual(Buffer.from(cookie), Buffer.from(session));
      if (!equal)
        return reply
          .code(401)
          .send({
            error:
              "Bitte den Hub neu laden, um eine lokale Sitzung zu starten.",
          });
      if (
        !["GET", "HEAD"].includes(request.method) &&
        request.headers["x-hub-request"] !== "1"
      )
        return reply.code(403).send({ error: "Ungültige lokale Anfrage." });
    } else if (request.url === "/" || request.url.startsWith("/?")) {
      reply.header(
        "Set-Cookie",
        `hub_session=${session}; HttpOnly; SameSite=Strict; Path=/`,
      );
    }
    reply
      .header("X-Content-Type-Options", "nosniff")
      .header("Referrer-Policy", "no-referrer")
      .header("X-Frame-Options", "DENY");
    if (request.url.startsWith("/api/"))
      reply.header("Cache-Control", "no-store");
  });
  app.setErrorHandler((error, _request, reply) => {
    const typed = error as { statusCode?: number; message?: string };
    const status = typed.statusCode || 500;
    reply
      .code(status)
      .send({
        error:
          status < 500
            ? typed.message
            : "Die Anfrage konnte nicht verarbeitet werden.",
      });
  });
  app.get("/api/bootstrap", async () => ({
    version: "0.1.0",
    projects: store.projects(),
    scans: store.scans(),
    dependencies: await dependencies(),
  }));
  app.post(
    "/api/projects",
    {
      schema: {
        body: {
          type: "object",
          required: ["name", "url", "environment", "acknowledged"],
          additionalProperties: false,
          properties: {
            name: { type: "string", minLength: 1, maxLength: 80 },
            url: { type: "string", maxLength: 2048 },
            environment: {
              type: "string",
              enum: ["production", "staging", "local"],
            },
            acknowledged: { type: "boolean", const: true },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        name: string;
        url: string;
        environment: Environment;
      };
      if (!body.name.trim())
        return reply
          .code(400)
          .send({ error: "Bitte einen Projektnamen eingeben." });
      try {
        const url = parseTarget(body.url);
        await assertPublicTarget(url);
        const project = store.createProject(
          body.name.trim(),
          url.href,
          body.environment,
        );
        return reply.code(201).send({ project });
      } catch (error) {
        return reply
          .code(400)
          .send({
            error: error instanceof Error ? error.message : "Ungültiges Ziel.",
          });
      }
    },
  );
  const startScan = (projectId: string) => {
    if (
      store.scans().filter((s) => ["queued", "running"].includes(s.status))
        .length >= 5
    )
      throw Object.assign(
        new Error("Maximal fünf Prüfungen gleichzeitig in der Warteschlange."),
        { statusCode: 429 },
      );
    if (
      store
        .scans()
        .some(
          (s) =>
            s.projectId === projectId &&
            ["queued", "running"].includes(s.status),
        )
    )
      throw Object.assign(
        new Error("Für dieses Projekt läuft bereits eine Prüfung."),
        { statusCode: 409 },
      );
    const scan = store.createScan(projectId);
    if (options.runJobs !== false) runner.enqueue();
    return scan;
  };
  app.post<{ Params: { id: string } }>(
    "/api/projects/:id/scans",
    async (request, reply) => {
      if (!store.project(request.params.id))
        return reply.code(404).send({ error: "Projekt nicht gefunden." });
      return reply.code(202).send({ scan: startScan(request.params.id) });
    },
  );
  app.post("/api/demo", async (_request, reply) => {
    const project =
      store.projects().find((p) => store.isDemo(p.id)) ||
      store.createProject(
        "Northstar Studio · Demo",
        `${origin}/demo-site`,
        "local",
        true,
      );
    return reply.code(201).send({ project, scan: startScan(project.id) });
  });
  app.get("/demo-site", async (_request, reply) =>
    reply.type("text/html").send(demoHTML),
  );
  app.get<{ Params: { id: string } }>(
    "/api/scans/:id/screenshot",
    async (request, reply) => {
      const scan = store.scan(request.params.id);
      if (!scan?.result)
        return reply.code(404).send({ error: "Kein Screenshot verfügbar." });
      try {
        return reply
          .type("image/png")
          .send(
            await readFile(join(options.dataDir, "evidence", `${scan.id}.png`)),
          );
      } catch {
        return reply
          .code(404)
          .send({ error: "Die Evidenzdatei fehlt. Starte eine neue Prüfung." });
      }
    },
  );
  let closeVite: (() => Promise<void>) | undefined;
  if (options.dev) {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    closeVite = () => vite.close();
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith("/api/"))
        return reply.code(404).send({ error: "API-Endpunkt nicht gefunden." });
      for (const [name, value] of Object.entries(reply.getHeaders()))
        if (value !== undefined) reply.raw.setHeader(name, value);
      reply.hijack();
      vite.middlewares(request.raw, reply.raw, () => {
        reply.raw.statusCode = 404;
        reply.raw.end("Not found");
      });
    });
  } else {
    const webRoot = resolve("dist/web");
    try {
      await access(join(webRoot, "index.html"));
      await app.register((await import("@fastify/static")).default, {
        root: webRoot,
        wildcard: false,
      });
      app.setNotFoundHandler((_request, reply) =>
        reply.code(404).send({ error: "Nicht gefunden." }),
      );
    } catch {
      app.get("/", async (_request, reply) =>
        reply
          .type("text/html")
          .send(
            "<h1>Website Audit Hub</h1><p>Bitte zuerst npm run build ausführen.</p>",
          ),
      );
    }
  }
  app.addHook("onClose", async () => {
    await runner.close();
    await closeVite?.();
    store.close();
  });
  return { app, store };
}
