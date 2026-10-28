import {
  createServer,
  request as httpRequest,
  type IncomingMessage,
} from "node:http";
import { connect, type Socket } from "node:net";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { resolvePinnedTarget, type TargetPolicy } from "./security.js";

export interface AuditProxy {
  server: string;
  username: string;
  password: string;
  close(): Promise<void>;
  blockedRequests(): number;
}

/** A local forward proxy pins DNS answers to the validated socket destination. No redirect following here. */
export async function startAuditProxy(
  policy: TargetPolicy = {},
  authentication = true,
): Promise<AuditProxy> {
  const username = "audit";
  const password = randomBytes(24).toString("hex");
  const expected = Buffer.from(
    `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
  );
  const sockets = new Set<Socket>();
  let blocked = 0;
  let transferred = 0;
  let connections = 0;
  const maximumBytes = 256 * 1024 * 1024;
  const countBytes = (chunk: Buffer, abort: () => void) => {
    transferred += chunk.length;
    if (transferred > maximumBytes) {
      blocked++;
      abort();
    }
  };
  const auth = (request: IncomingMessage) => {
    if (!authentication) return true;
    const supplied = Buffer.from(request.headers["proxy-authorization"] || "");
    return (
      supplied.length === expected.length && timingSafeEqual(supplied, expected)
    );
  };
  const server = createServer(async (req, res) => {
    if (!auth(req)) {
      res.writeHead(407, { "Proxy-Authenticate": 'Basic realm="Audit"' });
      res.end();
      return;
    }
    if (++connections > 3000 || transferred > maximumBytes) {
      blocked++;
      res.writeHead(429);
      res.end("Audit network budget exceeded");
      return;
    }
    if (!["GET", "HEAD"].includes(req.method || "")) {
      blocked++;
      res.writeHead(403);
      res.end("Method blocked");
      return;
    }
    let target: URL;
    try {
      target = new URL(req.url || "");
      if (target.protocol !== "http:")
        throw new Error("HTTP proxy requires absolute HTTP URL");
      const pinned = await resolvePinnedTarget(target, policy);
      const headers: Record<string, string | string[] | undefined> = {
        ...req.headers,
        host: target.host,
      };
      delete headers["proxy-authorization"];
      delete headers["proxy-connection"];
      const upstream = httpRequest(
        {
          hostname: pinned.address,
          family: pinned.family,
          port: Number(target.port || 80),
          path: target.pathname + target.search,
          method: req.method,
          headers,
          agent: false,
          timeout: 20_000,
        },
        (response) => {
          res.writeHead(response.statusCode || 502, response.headers);
          response.on("data", (chunk) =>
            countBytes(Buffer.from(chunk), () => {
              response.destroy();
              res.destroy();
            }),
          );
          response.pipe(res);
        },
      );
      upstream.on("socket", (socket) => {
        sockets.add(socket);
        socket.once("close", () => sockets.delete(socket));
      });
      upstream.on("timeout", () =>
        upstream.destroy(new Error("Upstream timeout")),
      );
      upstream.on("error", () => {
        if (!res.headersSent) res.writeHead(502);
        res.end("Upstream unavailable");
      });
      req.on("aborted", () => upstream.destroy());
      res.on("close", () => upstream.destroy());
      req.pipe(upstream);
    } catch {
      blocked++;
      res.writeHead(403);
      res.end("Destination blocked");
    }
  });
  server.on("connect", async (req, client, head) => {
    if (!auth(req)) {
      client.end(
        'HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm="Audit"\r\n\r\n',
      );
      return;
    }
    if (++connections > 3000 || transferred > maximumBytes) {
      blocked++;
      client.end("HTTP/1.1 429 Too Many Requests\r\n\r\n");
      return;
    }
    try {
      const target = new URL(`https://${req.url || ""}/`);
      // CONNECT is only for TLS. Explicit local HTTPS ports are allowed by the policy.
      if (
        (target.port || "443") !== "443" &&
        target.origin !== policy.allowedLocalOrigin
      )
        throw new Error("Port blocked");
      const pinned = await resolvePinnedTarget(target, policy);
      const upstream = connect({
        host: pinned.address,
        family: pinned.family,
        port: Number(target.port || 443),
      });
      sockets.add(upstream);
      upstream.once("close", () => sockets.delete(upstream));
      upstream.setTimeout(30_000, () => upstream.destroy());
      upstream.once("connect", () => {
        client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (head.length) upstream.write(head);
        client.pipe(upstream);
        upstream.pipe(client);
      });
      upstream.on("error", () => client.destroy());
      upstream.on("data", (chunk) =>
        countBytes(Buffer.from(chunk), () => {
          upstream.destroy();
          client.destroy();
        }),
      );
      client.on("error", () => upstream.destroy());
      client.on("close", () => upstream.destroy());
    } catch {
      blocked++;
      client.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
    }
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
    socket.setTimeout(35_000, () => socket.destroy());
  });
  server.on("clientError", (_error, socket) => socket.destroy());
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Proxy did not bind");
  return {
    server: `http://127.0.0.1:${address.port}`,
    username,
    password,
    blockedRequests: () => blocked,
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
