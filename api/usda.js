export const config = { runtime: 'edge' };

// USDA FoodData Central proxy. The key stays server-side; the client never
// sees it and cannot choose it. Same auth gate as /api/coach: a real Supabase
// JWT, verified against /auth/v1/user, rejecting on ANY non-2xx.
//
// Why a proxy and not a VITE_ env var: a VITE_ value is compiled into the
// public bundle, so it is not a secret, only a moved literal. This keeps the
// key private, lets the edge cache identical queries (search results do not
// depend on who asks), and gives one place to rate-limit or swap providers.
//
// The client treats any non-2xx from here as "search failed", never as "no
// results" — that distinction is the whole reason DEMO_KEY hid for so long.

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vghqqksbjpgdzmvfmnru.supabase.co';
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZnaHFxa3NianBnZHptdmZtbnJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NjAwNzgsImV4cCI6MjA5MzMzNjA3OH0.1JXmsIs9Jk87wd9uTIpNp93gnoqNMtOR78XiDQHUasg';
const FDC = 'https://api.nal.usda.gov/fdc/v1/foods/search';
const ALLOWED_DATATYPES = new Set(['Branded', 'Foundation', 'SR Legacy', 'Survey (FNDDS)']);

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

export default async function handler(req) {
  if (req.method !== 'GET') return json(405, { error: 'GET only', code: 'method' });
  const user = await verifyUser(bearerToken(req));
  if (!user) return json(401, { error: 'Sign in to search foods.', code: 'unauthenticated' });

  const key = process.env.USDA_API_KEY;
  if (!key) return json(503, { error: 'USDA_API_KEY is not set on the server', code: 'not_configured' });

  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim().slice(0, 120);
  if (!q) return json(400, { error: 'q is required', code: 'bad_request' });
  const dataType = (url.searchParams.get('dataType') || 'Branded,Foundation,SR Legacy').split(',').map((s) => s.trim()).filter((s) => ALLOWED_DATATYPES.has(s)).join(',');
  const pageSize = Math.min(25, Math.max(1, parseInt(url.searchParams.get('pageSize') || '10', 10) || 10));

  const upstream = await fetch(FDC + '?query=' + encodeURIComponent(q) + '&dataType=' + encodeURIComponent(dataType) + '&pageSize=' + pageSize + '&api_key=' + key);
  if (!upstream.ok) {
    // Passed through verbatim so a 429 (FDC's own limit) or 403 (bad key) is
    // diagnosable from the client's console, but the key itself never is.
    return json(upstream.status, { error: 'USDA responded ' + upstream.status, code: 'upstream' });
  }
  const body = await upstream.text();
  // Results do not depend on the caller; let the edge serve repeats for a day.
  return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } });
}
