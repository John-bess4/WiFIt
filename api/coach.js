export const config = { runtime: 'edge' };

// Pinned server-side. Callers send a `model` field; it is ignored. Changing the
// coach's model is a one-line change here, never something a caller can do.
const MODEL = 'claude-sonnet-4-20250514';
const ANTHROPIC_VERSION = '2023-06-01';

// Ceilings. Deliberately NOT per-call-site: a client-declared "purpose" would be
// attacker-controlled and would enforce nothing. Every limit below is derived
// from the request itself, and the one real distinction — an image payload vs a
// text-only one — is something the server can see for itself.
const MAX_TOKENS = 1200;                  // highest any call site legitimately asks for
const MAX_MESSAGES = 24;                  // chat sends 10 context + 1; rest is headroom
const MAX_SYSTEM_CHARS = 20000;           // buildSystem() renders well under 8k
const MAX_BODY_BYTES = 5 * 1024 * 1024;   // one base64 phone photo
const MAX_TEXT_BODY_BYTES = 128 * 1024;   // text-only: ~32k tokens of input

// Per-user rate limit. One chat turn is already two requests (callClaude, then
// generateSuggestions on the reply), so 60/hour is ~30 turns an hour today and
// fewer once the Action Router multiplies calls per message. The daily cap
// exists because the hourly one alone would still permit 1,440 requests a day.
const RATE_PER_HOUR = 60;
const RATE_PER_DAY = 400;

// Both values are public — the anon key already ships inside the client bundle —
// so these env vars are a convenience, not a secret. The literal fallbacks mean
// the gate works without provisioning anything on Vercel.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vghqqksbjpgdzmvfmnru.supabase.co';
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZnaHFxa3NianBnZHptdmZtbnJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NjAwNzgsImV4cCI6MjA5MzMzNjA3OH0.1JXmsIs9Jk87wd9uTIpNp93gnoqNMtOR78XiDQHUasg';

const json = (status, obj) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });

// Verify the caller's Supabase JWT for real — a presence check on the header
// would be worthless, since anyone can send "Bearer x".
//
// Rejects on ANY non-2xx, not just 401. Verified against the live endpoint:
//   garbage token      -> 403 bad_jwt
//   no Authorization   -> 401 no_authorization
//   the anon key       -> 403 "invalid claim: missing sub claim"
// A 401-only check would therefore admit both a malformed token AND the public
// anon key that ships in the client bundle.
function bearerToken(req) {
  const auth = req.headers.get('authorization') || '';
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
}

async function verifyUser(token) {
  if (!token) return null;
  try {
    const r = await fetch(SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + token },
    });
    if (!r.ok) return null;
    const u = await r.json();
    return u && u.id ? u : null;
  } catch {
    return null; // network failure verifying == not verified
  }
}

function retryPhrase(sec) {
  const m = Math.ceil(sec / 60);
  if (m < 60) return 'about ' + m + ' minute' + (m === 1 ? '' : 's');
  const h = Math.ceil(m / 60);
  return 'about ' + h + ' hour' + (h === 1 ? '' : 's');
}

