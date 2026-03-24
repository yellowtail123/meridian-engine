// Cloudflare Pages Function — proxies climate index data from NOAA
// Runs on same origin (meridian-engine.com/api/climate) so no CORS needed
const SOURCES = {
  oni: 'https://www.ncei.noaa.gov/pub/data/cmb/ersst/v5/index/ersst.v5.el_nino.dat',
  nao: 'https://psl.noaa.gov/data/correlation/nao.data',
  pdo: 'https://www.ncei.noaa.gov/pub/data/cmb/ersst/v5/index/ersst.v5.pdo.dat'
};

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const type = url.searchParams.get('type');

  if (!type || !SOURCES[type]) {
    return new Response(JSON.stringify({ error: 'Invalid type. Use ?type=oni|nao|pdo' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const resp = await fetch(SOURCES[type], {
      headers: { 'User-Agent': 'Meridian-Engine/1.0' },
      cf: { cacheTtl: 3600, cacheEverything: true }
    });

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: 'Upstream returned ' + resp.status }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const text = await resp.text();
    return new Response(text, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
