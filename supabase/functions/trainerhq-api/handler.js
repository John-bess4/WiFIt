// Shared, dependency-free handler. Authentication is verified by Supabase Auth;
// authorization and live-session checks run again in the server-only database RPC.
export const actions = new Set([
  'account.get', 'trainer.apply', 'trainer.review', 'invitation.create', 'invitation.review',
  'invitation.respond', 'relationships.list', 'relationship.update', 'clients.list', 'client.logs', 'client.targets',
  'assignments.list', 'assignment.create', 'assignment.accept', 'schedule.list', 'schedule.create',
  'schedule.update', 'schedule.status', 'schedule.request_change', 'schedule.changes', 'schedule.decline_change',
  'availability.list', 'availability.set', 'messages.open', 'messages.create_group', 'messages.join',
  'messages.threads', 'messages.invitations', 'messages.list', 'messages.send', 'messages.batch',
  'messages.read', 'messages.delivered', 'messages.follow_up', 'media.reserve', 'media.complete',
  'reminders.list', 'reminders.save', 'reminders.delete', 'tracking.get', 'tracking.configure',
  'adherence.report', 'realtime.topics', 'notifications.preferences', 'notifications.configure',
  'device.register', 'device.unregister',
]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bodyLimit = 65536;
async function boundedJSON(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('body');
  let size = 0; const chunks = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > bodyLimit) { await reader.cancel(); throw new Error('size'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let at = 0;
  for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.byteLength; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}
function claimsFromVerifiedToken(token) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('token');
  return JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
}
export function createHandler({ url, clientKey, serverKey, fetcher = fetch, allowedOrigins = ['https://wifit.vercel.app', 'http://localhost:5173', 'http://127.0.0.1:5173'] }) {
  return async (request) => {
    const origin = request.headers.get('origin');
    const permitted = !origin || allowedOrigins.includes(origin);
    const headers = {
      'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin',
      'X-Content-Type-Options': 'nosniff',
      ...(origin && permitted ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } : {}),
    };
    const reply = (status, value) => new Response(JSON.stringify(value), { status, headers });
    const failure = (status, code, message) => reply(status, { error: { code, message } });
    if (!permitted) return failure(403, 'origin_denied', 'This origin is not allowed.');
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return failure(405, 'method', 'Use POST.');
    if (!url || !clientKey || !serverKey) return failure(503, 'configuration', 'The service is not configured.');
    const match = /^Bearer ([A-Za-z0-9._-]+)$/.exec(request.headers.get('authorization') || '');
    if (!match) return failure(401, 'sign_in_required', 'Sign in to continue.');
    let command;
    try { command = await boundedJSON(request); } catch { return failure(400, 'invalid_request', 'The request is invalid or too large.'); }
    if (!command || !actions.has(command.action) || !command.payload || Array.isArray(command.payload) || typeof command.payload !== 'object') {
      return failure(400, 'invalid_request', 'The requested operation is invalid.');
    }
    // Never accept caller-supplied identities, elevated roles or session IDs.
    if (['actor_id', 'session_id', 'verified_session_id'].some(key => key in command.payload) || 'actor_id' in command || 'session_id' in command) {
      return failure(400, 'invalid_request', 'Identity must come from the authenticated session.');
    }
    try {
      const verified = await fetcher(url + '/auth/v1/user', {
        headers: { apikey: clientKey, Authorization: 'Bearer ' + match[1] },
        redirect: 'error', signal: AbortSignal.timeout(15000),
      });
      if (!verified.ok) return verified.status >= 500
        ? failure(503, 'unavailable', 'The service is temporarily unavailable. Try again.')
        : failure(401, 'sign_in_required', 'Sign in to continue.');
      const user = await verified.json();
      let claims;
      try { claims = claimsFromVerifiedToken(match[1]); } catch { return failure(401, 'sign_in_required', 'Sign in to continue.'); }
      if (!uuid.test(user.id || '') || user.is_anonymous || claims.sub !== user.id || !uuid.test(claims.session_id || '')) {
        return failure(401, 'sign_in_required', 'A verified account session is required.');
      }
      const payload = { ...command.payload };
      if (command.action === 'device.register') payload.verified_session_id = claims.session_id;
      const result = await fetcher(url + '/rest/v1/rpc/trainerhq_api', {
        method: 'POST', headers: { 'Content-Type': 'application/json', apikey: serverKey, Authorization: 'Bearer ' + serverKey },
        body: JSON.stringify({ actor_id: user.id, session_id: claims.session_id, action: command.action, payload }),
        redirect: 'error', signal: AbortSignal.timeout(30000),
      });
      if (!result.ok) {
        const error = await result.json().catch(() => ({}));
        if (error.code === '42501') return failure(403, 'access_denied', 'Your session or permission is no longer available. Refresh or sign in again.');
        if (error.code === '23505') return failure(409, 'conflict', 'This record changed or the selected time is unavailable. Refresh and try again.');
        if (error.code === 'P0002') return failure(404, 'not_found', 'This item is no longer available.');
        if (error.code?.startsWith('22') || error.code?.startsWith('23')) return failure(400, 'invalid_request', 'Check the submitted values and try again.');
        if (result.status === 429) return failure(429, 'rate_limited', 'Wait a moment before trying again.');
        return failure(503, 'unavailable', 'The service could not save or load this information. Try again.');
      }
      return reply(200, await result.json());
    } catch {
      // Never log tokens, user records, message bodies or raw upstream errors.
      return failure(503, 'unavailable', 'The service is temporarily unavailable. Try again.');
    }
  };
}
