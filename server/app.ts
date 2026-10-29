import Fastify from "fastify";
import { readFile, access } from "node:fs/promises";
import { join, resolve, relative } from "node:path";
import { timingSafeEqual, randomBytes } from "node:crypto";
import { zipSync, strToU8 } from "fflate";
import { Store } from "./store.js";
import { Runner } from "./runner.js";
import { dependencies } from "./dependencies.js";
import { parseTarget, validateTarget, requestAllowed } from "./security.js";
import { demoPage } from "./demo.js";
import { discoverPages } from "./scan-worker.js";
import { normalizeScanOptions } from "./options.js";
import { calculateScore } from "./services/scoring.js";
import { compareScans } from "./services/comparison.js";
import {
  buildTasks,
  buildMarkdownReport,
  buildJsonReport,
  buildEvidenceManifest,
} from "./services/reports.js";
import { generateAiPlan, listOllamaModels } from "./services/ai.js";
import {
  parseSearchConsoleCsv,
  compareSearchDatasets,
} from "./services/search-console.js";
import { createBackup } from "./backup.js";
import { speechAvailable, speak, stopSpeech } from "./speech.js";
import type {
  Environment,
  HubSettings,
  Scan,
  SearchImportMetadata,
  TaskStatus,
} from "../shared/types.js";

