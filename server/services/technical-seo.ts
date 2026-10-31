import { createRequire } from "node:module";
const robotsParser = createRequire(import.meta.url)("robots-parser") as (
  url: string,
  text: string,
) => { isAllowed: (url: string, agent: string) => boolean | undefined };
import type {
  AuditReport,
  RuleStatus,
  SeoContext,
  SeoProbe,
  SeoSnapshot,
  Environment,
} from "../../shared/types.js";
import { hasNoindex, rawSeoMeta } from "./seo-meta.js";
import { permittedUrl, readScoped, type SeoPolicy } from "./seo-network.js";
export { TECHNICAL_RULES } from "../../shared/report-contract.js";
export interface SeoCheck {
  page: SeoSnapshot;
  id: string;
  status: RuleStatus;
  kind: "measured" | "heuristic";
  title: string;
  detail: string;
  action: string;
  acceptance: string;
  source?: string;
}
export function emptySeo(): SeoContext {
  return {
    version: "technical-seo-1.4",
    pages: [],
    probes: [],
    robots: {
      url: "",
      statusCode: null,
      googlebot: [],
      detail: "Noch nicht geprüft.",
    },
    graph: [],
    duplicates: [],
    coverage: {
      linkTargets: 0,
      checkedTargets: 0,
      limit: 40,
      omittedTargets: 0,
      linksTruncated: false,
    },
    warnings: [],
  };
}
const normalize = (value: string) =>
  value
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("de-DE");
export async function technicalSeo(
  report: AuditReport,
  policy: SeoPolicy,
  environment: Environment,
  hooks: {
    checkpoint: () => Promise<void>;
    progress: (detail: string) => void;
  },
): Promise<{ context: SeoContext; checks: SeoCheck[] }> {
  const context = report.seo ?? emptySeo(),
    signal = AbortSignal.timeout(90000),
    network = { ...policy, requestBudget: { remaining: 60 } },
    checks: SeoCheck[] = [];
  const pages = context.pages;
  context.warnings = [];
  context.coverage.linksTruncated = false;
  context.probes = [];
  context.graph = [];
  context.duplicates = [];
  const targets = new Set<string>(),
    edgeMap = new Map<string, SeoContext["graph"][number]>();
  for (const page of pages) targets.add(page.pageUrl);
  for (const page of pages) {
    for (const c of page.canonicals) {
      try {
        targets.add(new URL(c, page.finalUrl).href.split("#")[0]!);
      } catch {
        /* Recorded invalid canonical handled by the syntax rule. */
      }
    }
    for (const link of page.links) {
      try {
        const u = new URL(link.url, page.finalUrl);
        u.hash = "";
        if (
          !["http:", "https:"].includes(u.protocol) ||
          u.origin !== new URL(policy.url).origin ||
          u.username ||
          u.password
        )
          continue;
        const key = JSON.stringify([page.pageUrl, u.href, link.text, link.rel]),
          edge = edgeMap.get(key);
        if (edge) {
          if (!edge.viewportIds.includes(page.viewportId))
            edge.viewportIds.push(page.viewportId);
        } else if (edgeMap.size < 1500)
          edgeMap.set(key, {
            from: page.pageUrl,
            to: u.href,
            text: link.text,
            rel: link.rel,
            viewportIds: [page.viewportId],
            probeUrl: u.href,
          });
        else context.coverage.linksTruncated = true;
        targets.add(u.href);
      } catch {
        /* Non-HTTP/invalid anchors are outside this graph. */
      }
    }
    if (page.linksTruncated) context.coverage.linksTruncated = true;
  }
  context.graph = [...edgeMap.values()];
  try {
    const robotsUrl = permittedUrl("/robots.txt", policy.url, policy);
    hooks.progress("Robots-Angaben im freigegebenen Ursprung lesen.");
    await hooks.checkpoint();
    const r = await readScoped(robotsUrl, network, signal, 32768, true);
    context.robots.url = robotsUrl;
    context.robots.statusCode = r.statusCode;
    if (
      r.statusCode !== 200 ||
      /html/i.test(String(r.headers["content-type"])) ||
      /^\s*</.test(r.body)
    )
      throw new Error(
        `robots.txt nicht als vollständiger Text verfügbar (HTTP ${r.statusCode}).`,
      );
    const robots = robotsParser(robotsUrl, r.body);
    context.robots.googlebot = [...new Set(pages.map((p) => p.finalUrl))].map(
      (pageUrl) => ({
        pageUrl,
        allowed: robots.isAllowed(pageUrl, "Googlebot") ?? null,
      }),
    );
    context.robots.detail =
      "Begrenzte Auswertung der erhaltenen robots.txt für Googlebot. Keine Zugriffserlaubnis und kein Indexierungsnachweis.";
  } catch (error) {
    context.robots.detail = `Robots-Kontext unbekannt: ${(error as Error).message}`;
  }
  let bodyBudget = 8 * 1024 * 1024;
  for (const url of [...targets].slice(0, 40)) {
    await hooks.checkpoint();
    hooks.progress(
      `HTTP-Stichprobe ${context.probes.length + 1}/maximal 40 Ziel-URLs.`,
    );
    if (
      signal.aborted ||
      bodyBudget <= 0 ||
      network.requestBudget.remaining <= 0
    )
      break;
    try {
      permittedUrl(url, policy.url, policy);
      const r = await readScoped(
        url,
        network,
        signal,
        Math.min(256 * 1024, bodyBudget),
        false,
      );
      bodyBudget -= Buffer.byteLength(r.body);
      const header = [r.headers["x-robots-tag"]]
        .flat()
        .filter((v): v is string => typeof v === "string");
      let noindex: boolean | undefined, canonicals: string[] | undefined;
      let metadataLimited = r.truncated;
      if (!r.truncated) {
        if (/html/i.test(String(r.headers["content-type"]))) {
          try {
            const meta = rawSeoMeta(r.body);
            noindex = hasNoindex(meta.robots, meta.googlebot, header);
            canonicals = meta.canonicals;
          } catch {
            metadataLimited = true;
            if (hasNoindex([], [], header)) noindex = true;
          }
        } else noindex = hasNoindex([], [], header);
      } else if (hasNoindex([], [], header)) noindex = true;
      context.probes.push({
        url,
        finalUrl: r.url,
        statusCode: r.statusCode,
        redirects: r.redirects,
        outcome: [401, 403, 405, 429].includes(r.statusCode)
          ? "restricted"
          : "checked",
        detail: metadataLimited
          ? "HTTP-Status gemessen; Antwortkörper begrenzt, vollständige Metadaten unbekannt."
          : "Einmalige GET-Stichprobe ohne Anmeldung. Zielmetadaten stammen aus unverändertem HTTP-HTML, nicht aus einer JavaScript-Ausführung.",
        checkedAt: new Date().toISOString(),
        noindex,
        canonicals,
      });
    } catch (error) {
      const e = error as Error & {
        redirects?: SeoProbe["redirects"];
        statusCode?: number;
        finalUrl?: string;
      };
      context.probes.push({
        url,
        finalUrl: e.finalUrl,
        statusCode: e.statusCode ?? null,
        redirects: e.redirects ?? [],
        outcome: "unknown",
        detail: e.message,
        checkedAt: new Date().toISOString(),
      });
    }
  }
  context.coverage = {
    ...context.coverage,
    linkTargets: targets.size,
    checkedTargets: context.probes.filter((p) => p.outcome === "checked")
      .length,
    limit: 40,
    omittedTargets: Math.max(0, targets.size - context.probes.length),
  };
  if (context.coverage.omittedTargets || context.coverage.linksTruncated)
    context.warnings.push(
      "Begrenzter Linkkontext: maximal 100 Anker pro Seite/Profil, 1.500 Graphkanten, 40 Zielproben, 60 HTTP-Anfragen inkl. Redirects und 90 Sekunden. Fehlende Prüfungen bleiben unbekannt.",
    );
  const lookup = new Map(context.probes.map((p) => [p.url, p]));
  for (const viewport of report.options.viewports)
    for (const kind of ["title", "description"] as const) {
      const groups = new Map<string, SeoSnapshot[]>();
      for (const p of pages.filter((p) => p.viewportId === viewport.id)) {
        const key = normalize(p[kind]);
        if (key && !p.signalsTruncated)
          groups.set(key, [...(groups.get(key) ?? []), p]);
      }
      for (const group of groups.values()) {
        const distinct = [
          ...new Map(group.map((p) => [p.finalUrl, p])).values(),
        ];
        if (distinct.length > 1)
          context.duplicates.push({
            kind,
            value: distinct[0]![kind],
            pages: distinct.map((p) => p.pageUrl),
            viewportId: viewport.id,
          });
      }
    }
  for (const page of pages) {
    const add = (
      id: string,
      status: RuleStatus,
      kind: SeoCheck["kind"],
      title: string,
      detail: string,
      action: string,
      acceptance: string,
      source?: string,
    ) =>
      checks.push({
        page,
        id,
        status,
        kind,
        title,
        detail,
        action,
        acceptance,
        source,
      });
    const links = context.graph.filter(
        (e) =>
          e.from === page.pageUrl && e.viewportIds.includes(page.viewportId),
      ),
      probes = links.map((e) => lookup.get(e.to));
    const failed = probes.filter(
      (p): p is SeoProbe =>
        !!p &&
        p.outcome === "checked" &&
        p.statusCode !== null &&
        p.statusCode >= 400,
    );
    const unknown =
      page.linksTruncated ||
      context.coverage.linksTruncated ||
      probes.some((p) => !p || p.outcome !== "checked");
    add(
      "seo-internal-links",
      failed.length ? "fail" : unknown ? "not_run" : "pass",
      "measured",
      "Interne Linkziele mit beobachtetem HTTP-Fehler",
      failed.length
        ? failed
            .slice(0, 10)
            .map((p) => `${p.url}: HTTP ${p.statusCode} (${p.checkedAt})`)
            .join("; ")
        : unknown
          ? "Nicht alle beobachteten internen Linkziele konnten unter den gewählten Grenzen geprüft werden."
          : `${probes.length} beobachtete interne Linkziele ohne gemessenen HTTP-Fehler. Keine Aussage über Ankerfragmente, verwaiste Seiten oder vollständige Linkabdeckung.`,
      "Betroffene Verweise oder Ziele im Quellprojekt prüfen und dieselben URLs nachtesten.",
      "Im vollständig erfassten Linkumfang bleiben keine HTTP-Fehler; ausgeschlossene oder begrenzte Ziele bleiben unbekannt.",
    );
    const related = [lookup.get(page.pageUrl), ...probes],
      chains = related.filter(
        (p): p is SeoProbe => !!p && p.redirects.length > 1,
      );
    add(
      "seo-redirects",
      chains.length
        ? "fail"
        : unknown || related.some((p) => !p || p.outcome !== "checked")
          ? "not_run"
          : "pass",
      "heuristic",
      "Mehrstufige Redirects im geprüften Kontext",
      chains.length
        ? chains
            .slice(0, 5)
            .map(
              (p) =>
                `${p.url}: ${p.redirects.length} beobachtete Weiterleitungen bis ${p.finalUrl ?? "unbekannt"}.`,
            )
            .join(" ")
        : "Redirect-Stichproben geprüft, soweit Ziel und Budget dies erlauben. Einzelne Redirects können beabsichtigt sein.",
      "Prüfen, ob interne Links direkt auf das beabsichtigte endgültige Ziel zeigen können.",
      "Redirect-Verhalten und beabsichtigte Ziel-URL erneut unter denselben Grenzen prüfen.",
    );
    const ownNoindex = hasNoindex(
        page.robots,
        page.googlebot,
        page.headerRobots,
      ),
      allowed = context.robots.googlebot.find(
        (r) => r.pageUrl === page.finalUrl,
      )?.allowed;
    const conflict =
      environment === "production" && ownNoindex && allowed === false;
    add(
      "seo-robots-context",
      environment !== "production"
        ? "not_applicable"
        : conflict
          ? "fail"
          : page.signalsTruncated || allowed === undefined || allowed === null
            ? "not_run"
            : "pass",
      "heuristic",
      "Googlebot-Blockierung und noindex gemeinsam prüfen",
      conflict
        ? "Die gelesene robots.txt blockiert diese URL für Googlebot, während im gerenderten Dokument oder Header noindex steht. Ein Crawler könnte noindex dadurch nicht sehen; tatsächliche Google-Verarbeitung ist unbekannt."
        : environment !== "production"
          ? "Staging/lokal: keine Produktions-Indexierungsabsicht vorausgesetzt."
          : context.robots.detail,
      "Dokumentierte Indexierungsabsicht und Zugangsschutz prüfen; robots.txt ist keine Zugriffssperre und kein Beweis einer Deindexierung.",
      "Robots- und Indexierungsangaben passen zur ausdrücklich festgelegten Absicht.",
      "https://developers.google.com/search/docs/crawling-indexing/block-indexing",
    );
    let canonicalStatus: RuleStatus = page.signalsTruncated
        ? "not_run"
        : "not_applicable",
      canonicalDetail =
        "Kein HTML-Canonical beobachtet. Fehlendes Canonical ist nicht automatisch ein Fehler.",
      canonicalKind: SeoCheck["kind"] = "measured";
    if (page.canonicals.length) {
      canonicalStatus = "pass";
      const problems: string[] = [],
        uncertain: string[] = [];
      if (page.signalsTruncated)
        uncertain.push(
          "Metadatenbudget erreicht; Canonical-/Robots-Angaben unvollständig.",
        );
      if (page.canonicals.length > 1) {
        problems.push("Mehrere HTML-Canonical-Angaben beobachtet.");
        canonicalKind = "heuristic";
      }
      if (environment === "production" && ownNoindex) {
        problems.push(
          "Canonical und noindex gemeinsam vorhanden; Indexierungsabsicht manuell prüfen.",
        );
        canonicalKind = "heuristic";
      }
      for (const value of page.canonicals) {
        let u: URL;
        try {
          u = new URL(value, page.finalUrl);
        } catch {
          uncertain.push(
            "Canonical syntaktisch ungültig; Basisregel beachten.",
          );
          continue;
        }
        if (u.hash) {
          problems.push("Canonical enthält ein Fragment.");
          canonicalKind = "heuristic";
        }
        u.hash = "";
        const p = lookup.get(u.href);
        if (!p || p.outcome !== "checked") {
          uncertain.push(
            `${u.href}: Ziel nicht vollständig geprüft (Freigabe/Budget/Antwort).`,
          );
          continue;
        }
        if (p.statusCode !== null && p.statusCode >= 400)
          problems.push(`${u.href}: beobachteter HTTP-Status ${p.statusCode}.`);
        const renderedTarget = pages.find(
          (other) =>
            other.finalUrl === p.finalUrl &&
            other.viewportId === page.viewportId,
        );
        const targetNoindex =
          p.noindex === true ||
          (!!renderedTarget &&
            hasNoindex(
              renderedTarget.robots,
              renderedTarget.googlebot,
              renderedTarget.headerRobots,
            ));
        if (targetNoindex) {
          problems.push(
            `${u.href}: noindex im Ziel-HTTP-HTML/Header oder gerenderten Zielbericht beobachtet.`,
          );
          canonicalKind = "heuristic";
        }
        if (p.noindex === undefined)
          uncertain.push(`${u.href}: Indexierungsangaben im Ziel unbekannt.`);
        if (p.redirects.length) {
          problems.push(
            `${u.href}: Canonical-Ziel leitet weiter; beabsichtigtes Endziel prüfen.`,
          );
          canonicalKind = "heuristic";
        }
      }
      canonicalStatus = problems.length
        ? "fail"
        : uncertain.length
          ? "not_run"
          : "pass";
      canonicalDetail =
        [...problems, ...uncertain].join(" ") ||
        "HTML-Canonical-Ziele in der begrenzten HTTP-Stichprobe erreichbar, ohne dort beobachtetes noindex. Zielabsicht und Googles Canonical-Auswahl bleiben unbekannt.";
    }
    add(
      "seo-canonical-target",
      canonicalStatus,
      canonicalKind,
      "Canonical-Signale und Ziel prüfen",
      canonicalDetail,
      "Canonical-Ziel, Redirects und Indexierungsabsicht im Quellprojekt abstimmen.",
      "Ziel ist wie beabsichtigt erreichbar; Signale wurden erneut geprüft. Dies bestätigt keine Google-Auswahl.",
      "https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls",
    );
    for (const kind of ["title", "description"] as const) {
      const group = context.duplicates.find(
          (g) =>
            g.kind === kind &&
            g.viewportId === page.viewportId &&
            g.pages.includes(page.pageUrl),
        ),
        distinct = new Set(
          pages
            .filter((p) => p.viewportId === page.viewportId)
            .map((p) => p.finalUrl),
        ).size;
      const complete =
        report.coverage.completed === report.coverage.planned &&
        pages
          .filter((p) => p.viewportId === page.viewportId)
          .every((p) => !p.signalsTruncated);
      add(
        `seo-duplicate-${kind}`,
        group ? "fail" : distinct < 2 || !complete ? "not_run" : "pass",
        "heuristic",
        `${kind === "title" ? "Gleicher Seitentitel" : "Gleiche Meta Description"} in mehreren geprüften Seiten${group ? `: ${group.value.slice(0, 70)}` : ""}`,
        group
          ? `${group.pages.length} verschiedene geprüfte Dokumente im Profil ${page.viewportId}: ${group.pages.join(", ")}. Ähnlichkeit ist ein Prüfkandidat; gemeinsame Template-Ursache oder Rankingverlust sind nicht nachgewiesen.`
          : distinct < 2 || !complete
            ? "Zu wenig vollständiger Seitenkontext für eine vergleichende Aussage."
            : "Keine normalisierten Duplikate zwischen den tatsächlich geprüften Dokumenten dieses Profils gefunden. Kein vollständiger Website-Abgleich.",
        "Inhaltliche Absicht und mögliche Template-Übernahmen prüfen; relevante Seiten bei Bedarf unterscheiden.",
        "Erneuter Vergleich der betroffenen Seiten; legitime Gemeinsamkeiten redaktionell bewerten.",
      );
    }
    add(
      "seo-breadcrumb-profile",
      page.jsonld.status,
      "heuristic",
      "JSON-LD im eingeschränkten Breadcrumb-Profil prüfen",
      page.jsonld.detail,
      "Inline-Breadcrumb-Angaben anhand der dokumentierten Google-Eigenschaften prüfen; andere Schema-Typen und Rich-Result-Eignung separat validieren.",
      "Die unterstützten Inline-Felder sind konsistent. Ein Erfolg bestätigt weder sichtbare Inhalte noch Google-Rich-Results.",
      "https://developers.google.com/search/docs/appearance/structured-data/breadcrumb",
    );
  }
  return { context, checks };
}
