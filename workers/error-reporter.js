/**
 * Meridian Error Reporter — Cloudflare Worker
 *
 * Receives error reports from the Meridian client and stores them in KV.
 * Deploy: wrangler deploy --name meridian-errors
 *
 * Required KV namespace binding: ERROR_STORE
 * wrangler kv:namespace create ERROR_STORE
 *
 * Optional: Set NOTIFY_EMAIL env var to receive email alerts (requires Mailchannels or similar)
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://meridian-engine.com',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

// Rate limiting: max 20 reports per IP per minute
const RATE_LIMIT = 20;
const RATE_WINDOW = 60;

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    // POST /api/errors — receive error batch from client
    if (request.method === 'POST' && url.pathname === '/api/errors') {
      return handleErrorReport(request, env);
    }

    // GET /api/errors — admin view (requires ?key=ADMIN_KEY)
    if (request.method === 'GET' && url.pathname === '/api/errors') {
      return handleErrorList(request, env);
    }

    // GET /api/errors/stats — quick stats
    if (request.method === 'GET' && url.pathname === '/api/errors/stats') {
      return handleStats(env);
    }

    return new Response('Not found', { status: 404 });
  },
};

async function handleErrorReport(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

  // Rate limiting via KV
  const rateKey = `rate:${ip}`;
  const current = parseInt(await env.ERROR_STORE.get(rateKey) || '0');
  if (current >= RATE_LIMIT) {
    return new Response(JSON.stringify({ error: 'Rate limited' }), {
      status: 429,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
  await env.ERROR_STORE.put(rateKey, String(current + 1), { expirationTtl: RATE_WINDOW });

  try {
    const body = await request.json();
    if (!body.errors || !Array.isArray(body.errors)) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Store each error with a date-prefixed key for easy listing
    const date = new Date().toISOString().split('T')[0];
    for (const err of body.errors.slice(0, 20)) { // Max 20 per batch
      const key = `err:${date}:${err.id || Date.now()}`;
      // Strip any accidentally included API keys from error data
      const sanitized = sanitizeError(err);
      sanitized._ip = ip;
      sanitized._received = new Date().toISOString();
      await env.ERROR_STORE.put(key, JSON.stringify(sanitized), {
        expirationTtl: 60 * 60 * 24 * 30, // 30 days retention
      });
    }

    // Update daily counter
    const countKey = `count:${date}`;
    const dayCount = parseInt(await env.ERROR_STORE.get(countKey) || '0');
    await env.ERROR_STORE.put(countKey, String(dayCount + body.errors.length), {
      expirationTtl: 60 * 60 * 24 * 90,
    });

    return new Response(JSON.stringify({ ok: true, stored: body.errors.length }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Parse error' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
}

async function handleErrorList(request, env) {
  const url = new URL(request.url);
  const adminKey = url.searchParams.get('key');
  if (!env.ADMIN_KEY || adminKey !== env.ADMIN_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];
  const list = await env.ERROR_STORE.list({ prefix: `err:${date}:`, limit: 100 });
  const errors = [];
  for (const key of list.keys) {
    const val = await env.ERROR_STORE.get(key.name);
    if (val) errors.push(JSON.parse(val));
  }

  return new Response(JSON.stringify({ date, count: errors.length, errors }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleStats(env) {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const todayCount = parseInt(await env.ERROR_STORE.get(`count:${today}`) || '0');
  const yesterdayCount = parseInt(await env.ERROR_STORE.get(`count:${yesterday}`) || '0');

  return new Response(JSON.stringify({ today: todayCount, yesterday: yesterdayCount }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

function sanitizeError(err) {
  const clean = { ...err };
  // Remove any field that might contain an API key
  const keyPattern = /sk-ant-|sk-[a-zA-Z0-9]{20}|AIza[a-zA-Z0-9]{30}/;
  for (const [k, v] of Object.entries(clean)) {
    if (typeof v === 'string' && keyPattern.test(v)) {
      clean[k] = v.replace(keyPattern, '[REDACTED]');
    }
  }
  // Sanitize breadcrumbs
  if (clean.crumbs) {
    clean.crumbs = clean.crumbs.map(c => ({
      ...c,
      msg: typeof c.msg === 'string' ? c.msg.replace(keyPattern, '[REDACTED]') : c.msg,
    }));
  }
  return clean;
}
