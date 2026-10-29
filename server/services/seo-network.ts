import http from "node:http";
import https from "node:https";
import { createGunzip } from "node:zlib";
import type { IncomingHttpHeaders } from "node:http";
import { resolvePinnedTarget, type TargetPolicy } from "../security.js";
export interface SeoPolicy extends TargetPolicy {
  url: string;
  excludedPaths: string[];
  requestBudget?: { remaining: number };
}
export function permittedUrl(
  value: string,
  base: string,
  policy: SeoPolicy,
): string {
  const u = new URL(value, base);
  u.hash = "";
  if (
    !["http:", "https:"].includes(u.protocol) ||
    u.username ||
    u.password ||
    u.origin !== new URL(policy.url).origin ||
    policy.excludedPaths.some((p) => u.pathname.startsWith(p)) ||
    (policy.demoOrigin && !/^\/demo-site(?:\/|$)/.test(u.pathname)) ||
    (u.origin === policy.hubOrigin && u.origin !== policy.demoOrigin) ||
    /\/(?:logout|signout|delete|remove|checkout|cart|unsubscribe)(?:\/|$)/i.test(
      decodeURIComponent(u.pathname),
    ) ||
    [...u.searchParams.keys()].some((k) =>
      /^(?:access_token|token|password|secret|api_key|authorization)$/i.test(k),
    )
  )
    throw new Error(
      "URL außerhalb der freigegebenen Host-/Pfadgrenzen oder mit gesperrter Aktion/Zugangsdaten.",
    );
  return u.href;
}
export interface HttpRead {
  url: string;
  statusCode: number;
  headers: IncomingHttpHeaders;
  body: string;
  truncated: boolean;
}
async function once(
  url: string,
  policy: SeoPolicy,
  signal: AbortSignal,
  maxBytes: number,
  strict: boolean,
): Promise<HttpRead> {
  if (policy.requestBudget && --policy.requestBudget.remaining < 0)
    throw new Error("HTTP-Anfragebudget erreicht.");
  const target = new URL(permittedUrl(url, policy.url, policy));
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(5000)]);
  const pinned = await new Promise<
    Awaited<ReturnType<typeof resolvePinnedTarget>>
  >((resolve, reject) => {
    const abort = () => reject(new Error("Zeitlimit bei der Zielauflösung."));
    deadline.addEventListener("abort", abort, { once: true });
    resolvePinnedTarget(target, policy).then(
      (value) => {
        deadline.removeEventListener("abort", abort);
        resolve(value);
      },
      (error) => {
        deadline.removeEventListener("abort", abort);
        reject(error);
      },
    );
    if (deadline.aborted) abort();
  });
  deadline.throwIfAborted();
  return new Promise((resolve, reject) => {
    let finished = false;
    const req = (target.protocol === "https:" ? https : http).request(
      target,
      {
        method: "GET",
        agent: false,
        family: pinned.family,
        lookup: (_name, _opts, cb) => cb(null, pinned.address, pinned.family),
        signal: deadline,
        headers: {
          "user-agent": "SiteFenn/1.4 (authorized local audit)",
          accept: "text/html,application/xml,text/xml,text/plain,*/*;q=0.1",
          "accept-encoding": "identity",
        },
      },
      (res) => {
        let bytes = 0,
          wire = 0;
        const chunks: Buffer[] = [];
        const compressed =
          /gzip/i.test(String(res.headers["content-encoding"] ?? "")) ||
          target.pathname.endsWith(".gz");
        const stream = compressed ? res.pipe(createGunzip()) : res;
        const finish = (truncated = false) => {
          if (finished) return;
          finished = true;
          resolve({
            url: target.href,
            statusCode: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
            truncated,
          });
          if (truncated) {
            stream.destroy();
            res.destroy();
            req.destroy();
          }
        };
        const fail = (error: Error) => {
          if (finished) return;
          finished = true;
          stream.destroy();
          res.destroy();
          req.destroy();
          reject(error);
        };
        res.on("data", (chunk) => {
          wire += chunk.length;
          if (wire > maxBytes * 2)
            strict
              ? fail(new Error("Antwort überschreitet das Übertragungsbudget."))
              : finish(true);
        });
        stream.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > maxBytes) {
            strict
              ? fail(
                  new Error(
                    "Entpackte Antwort überschreitet das Analysebudget.",
                  ),
                )
              : finish(true);
            return;
          }
          chunks.push(Buffer.from(chunk));
        });
        stream.on("end", () => finish());
        stream.on("error", fail);
        res.on("error", fail);
      },
    );
    req.on("error", (error) => {
      if (!finished) {
        finished = true;
        reject(error);
      }
    });
    req.end();
  });
}
export async function readScoped(
  url: string,
  policy: SeoPolicy,
  signal: AbortSignal,
  maxBytes = 512 * 1024,
  strict = false,
) {
  const redirects: { url: string; statusCode: number; to: string }[] = [],
    seen = new Set<string>();
  let current = permittedUrl(url, policy.url, policy);
  let lastStatus: number | undefined;
  try {
    while (true) {
      if (seen.has(current)) throw new Error("Redirect-Schleife beobachtet.");
      seen.add(current);
      const response = await once(current, policy, signal, maxBytes, strict);
      lastStatus = response.statusCode;
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        if (!response.headers.location)
          throw new Error("Redirect ohne Location-Header.");
        if (redirects.length >= 5)
          throw new Error("Redirect-Limit von fünf Weiterleitungen erreicht.");
        const to = permittedUrl(response.headers.location, current, policy);
        redirects.push({ url: current, statusCode: response.statusCode, to });
        current = to;
        continue;
      }
      return { ...response, redirects };
    }
  } catch (error) {
    throw Object.assign(error as Error, {
      redirects,
      finalUrl: current,
      statusCode: lastStatus,
    });
  }
}
