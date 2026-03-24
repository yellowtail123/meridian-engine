// Meridian ERDDAP Proxy — Cloudflare Worker
// Proxies ERDDAP and NOAA data requests with proper CORS headers.
// Deploy: npx wrangler deploy --config workers/erddap-proxy/wrangler.toml
//
// Usage: GET /api/erddap/proxy?url=<encoded-target-url>

const ALLOWED_ORIGINS = [
  'https://meridian-engine.com',
  'https://www.meridian-engine.com',
];

const ALLOWED_HOSTS = [
  'coastwatch.pfeg.noaa.gov',
  'www.ncei.noaa.gov',
  'coastwatch.noaa.gov',
  'psl.noaa.gov',
  'www.cpc.ncep.noaa.gov',
  'dap.ceda.ac.uk',
  'pae-paha.pacioos.hawaii.edu',
  'oceanwatch.pifsc.noaa.gov',
  'polarwatch.noaa.gov',
  'upwell.pfeg.noaa.gov',
  'apdrc.soest.hawaii.edu',
  'erddap.marine.copernicus.eu',
  'podaac-opendap.jpl.nasa.gov',
  'oceandata.sci.gsfc.nasa.gov',
  'www.ngdc.noaa.gov',
  'gml.noaa.gov',
  'scrippsco2.ucsd.edu',
  'members.oceantrack.org',
];

const RATE_LIMIT_MAX = 120; // per minute per IP
const rateLimits = new Map();

// Only these upstream headers are forwarded to the client
const SAFE_RESPONSE_HEADERS = [
  'content-type',
  'content-length',
  'content-encoding',
  'last-modified',
  'etag',
];

function isOriginAllowed(origin) {
  return ALLOWED_ORIGINS.includes(origin);
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

    // GET only
    if (request.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Strict origin check — reject missing or unauthorized Origin
    if (!isOriginAllowed(origin)) {
      return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
        status: 403,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Rate limit
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

    // HTTPS only — blocks http, data, javascript, file, etc.
    if (targetUrl.protocol !== 'https:') {
      return new Response(JSON.stringify({ error: 'Only HTTPS targets allowed' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Domain whitelist — exact hostname match
    if (!ALLOWED_HOSTS.includes(targetUrl.hostname)) {
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

      // Build clean response — only forward safe headers, strip everything else
      const newHeaders = new Headers();
      for (const name of SAFE_RESPONSE_HEADERS) {
        const val = resp.headers.get(name);
        if (val) newHeaders.set(name, val);
      }
      Object.entries(cors).forEach(([k, v]) => newHeaders.set(k, v));
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
