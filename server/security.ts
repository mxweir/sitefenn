import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export function parseTarget(
  value: unknown,
  options: { allowLocal?: boolean } = {},
): URL {
  if (typeof value !== "string" || value.length > 2048)
    throw new Error("Bitte eine gültige HTTP(S)-URL eingeben.");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Bitte eine vollständige URL mit https:// eingeben.");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("Nur HTTP(S)-URLs ohne Zugangsdaten sind erlaubt.");
  if (!options.allowLocal && url.port && !["80", "443"].includes(url.port))
    throw new Error(
      "Öffentliche Ziele werden nur auf Port 80 oder 443 unterstützt.",
    );
  url.hash = "";
  return url;
}

export function isPublicIP(ip: string) {
  if (isIP(ip) === 4) {
    const [a, b, c] = ip.split(".").map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 &&
        (b === 168 ||
          (b === 0 && (c === 0 || c === 2)) ||
          (b === 88 && c === 99))) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113)
    );
  }
  if (isIP(ip) === 6) {
    // Global unicast only; mapped IPv4 and transition/tunnel prefixes are denied.
    const normalized = ip.toLowerCase();
    return (
      /^[23][0-9a-f]{3}:/.test(normalized) &&
      !/^2001:(0*:|0*2:0*:|0*db8:)/.test(normalized) &&
      !normalized.startsWith("2002:")
    );
  }
  return false;
}

export async function assertPublicTarget(url: URL) {
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  )
    throw new Error(
      "Private und lokale Ziele benötigen ein ausdrücklich freigegebenes lokales Projekt.",
    );
  const addresses = isIP(hostname)
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true, verbatim: true });
  if (
    !addresses.length ||
    addresses.some((address) => !isPublicIP(address.address))
  )
    throw new Error(
      "Das Ziel zeigt auf eine gesperrte/private Netzwerkadresse.",
    );
}

export interface TargetPolicy {
  allowedLocalOrigin?: string;
  demoOrigin?: string;
  hubOrigin?: string;
}

/** Resolve once, validate every address, and connect to the returned IP rather than resolving again. */
export async function resolvePinnedTarget(url: URL, policy: TargetPolicy = {}) {
  parseTarget(url.href, {
    allowLocal:
      url.origin === policy.allowedLocalOrigin ||
      url.origin === policy.demoOrigin,
  });
  const demo = url.origin === policy.demoOrigin;
  const local = url.origin === policy.allowedLocalOrigin;
  if (url.origin === policy.hubOrigin && !demo)
    throw new Error(
      "Der Hub selbst darf nicht als Projektziel verwendet werden.",
    );
  if (demo && !/^\/demo-site(?:\/|$)/.test(url.pathname))
    throw new Error("Demo-Zugriff außerhalb der Beispielwebsite ist gesperrt.");
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (
    !local &&
    !demo &&
    (hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local"))
  )
    throw new Error("Lokales Ziel nicht ausdrücklich freigegeben.");
  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await lookup(hostname, { all: true, verbatim: true });
  if (
    !addresses.length ||
    (!local && !demo && addresses.some((item) => !isPublicIP(item.address)))
  )
    throw new Error(
      "Das Ziel zeigt auf eine gesperrte/private Netzwerkadresse.",
    );
  return addresses[0]!;
}

export async function validateTarget(url: URL, policy: TargetPolicy = {}) {
  await resolvePinnedTarget(url, policy);
}

export function requestAllowed(
  host: string | undefined,
  origin: string | undefined,
  port: number,
) {
  const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  return (
    !!host &&
    hosts.has(host) &&
    (!origin ||
      origin === `http://127.0.0.1:${port}` ||
      origin === `http://localhost:${port}`)
  );
}
