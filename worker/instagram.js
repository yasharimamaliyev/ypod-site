// Cloudflare Worker: Instagram postlarını sayt üçün verir, tokeni gizli saxlayır.
// Quraşdırma: README.md → "Instagram bölməsini qoşmaq".
//
// Secret-lər (wrangler secret put ...):
//   IG_TOKEN      — Instagram API uzunmüddətli access token (ilkin dəyər)
// KV (wrangler.toml [[kv_namespaces]] binding = "IG_KV"):
//   həftəlik yenilənən token burada saxlanır, IG_TOKEN-dan üstündür
// Dəyişənlər (wrangler.toml [vars]):
//   ALLOW_ORIGIN  — saytın ünvanı, məs. https://ypod.az (vergüllə bir neçə)

const FIELDS = 'id,media_type,media_url,thumbnail_url,permalink';
const CACHE_SECONDS = 3600;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOW_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
    const cors = {
      'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0] || '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      Vary: 'Origin',
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (url.pathname !== '/api/instagram') return new Response('Not found', { status: 404, headers: cors });
    const token = await getToken(env);
    if (!token) return json({ error: 'IG_TOKEN təyin olunmayıb' }, 500, cors);

    const cache = caches.default;
    const cacheKey = new Request(url.origin + '/api/instagram');
    const hit = await cache.match(cacheKey);
    if (hit) return withHeaders(hit, cors);

    const api = `https://graph.instagram.com/me/media?fields=${FIELDS}&limit=12&access_token=${token}`;
    const res = await fetch(api);
    if (!res.ok) return json({ error: 'Instagram API xətası', status: res.status }, 502, cors);

    const body = await res.json();
    const data = (body.data || [])
      .filter(p => p.media_url || p.thumbnail_url)
      .map(({ id, media_type, media_url, thumbnail_url, permalink }) => ({ id, media_type, media_url, thumbnail_url, permalink }));

    const out = json({ data }, 200, { ...cors, 'Cache-Control': `public, max-age=${CACHE_SECONDS}` });
    ctx.waitUntil(cache.put(cacheKey, out.clone()));
    return out;
  },

  // Token 60 gündə köhnəlir: həftədə bir dəfə yenilənir və KV-yə yazılır (wrangler.toml [triggers] crons)
  async scheduled(_event, env) {
    const token = await getToken(env);
    if (!token || !env.IG_KV) return;
    const r = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${token}`);
    if (!r.ok) { console.log('Token yenilənmədi:', r.status); return; }
    const { access_token } = await r.json();
    if (access_token) await env.IG_KV.put('token', access_token);
  },
};

async function getToken(env) {
  return (await env.IG_KV?.get('token')) || env.IG_TOKEN;
}

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } });
}

function withHeaders(res, headers) {
  const r = new Response(res.body, res);
  for (const [k, v] of Object.entries(headers)) r.headers.set(k, v);
  return r;
}
