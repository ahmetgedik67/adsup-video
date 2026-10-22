// AD'S UP video vekili (Cloudflare Worker)
//
// Amaç: Hugging Face anahtarını tarayıcıda göstermeden ZeroGPU alanına istek atmak.
// Öğrenci sayfayı açar, görseli seçer, üretir — hiçbir anahtar girmez.
//
// Anahtar Worker sırrı olarak durur (HF_TOKEN). Yalnızca izinli kaynaklardan
// (GitHub Pages + localhost) gelen istekler geçer; başka hedefe yönlendirme yok.

const SPACE = "https://saravutw-wan2-2-i2v-lightning-4-8step-custom.hf.space";
const ALLOWED_ORIGINS = [
  "https://bilfen.github.io",
  "http://localhost:8080",
  "http://127.0.0.1:8080"
];

function corsHeaders(origin) {
  const ok = ALLOWED_ORIGINS.includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "content-type,accept",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin"
  };
}

function json(body, headers, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: Object.assign({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, headers)
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const headers = corsHeaders(origin);
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });

    if (url.pathname === "/api/health") {
      return json({
        ok: true,
        token: !!env.HF_TOKEN,
        space: SPACE
      }, headers);
    }

    if (!url.pathname.startsWith("/hf/")) return json({ error: "not_found" }, headers, 404);

    if (!env.HF_TOKEN) {
      return json({ error: "Sunucuda HF_TOKEN sırrı tanımlı değil." }, headers, 503);
    }

    // /hf/upload -> {SPACE}/gradio_api/upload  (yol kısıtı: yalnızca gradio_api)
    const rest = url.pathname.slice("/hf/".length);
    if (!/^[A-Za-z0-9_./=-]*$/.test(rest) || rest.includes("..")) {
      return json({ error: "bad_path" }, headers, 400);
    }
    const target = SPACE + "/gradio_api/" + rest + url.search;

    const upstreamHeaders = new Headers();
    upstreamHeaders.set("Authorization", "Bearer " + env.HF_TOKEN);
    const ct = request.headers.get("content-type");
    if (ct) upstreamHeaders.set("Content-Type", ct);
    upstreamHeaders.set("Accept", request.headers.get("accept") || "*/*");

    let upstream;
    try {
      upstream = await fetch(target, {
        method: request.method,
        headers: upstreamHeaders,
        body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body
      });
    } catch (e) {
      return json({ error: "upstream_failed", detail: String(e && e.message || e) }, headers, 502);
    }

    const outHeaders = new Headers(headers);
    const pass = ["content-type", "content-length", "cache-control", "last-modified", "etag", "accept-ranges", "content-range"];
    for (const k of pass) {
      const v = upstream.headers.get(k);
      if (v) outHeaders.set(k, v);
    }
    // SSE ve video akışı için arabellekleme kapalı
    outHeaders.set("X-Accel-Buffering", "no");
    if (upstream.headers.get("content-type") && upstream.headers.get("content-type").includes("text/event-stream")) {
      outHeaders.set("Cache-Control", "no-store");
    }

    return new Response(upstream.body, { status: upstream.status, headers: outHeaders });
  }
};
