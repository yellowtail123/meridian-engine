/**
 * Meridian Error Reporter — Cloudflare Worker
 *
 * Receives error reports from the Meridian client and stores them in KV.
 * Creates or updates GitHub Issues for each distinct error.
 * Deploy: wrangler deploy --name meridian-errors
 *
 * Required KV namespace binding: ERROR_STORE
 * wrangler kv:namespace create ERROR_STORE
 *
 * Required secret: GITHUB_TOKEN (repo scope, for creating issues)
 * wrangler secret put GITHUB_TOKEN
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://meridian-engine.com',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

const GITHUB_REPO = 'yellowtail123/meridian-engine';
const GITHUB_API = 'https://api.github.com';
const GITHUB_LABELS = ['bug', 'auto-reported'];

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

    // File GitHub Issues (non-blocking — don't let failures affect the response)
    if (env.GITHUB_TOKEN) {
      const uniqueMsgs = [...new Map(body.errors.slice(0, 20).map(e => [e.msg, sanitizeError(e)])).values()];
      for (const err of uniqueMsgs) {
        try { await fileGithubIssue(err, env); } catch {}
      }
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

async function fileGithubIssue(err, env) {
  const headers = {
    Authorization: `token ${env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'meridian-error-reporter',
  };

  const titlePrefix = '[Auto] ';
  const errMsg = String(err.msg || 'Unknown error').slice(0, 200);
  const searchTitle = errMsg.replace(/["\\\n\r]/g, ' ');

  // Search open issues for a duplicate
  const query = `repo:${GITHUB_REPO} is:issue is:open in:title "${searchTitle}"`;
  const searchResp = await fetch(
    `${GITHUB_API}/search/issues?q=${encodeURIComponent(query)}&per_page=5`,
    { headers },
  );

  if (!searchResp.ok) return;
  const searchData = await searchResp.json();

  const existing = searchData.items?.find(
    (issue) => issue.title.startsWith(titlePrefix) && issue.title.includes(errMsg.slice(0, 80)),
  );

  const body = formatIssueBody(err);

  if (existing) {
    // Add a comment to the existing issue
    await fetch(`${GITHUB_API}/repos/${GITHUB_REPO}/issues/${existing.number}/comments`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: `**Additional occurrence** — ${new Date().toISOString()}\n\n${body}` }),
    });
  } else {
    // Create a new issue
    await fetch(`${GITHUB_API}/repos/${GITHUB_REPO}/issues`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `${titlePrefix}${errMsg}`,
        body,
        labels: GITHUB_LABELS,
      }),
    });
  }
}

function formatIssueBody(err) {
  const lines = [
    `**Error:** \`${String(err.msg || 'Unknown').slice(0, 500)}\``,
    `**Source:** ${err.source || 'N/A'}`,
    `**Tab:** ${err.tab || 'N/A'}`,
    `**Time:** ${err.ts || new Date().toISOString()}`,
    `**Browser:** ${err.env?.browser || 'N/A'} on ${err.env?.os || 'N/A'}`,
    `**Screen:** ${err.env?.screen || 'N/A'}`,
    '',
  ];
  if (err.stack) {
    lines.push('### Stack Trace', '```', String(err.stack).slice(0, 2000), '```', '');
  }
  if (err.crumbs?.length) {
    lines.push(
      '### Breadcrumbs',
      '| Time | Type | Message |',
      '|------|------|---------|',
      ...err.crumbs.slice(-10).map(
        (c) => `| ${new Date(c.t).toISOString()} | ${c.type} | ${String(c.msg || '').slice(0, 120)} |`,
      ),
      '',
    );
  }
  lines.push('---', '*Auto-reported by Meridian Error Reporter*');
  return lines.join('\n');
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
