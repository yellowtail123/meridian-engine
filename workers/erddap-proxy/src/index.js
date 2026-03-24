// Meridian ERDDAP Proxy — Cloudflare Worker
// Proxies ERDDAP and NOAA data requests with proper CORS headers.
// Deploy: npx wrangler deploy --config workers/erddap-proxy/wrangler.toml
//
// Usage: GET /api/erddap/proxy?url=<encoded-target-url>
//
// After deploying, set _CORS_WORKER in meridian-core.js to:
//   '/api/erddap/proxy?url='

const ALLOWED_ORIGINS = [
  'https://meridian-engine.com',
  'https://www.meridian-engine.com',
  'http://localhost',
  'http://127.0.0.1',
];

const ALLOWED_HOSTS = [
  'coastwatch.pfeg.noaa.gov',
  'coastwatch.noaa.gov',
  'www.ncei.noaa.gov',
  'pae-paha.pacioos.hawaii.edu',
  'oceanwatch.pifsc.noaa.gov',
  'polarwatch.noaa.gov',
  'upwell.pfeg.noaa.gov',
  'apdrc.soest.hawaii.edu',
  'erddap.marine.copernicus.eu',
  'podaac-opendap.jpl.nasa.gov',
  'oceandata.sci.gsfc.nasa.gov',
  'www.ngdc.noaa.gov',
  'dap.ceda.ac.uk',
  'psl.noaa.gov',
  'www.cpc.ncep.noaa.gov',
  'gml.noaa.gov',
  'scrippsco2.ucsd.edu',
];

const RATE_LIMIT_MAX = 120; // per minute per IP
const rateLimits = new Map();

function isOriginAllowed(request) {
  const origin = request.headers.get('Origin') || '';
  const referer = request.headers.get('Referer') || '';
  // Allow in development (no origin = direct/curl, localhost)
  if (!origin && !referer) return true;
  return ALLOWED_ORIGINS.some(o => origin === o || origin.startsWith('http://localhost') || referer.startsWith(o + '/'));
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
  // Cleanup stale entries
  if (rateLimits.size > 10000) {
    for (const [key, val] of rateLimits) {
      if (now - val.start > window) rateLimits.delete(key);
    }
  }
  return entry.count <= RATE_LIMIT_MAX;
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    if (!isOriginAllowed(request)) {
      return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
        status: 403,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!checkRateLimit(ip)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: { ...cors, 'Content-Type': 'application/json', 'Retry-After': '60' },
      });
    }

    const url = new URL(request.url);
    const target = url.searchParams.get('url');

    if (!target) {
      return new Response(JSON.stringify({ error: 'Missing ?url= parameter' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Validate target URL
    let targetUrl;
    try {
      targetUrl = new URL(target);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid target URL' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Whitelist check
    if (!ALLOWED_HOSTS.some(h => targetUrl.hostname === h)) {
      return new Response(JSON.stringify({ error: 'Domain not allowed: ' + targetUrl.hostname }), {
        status: 403,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    try {
      const resp = await fetch(target, {
        headers: { 'User-Agent': 'Meridian-Engine/1.0 (ERDDAP Proxy)' },
        cf: { cacheTtl: 3600, cacheEverything: true },
      });

      if (!resp.ok) {
        return new Response(JSON.stringify({ error: 'Upstream returned ' + resp.status }), {
          status: resp.status >= 500 ? 502 : resp.status,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      // Forward the response with CORS headers
      const newHeaders = new Headers(resp.headers);
      Object.entries(cors).forEach(([k, v]) => newHeaders.set(k, v));
      // Ensure cache at the edge (1hr) and in browser (5min)
      newHeaders.set('Cache-Control', 'public, max-age=300, s-maxage=3600');

      return new Response(resp.body, {
        status: resp.status,
        headers: newHeaders,
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Proxy fetch failed: ' + e.message }), {
        status: 502,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
  },
};
