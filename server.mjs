// Standalone Node server entry for VPS / Docker deploy.
// Serves the TanStack Start build (dist/client + dist/server) on a single port.
// Reads PORT from env (default 3000). All other env (SUPABASE_*, EVOLUTION_*, etc.)
// is consumed by the bundled server handler at request time.

import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, createReadStream } from "node:fs";
import { join, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const CLIENT_DIR = resolve(__dirname, "dist/client");
const SERVER_ENTRY = resolve(__dirname, "dist/server/server.js");
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

if (!existsSync(SERVER_ENTRY)) {
  console.error(`[server] Server bundle not found at ${SERVER_ENTRY}.`);
  console.error("[server] Run `npm run build` (with VERCEL=1) before starting.");
  process.exit(1);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

function safeJoin(root, urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0].split("#")[0]);
  const target = resolve(root, "." + clean);
  if (!target.startsWith(root)) return null;
  return target;
}

function tryServeStatic(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  const filePath = safeJoin(CLIENT_DIR, req.url || "/");
  if (!filePath) return false;
  if (!existsSync(filePath)) return false;
  const stat = statSync(filePath);
  if (!stat.isFile()) return false;

  const ext = extname(filePath).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  const isImmutable = req.url.includes("/assets/");
  res.writeHead(200, {
    "Content-Type": type,
    "Content-Length": stat.size,
    "Cache-Control": isImmutable
      ? "public, max-age=31536000, immutable"
      : "public, max-age=300",
  });
  if (req.method === "HEAD") return res.end(), true;
  createReadStream(filePath).pipe(res);
  return true;
}

// Convert Node IncomingMessage -> Web Request
async function nodeToWebRequest(req) {
  const proto = (req.headers["x-forwarded-proto"] || "http").toString().split(",")[0].trim();
  const host = (req.headers["x-forwarded-host"] || req.headers.host || `localhost:${PORT}`).toString();
  const url = `${proto}://${host}${req.url}`;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v == null) continue;
    if (Array.isArray(v)) v.forEach((vv) => headers.append(k, vv));
    else headers.set(k, String(v));
  }
  const method = req.method || "GET";
  let body;
  if (method !== "GET" && method !== "HEAD") {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    if (chunks.length) body = Buffer.concat(chunks);
  }
  return new Request(url, { method, headers, body, duplex: "half" });
}

async function sendWebResponse(webRes, res) {
  const headers = {};
  webRes.headers.forEach((v, k) => {
    if (headers[k] == null) headers[k] = v;
    else if (Array.isArray(headers[k])) headers[k].push(v);
    else headers[k] = [headers[k], v];
  });
  res.writeHead(webRes.status, webRes.statusText, headers);
  if (!webRes.body) return res.end();
  const reader = webRes.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) res.write(Buffer.from(value));
  }
  res.end();
}

const mod = await import(SERVER_ENTRY);
// TanStack Start emits { default: { fetch }, createServerEntry }. Older builds may
// expose a top-level fetch/handler or a callable default. Accept all shapes.
function resolveHandler(m) {
  const candidates = [
    m.default,
    m.default?.fetch,
    m.handler,
    m.fetch,
    typeof m.createServerEntry === "function" ? m.createServerEntry()?.fetch : null,
  ];
  for (const c of candidates) {
    if (typeof c === "function") return c;
  }
  return null;
}
const handler = resolveHandler(mod);
if (typeof handler !== "function") {
  console.error("[server] dist/server/server.js has no callable handler. Module exports:", Object.keys(mod));
  console.error("[server] default keys:", mod.default && typeof mod.default === "object" ? Object.keys(mod.default) : typeof mod.default);
  process.exit(1);
}

const server = createServer(async (req, res) => {
  try {
    if (req.url === "/health" || req.url === "/_health") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      return res.end("ok");
    }
    if (tryServeStatic(req, res)) return;
    const webReq = await nodeToWebRequest(req);
    const webRes = await handler(webReq);
    if (!(webRes instanceof Response)) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      return res.end("Server handler returned non-Response value");
    }
    await sendWebResponse(webRes, res);
  } catch (err) {
    console.error("[server] request error:", err);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "text/plain" });
    }
    res.end("Internal Server Error");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[server] listening on http://${HOST}:${PORT}`);
});

const shutdown = (sig) => {
  console.log(`[server] received ${sig}, shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