// Per-user rate limit, counted on entry.
//
// Edge isolates are ephemeral, concurrent and per-region, so an in-memory
// counter would reset constantly and enforce nothing. State lives in
// coach_usage instead, which is co-located with the function (Supabase
// us-east-1 / Vercel iad1).
//
// Uses the caller's own JWT, not a service-role key: coach_usage grants
// INSERT and SELECT of your own rows and has no UPDATE or DELETE policy, so a
// user cannot clear or backdate their history to reset the limit.
//
// One read covers both windows. Rows come back newest-first capped at
// RATE_PER_DAY + 1, and that cap is far above RATE_PER_HOUR, so every row
// inside the hour window is present and the hourly count is exact.
async function checkRate(userId, token) {
  const now = Date.now();
  const h = { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + token };
  const url =
    SUPABASE_URL +
    '/rest/v1/coach_usage?user_id=eq.' + encodeURIComponent(userId) +
    '&created_at=gte.' + encodeURIComponent(new Date(now - 86400000).toISOString()) +
    '&select=created_at&order=created_at.desc&limit=' + (RATE_PER_DAY + 1);

  let rows;
  try {
    const r = await fetch(url, { headers: h });
    if (!r.ok) return { fail: true };
    rows = await r.json();
  } catch {
    return { fail: true };
  }
  if (!Array.isArray(rows)) return { fail: true };

  const times = rows.map((x) => Date.parse(x.created_at)).filter(Number.isFinite);
  const hourCount = times.filter((t) => t > now - 3600000).length;

  // A slot frees when the Nth-newest request in the window ages out of it.
  if (hourCount >= RATE_PER_HOUR) {
    const freesAt = times[RATE_PER_HOUR - 1] + 3600000;
    return { limited: true, scope: 'hour', retryAfter: Math.max(1, Math.ceil((freesAt - now) / 1000)) };
  }
  if (times.length >= RATE_PER_DAY) {
    const freesAt = times[RATE_PER_DAY - 1] + 86400000;
    return { limited: true, scope: 'day', retryAfter: Math.max(1, Math.ceil((freesAt - now) / 1000)) };
  }

  // Count on entry — recorded before Anthropic is called, so a caller cannot
  // burn quota and retry for free. A failed write fails closed for the same
  // reason: unrecorded usage is unenforceable usage.
  try {
    const w = await fetch(SUPABASE_URL + '/rest/v1/coach_usage', {
      method: 'POST',
      headers: { ...h, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ user_id: userId }),
    });
    if (!w.ok) return { fail: true };
  } catch {
    return { fail: true };
  }
  return { ok: true };
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Auth first: no unauthenticated request may ever cost money.
  const token = bearerToken(req);
  const user = await verifyUser(token);
  if (!user) {
    return json(401, { error: 'Sign in to use the AI coach.', code: 'unauthenticated' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json(503, { error: 'ANTHROPIC_API_KEY is not set on the server' });
  }

  const raw = await req.text();
  const bytes = new TextEncoder().encode(raw).length;
  if (bytes > MAX_BODY_BYTES) {
    return json(413, { error: 'Request too large.', code: 'payload_too_large' });
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const messages = body && body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return json(400, { error: 'messages must be a non-empty array', code: 'bad_request' });
  }
  if (messages.length > MAX_MESSAGES) {
    return json(400, { error: 'Too many messages.', code: 'bad_request' });
  }

  // Only a genuine image payload earns the larger size budget.
  const hasImage = messages.some(
    (m) => Array.isArray(m && m.content) && m.content.some((b) => b && b.type === 'image')
  );
  if (!hasImage && bytes > MAX_TEXT_BODY_BYTES) {
    return json(413, { error: 'Request too large.', code: 'payload_too_large' });
  }

  const system =
    typeof body.system === 'string' ? body.system.slice(0, MAX_SYSTEM_CHARS) : undefined;
  const requested = Number(body.max_tokens);
  const max_tokens = Math.min(
    Number.isFinite(requested) && requested > 0 ? Math.floor(requested) : MAX_TOKENS,
    MAX_TOKENS
  );

  // Rebuilt from validated parts. The client body is never forwarded as-is, so a
  // caller cannot smuggle in a different model or any other Anthropic parameter.
  const payload = { model: MODEL, max_tokens, messages };
  if (system) payload.system = system;

  // Last gate before spending money. Placed after validation so a malformed
  // request, which never reaches Anthropic anyway, does not consume quota.
  const rate = await checkRate(user.id, token);
  if (rate.fail) {
    return json(503, {
      error: 'Could not verify usage limits right now. Try again in a moment.',
      code: 'rate_check_failed',
    });
  }
  if (rate.limited) {
    return new Response(
      JSON.stringify({
        error:
          "You've reached the coach's " + (rate.scope === 'hour' ? 'hourly' : 'daily') +
          ' limit. Try again in ' + retryPhrase(rate.retryAfter) + '.',
        code: 'rate_limited',
        scope: rate.scope,
        retryAfter: rate.retryAfter,
      }),
      {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': String(rate.retryAfter) },
      }
    );
  }

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify(payload),
  });

  const data = await upstream.json();
  return json(upstream.status, data);
}
