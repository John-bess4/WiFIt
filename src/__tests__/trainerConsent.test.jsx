// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import TrainerConsent from '../TrainerConsent.jsx';
const fake = vi.hoisted(() => ({ user: null, handler: null, read: vi.fn(), api: vi.fn() }));
vi.mock('../lib/supabase.js', () => ({ sb: { getUser: () => fake.user, signOut: vi.fn(async () => { fake.user = null; }) }, resolveSession: async () => ({ status: fake.user ? 'ready' : 'logged-out' }), setAuthLostHandler: handler => { fake.handler = handler; } }));
vi.mock('../lib/trainerAPI.js', async importOriginal => ({ ...await importOriginal(), trainerRead: fake.read, trainerAPI: fake.api }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root, container;
beforeEach(() => {
  fake.user = { id: 'client-one', email: 'client@example.invalid' }; fake.api.mockReset(); fake.read.mockReset();
  fake.read.mockImplementation(async action => action === 'tracking.get' ? { wifit_targets: null } : action === 'invitation.review' ? { trainer: { display_name: 'Reviewed Trainer', credentials_summary: 'Verified coach' } } : []);
  fake.api.mockResolvedValue({});
  window.history.replaceState(null, '', '/trainer-consent'); sessionStorage.clear();
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
const render = () => act(async () => root.render(<TrainerConsent />));
const click = async text => { const button = [...container.querySelectorAll('button')].find(b => b.textContent === text); expect(button).toBeTruthy(); await act(async () => button.click()); };
it('shows existing WiFit sign-in rather than protected data when logged out', async () => {
  fake.user = null; await render(); expect(container.textContent).toContain('Sign in to WiFit'); expect(fake.read).not.toHaveBeenCalled();
});
it('starts all invitation sharing categories unchecked', async () => {
  window.history.replaceState(null, '', '/trainer-consent#invite=disposable-token'); await render();
  expect(container.textContent).toContain('Reviewed Trainer');
  const scopes = container.querySelectorAll('fieldset input'); expect(scopes.length).toBe(9); expect([...scopes].every(c => !c.checked)).toBe(true);
  await click('Accept and activate selected access');
  expect(fake.api.mock.calls[0][0].payload).toMatchObject({ scopes: [], activate: true, decision: 'accept', token: 'disposable-token' });
  expect(window.location.hash).toBe('');
});
it('retries a failed consent submission with the exact same operation ID', async () => {
  window.history.replaceState(null, '', '/trainer-consent#invite=disposable-token'); fake.api.mockRejectedValueOnce(new Error('Offline')); await render();
  await click('Decline invitation'); expect(container.textContent).toContain('Offline'); expect(container.textContent).not.toContain('Saved.');
  await click('Retry submission'); expect(fake.api.mock.calls[1][0]).toEqual(fake.api.mock.calls[0][0]);
});
it('keeps independent trainer scopes and clears protected state and drafts on auth loss', async () => {
  fake.read.mockImplementation(async action => action === 'tracking.get' ? {} : action === 'relationships.list' ? [{ id:'one',client_id:'client-one',trainer_name:'First trainer',state:'active',scopes:['messaging'],version:1 },{ id:'two',client_id:'client-one',trainer_name:'Second trainer',state:'active',scopes:[],version:2 }] : []);
  await render(); expect(container.querySelectorAll('fieldset')[0].querySelectorAll('input:checked')).toHaveLength(1); expect(container.querySelectorAll('fieldset')[1].querySelectorAll('input:checked')).toHaveLength(0);
  sessionStorage.setItem('wifit-coach-draft:client-one:thread','unsent'); fake.user = null;
  await act(async () => fake.handler());
  expect(container.textContent).not.toContain('First trainer'); expect(container.textContent).toContain('Sign in to WiFit'); expect(sessionStorage.length).toBe(0);
});
