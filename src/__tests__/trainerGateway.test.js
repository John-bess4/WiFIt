import { describe, it, expect, vi } from 'vitest';
import { createHandler } from '../../supabase/functions/trainerhq-api/handler.js';
const actor = '11111111-1111-4111-8111-111111111111';
const session = '22222222-2222-4222-8222-222222222222';
const token = 'header.' + btoa(JSON.stringify({ sub: actor, session_id: session })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_') + '.signature';
const response = (data, status = 200) => new Response(JSON.stringify(data), { status });
const request = (body = { action: 'account.get', payload: {} }, headers = {}) => new Request('https://edge.invalid', {
  method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
});
function setup(results = []) {
  const fetcher = vi.fn(); for (const r of results) fetcher.mockResolvedValueOnce(r);
  return { fetcher, handler: createHandler({ url: 'https://project.supabase.co', clientKey: 'public-test-key', serverKey: 'server-test-key', fetcher }) };
}
describe('TrainerHQ secured gateway', () => {
  it('rejects missing authentication before accessing the database', async () => {
    const { handler, fetcher } = setup(); expect((await handler(request(undefined, { authorization: '' }))).status).toBe(401); expect(fetcher).not.toHaveBeenCalled();
  });
  it('does not trust caller supplied account or session IDs', async () => {
    const { handler, fetcher } = setup(); expect((await handler(request({ action: 'account.get', payload: { actor_id: actor } }))).status).toBe(400); expect(fetcher).not.toHaveBeenCalled();
  });
  it('verifies Auth before deriving identity and calling the protected RPC', async () => {
    const { handler, fetcher } = setup([response({ id: actor }), response({ user_id: actor })]);
    const result = await handler(request()); expect(result.status).toBe(200);
    expect(fetcher.mock.calls[0][0]).toContain('/auth/v1/user');
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ actor_id: actor, session_id: session, action: 'account.get', payload: {} });
    expect(await result.text()).not.toContain('server-test-key'); expect(result.headers.get('cache-control')).toBe('no-store');
  });
  it('rejects an Auth/JWT subject mismatch', async () => {
    const { handler, fetcher } = setup([response({ id: session })]); expect((await handler(request())).status).toBe(401); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('rejects anonymous accounts', async () => {
    const { handler } = setup([response({ id: actor, is_anonymous: true })]); expect((await handler(request())).status).toBe(401);
  });
  it('rejects untrusted browser origins', async () => {
    const { handler, fetcher } = setup(); expect((await handler(request(undefined, { origin: 'https://attacker.invalid' }))).status).toBe(403); expect(fetcher).not.toHaveBeenCalled();
  });
  it('handles WiFit preflight without a session', async () => {
    const { handler } = setup(); const r = await handler(new Request('https://edge.invalid', { method: 'OPTIONS', headers: { origin: 'https://wifit.vercel.app' } }));
    expect(r.status).toBe(204); expect(r.headers.get('access-control-allow-origin')).toBe('https://wifit.vercel.app');
  });
  it('refuses oversized streamed JSON', async () => {
    const { handler, fetcher } = setup(); expect((await handler(request({ action: 'messages.send', payload: { text: 'x'.repeat(66000) } }))).status).toBe(400); expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([['42501', 403], ['23505', 409], ['22023', 400], ['P0002', 404], ['XX000', 503]])('maps %s without leaking database diagnostics', async (code, status) => {
    const { handler } = setup([response({ id: actor }), response({ code, message: 'Private content', detail: 'Sensitive row' }, 400)]);
    const result = await handler(request()); expect(result.status).toBe(status); expect(await result.text()).not.toMatch(/Private content|Sensitive row/);
  });
  it('injects only the verified session for device registration', async () => {
    const { handler, fetcher } = setup([response({ id: actor }), response({ registered: true })]);
    await handler(request({ action: 'device.register', payload: { app: 'trainerhq' } }));
    expect(JSON.parse(fetcher.mock.calls[1][1].body).payload.verified_session_id).toBe(session);
  });
  it('does not report success when Auth is unavailable', async () => {
    const { handler, fetcher } = setup([response({}, 503)]); expect((await handler(request())).status).toBe(503); expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
