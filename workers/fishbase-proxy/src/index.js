const ALLOWED_ORIGINS = [
  'https://meridian-engine.com',
  'https://www.meridian-engine.com',
];

const ALLOWED_ENDPOINTS = [
  'species', 'comnames', 'ecology', 'estimate', 'taxa',
  'synonyms', 'stocks', 'country', 'diet', 'morphology',
  'maturity', 'popchar'
];

const UPSTREAM = 'https://fishbase.ropensci.org';
const RATE_LIMIT_MAX = 60;
const rateLimits = new Map();

function isOriginAllowed(request) {
  const origin = request.headers.get('Origin') || '';
  const referer = request.headers.get('Referer') || '';
  return ALLOWED_ORIGINS.some(o => origin === o || referer.startsWith(o + '/'));
}

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function checkRateLimit(ip) {
  const now = Date.now();
  const window = 60000;
  let entry = rateLimits.get(ip);
  if (!entry || now - entry.start > window) {
    entry = { start: now, count: 0 };
    rateLimits.set(ip, entry);
  }
  entry.count++;
  if (rateLimits.size > 5000) {
    for (const [key, val] of rateLimits) {
      if (now - val.start > window) rateLimits.delete(key);
    }
  }
  return entry.count <= RATE_LIMIT_MAX;
}

function jsonResponse(body, status, cors) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' },
  });
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405, headers: cors });
    }
    if (!isOriginAllowed(request)) {
      return new Response('Forbidden', { status: 403, headers: cors });
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!checkRateLimit(ip)) {
      return new Response('Rate limit exceeded', { status: 429, headers: { ...cors, 'Retry-After': '60' } });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;

    // Parse route: /api/fishbase/{endpoint} or /api/sealifebase/{endpoint}
    let db = null, endpoint = null;
    const fbMatch = pathname.match(/^\/api\/fishbase\/(\w+)$/);
    const slbMatch = pathname.match(/^\/api\/sealifebase\/(\w+)$/);
    if (fbMatch) { db = 'fishbase'; endpoint = fbMatch[1]; }
    else if (slbMatch) { db = 'sealifebase'; endpoint = slbMatch[1]; }

    if (!db || !endpoint || !ALLOWED_ENDPOINTS.includes(endpoint)) {
      return jsonResponse({ error: 'Not found' }, 404, cors);
    }

    // Build upstream URL
    // FishBase: https://fishbase.ropensci.org/{endpoint}?params
    // SeaLifeBase: https://fishbase.ropensci.org/sealifebase/{endpoint}?params
    const upstreamPath = db === 'sealifebase' ? `/sealifebase/${endpoint}` : `/${endpoint}`;
    const upstreamUrl = `${UPSTREAM}${upstreamPath}?${url.searchParams.toString()}`;

    // Check Cloudflare cache first
    const cacheKey = new Request(upstreamUrl, request);
    const cache = caches.default;
    let cached = await cache.match(cacheKey);
    if (cached) {
      const resp = new Response(cached.body, cached);
      Object.entries(cors).forEach(([k, v]) => resp.headers.set(k, v));
      return resp;
    }

    // Forward to upstream
    try {
      const upstream = await fetch(upstreamUrl, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'Meridian/1.0' },
        cf: { cacheTtl: 86400, cacheEverything: true },
      });

      if (!upstream.ok) {
        return jsonResponse({ error: `Upstream error: ${upstream.status}` }, upstream.status, cors);
      }

      const data = await upstream.json();
      const resp = new Response(JSON.stringify(data), {
        status: 200,
        headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' },
      });

      // Cache the response
      ctx.waitUntil(cache.put(cacheKey, resp.clone()));
      return resp;
    } catch (e) {
      return jsonResponse({ error: 'Upstream fetch failed' }, 502, cors);
    }
  },
};
