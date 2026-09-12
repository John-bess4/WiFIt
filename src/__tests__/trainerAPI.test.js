import { beforeEach, it, expect, vi } from 'vitest';
import { trainerAPI, readAttachment, operation } from '../lib/trainerAPI.js';
import { assignmentOrigin, sessionFromRow } from '../lib/workouts.js';
const fake = vi.hoisted(() => ({ getUser: vi.fn(), _fetch: vi.fn() }));
vi.mock('../lib/supabase.js', () => ({ sb: fake }));
beforeEach(() => { fake.getUser.mockReturnValue({ id:'client' }); fake._fetch.mockReset(); });
it('does not mistake a swallowed HTTP failure for a saved write', async () => {
  fake._fetch.mockResolvedValue(new Response(JSON.stringify({error:{message:'Access changed'}}), {status:403}));
  await expect(trainerAPI(operation('messages.send',{text:'draft'}))).rejects.toThrow('Access changed');
});
it('fails closed for unreadable responses', async () => {
  fake._fetch.mockResolvedValue(new Response('bad json', {status:200})); await expect(trainerAPI({action:'relationships.list',payload:{}})).rejects.toThrow('unreadable');
});
it('rechecks private Storage instead of using a public URL', async () => {
  const a={bucket:'trainerhq-message-attachments',object_path:'message/file.pdf',mime_type:'application/pdf',byte_count:3};
  fake._fetch.mockResolvedValue(new Response('pdf')); expect((await readAttachment(a)).size).toBe(3);
  const first = new URL(fake._fetch.mock.calls[0][0], 'https://test.invalid');
  expect(first.pathname).toBe('/storage/v1/object/authenticated/trainerhq-message-attachments/message/file.pdf');
  expect(first.searchParams.get('cacheNonce')).toMatch(/^[a-f0-9-]{36}$/i);
  fake._fetch.mockResolvedValue(new Response('',{status:403})); await expect(readAttachment(a)).rejects.toThrow('access has changed');
  const second = new URL(fake._fetch.mock.calls[1][0], 'https://test.invalid');
  expect(second.pathname).toBe(first.pathname);
  expect(second.searchParams.get('cacheNonce')).not.toBe(first.searchParams.get('cacheNonce'));
});
it('rejects tampered attachment sizes', async () => {
  fake._fetch.mockResolvedValue(new Response('short')); await expect(readAttachment({bucket:'trainerhq-message-attachments',object_path:'a',mime_type:'image/png',byte_count:100})).rejects.toThrow('verified');
});
it('preserves ordinary WiFit writes and only includes valid assignment origins', () => {
  expect(assignmentOrigin({})).toEqual({}); expect(assignmentOrigin({trainerAssignmentID:'invalid'})).toEqual({});
  const id='11111111-1111-4111-8111-111111111111'; expect(assignmentOrigin({trainerAssignmentID:id})).toEqual({trainer_assignment_id:id});
  expect(sessionFromRow({id:'session',exercises:[],trainer_assignment_id:id}).trainerAssignmentID).toBe(id);
});
