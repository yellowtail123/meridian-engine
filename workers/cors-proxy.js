// Meridian CORS Proxy — Cloudflare Worker
// Proxies ERDDAP requests with proper CORS headers
// Deploy: npx wrangler deploy --config workers/wrangler-cors.toml
//
// After deploying, set _CORS_WORKER in meridian.html to:
//   'https://meridian-cors.<your-subdomain>.workers.dev/?url='

const ALLOWED_ORIGINS = [
  'https://meridian-engine.com',
  'https://www.meridian-engine.com',
  'http://localhost',
  'http://127.0.0.1',
  'null' // file:// protocol sends Origin: null
];

// Only proxy requests to known oceanographic data servers
const ALLOWED_HOSTS = [
  'coastwatch.pfeg.noaa.gov',
  'coastwatch.noaa.gov',
  'www.ncei.noaa.gov',
  'upwell.pfeg.noaa.gov',
  'apdrc.soest.hawaii.edu',
  'erddap.marine.copernicus.eu',
  'podaac-opendap.jpl.nasa.gov',
  'oceandata.sci.gsfc.nasa.gov',
  'gml.noaa.gov',
  'scrippsco2.ucsd.edu',
  'marine-api.open-meteo.com',
  'archive-api.open-meteo.com',
  'api.open-meteo.com',
  'pae-paha.pacioos.hawaii.edu',
  'oceanwatch.pifsc.noaa.gov',
  'polarwatch.noaa.gov',
  'www.gmrt.org',
  'gateway.api.globalfishingwatch.org',
  'psl.noaa.gov',
  'www.cpc.ncep.noaa.gov'
];

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders(origin) });
    }

    const url = new URL(request.url);
    const target = url.searchParams.get('url');

    if (!target) {
      return new Response('Missing ?url= parameter', { status: 400, headers: corsHeaders(origin) });
    }

    // Validate target host
    let targetUrl;
    try {
      targetUrl = new URL(target);
    } catch {
      return new Response('Invalid URL', { status: 400, headers: corsHeaders(origin) });
    }

    if (!ALLOWED_HOSTS.some(h => targetUrl.hostname === h || targetUrl.hostname.endsWith('.' + h))) {
      return new Response('Host not allowed: ' + targetUrl.hostname, { status: 403, headers: corsHeaders(origin) });
    }

    try {
      const resp = await fetch(target, {
        headers: { 'User-Agent': 'Meridian-Engine/1.0 (CORS Proxy)' },
        cf: { cacheTtl: 300, cacheEverything: true }
      });

      const newHeaders = new Headers(resp.headers);
      Object.entries(corsHeaders(origin)).forEach(([k, v]) => newHeaders.set(k, v));

      return new Response(resp.body, {
        status: resp.status,
        statusText: resp.statusText,
        headers: newHeaders
      });
    } catch (e) {
      return new Response('Proxy error: ' + e.message, {
        status: 502,
        headers: corsHeaders(origin)
      });
    }
  }
};
