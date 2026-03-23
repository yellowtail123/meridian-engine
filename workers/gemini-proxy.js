// Meridian Gemini API Proxy — Cloudflare Worker
// Routes browser requests to Google Gemini API with CORS headers
// Deploy: npx wrangler deploy --config workers/wrangler-gemini.toml
//
// Route: meridian-engine.com/api/gemini/*
// Proxies to: generativelanguage.googleapis.com/v1beta/*

const ALLOWED_ORIGINS = [
  'https://meridian-engine.com',
  'https://www.meridian-engine.com',
  'http://localhost',
  'http://127.0.0.1',
  'null'
];

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': allowedOrigin,
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        }
      });
    }

    const url = new URL(request.url);
    // Strip /api/gemini/ prefix to get the Gemini API path
    const geminiPath = url.pathname.replace(/^\/api\/gemini\/?/, '');
    const targetUrl = `https://generativelanguage.googleapis.com/v1beta/${geminiPath}${url.search}`;

    try {
      const resp = await fetch(targetUrl, {
        method: request.method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: request.method === 'POST' ? await request.text() : undefined,
      });

      const responseHeaders = new Headers(resp.headers);
      responseHeaders.set('Access-Control-Allow-Origin', allowedOrigin);
      responseHeaders.set('Access-Control-Allow-Methods', 'POST, OPTIONS');

      return new Response(resp.body, {
        status: resp.status,
        statusText: resp.statusText,
        headers: responseHeaders,
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Proxy error: ' + err.message }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowedOrigin,
        }
      });
    }
  }
};
