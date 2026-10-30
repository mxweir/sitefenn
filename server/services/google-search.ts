/** Optional read-only connector. No credentials in SQLite, exports, logs or process arguments. */
import { createServer, type Server } from "node:http";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type {
  SearchDataset,
  SearchImportMetadata,
} from "../../shared/types.js";
import { validateMetadata } from "./search-console.js";
export const SEARCH_SCOPE =
  "https://www.googleapis.com/auth/webmasters.readonly";
export interface SecretVault {
  get(): Promise<string | null>;
  set(value: string): Promise<void>;
  remove(): Promise<void>;
}
export function nativeVault(account: string): SecretVault {
  const entry = async () => {
    // Other OS backends are deliberately disabled until tested; CSV remains available.
    if (process.platform !== "darwin")
      throw Error(
        "Google-Verbindung benötigt derzeit den geprüften macOS-Schlüsselbund. CSV bleibt verfügbar.",
      );
    const { AsyncEntry } = await import("@napi-rs/keyring");
    return new AsyncEntry(
      "de.sitefenn.search-console",
      createHash("sha256").update(account).digest("hex"),
    );
  };
  return {
    async get() {
      return (await entry()).getPassword();
    },
    async set(value) {
      const e = await entry();
      await e.setPassword(value);
      if ((await e.getPassword()) !== value)
        throw Error("Schlüsselbund-Speicherung nicht bestätigt.");
    },
    async remove() {
      const e = await entry();
      await e.deletePassword();
      if ((await e.getPassword()) !== null)
        throw Error("Schlüsselbund-Löschung nicht bestätigt.");
    },
  };
}
interface Config {
  clientId: string;
  clientSecret: string;
}
interface Credentials {
  config: Config;
  refreshToken?: string;
  accessToken?: string;
  expiresAt?: number;
}
export function propertyContains(property: string, page: string) {
  try {
    const url = new URL(page);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return false;
    if (property.startsWith("sc-domain:")) {
      const domain = property.slice(10).toLowerCase();
      return url.hostname === domain || url.hostname.endsWith("." + domain);
    }
    const prefix = new URL(property);
    return (
      url.origin === prefix.origin && url.pathname.startsWith(prefix.pathname)
    );
  } catch {
    return false;
  }
}
export class GoogleSearch {
  private pending?: { server: Server; timer: ReturnType<typeof setTimeout> };
  private state = "Nicht verbunden";
  private busy = false;
  constructor(
    private vault: SecretVault,
    private request: typeof fetch = fetch,
  ) {}
  private async exclusive<T>(fn: () => Promise<T>) {
    if (this.busy) throw Error("Google-Anfrage läuft bereits.");
    this.busy = true;
    try {
      return await fn();
    } finally {
      this.busy = false;
    }
  }
  private async credentials() {
    const raw = await this.vault.get();
    if (!raw) throw Error("Zuerst Google-Konfiguration einrichten.");
    return JSON.parse(raw) as Credentials;
  }
  private async json(url: string, init: RequestInit = {}) {
    const response = await this.request(url, {
      ...init,
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw Error(
        `Google-Anfrage fehlgeschlagen (HTTP ${response.status}); Berechtigung, API-Freigabe und Kontingent prüfen.`,
      );
    const reader = response.body?.getReader();
    if (!reader) throw Error("Google-Antwort fehlt.");
    let size = 0;
    const chunks: Uint8Array[] = [];
    try {
      for (;;) {
        const r = await reader.read();
        if (r.done) break;
        size += r.value.length;
        if (size > 8 * 1024 * 1024)
          throw Error("Google-Antwort überschreitet 8 MiB.");
        chunks.push(r.value);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    return JSON.parse(Buffer.concat(chunks).toString()) as Record<
      string,
      unknown
    >;
  }
  async status() {
    try {
      const c = await this.vault.get();
      const parsed = c ? (JSON.parse(c) as Credentials) : undefined;
      return {
        available: true,
        configured: !!parsed,
        connected: !!parsed?.refreshToken,
        pending: !!this.pending,
        state: this.state,
        validation: "experimental — echter Google-Kontotest ausstehend",
        scope: SEARCH_SCOPE,
      };
    } catch {
      return {
        available: false,
        configured: false,
        connected: false,
        pending: false,
        state: "Schlüsselbund nicht verfügbar; CSV nutzen.",
        validation: "unvalidiert",
        scope: SEARCH_SCOPE,
      };
    }
  }
  async configure(input: unknown) {
    return this.exclusive(async () => {
      if (this.pending) throw Error("Zuerst laufende Anmeldung abbrechen.");
      const installed = (input as { installed?: Config })?.installed;
      if (
        !installed ||
        typeof installed.clientId !== "string" ||
        !/^[-a-zA-Z0-9.]{8,200}\.apps\.googleusercontent\.com$/.test(
          installed.clientId,
        ) ||
        typeof installed.clientSecret !== "string" ||
        installed.clientSecret.length < 5 ||
        installed.clientSecret.length > 500
      )
        throw Error(
          "Desktop-OAuth-Konfiguration mit clientId und clientSecret erforderlich.",
        );
      const old = await this.vault.get();
      if (old && JSON.parse(old).refreshToken)
        throw Error("Bestehende Verbindung zuerst widerrufen.");
      await this.vault.set(
        JSON.stringify({
          config: {
            clientId: installed.clientId,
            clientSecret: installed.clientSecret,
          },
        }),
      );
      this.state = "Konfiguriert; noch nicht verbunden.";
      return this.status();
    });
  }
  async start() {
    return this.exclusive(async () => {
      if (this.pending) throw Error("Anmeldung läuft bereits.");
      const saved = await this.credentials();
      if (saved.refreshToken) throw Error("Bereits verbunden.");
      const state = randomBytes(32).toString("base64url"),
        verifier = randomBytes(48).toString("base64url");
      const server = createServer();
      await new Promise<void>((done, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", done);
      });
      const address = server.address();
      if (!address || typeof address === "string")
        throw Error("Loopback-Listener fehlt.");
      const host = `127.0.0.1:${address.port}`,
        redirect = `http://${host}/oauth/callback`;
      const timer = setTimeout(() => {
        this.close();
        this.state = "Anmeldung abgelaufen.";
      }, 5 * 60000);
      timer.unref();
      this.pending = { server, timer };
      this.state = "Warte auf Google-Freigabe.";
      server.on("request", (req, res) => {
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Referrer-Policy", "no-referrer");
        res.setHeader(
          "Content-Security-Policy",
          "default-src 'none'; frame-ancestors 'none'",
        );
        const url = new URL(req.url ?? "/", redirect);
        if (
          !this.pending || this.pending.server !== server ||
          req.method !== "GET" ||
          req.headers.host !== host ||
          url.pathname !== "/oauth/callback" ||
          url.searchParams.getAll("state").length !== 1 ||
          url.searchParams.get("state") !== state
        ) {
          res.writeHead(400);
          res.end("Ungültige Anmeldung.");
          return;
        }
        const code = url.searchParams.get("code");
        if (
          !code ||
          code.length > 4000 ||
          url.searchParams.getAll("code").length !== 1
        ) {
          this.close();
          this.state = "Google-Freigabe abgelehnt.";
          res.writeHead(400);
          res.end("Keine Freigabe.");
          return;
        }
        this.close();
        void this.exclusive(async () => {
          const token = await this.json("https://oauth2.googleapis.com/token", {
            method: "POST",
            body: new URLSearchParams({
              client_id: saved.config.clientId,
              client_secret: saved.config.clientSecret,
              code,
              code_verifier: verifier,
              redirect_uri: redirect,
              grant_type: "authorization_code",
            }),
          });
          if (
            typeof token.refresh_token !== "string" ||
            token.scope !== SEARCH_SCOPE
          )
            throw Error(
              "Google hat nicht den erwarteten rein lesenden Scope bestätigt.",
            );
          await this.vault.set(
            JSON.stringify({
              config: saved.config,
              refreshToken: token.refresh_token,
            }),
          );
          this.state = "Verbunden · rein lesend";
          res.end(
            "SiteFenn verbunden. Dieses Fenster kann geschlossen werden.",
          );
        }).catch(() => {
          this.state =
            "Anmeldung fehlgeschlagen; keine Verbindung gespeichert.";
          res.writeHead(400);
          res.end("Anmeldung fehlgeschlagen. In SiteFenn erneut starten.");
        });
      });
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.search = new URLSearchParams({
        client_id: saved.config.clientId,
        redirect_uri: redirect,
        response_type: "code",
        scope: SEARCH_SCOPE,
        state,
        code_challenge: createHash("sha256")
          .update(verifier)
          .digest("base64url"),
        code_challenge_method: "S256",
        access_type: "offline",
        prompt: "consent",
      }).toString();
      return { url: url.href, expiresInSeconds: 300 };
    });
  }
  close() {
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending.server.close();
      this.pending = undefined;
    }
  }
  async disconnect() {
    return this.exclusive(async () => {
      this.close();
      const c = await this.credentials();
      if (c.refreshToken) {
        const response = await this.request(
          "https://oauth2.googleapis.com/revoke",
          {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ token: c.refreshToken }),
            redirect: "error",
            signal: AbortSignal.timeout(15000),
          },
        );
        if (!response.ok)
          throw Error(
            "Google-Widerruf nicht bestätigt. Lokal gespeicherte Verbindung bleibt zur Wiederholung erhalten.",
          );
      }
      await this.vault.remove();
      this.state = "Google-Zugriff widerrufen und lokal entfernt.";
      return this.status();
    });
  }
  private async access() {
    const c = await this.credentials();
    if (!c.refreshToken) throw Error("Nicht mit Google verbunden.");
    const token = await this.json("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: new URLSearchParams({
        client_id: c.config.clientId,
        client_secret: c.config.clientSecret,
        refresh_token: c.refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (
      typeof token.access_token !== "string" ||
      token.access_token.length > 10000
    )
      throw Error("Google-Token fehlt.");
    return token.access_token;
  }
  async sites() {
    return this.exclusive(async () => {
      const token = await this.access();
      const data = await this.json(
        "https://www.googleapis.com/webmasters/v3/sites",
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return {
        properties: Array.isArray(data.siteEntry)
          ? data.siteEntry
              .filter(
                (v): v is { siteUrl: string; permissionLevel: string } =>
                  !!v &&
                  typeof v === "object" &&
                  typeof v.siteUrl === "string" &&
                  typeof v.permissionLevel === "string",
              )
              .slice(0, 1000)
          : [],
      };
    });
  }
  async import(
    projectId: string,
    projectUrl: string,
    input: SearchImportMetadata,
  ): Promise<SearchDataset> {
    return this.exclusive(async () => {
      validateMetadata(input);
      if (!propertyContains(input.property, projectUrl))
        throw Error("Property passt nicht zum Projekt.");
      if (
        Date.parse(input.endDate) - Date.parse(input.startDate) >
        366 * 86400000
      )
        throw Error("Maximal 367 Tage pro Abruf.");
      const filters = Object.entries(input.filters ?? {});
      if (
        input.filters === null ||
        filters.some(
          ([key, value]) =>
            !["country", "device"].includes(key) ||
            (key === "country"
              ? !/^[a-z]{3}$/i.test(value)
              : !["DESKTOP", "MOBILE", "TABLET"].includes(value)),
        )
      )
        throw Error(
          "API-Filter: country als ISO-3-Code, device als DESKTOP/MOBILE/TABLET.",
        );
      const token = await this.access();
      const data = await this.json(
        `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(input.property)}/searchAnalytics/query`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            startDate: input.startDate,
            endDate: input.endDate,
            dimensions: [input.dimension],
            type: "web",
            dataState: "final",
            rowLimit: 25000,
            startRow: 0,
            ...(filters.length
              ? {
                  dimensionFilterGroups: [
                    {
                      groupType: "and",
                      filters: filters.map(([dimension, expression]) => ({
                        dimension,
                        operator: "equals",
                        expression,
                      })),
                    },
                  ],
                }
              : {}),
          }),
        },
      );
      if (data.rows !== undefined && !Array.isArray(data.rows))
        throw Error("Ungültige Google-Zeilen.");
      const rows = (data.rows ?? []) as Record<string, unknown>[];
      if (rows.length > 25000) throw Error("Google-Zeilenlimit überschritten.");
      const keys = new Set<string>();
      const clean = rows.map((row) => {
        const key =
          Array.isArray(row.keys) && row.keys.length === 1 ? row.keys[0] : null;
        const clicks = Number(row.clicks),
          impressions = Number(row.impressions),
          ctr = Number(row.ctr),
          position = Number(row.position);
        if (
          ![row.clicks,row.impressions,row.ctr,row.position].every(value=>typeof value === "number") ||
          typeof key !== "string" ||
          !key ||
          key.length > 10000 ||
          keys.has(key) ||
          !Number.isSafeInteger(clicks) ||
          !Number.isSafeInteger(impressions) ||
          clicks < 0 ||
          impressions < clicks ||
          !Number.isFinite(ctr) ||
          ctr < 0 ||
          ctr > 1 ||
          !Number.isFinite(position) ||
          position < 0
        )
          throw Error("Ungültiger Google-Datensatz.");
        keys.add(key);
        return { key, clicks, impressions, ctr, position };
      });
      const clicks = clean.reduce((n, r) => n + r.clicks, 0),
        impressions = clean.reduce((n, r) => n + r.impressions, 0);
      if (!Number.isSafeInteger(clicks) || !Number.isSafeInteger(impressions))
        throw Error("Summen überschreiten Zahlenpräzision.");
      return {
        id: randomUUID(),
        projectId,
        importedAt: new Date().toISOString(),
        metadata: {
          ...input,
          filters: { ...input.filters, searchType: "web", dataState: "final" },
          source: "google-api",
          rowLimit: 25000,
        },
        rows: clean,
        summary: {
          clicks,
          impressions,
          ctr: impressions ? clicks / impressions : null,
          position: null,
          label:
            "Summen der zurückgegebenen Zeilen; keine vollständigen Property-Summen. Position wird nicht aggregiert.",
        },
        warnings: [
          "Google liefert begrenzte Top-Zeilen; anonyme/fehlende Daten und ausgelassene Tage bleiben unbekannt.",
          "Historische Durchschnittsposition ist kein aktueller universeller Google-Rang.",
          ...(rows.length === 25000
            ? ["Zeilenlimit erreicht; Ergebnis ausdrücklich unvollständig."]
            : []),
        ],
      };
    });
  }
}
