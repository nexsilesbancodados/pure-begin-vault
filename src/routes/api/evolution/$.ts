import { createFileRoute } from "@tanstack/react-router";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

async function proxy(request: Request, splat: string) {
  const apiUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;

  if (!apiUrl || !apiKey) {
    return new Response(
      JSON.stringify({ error: "Evolution API credentials not configured" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }

  const url = new URL(request.url);
  const target = `${apiUrl.replace(/\/$/, "")}/${splat}${url.search}`;

  const init: RequestInit = {
    method: request.method,
    headers: {
      apikey: apiKey,
      "Content-Type": "application/json",
    },
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    const body = await request.text();
    if (body) init.body = body;
  }

  try {
    const res = await fetch(target, init);
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("Content-Type") || "application/json",
        ...corsHeaders,
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Evolution API request failed", details: String(err) }),
      { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
}

export const Route = createFileRoute("/api/evolution/$")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      GET: async ({ request, params }) => proxy(request, params._splat ?? ""),
      POST: async ({ request, params }) => proxy(request, params._splat ?? ""),
      PUT: async ({ request, params }) => proxy(request, params._splat ?? ""),
      DELETE: async ({ request, params }) => proxy(request, params._splat ?? ""),
    },
  },
});