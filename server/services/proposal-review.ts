import { createHash, randomUUID } from "node:crypto";
import type {
  AuditReport,
  Finding,
  PageAnalysis,
  PageSolution,
} from "../../shared/types.js";
import type {
  ProposalEdits,
  ProposalReview,
  ReviewIssue,
} from "../../shared/proposal-review.js";
import { validateReport } from "../../shared/report-contract.js";
import { observationFacts } from "../../shared/analysis-facts.js";
import { canonical } from "./comparison.js";
const hash = (value: unknown) =>
  createHash("sha256").update(canonical(value)).digest("hex");
export const originalSolution = (job: PageAnalysis, findingId: string) =>
  job.parts
    .filter((p) => p.status === "completed")
    .flatMap((p) => p.solutions)
    .find((s) => s.findingId === findingId);
export function proposalIssues(
  solution: Pick<
    PageSolution,
    "explanation" | "cause" | "steps" | "acceptance" | "code"
  >,
  finding: Finding,
  report: AuditReport,
  mode: ProposalEdits["codeMode"] = "captured",
): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  const add = (code: string, detail: string) => {
    if (!issues.some((i) => i.code === code)) issues.push({ code, detail });
  };
  const prose = [
    solution.explanation,
    solution.cause,
    ...solution.steps,
    solution.acceptance,
  ].join("\n");
  for (const [device, pattern] of [
    ["desktop", /\b(?:desktop|desktopansicht)\b/i],
    ["tablet", /\btablet\b/i],
    ["mobile", /\b(?:mobile|mobilen?|handy)\b/i],
  ] as const)
    if (pattern.test(prose) && device !== finding.viewportId)
      add(
        "wrong-device",
        `Der Entwurf nennt ${device}; die gewählte Fundstelle ist ${finding.viewportId}. Zusatzprüfungen separat planen.`,
      );
  const factual = [
    solution.explanation,
    solution.cause,
    ...solution.steps.filter((s) =>
      /gemessen|erfasst|measured|recorded|beträgt|ist aktuell/i.test(s),
    ),
  ].join(" ");
  const recorded = JSON.stringify({
    viewport: report.options.viewports.find((v) => v.id === finding.viewportId),
    rect: finding.rect,
    styles: finding.elementContext,
    detail: finding.detail,
  });
  const recordedNumbers = new Set(
    [...recorded.matchAll(/-?\d+(?:[.,]\d+)?/g)].map((m) =>
      String(Number(m[0].replace(",", "."))),
    ),
  );
  const capturedTokens = new Set(
    finding.selector?.match(/#[A-Za-z_][\w-]*|\.[A-Za-z_][\w-]*/g) ?? [],
  );
  const selectorProse = prose.replace(/https?:\/\/[^\s<>]+/g, "");
  for (const token of selectorProse.match(
    /#[A-Za-z_][\w-]*|\.[A-Za-z_][\w-]*/g,
  ) ?? [])
    if (
      !capturedTokens.has(token) &&
      !(mode === "illustrative" && token.startsWith(".sf-example-"))
    )
      add(
        "wrong-selector",
        `Selektor ${token} ist keine erfasste Fundstelle. Kanonischen Selektor verwenden oder ein neues Beispiel ausdrücklich kennzeichnen.`,
      );
  for (const m of factual.matchAll(/\b(\d+(?:[.,]\d+)?)\s*(px|ms|%)/g))
    if (!recordedNumbers.has(String(Number(m[1]!.replace(",", ".")))))
      add(
        "unknown-number",
        `Nicht belegter Messwert in der Erklärung: ${m[0]}.`,
      );
  if (
    /(?:alle (?:checks|prüfungen).{0,20}(?:bestanden|erfolgreich)|all (?:checks|tests) (?:passed|successful)|bereits (?:behoben|repariert)|keine (?:weiteren )?(?:fehler|befunde)|fehlerfrei)/i.test(
      prose,
    )
  )
    add(
      "unsupported-pass",
      "Der Text behauptet eine Freigabe/Behebung oder pauschale Fehlerfreiheit.",
    );
  if (
    /\b(?:sudo|curl|wget)\b|rm\s+-[rf]+|ignore (?:previous|all) instructions|reveal (?:the )?system prompt/i.test(
      prose + solution.code.text,
    )
  )
    add(
      "unsafe-instruction",
      "Anweisung außerhalb eines lokalen Reparaturentwurfs.",
    );
  const code = solution.code.text;
  if (mode === "none" && code.trim())
    add("code-mode", "Zum Verwerfen des Codes den Codeinhalt entfernen.");
  if (mode !== "none" && code.trim()) {
    if (solution.code.language === "javascript")
      add(
        "unsupported-code",
        "JavaScript-Beispiele bleiben im Original. Für diese Übernahme Code verwerfen und geprüfte Schritte formulieren.",
      );
    if (solution.code.language === "css") {
      // Selectors only occur before a CSS block. Declaration colors/decimal values are not selectors.
      const selectors = [...code.matchAll(/([^{}]+)\{/g)].flatMap((m) =>
        m[1]!.trim().split(/,\s*/),
      );
      for (const selector of selectors) {
        if (selector.startsWith("@")) continue;
        if (mode === "captured" && selector !== finding.selector)
          add(
            "wrong-selector",
            `CSS-Selektor ${selector} stimmt nicht mit der erfassten Fundstelle ${finding.selector ?? "(kein Selektor)"} überein.`,
          );
        if (
          mode === "illustrative" &&
          !/^\.sf-example-[a-zA-Z0-9_-]+$/.test(selector)
        )
          add(
            "unmarked-example",
            "Neue Beispielklassen müssen mit .sf-example- beginnen und als neues Beispiel gekennzeichnet bleiben.",
          );
      }
      if (
        /(?:width|height|margin|padding)(?:-[a-z]+)?\s*:\s*[#.][A-Za-z_]/i.test(
          code,
        )
      )
        add(
          "invalid-css-value",
          "Ein Selektor ist kein gültiger CSS-Längenwert. Beispiel korrigieren oder verwerfen.",
        );
      if (!selectors.length)
        add("unsupported-code", "Kein klarer CSS-Regelblock erkennbar.");
    }
    if (solution.code.language === "html") {
      for (const match of code.matchAll(
        /\b(?:id|class)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
      ))
        for (const token of (match[1] ?? match[2] ?? match[3] ?? "")
          .split(/\s+/)
          .filter(Boolean))
          if (!token.startsWith("sf-example-"))
            add(
              "unmarked-example",
              "Neue HTML-IDs und Klassen müssen mit sf-example- beginnen. Gemessenes DOM bleibt ausschließlich im Originalbericht.",
            );
    }
    if (solution.code.language === "html" && mode !== "illustrative")
      add(
        "unmarked-example",
        "HTML-Code ist ein neues Anpassungsbeispiel, keine gemessene DOM-Quelle.",
      );
    if (solution.code.language === "none")
      add("code-mode", "Codeinhalt ohne gewählte Sprache.");
    if (
      finding.ruleId === "horizontal-overflow" &&
      /(?:overflow(?:-x)?\s*:\s*(?:hidden|clip)|min-width\s*:)/i.test(code)
    )
      add(
        "layout-fix-unproven",
        "Verstecken/Abschneiden oder zusätzliche Mindestbreite ist keine belegte Behebung dieses Überlaufs. Ursache prüfen oder Code verwerfen.",
      );
  }
  if (
    finding.ruleId === "meta-description" &&
    /(?:meta.?keywords|suchmaschinenrank(?:ing|ung)|mehr (?:besucher|traffic)|besucherzahlen.{0,30}(?:steig|erhöh))/i.test(
      solution.steps.join(" "),
    )
  )
    add(
      "unsupported-seo-action",
      "Diese SEO-Wirkung oder Meta-Keywords-Maßnahme ist durch den Description-Befund nicht belegt.",
    );
  if (
    /(?:Ranking|Google.{0,25}(?:garantiert|Platz\s*1))/i.test(
      solution.acceptance,
    )
  )
    add(
      "unverifiable-acceptance",
      "Ranking ist kein reproduzierbares Abnahmekriterium dieser Regelmessung.",
    );
  return issues;
}
export function parseEdits(value: unknown): ProposalEdits {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Entwurf fehlt.");
  const v = value as Record<string, unknown>;
  if (
    Object.keys(v).sort().join(",") !== "acceptance,code,codeMode,steps" ||
    !Array.isArray(v.steps) ||
    !v.steps.length ||
    v.steps.length > 6 ||
    v.steps.some((x) => typeof x !== "string" || !x.trim() || x.length > 600) ||
    typeof v.acceptance !== "string" ||
    !v.acceptance.trim() ||
    v.acceptance.length > 1800 ||
    !["none", "captured", "illustrative"].includes(String(v.codeMode))
  )
    throw Error("Ungültige Schritte oder Nachtest im Entwurf.");
  const code = v.code as PageSolution["code"];
  if (
    !code ||
    Object.keys(code).sort().join(",") !== "language,text" ||
    !["none", "html", "css", "javascript"].includes(code.language) ||
    typeof code.text !== "string" ||
    code.text.length > 3000
  )
    throw Error("Ungültiges Codebeispiel.");
  return {
    steps: (v.steps as string[]).map((s) => s.trim()),
    acceptance: v.acceptance.trim(),
    code: { ...code },
    codeMode: v.codeMode as ProposalEdits["codeMode"],
  };
}
export function makeReview(
  job: PageAnalysis,
  report: AuditReport,
  finding: Finding,
  solution: PageSolution,
  edits: ProposalEdits,
  status: ProposalReview["status"],
): ProposalReview {
  const reviewSolution = { ...solution, explanation: "", cause: "", ...edits };
  const issues = proposalIssues(
    reviewSolution,
    finding,
    report,
    edits.codeMode,
  );
  // Known factual contradictions in the original cannot be adopted as original prose: only the reviewed steps/code are transferred.
  if (status === "approved" && !validateReport(report).valid)
    throw Error(
      "Messvertrag ungültig oder unvollständig. Vor Übernahme einen neuen vollständigen Check erstellen.",
    );
  if (status === "approved" && issues.length)
    throw Error(issues.map((i) => i.detail).join(" "));
  return {
    id: randomUUID(),
    analysisId: job.id,
    scanId: job.scanId,
    findingId: finding.id,
    createdAt: new Date().toISOString(),
    status,
    sourceHash: job.sourceHash,
    originalSha256: hash(solution),
    factsSha256: hash(observationFacts(report, finding)),
    binding: {
      pageUrl: finding.pageUrl,
      viewportId: finding.viewportId,
      state: finding.state,
      selector: finding.selector ?? null,
      reference: `finding:${finding.id}`,
    },
    edits,
    issues,
    meaning:
      "Lokale redaktionelle Prüfung dieses Entwurfs; keine semantische Qualitätszertifizierung und keine verifizierte Reparatur.",
  };
}
export function assertReviewCurrent(
  review: ProposalReview,
  job: PageAnalysis,
  report: AuditReport,
  finding: Finding,
  solution: PageSolution,
) {
  if (!validateReport(report).valid)
    throw Error("Messvertrag für die Übernahme ist ungültig.");
  if (
    review.status !== "approved" ||
    review.analysisId !== job.id ||
    review.scanId !== job.scanId ||
    review.findingId !== finding.id ||
    review.sourceHash !== job.sourceHash ||
    review.originalSha256 !== hash(solution) ||
    review.factsSha256 !== hash(observationFacts(report, finding))
  )
    throw Error(
      "Entwurf ist nicht freigegeben oder gehört zu einem geänderten Mess-/Modellstand.",
    );
  const issues = proposalIssues(
    { ...solution, explanation: "", cause: "", ...review.edits },
    finding,
    report,
    review.edits.codeMode,
  );
  if (issues.length)
    throw Error("Entwurf enthält nicht übernehmbare Aussagen.");
}
