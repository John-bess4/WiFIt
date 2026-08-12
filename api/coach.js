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
async function verifyUser(req) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
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

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Auth first: no unauthenticated request may ever cost money.
  const user = await verifyUser(req);
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
