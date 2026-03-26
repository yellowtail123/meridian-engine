const ALLOWED_ORIGINS = [
  'https://meridian-engine.com',
  'https://www.meridian-engine.com',
];

const ALLOWED_ENDPOINTS = [
  'species', 'comnames', 'ecology', 'estimate', 'taxa',
  'synonyms', 'stocks', 'country', 'diet', 'morphology',
  'maturity', 'popchar'
];

const RATE_LIMIT_MAX = 60;
const rateLimits = new Map();

// In-memory caches (loaded from KV on first request)
let fbSpeciesData = null;

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

async function loadFBSpecies(env) {
  if (fbSpeciesData) return fbSpeciesData;
  try {
    const raw = await env.FISHBASE_DATA.get('species_lookup');
    if (raw) fbSpeciesData = JSON.parse(raw);
  } catch {}
  return fbSpeciesData;
}

// Serve FishBase species from KV
function serveFBSpecies(data, url, cors) {
  const genus = url.searchParams.get('Genus') || '';
  const species = url.searchParams.get('Species') || '';
  const specCode = url.searchParams.get('SpecCode');

  if (genus) {
    const key = species ? `${genus} ${species}` : null;
    if (key && data[key]) {
      const entry = { ...data[key] };
      delete entry._eco;
      return jsonResponse({ data: [entry] }, 200, cors);
    }
    // Genus-level search
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

// Serve FishBase ecology from KV
function serveFBEcology(data, url, cors) {
  const specCode = url.searchParams.get('SpecCode');
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

    // FishBase: serve species + ecology from KV
    if (db === 'fishbase' && (endpoint === 'species' || endpoint === 'ecology')) {
      const data = await loadFBSpecies(env);
      if (!data) {
        return jsonResponse({ data: [], _note: 'KV data not loaded' }, 200, cors);
      }
      if (endpoint === 'species') return serveFBSpecies(data, url, cors);
      if (endpoint === 'ecology') return serveFBEcology(data, url, cors);
    }

    // All other endpoints (comnames, synonyms, estimate, diet, maturity, country, etc.)
    // and all SeaLifeBase endpoints: return empty data gracefully.
    // The upstream API (fishbase.ropensci.org) is decommissioned.
    // TODO: Build parquet-to-KV data loader for additional tables.
    return jsonResponse({ data: [] }, 200, cors);
  },
};