import { APP_VERSION as VERSION } from "../shared/version.js";
const bad = (message: string, statusCode = 400) =>
  Object.assign(new Error(message), { statusCode });
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw bad("Ein JSON-Objekt wird erwartet.");
  return value as Record<string, unknown>;
}
export async function createApp(options: {
  port: number;
  dataDir: string;
  dev?: boolean;
  runJobs?: boolean;
}) {
  const app = Fastify({ logger: false, bodyLimit: 2_200_000 });
  const store = new Store(options.dataDir);
  const origin = `http://127.0.0.1:${options.port}`;
  const runner = new Runner(store, origin);
  const session = randomBytes(32).toString("hex");
  let operation: "discovery" | "ai" | "backup" | null = null;
  const aiControllers = new Set<AbortController>();
  const idle = () => {
    if (operation || runner.isBusy())
      throw bad(
        "Zuerst die aktive Prüfung oder Analyse abschließen. Aufwendige Arbeiten laufen nacheinander.",
        409,
      );
  };
  const requireScan = (id: string) => {
    const scan = store.scan(id);
    if (!scan) throw bad("Prüfung nicht gefunden.", 404);
    return scan;
  };
  const requireProject = (id: string) => {
    const project = store.project(id);
    if (!project) throw bad("Projekt nicht gefunden.", 404);
    return project;
  };
  const policy = (id: string) => {
    const project = requireProject(id),
      demo = store.isDemo(id);
    return {
      hubOrigin: origin,
      demoOrigin: demo ? origin : undefined,
      allowedLocalOrigin:
        project.environment === "local" && !demo
          ? new URL(project.url).origin
          : undefined,
    };
  };
  const projectUrl = (id: string) =>
    store.isDemo(id) ? `${origin}/demo-site` : requireProject(id).url;
  const score = (scan: Scan) =>
    scan.result?.audit ? calculateScore(scan.result.audit) : undefined;
  const ensureTasks = (scan: Scan) => {
    if (["queued", "running", "paused"].includes(scan.status))
      return scan.result?.audit
        ? buildTasks(requireProject(scan.projectId), scan)
        : [];
    if (scan.result?.audit)
      store.saveTasks(buildTasks(requireProject(scan.projectId), scan));
    return store.tasks(scan.id);
  };
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
    if (request.headers["sec-fetch-site"] === "cross-site")
      return reply
        .code(403)
        .send({ error: "Website-übergreifender Zugriff ist gesperrt." });
    if (request.url.startsWith("/api/")) {
      const cookie = request.headers.cookie
        ?.split(";")
        .map((v) => v.trim())
        .find((v) => v.startsWith("hub_session="))
        ?.slice(12);
      if (
        !cookie ||
        !/^[a-f0-9]{64}$/.test(cookie) ||
        !timingSafeEqual(Buffer.from(cookie), Buffer.from(session))
      )
        return reply.code(401).send({
          error: "Bitte den Hub neu laden, um eine lokale Sitzung zu starten.",
        });
      if (
        !["GET", "HEAD"].includes(request.method) &&
        request.headers["x-hub-request"] !== "1"
      )
        return reply.code(403).send({ error: "Ungültige lokale Anfrage." });
    } else if (request.url === "/" || request.url.startsWith("/?"))
      reply.header(
        "Set-Cookie",
        `hub_session=${session}; HttpOnly; SameSite=Strict; Path=/`,
      );
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
    reply.code(status).send({
      error:
        status < 500
          ? typed.message
          : "Die Anfrage konnte nicht verarbeitet werden. Prüfe den Umfang und versuche es erneut.",
    });
  });
  app.get("/api/bootstrap", async () => {
    const scans = store.scans();
    return {
      version: VERSION,
      projects: store.projects(),
      scans: scans.map((scan) => ({
        ...scan,
        result: scan.result ? { ...scan.result, audit: undefined } : null,
      })),
      dependencies: await dependencies(),
      settings: store.settings(),
      tasks: store.tasks(),
      speechAvailable,
      scores: Object.fromEntries(
        scans
          .filter((scan) => scan.result?.audit)
          .map((scan) => [scan.id, score(scan)]),
      ),
    };
  });
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
      if (!body.name.trim()) throw bad("Bitte einen Projektnamen eingeben.");
      if (store.projects().length >= 200)
        throw bad("Das Projektlimit von 200 wurde erreicht.");
      try {
        const url = parseTarget(body.url, {
          allowLocal: body.environment === "local",
        });
        if (
          body.environment === "local" &&
          [options.port, 11434].includes(Number(url.port))
        )
          throw bad(
            "Der Hub und der Modellserver sind keine freigegebenen Website-Ziele.",
          );
        await validateTarget(url, {
          allowedLocalOrigin:
            body.environment === "local" ? url.origin : undefined,
          hubOrigin: origin,
        });
        return reply.code(201).send({
          project: store.createProject(
            body.name.trim(),
            url.href,
            body.environment,
          ),
        });
      } catch (error) {
        throw bad(error instanceof Error ? error.message : "Ungültiges Ziel.");
      }
    },
  );
  app.post<{ Params: { id: string } }>(
    "/api/projects/:id/discover",
    async (request) => {
      requireProject(request.params.id);
      idle();
      const body = request.body === undefined ? {} : object(request.body);
      let normalized;
      try {
        normalized = normalizeScanOptions(
          {
            maxPages: body.maxPages,
            maxDepth: body.maxDepth,
            excludedPaths: body.excludedPaths,
          },
          projectUrl(request.params.id),
          policy(request.params.id).demoOrigin,
        );
      } catch (error) {
        throw bad((error as Error).message);
      }
      operation = "discovery";
      try {
        return await discoverPages({
          url: projectUrl(request.params.id),
          maxPages: normalized.maxPages,
          maxDepth: normalized.maxDepth,
          excludedPaths: normalized.excludedPaths,
          ...policy(request.params.id),
        });
      } catch (error) {
        throw bad((error as Error).message);
      } finally {
        operation = null;
      }
    },
  );
  const startScan = (projectId: string, rawOptions?: unknown) => {
    if (operation)
      throw bad(
        "Eine andere aufwendige Arbeit ist aktiv. Bitte kurz warten.",
        409,
      );
    requireProject(projectId);
    const active = store
      .scans()
      .filter((scan) => ["queued", "running", "paused"].includes(scan.status));
    if (active.length >= 5)
      throw bad(
        "Maximal fünf Prüfungen gleichzeitig in der Warteschlange.",
        429,
      );
    if (active.some((scan) => scan.projectId === projectId))
      throw bad("Für dieses Projekt läuft bereits eine Prüfung.", 409);
    let normalized;
    try {
      normalized = normalizeScanOptions(
        rawOptions,
        projectUrl(projectId),
        policy(projectId).demoOrigin,
      );
    } catch (error) {
      throw bad((error as Error).message);
    }
    const scan = store.createScan(projectId, normalized);
    if (options.runJobs !== false) runner.enqueue();
    return scan;
  };
  app.post<{ Params: { id: string } }>(
    "/api/projects/:id/scans",
    async (request, reply) =>
      reply
        .code(202)
        .send({ scan: startScan(request.params.id, request.body) }),
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
    return reply.code(201).send({
      project,
      scan: startScan(project.id, {
        pages: ["", "/work", "/contact"].map(
          (path) => `${origin}/demo-site${path}`,
        ),
        performance: false,
      }),
    });
  });
  for (const path of ["/demo-site", "/demo-site/*"])
    app.get(path, async (request, reply) => {
      const html = demoPage(new URL(request.url, origin).pathname);
      return html
        ? reply.type("text/html").send(html)
        : reply.code(404).type("text/plain").send("Demo page not found");
    });
  app.get<{ Params: { id: string } }>("/api/scans/:id", async (request) => {
    const scan = requireScan(request.params.id);
    return {
      scan,
      score: score(scan),
      tasks: ensureTasks(scan),
      aiPlan: store.aiPlan(scan.id),
    };
  });
  app.post<{ Params: { id: string } }>(
    "/api/scans/:id/control",
    async (request) => {
      const body = object(request.body);
      if (!["pause", "resume", "cancel"].includes(String(body.action)))
        throw bad("Ungültige Prüfaktion.");
      if (operation && body.action === "resume")
        throw bad("Andere Arbeit aktiv. Bitte später fortsetzen.", 409);
      return {
        scan: runner.control(
          request.params.id,
          body.action as "pause" | "resume" | "cancel",
        ),
      };
    },
  );
  app.get<{ Params: { id: string } }>(
    "/api/scans/:id/live",
    async (request) => {
      requireScan(request.params.id);
      return runner.live(request.params.id);
    },
  );
  app.get<{ Params: { id: string } }>(
    "/api/scans/:id/report",
    async (request) => {
      const scan = requireScan(request.params.id);
      return {
        score: score(scan),
        tasks: ensureTasks(scan),
        aiPlan: store.aiPlan(scan.id),
      };
    },
  );
  const evidenceBytes = async (path: string) => {
    if (!/^evidence\/[a-zA-Z0-9_.-]+\.png$/.test(path) || path.includes(".."))
      throw bad("Ungültiger Evidenzpfad.");
    const absolute = resolve(options.dataDir, path);
    if (relative(resolve(options.dataDir), absolute).startsWith(".."))
      throw bad("Ungültiger Evidenzpfad.");
    try {
      return await readFile(absolute);
    } catch {
      throw bad("Die Evidenzdatei fehlt. Starte eine neue Prüfung.", 404);
    }
  };
  app.get<{ Params: { id: string; evidenceId: string } }>(
    "/api/scans/:id/evidence/:evidenceId",
    async (request, reply) => {
      const scan = requireScan(request.params.id),
        evidence = scan.result?.audit?.evidence.find(
          (item) => item.id === request.params.evidenceId,
        );
      if (!evidence) throw bad("Nachweis nicht gefunden.", 404);
      return reply.type("image/png").send(await evidenceBytes(evidence.path));
    },
  );
  app.get<{ Params: { id: string } }>(
    "/api/scans/:id/screenshot",
    async (request, reply) => {
      const scan = requireScan(request.params.id);
      if (!scan.result) throw bad("Kein Screenshot verfügbar.", 404);
      const path =
        scan.result.audit?.evidence[0]?.path ||
        scan.result.screenshotPath.replaceAll("\\", "/");
      return reply.type("image/png").send(await evidenceBytes(path));
    },
  );
  app.patch<{ Params: { id: string } }>("/api/tasks/:id", async (request) => {
    const body = object(request.body);
    if (
      !["open", "in-progress", "review", "accepted"].includes(
        String(body.status),
      )
    )
      throw bad(
        "Manuell sind Offen, In Arbeit, Zur Prüfung oder Akzeptiertes Risiko erlaubt. Verifiziert wird nur durch Nachtest.",
      );
    if (!store.task(request.params.id))
      throw bad("Aufgabe nicht gefunden.", 404);
    return {
      task: store.updateTask(request.params.id, body.status as TaskStatus),
    };
  });
  app.get<{
    Params: { id: string };
    Querystring: { format?: string; includeEvidence?: string };
  }>("/api/scans/:id/export", async (request, reply) => {
    const scan = requireScan(request.params.id),
      project = requireProject(scan.projectId);
    if (!scan.result?.audit)
      throw bad(
        "Für diesen älteren Scan ist kein 1.0-Report verfügbar. Bitte neu prüfen.",
      );
    const tasks = ensureTasks(scan),
      format = request.query.format || "markdown";
    if (!["markdown", "json", "zip"].includes(format))
      throw bad("Unbekanntes Exportformat.");
    const includeEvidence =
      format === "zip" && request.query.includeEvidence === "true";
    const reportOptions = { includeEvidence };
    const markdown = buildMarkdownReport(project, scan, tasks, reportOptions),
      json = buildJsonReport(project, scan, tasks, reportOptions);
    const extension = format === "markdown" ? "md" : format;
    reply.header(
      "Content-Disposition",
      `attachment; filename="sitefenn-${scan.id}.${extension}"`,
    );
    if (format === "markdown")
      return reply.type("text/markdown; charset=utf-8").send(markdown);
    if (format === "json") return reply.type("application/json").send(json);
    const files: Record<string, Uint8Array> = {
      "REPORT.md": strToU8(markdown),
      "report.json": strToU8(json),
    };
    let size = 0;
    if (includeEvidence) {
      const ids = [
        ...new Set(
          scan.result.audit.findings.flatMap((finding) =>
            finding.evidenceId ? [finding.evidenceId] : [],
          ),
        ),
      ];
      for (const artifact of buildEvidenceManifest(scan.result.audit, ids)) {
        const bytes = await evidenceBytes(artifact.sourcePath);
        size += bytes.byteLength;
        if (size > 100 * 1024 * 1024)
          throw bad(
            "Der ZIP-Export überschreitet 100 MiB. Lade Berichte ohne Bilder herunter.",
          );
        files[artifact.archivePath] = bytes;
      }
    }
    return reply
      .type("application/zip")
      .send(Buffer.from(zipSync(files, { level: 1 })));
  });
  app.get<{ Querystring: { before?: string; after?: string } }>(
    "/api/compare",
    async (request) => {
      if (
        !request.query.before ||
        !request.query.after ||
        request.query.before === request.query.after
      )
        throw bad("Zwei unterschiedliche Prüfungen auswählen.");
      try {
        return compareScans(
          requireScan(request.query.before),
          requireScan(request.query.after),
        );
      } catch (error) {
        throw bad((error as Error).message);
      }
    },
  );
  app.get("/api/models", async () => listOllamaModels());
  app.patch("/api/settings", async (request) => {
    const body = object(request.body),
      values: Partial<HubSettings> = {};
    if (
      Object.keys(body).some((key) => !["model", "speechEnabled"].includes(key))
    )
      throw bad("Unbekannte Einstellung.");
    if (body.model !== undefined) {
      if (
        typeof body.model !== "string" ||
        body.model.length > 255 ||
        (body.model && !/^[a-zA-Z0-9._:/-]+$/.test(body.model))
      )
        throw bad("Ungültiger Modellname.");
      if (body.model) {
        const list = await listOllamaModels();
        if (!list.available || !list.models.includes(body.model))
          throw bad("Das gewählte Modell ist lokal nicht installiert.");
      }
      values.model = body.model;
    }
    if (body.speechEnabled !== undefined) {
      if (
        typeof body.speechEnabled !== "boolean" ||
        (body.speechEnabled && !speechAvailable)
      )
        throw bad("Lokale Sprachausgabe ist hier nicht verfügbar.");
      values.speechEnabled = body.speechEnabled;
      if (!body.speechEnabled) stopSpeech();
    }
    return { settings: store.updateSettings(values) };
  });
  app.post<{ Params: { id: string } }>("/api/scans/:id/ai", async (request) => {
    const scan = requireScan(request.params.id);
    if (scan.status !== "completed" || !scan.result?.audit)
      throw bad("Zuerst einen vollständigen 1.0-Check abschließen.");
    idle();
    const body = request.body === undefined ? {} : object(request.body);
    const model = body.model ?? store.settings().model;
    if (typeof model !== "string" || !model)
      throw bad(
        "Ein installiertes lokales Modell in den Einstellungen auswählen.",
      );
    if (
      body.question !== undefined &&
      (typeof body.question !== "string" || body.question.length > 1000)
    )
      throw bad("Die Frage darf maximal 1000 Zeichen enthalten.");
    if (
      body.findingId !== undefined &&
      (typeof body.findingId !== "string" ||
        !scan.result.audit.findings.some(
          (f) => f.id === body.findingId && f.evidenceId,
        ))
    )
      throw bad(
        "Der gewählte bildbelegte Befund gehört nicht zu diesem Check.",
      );
    const findings = scan.result.audit.findings
      .filter((finding) =>
        scan.result!.audit!.evidence.some(
          (evidence) => evidence.id === finding.evidenceId,
        ),
      )
      .sort(
        (a, b) =>
          Number(b.id === body.findingId) - Number(a.id === body.findingId) ||
          { critical: 0, important: 1, "nice-to-have": 2 }[a.priority] -
            { critical: 0, important: 1, "nice-to-have": 2 }[b.priority],
      )
      .slice(0, 12);
    if (!findings.length)
      throw bad(
        "Keine bildbelegten Befunde für eine lokale Erklärung vorhanden. Messwerte und Ergebnisse stehen im Report.",
      );
    const controller = new AbortController();
    aiControllers.add(controller);
    operation = "ai";
    try {
      const plan = await generateAiPlan(
        {
          findings,
          evidence: scan.result.audit.evidence,
          model,
          question: body.question as string | undefined,
        },
        controller.signal,
      );
      plan.warnings.push(
        `Diese Erklärung umfasst ${findings.length} ausgewählte bildbelegte Befunde. Weitere und rein numerische Befunde bleiben im regelbasierten Bericht.`,
      );
      return { plan: store.saveAiPlan(scan.id, plan) };
    } catch (error) {
      throw bad(
        error instanceof Error
          ? error.message
          : "Die lokale KI-Antwort konnte nicht validiert werden.",
        422,
      );
    } finally {
      aiControllers.delete(controller);
      operation = null;
    }
  });
  app.post("/api/ai/cancel", async () => {
    for (const controller of aiControllers) controller.abort();
    return { cancelled: true };
  });
  app.post("/api/speech", async (request) => {
    const body = object(request.body);
    if (!store.settings().speechEnabled)
      throw bad("Lokale Sprachausgabe zuerst ausdrücklich aktivieren.");
    if (typeof body.text !== "string") throw bad("Text fehlt.");
    try {
      speak(body.text);
      return { started: true };
    } catch (error) {
      throw bad((error as Error).message);
    }
  });
  app.post("/api/speech/stop", async () => {
    stopSpeech();
    return { stopped: true };
  });
  app.get<{ Params: { id: string } }>(
    "/api/projects/:id/search",
    async (request) => {
      requireProject(request.params.id);
      return { datasets: store.searchDatasets(request.params.id) };
    },
  );
  app.post<{ Params: { id: string } }>(
    "/api/projects/:id/search",
    async (request) => {
      requireProject(request.params.id);
      const body = object(request.body);
      if (
        typeof body.csv !== "string" ||
        Buffer.byteLength(body.csv) > 2 * 1024 * 1024
      )
        throw bad("CSV-Datei maximal 2 MiB.");
      if (store.searchDatasets(request.params.id).length >= 50)
        throw bad(
          "Pro Projekt maximal 50 Importe. Sichere ältere Daten vor weiteren Importen.",
        );
      try {
        const dataset = parseSearchConsoleCsv(
          body.csv,
          body.metadata as SearchImportMetadata,
          { id: randomBytes(16).toString("hex"), projectId: request.params.id },
        );
        store.saveSearchDataset(dataset);
        return { dataset };
      } catch (error) {
        throw bad((error as Error).message);
      }
    },
  );
  app.get<{
    Params: { id: string };
    Querystring: { before?: string; after?: string };
  }>("/api/projects/:id/search/compare", async (request) => {
    requireProject(request.params.id);
    const datasets = store.searchDatasets(request.params.id),
      before = datasets.find((item) => item.id === request.query.before),
      after = datasets.find((item) => item.id === request.query.after);
    if (!before || !after || before.id === after.id)
      throw bad("Zwei gültige unterschiedliche Datenimporte auswählen.");
    return compareSearchDatasets(before, after);
  });
  app.get("/api/data/backup", async (_request, reply) => {
    idle();
    operation = "backup";
    try {
      const bytes = await createBackup(store);
      return reply
        .type("application/zip")
        .header(
          "Content-Disposition",
          `attachment; filename="sitefenn-backup-${new Date().toISOString().slice(0, 10)}.zip"`,
        )
        .send(Buffer.from(bytes));
    } catch (error) {
      throw bad((error as Error).message);
    } finally {
      operation = null;
    }
  });
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
            "<h1>SiteFenn</h1><p>Bitte zuerst npm run build ausführen.</p>",
          ),
      );
    }
  }
  app.addHook("onClose", async () => {
    for (const controller of aiControllers) controller.abort();
    stopSpeech();
    await runner.close();
    await closeVite?.();
    store.close();
  });
  return { app, store, runner };
}
