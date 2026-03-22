const ALLOWED_ORIGINS = [
  'https://meridian-engine.com',
  'https://www.meridian-engine.com',
];

const ALLOWED_PATHS = ['/api/fishbase/species', '/api/fishbase/ecology'];
const RATE_LIMIT_MAX = 60; // per minute per IP

// In-memory rate limit counters
const rateLimits = new Map();
// In-memory species cache (loaded from KV on first request)
let speciesData = null;

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

async function loadData(env) {
  if (speciesData) return speciesData;
  const raw = await env.FISHBASE_DATA.get('species_lookup');
  if (raw) {
    speciesData = JSON.parse(raw);
  }
  return speciesData;
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

    if (!ALLOWED_PATHS.some(p => pathname === p)) {
      return new Response('Not found', { status: 404, headers: cors });
    }

    // Load species data from KV
    const data = await loadData(env);
    if (!data) {
      return jsonResponse({ error: 'Data not loaded' }, 503, cors);
    }

    const genus = url.searchParams.get('Genus') || '';
    const species = url.searchParams.get('Species') || '';
    const specCode = url.searchParams.get('SpecCode');

    if (pathname === '/api/fishbase/species') {
      // Look up by Genus + Species
      if (genus) {
        const key = species ? `${genus} ${species}` : null;
        if (key && data[key]) {
          // Exact match
          const entry = { ...data[key] };
          delete entry._eco; // /species only returns species data, not ecology
          return jsonResponse({ data: [entry] }, 200, cors);
        }
        // Genus-level search: return all species in genus
        const matches = [];
        const prefix = genus + ' ';
        for (const [k, v] of Object.entries(data)) {
          if (k.startsWith(prefix)) {
            const entry = { ...v };
            entry.Genus = genus;
            entry.Species = k.slice(prefix.length);
            delete entry._eco;
            matches.push(entry);
          }
          if (matches.length >= 50) break;
        }
        if (matches.length) return jsonResponse({ data: matches }, 200, cors);
      }
      // Search by SpecCode
      if (specCode) {
        const sc = parseInt(specCode);
        for (const [k, v] of Object.entries(data)) {
          if (v.SpecCode === sc) {
            const entry = { ...v };
            const parts = k.split(' ');
            entry.Genus = parts[0];
            entry.Species = parts.slice(1).join(' ');
            delete entry._eco;
            return jsonResponse({ data: [entry] }, 200, cors);
          }
        }
      }
      return jsonResponse({ data: [] }, 200, cors);
    }

    if (pathname === '/api/fishbase/ecology') {
      // Look up ecology by SpecCode
      if (specCode) {
        const sc = parseInt(specCode);
        for (const [k, v] of Object.entries(data)) {
          if (v.SpecCode === sc && v._eco) {
            return jsonResponse({ data: [{ SpecCode: sc, ...v._eco }] }, 200, cors);
          }
        }
      }
      return jsonResponse({ data: [] }, 200, cors);
    }

    return jsonResponse({ error: 'Not found' }, 404, cors);
  },
};

function jsonResponse(body, status, cors) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' },
  });
}
