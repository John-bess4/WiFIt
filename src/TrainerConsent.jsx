import { useCallback, useEffect, useRef, useState } from 'react';
import { sb, resolveSession, setAuthLostHandler } from './lib/supabase.js';
import { operation, sharingCategories, trainerAPI, trainerRead, readAttachment } from './lib/trainerAPI.js';
import './trainerConsent.css';

function ScopePicker({ value, onChange, disabled }) {
  return <fieldset disabled={disabled}><legend>Choose what this trainer may see</legend>
    {sharingCategories.map(([scope, title]) => <label className="consent-check" key={scope}>
      <input type="checkbox" checked={value.includes(scope)} onChange={e => onChange(e.target.checked ? [...value, scope] : value.filter(x => x !== scope))} />{title}
    </label>)}
    <p className="consent-note">Nutrition history and the adherence score are separate permissions. Sharing one does not automatically share the other. Health summaries are reserved for future WiFit features.</p>
  </fieldset>;
}
function RelationshipCard({ relationship, busy, run }) {
  const [scopes, setScopes] = useState(relationship.scopes);
  useEffect(() => setScopes(relationship.scopes), [relationship.scopes]);
  const change = state => run('relationship.update', { relationship_id: relationship.id, version: relationship.version, state, scopes });
  const ended = ['ended', 'revoked'].includes(relationship.state);
  return <article className="consent-card">
    <h3>{relationship.trainer_name}</h3><p>{relationship.credentials_summary || 'No credentials summary supplied.'}</p>
    <p className="consent-status">Relationship: {relationship.state}</p>
    {ended ? <p>Access is closed. Reconnecting requires a new invitation.</p> : <>
      <ScopePicker value={scopes} onChange={setScopes} disabled={busy} />
      <div className="consent-actions">
        <button disabled={busy} onClick={() => change('active')}>{relationship.state === 'active' ? 'Save permissions' : 'Activate access'}</button>
        {relationship.state === 'active' && <button className="secondary" disabled={busy} onClick={() => change('paused')}>Pause access</button>}
        <button className="danger" disabled={busy} onClick={() => { if (window.confirm('Revoke this trainer’s access to your shared data, messages and attachments? Your other trainers will keep their separate permissions.')) change('revoked'); }}>Revoke access</button>
      </div>
    </>}
  </article>;
}
function AttachmentViewer({ attachment }) {
  const [preview, setPreview] = useState(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const url = useRef(null); const generation = useRef(0);
  const close = useCallback(() => { generation.current++; if (url.current) URL.revokeObjectURL(url.current); url.current = null; setPreview(null); setLoading(false); }, []);
  useEffect(() => { const hidden = () => { if (document.hidden) close(); }; document.addEventListener('visibilitychange', hidden); return () => { generation.current++; if (url.current) URL.revokeObjectURL(url.current); document.removeEventListener('visibilitychange', hidden); }; }, [close]);
  return <div><button className="secondary" disabled={loading} onClick={async () => {
    const request = ++generation.current; setLoading(true); setError('');
    try { const blob = await readAttachment(attachment); if (request !== generation.current) return; if (url.current) URL.revokeObjectURL(url.current); url.current = URL.createObjectURL(blob); setPreview(url.current); }
    catch (e) { if (request === generation.current) setError(e.message); } finally { if (request === generation.current) setLoading(false); }
  }}>{loading ? 'Opening…' : 'Open private attachment'}</button>{error && <p role="alert">{error}</p>}
    {preview && <div role="dialog" aria-modal="true" aria-label="Private attachment" className="consent-preview"><button autoFocus onClick={close}>Close attachment</button>
      {attachment.mime_type === 'application/pdf' ? <iframe title="Private PDF attachment" src={preview} /> : <img alt="Shared message attachment" src={preview} />}
    </div>}</div>;
}
function CoachingPanel({ relationships, busy, run, refreshID }) {
  const [assignments, setAssignments] = useState([]); const [appointments, setAppointments] = useState([]);
  const [threads, setThreads] = useState([]); const [threadID, setThreadID] = useState('');
  const [messages, setMessages] = useState([]); const [draft, setDraft] = useState(''); const [error, setError] = useState('');
  const [groupTitle, setGroupTitle] = useState(''); const [groupMembers, setGroupMembers] = useState([]);
  const [changeAppointment, setChangeAppointment] = useState(''); const [changeReason, setChangeReason] = useState('');
  const currentUser = sb.getUser()?.id;
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const refresh = useCallback(async () => {
    setError('');
    try {
      const assignmentRows = [];
      for (const r of relationships.filter(r => r.state === 'active' && r.scopes.includes('workouts'))) {
        let after;
        do {
          const rows = await trainerRead('assignments.list', { relationship_id: r.id, ...(after ? { after } : {}) });
          assignmentRows.push(...rows.map(a => ({ ...a, trainer_name: r.trainer_name })));
          after = rows.length === 100 ? rows.at(-1).id : null;
        } while (after);
      }
      const from = new Date(); from.setHours(0, 0, 0, 0); const until = new Date(from); until.setDate(until.getDate() + 30);
      const schedule = [], threadRows = []; let page, after;
      do { page = await trainerRead('schedule.list', { from: from.toISOString(), until: until.toISOString(), ...(after ? { after } : {}) }); schedule.push(...page); after = page.length === 200 ? page.at(-1).id : null; } while (after);
      do { page = await trainerRead('messages.threads', after ? { after } : {}); threadRows.push(...page); after = page.length === 100 ? page.at(-1).id : null; } while (after);
      if (!live.current || sb.getUser()?.id !== currentUser) return;
      setAssignments(assignmentRows); setAppointments(schedule); setThreads(threadRows);
    } catch (e) { if (!live.current || sb.getUser()?.id !== currentUser) return; setAssignments([]); setAppointments([]); setThreads([]); setMessages([]); setError(e.message); }
  }, [relationships, currentUser]);
  useEffect(() => { refresh(); }, [refresh, refreshID]);
  useEffect(() => {
    let active = true; setMessages([]); setError('');
    setDraft(sessionStorage.getItem('wifit-coach-draft:' + currentUser + ':' + threadID) || '');
    if (threadID) (async () => {
      try {
        let rows = [], after = 0, page;
        do { page = await trainerRead('messages.list', { conversation_id: threadID, after_sequence: after }); rows.push(...page); after = page.at(-1)?.sequence || after; } while (page.length === 100);
        if (active) setMessages(rows);
        if (active && rows.length) await trainerAPI(operation('messages.read', { conversation_id: threadID, sequence: rows.at(-1).sequence }));
      } catch (e) { if (active) { setMessages([]); setError(e.message); } }
    })();
    return () => { active = false; };
  }, [threadID, refreshID, currentUser]);
  const openConversation = async relationship_id => {
    await run('messages.open', { relationship_id }, result => setThreadID(result.conversation_id));
  };
  return <section className="consent-card"><h2>Shared coaching</h2>
    <p>Your accepted workouts appear in WiFit’s Train tab after refreshing WiFit. Logging continues in WiFit.</p>
    {error && <p role="alert">{error} <button disabled={busy} onClick={refresh}>Reload coaching</button></p>}
    <h3>Workout assignments</h3>
    {assignments.length === 0 && <p>No shared assignments.</p>}
    {assignments.map(a => <article className="consent-row" key={a.id}><strong>{a.title}</strong><span>{a.trainer_name} · Due {a.due_date} · {a.status}</span>
      <p>{a.notes}</p><ul>{a.exercises.map((e, i) => <li key={i}>{e.name} · {e.sets.length} sets</li>)}</ul>
      {a.status === 'assigned' && <button disabled={busy} onClick={() => run('assignment.accept', { assignment_id: a.id })}>Accept into WiFit</button>}
    </article>)}
    <h3>Appointments · next 30 days</h3>
    {!appointments.length && <p>No upcoming appointments.</p>}
    {appointments.sort((a,b) => a.start_at.localeCompare(b.start_at)).map(a => <div className="consent-row" key={a.id}>
      <strong>{new Date(a.start_at).toLocaleString()}</strong><span>{a.location} · {a.status}</span>
      {['scheduled','confirmed','rescheduled'].includes(a.status) && <button className="secondary" disabled={busy} onClick={() => { setChangeAppointment(a.id); setChangeReason(''); }}>Request a change</button>}
      {changeAppointment === a.id && <form aria-label="Appointment change request" onSubmit={e => { e.preventDefault(); if (!changeReason.trim()) return; run('schedule.request_change', { id: a.id, reason: changeReason.trim() }, () => { setChangeAppointment(''); setChangeReason(''); }); }}>
        <label>What needs to change?<textarea autoFocus value={changeReason} maxLength={2000} onChange={e => setChangeReason(e.target.value)} /></label>
        <div className="consent-actions"><button disabled={busy || !changeReason.trim()}>Send change request</button><button type="button" className="secondary" disabled={busy} onClick={() => { setChangeAppointment(''); setChangeReason(''); }}>Cancel request</button></div>
      </form>}
    </div>)}
    <h3>Messages</h3><div className="consent-actions">
      {relationships.filter(r => r.state === 'active' && r.scopes.includes('messaging')).map(r => <button className="secondary" key={r.id} disabled={busy} onClick={() => openConversation(r.id)}>Message {r.trainer_name}</button>)}
    </div>
    {relationships.filter(r => r.state === 'active' && r.scopes.includes('messaging')).length >= 2 && <details><summary>Create a coaching group</summary><p>Choose two to eight trainers. Each trainer must accept the group invitation. Revoking one keeps the other participants’ access.</p>
      <label>Group name<input value={groupTitle} maxLength={120} onChange={e => setGroupTitle(e.target.value)} /></label>
      {relationships.filter(r => r.state === 'active' && r.scopes.includes('messaging')).map(r => <label className="consent-check" key={r.id}><input type="checkbox" checked={groupMembers.includes(r.id)} onChange={e => setGroupMembers(e.target.checked ? [...groupMembers, r.id] : groupMembers.filter(id => id !== r.id))} />{r.trainer_name}</label>)}
      <button disabled={busy || !groupTitle.trim() || groupMembers.length < 2 || groupMembers.length > 8} onClick={() => run('messages.create_group', { title: groupTitle.trim(), relationship_ids: groupMembers }, result => { setThreadID(result.conversation_id); setGroupTitle(''); setGroupMembers([]); })}>Invite selected trainers to group</button>
    </details>}
    <label>Conversation<select value={threadID} onChange={e => setThreadID(e.target.value)}><option value="">Choose a conversation</option>{threads.map(t => <option key={t.id} value={t.id}>{t.title || relationships.find(r => r.id === t.relationship_id)?.trainer_name || 'Coaching conversation'} ({t.unread_count} unread)</option>)}</select></label>
    {threadID && <><div className="consent-messages" aria-label="Message history">{messages.map(m => <article className="consent-row" key={m.id}>
      <strong>{m.sender_id === currentUser ? 'You' : relationships.find(r => r.trainer_id === m.sender_id)?.trainer_name || 'Trainer'}</strong>
      <p>{m.body}</p><small>{new Date(m.sent_at).toLocaleString()} · {m.receipts?.some(r => r.read) ? 'Read' : 'Sent'}</small>
      {m.attachments?.map(a => <AttachmentViewer key={a.id} attachment={a} />)}
    </article>)}</div>
    <form onSubmit={e => { e.preventDefault(); run('messages.send', { conversation_id: threadID, text: draft }, () => { setDraft(''); sessionStorage.removeItem('wifit-coach-draft:' + currentUser + ':' + threadID); }); }}>
      <label>Message<textarea value={draft} maxLength={2000} onChange={e => { setDraft(e.target.value); sessionStorage.setItem('wifit-coach-draft:' + currentUser + ':' + threadID, e.target.value); }} /></label>
      <button disabled={busy || !draft.trim()}>Send message</button>
    </form></>}
  </section>;
}
export default function TrainerConsent() {
  const [ready, setReady] = useState(false); const [user, setUser] = useState(null); const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [relationships, setRelationships] = useState([]); const [invitation, setInvitation] = useState(null); const [scopes, setScopes] = useState([]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [refreshID, setRefreshID] = useState(0);
  const [tracking, setTracking] = useState(null); const [nutritionEnabled, setNutritionEnabled] = useState(false);
  const pending = useRef(null); const mounted = useRef(true); const loadGeneration = useRef(0);
  const [invitationError, setInvitationError] = useState('');
  const previousAccess = useRef([]);
  const accessKey = relationships.map(r => [r.id, r.state, ...r.scopes.slice().sort()].join(':')).sort().join('|');
  const [token, setToken] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('invite') || '');
  useEffect(() => {
    const changed = () => { setToken(new URLSearchParams(window.location.hash.slice(1)).get('invite') || ''); setInvitation(null); setScopes([]); setInvitationError(''); loadGeneration.current++; };
    changed(); window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);
  const clearProtected = useCallback(() => { loadGeneration.current++; previousAccess.current = []; setInvitationError(''); setRelationships([]); setInvitation(null); setTracking(null); setUser(null); pending.current = null; for (const key of Object.keys(sessionStorage)) if (key.startsWith('wifit-coach-draft:')) sessionStorage.removeItem(key); }, []);
  useEffect(() => {
    mounted.current = true;
    setAuthLostHandler(() => { clearProtected(); setError('Your session expired. Sign in again.'); });
    resolveSession().then(result => { if (mounted.current) { setUser(result.status === 'logged-out' ? null : sb.getUser()); setReady(true); } }).catch(() => { if (mounted.current) { setReady(true); setError('Your session could not be restored. Sign in again.'); } });
    return () => { mounted.current = false; loadGeneration.current++; setAuthLostHandler(null); };
  }, [clearProtected]);
  const load = useCallback(async () => {
    if (!user) return;
    const generation = ++loadGeneration.current;
    const current = () => mounted.current && generation === loadGeneration.current && sb.getUser()?.id === user.id;
    try {
      const rows = await trainerRead('relationships.list');
      const prefs = await trainerRead('tracking.get');
      if (!current()) return;
      const clientRows = rows.filter(r => r.client_id === user.id);
      const reduced = previousAccess.current.some(old => old.state === 'active' && (() => {
        const next = clientRows.find(r => r.id === old.id);
        return !next || next.state !== 'active' || old.scopes.some(scope => !next.scopes.includes(scope));
      })());
      if (reduced) for (const key of Object.keys(sessionStorage)) if (key.startsWith('wifit-coach-draft:' + user.id + ':')) sessionStorage.removeItem(key);
      previousAccess.current = clientRows;
      setRelationships(clientRows); setTracking(prefs); setNutritionEnabled(prefs.nutrition_target?.enabled || false);
    } catch (e) { if (current()) { setRelationships([]); setInvitation(null); setTracking(null); setError(e.message); } return; }
    if (token) {
      try {
        const invite = await trainerRead('invitation.review', { token });
        if (current()) { setInvitation(invite); setInvitationError(''); }
      } catch {
        // An expired or already-used link must not hide independently authorized relationships.
        if (current()) { setInvitation(null); setInvitationError('This invitation is unavailable, expired or already used. Your existing trainer relationships are shown below.'); }
      }
    }
  }, [user, token]);
  useEffect(() => { load(); }, [load, refreshID]);
  useEffect(() => {
    if (!user) return;
    const refresh = () => { if (!document.hidden && !busy) setRefreshID(n => n + 1); };
    const timer = window.setInterval(refresh, 45000); window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [user, busy]);
  const runCommand = async (command, success) => {
    const submittingUser = sb.getUser()?.id;
    if (busy) return; setBusy(true); setError(''); setNotice('Saving…'); pending.current = { command, success };
    try { const result = await trainerAPI(command); if (!mounted.current || sb.getUser()?.id !== submittingUser) return; success?.(result); pending.current = null; setNotice('Saved to your WiFit account.'); setRefreshID(n => n + 1); }
    catch (e) { if (mounted.current) { setError(e.message); setNotice('Not confirmed saved. Retry the same submission below.'); } }
    finally { if (mounted.current) setBusy(false); }
  };
  const run = (action, payload, success) => runCommand(operation(action, payload), success);
  const respond = decision => run('invitation.respond', { token, decision, activate: decision === 'accept', scopes }, () => { setToken(''); setInvitation(null); history.replaceState(null, '', window.location.pathname); });
  return <main className="trainer-consent"><header><a href="/" className="consent-brand">WiFit</a><h1>Your trainers. Your choice.</h1>
    <p>TrainerHQ access uses your existing WiFit account. Each trainer has separate permissions, and you can pause or revoke them here.</p></header>
    {!ready ? <p role="status">Checking your session…</p> : !user ? <form className="consent-card" onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError('');
      try { const result = await sb.signIn(email.trim(), password); if (!result.access_token || !result.user) throw new Error('Sign-in failed. Check your WiFit email and password.'); setUser(result.user); setPassword(''); }
      catch (e) { setError(e.message); } finally { setBusy(false); }
    }}><h2>Sign in to WiFit</h2><label>Email<input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required /></label>
      <label>Password<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label><button disabled={busy}>Sign in</button><p>New to WiFit? <a href="/">Create your account in WiFit</a>, then return to this invitation.</p>
    </form> : <>
      <div className="consent-actions"><span>{user.email}</span><button className="secondary" disabled={busy} onClick={() => { setError(''); setRefreshID(n => n + 1); }}>Refresh</button><button className="secondary" disabled={busy} onClick={async () => { setBusy(true); clearProtected(); try { await sb.signOut(); } catch { sb._session = null; localStorage.removeItem('sb_session'); setNotice('Signed out locally. Remote sign-out could not be confirmed.'); } finally { setBusy(false); } }}>Sign out</button></div>
      {invitationError && <p role="status">{invitationError}</p>}
      {invitation && <section className="consent-card"><h2>Trainer invitation</h2><h3>{invitation.trainer.display_name}</h3><p>{invitation.trainer.credentials_summary || 'No credentials summary supplied.'}</p><p>Owner-approved trainer. Confirm this is the person you intend to work with.</p>
        <ScopePicker value={scopes} onChange={setScopes} disabled={busy} /><div className="consent-actions"><button disabled={busy} onClick={() => respond('accept')}>Accept and activate selected access</button><button className="secondary" disabled={busy} onClick={() => respond('decline')}>Decline invitation</button></div>
      </section>}
      <section><h2>Your trainer relationships</h2>{relationships.length === 0 && <p>No accepted trainer relationships.</p>}{relationships.map(r => <RelationshipCard key={r.id} relationship={r} busy={busy} run={run} />)}</section>
      {tracking && <section className="consent-card"><h2>Adherence tracking</h2><p>Your trainer sees scores only for categories you share. Days before setup are not scored. Tracking days finish at midnight in your selected timezone.</p>
        <p>Timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
        {tracking.wifit_targets && <p>Current WiFit targets: {tracking.wifit_targets.calories} calories, {tracking.wifit_targets.protein} g protein, {tracking.wifit_targets.carbs} g carbs, {tracking.wifit_targets.fat} g fat.</p>}
        <label className="consent-check"><input type="checkbox" checked={nutritionEnabled} onChange={e => setNutritionEnabled(e.target.checked)} disabled={busy || !tracking.wifit_targets} />Use these WiFit nutrition targets for daily adherence tracking</label>
        <button disabled={busy || !tracking.wifit_targets} onClick={() => run('tracking.configure', { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, cutoff_minute: 1440, nutrition_enabled: nutritionEnabled, weekdays: [1,2,3,4,5,6,7] })}>Confirm tracking settings</button>
      </section>}
      <CoachingPanel key={accessKey} relationships={relationships} busy={busy} run={run} refreshID={refreshID} />
    </>}
    <div className="consent-feedback" aria-live="polite">{notice && <p role="status">{notice}</p>}{error && <p role="alert">{error}</p>}{error && pending.current && <button disabled={busy} onClick={() => runCommand(pending.current.command, pending.current.success)}>Retry submission</button>}</div>
    <footer><a href="/">Return to WiFit</a><p>Fitness records stay in WiFit. Revoking a trainer stops their future access without deleting your records or your other trainer relationships.</p></footer>
  </main>;
}
