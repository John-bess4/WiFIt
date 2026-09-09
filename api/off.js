export const config = { runtime: 'edge' };

// Open Food Facts search proxy. Same shape and auth gate as api/usda.js: a real
// Supabase JWT verified against /auth/v1/user, rejecting on ANY non-2xx.
//
// Why a proxy for a keyless, free API: CORS. Every OFF endpoint that does
// free-text search — the legacy cgi/search.pl and the modern search-a-licious
// service — rejects the browser (no Access-Control-Allow-Origin). /api/v2/search
// is CORS-open but does NOT free-text (q/search_terms are ignored; it filters by
// structured tags only, so every query returns the whole database). Server to
// server there is no CORS, so this function is the only client-viable path to
// OFF name search. It also caches, and gives one place to swap the upstream.
//
// Upstream: search-a-licious (search.openfoodfacts.org) is PRIMARY — measured
// 2026-09-09 to rank US/national brands first and surface whole foods (Kirkland
// chicken breast, USDA banana), where cgi/search.pl is Euro-biased and returns
// packaged derivatives. cgi is the FALLBACK if SAL is unavailable. Both are
// normalised here to the { products:[{product_name, brands, nutriments,
// serving_quantity}] } shape the client already parses, so the client never
// learns which upstream answered.
//
// The client treats any non-2xx from here as "search failed", never "no
// results" — the distinction the whole three-state search sheet depends on.

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vghqqksbjpgdzmvfmnru.supabase.co';
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZnaHFxa3NianBnZHptdmZtbnJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NjAwNzgsImV4cCI6MjA5MzMzNjA3OH0.1JXmsIs9Jk87wd9uTIpNp93gnoqNMtOR78XiDQHUasg';
const UA = 'WiFit/1.0 (https://wifit.vercel.app)';
const FIELDS = 'product_name,brands,nutriments,serving_quantity,countries_tags,code';

const json = (status, obj, extra = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...extra } });

function bearerToken(req) {
  const auth = req.headers.get('authorization') || '';
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
}
async function verifyUser(token) {
  if (!token) return null;
  try {
    const r = await fetch(SUPABASE_URL + '/auth/v1/user', { headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + token } });
    if (!r.ok) return null;
    const u = await r.json();
    return u && u.id ? u : null;
  } catch { return null; }
}

// SAL hits and cgi products both carry nutriments in the same key space; only
// `brands` differs (SAL: array, cgi: comma string). Normalise to cgi's shape.
const normBrands = (b) => Array.isArray(b) ? b.join(', ') : (b || '');
const toProducts = (rows) => (rows || []).map((p) => ({
  product_name: p.product_name || p.product_name_en || '',
  brands: normBrands(p.brands),
  nutriments: p.nutriments || {},
  serving_quantity: p.serving_quantity ?? null,
}));

async function searchSAL(q, pageSize) {
  const url = 'https://search.openfoodfacts.org/search?q=' + encodeURIComponent(q) + '&page_size=' + pageSize + '&fields=' + FIELDS;
  const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!r.ok) return { ok: false, status: r.status };
  const d = await r.json();
  return { ok: true, products: toProducts(d.hits) };
}
async function searchCGI(q, pageSize) {
  const url = 'https://world.openfoodfacts.org/cgi/search.pl?search_terms=' + encodeURIComponent(q) + '&search_simple=1&action=process&json=1&page_size=' + pageSize + '&fields=' + FIELDS;
  const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!r.ok) return { ok: false, status: r.status };
  const d = await r.json();
  return { ok: true, products: toProducts(d.products) };
}

export default async function handler(req) {
  if (req.method !== 'GET') return json(405, { error: 'GET only', code: 'method' });
  const user = await verifyUser(bearerToken(req));
  if (!user) return json(401, { error: 'Sign in to search foods.', code: 'unauthenticated' });

  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim().slice(0, 120);
  if (!q) return json(400, { error: 'q is required', code: 'bad_request' });
  const pageSize = Math.min(20, Math.max(1, parseInt(url.searchParams.get('pageSize') || '8', 10) || 8));

  try {
    let res = await searchSAL(q, pageSize);
    if (!res.ok) res = await searchCGI(q, pageSize); // SAL down → the Euro-biased but live fallback
    if (!res.ok) return json(502, { error: 'OFF responded ' + res.status, code: 'upstream' });
    // Results do not depend on the caller; let the edge serve repeats for a day.
    return json(200, { products: res.products }, { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' });
  } catch {
    return json(502, { error: 'OFF request failed', code: 'upstream_network' });
  }
}
