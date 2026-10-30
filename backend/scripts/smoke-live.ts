import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// Explicit live check: creates temporary users/data and removes only those exact users in finally.
// Admin-confirmed test users do not send signup or invitation emails.
const url = process.env.SUPABASE_URL;
const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !publicKey || !secretKey) throw new Error('Supabase environment configuration is required.');
const base = 'http://127.0.0.1:4000';
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, secretKey, options);
const createdUsers: string[] = [];
const signedClients: ReturnType<typeof createClient>[] = [];
const clientsByToken = new Map<string, ReturnType<typeof createClient>>();
const runTag = randomUUID();

async function player() {
  const email = `smoke-${randomUUID()}@multigrizz.example`;
  const password = randomBytes(32).toString('base64url');
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw new Error('Temporary test user creation failed.');
  createdUsers.push(created.data.user.id);
  const client = createClient(url!, publicKey!, options);
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session) throw new Error('Temporary test sign-in failed.');
  const token = signedIn.data.session.access_token;
  signedClients.push(client); clientsByToken.set(token, client);
  await client.realtime.setAuth(token);
  return token;
}

async function api(token: string, path: string, method = 'GET', body?: object, expected = 200) {
  const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000) });
  if (response.status !== expected) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Live API ${method} ${path.replace(/[a-f0-9-]{36}/g, ':id')}: expected ${expected}, got ${response.status} (${error.error?.code ?? 'unknown'})`);
  }
  return (await response.json()).data;
}

try {
  const ready = await fetch(base + '/ready');
  assert.equal(ready.status, 200, 'Apply SQL schema and start local Ollama before the live smoke test.');
  const owner = await player(); const teammate = await player(); const outsider = await player();
  const team = await api(owner, '/teams', 'POST', { name: `Smoke ${runTag}` }, 201);
  const other = await api(outsider, '/teams', 'POST', { name: `Other ${runTag}` }, 201);
  await api(teammate, '/teams/join', 'POST', { invite_code: team.invite_code });
  const research = await api(owner, `/teams/${team.id}/squads`, 'POST', { name: 'Research', goal: 'Investigate a prototype' }, 201);
  const build = await api(teammate, `/teams/${team.id}/squads`, 'POST', { name: 'Build', goal: 'Implement findings' }, 201);
  const foreign = await api(outsider, `/teams/${other.id}/squads`, 'POST', { name: 'Private' }, 201);
  const agent = await api(owner, `/teams/${team.id}/agents`, 'POST', { name: 'Planner', role: 'Prototype planner', instructions: 'Give concise practical plans based on the current squad context. Do not invent facts.' }, 201);
  assert.equal((await api(teammate, `/teams/${team.id}/agents`))[0].id, agent.id);
  await api(outsider, `/teams/${team.id}/agents`, 'GET', undefined, 403);
  await api(owner, `/teams/${team.id}/squads/${research.id}/agents`, 'POST', { agent_id: agent.id }, 201);
  await api(owner, `/teams/${team.id}/squads/${research.id}/context`, 'POST', { content: 'This is an illustrative prototype. Keep the scope small and use local AI.' }, 201);
  await api(owner, `/teams/${team.id}/squads/${research.id}/handoffs`, 'POST', { target_squad_id: foreign.id, content: 'Must not cross teams' }, 404);
  const finding = `Reviewed finding ${runTag}`;
  const observed: any[] = []; const foreignObserved: any[] = [];
  async function subscribe(token: string, label: string, sink: any[]) {
    const channel = clientsByToken.get(token)!.channel(`smoke-${label}-${runTag}`, { config: { postgres_changes_options: { wait: true, timeout: 15000 } } })
      .on('system', {}, payload => console.log(`Realtime ${label}: ${String(payload.status)} (${String(payload.extension)})`))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'context_entries', filter: `team_id=eq.${team.id}` }, payload => sink.push(payload.new));
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Live Realtime subscription timed out.')), 25000);
      channel.subscribe(status => {
        if (status === 'SUBSCRIBED') { clearTimeout(timeout); resolve(); }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { clearTimeout(timeout); reject(new Error('Live Realtime subscription failed.')); }
      });
    });
  }
  await subscribe(teammate, 'member', observed);
  await subscribe(outsider, 'outsider', foreignObserved);
  await api(owner, `/teams/${team.id}/squads/${research.id}/handoffs`, 'POST', { target_squad_id: build.id, content: finding }, 201);
  const received = await api(teammate, `/teams/${team.id}/squads/${build.id}/context`);
  assert.ok(received.some((entry: any) => entry.content === finding && entry.source_squad_id === research.id));
  for (let i = 0; i < 60 && !observed.some(entry => entry.content === finding); i++) await new Promise(resolve => setTimeout(resolve, 500));
  assert.ok(observed.some(entry => entry.content === finding), 'Teammate did not receive the handoff through Realtime.');
  await new Promise(resolve => setTimeout(resolve, 2000));
  assert.equal(foreignObserved.length, 0, 'An outsider received a private team Realtime event.');
  const renamed = await api(owner, `/teams/${team.id}/squads/${research.id}`, 'PATCH', { name: 'Research renamed' });
  assert.equal(renamed.goal, 'Investigate a prototype');
  const queued = await api(owner, `/teams/${team.id}/squads/${research.id}/runs`, 'POST', { goal: 'Give a concise two-step plan for a shared prototype workspace. Do not call tools for this task.' }, 202);
  let completed = false;
  for (let attempt = 0; attempt < 135; attempt++) {
    const run = await api(teammate, `/teams/${team.id}/runs/${queued.id}`);
    if (run.status === 'failed') throw new Error('Live local agent run reported failure.');
    if (run.status === 'completed') { assert.ok(run.entries.some((entry: any) => entry.kind === 'result' && entry.content.trim().length)); completed = true; break; }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  assert.ok(completed, 'Live agent run did not complete within the test budget.');
  await api(outsider, `/teams/${team.id}/runs/${queued.id}`, 'GET', undefined, 403);
  console.log('Live smoke passed: Auth, shared teams, agents, squads, context, same-team handoffs, outsider denial, authorized Realtime delivery, local Gemma run and persisted result.');
} finally {
  for (const client of signedClients) { await client.removeAllChannels(); client.realtime.disconnect(); }
  let cleanupFailed = false;
  for (const id of createdUsers.reverse()) {
    const removed = await admin.auth.admin.deleteUser(id);
    if (removed.error) cleanupFailed = true;
  }
  if (cleanupFailed) { console.error('Temporary live-test cleanup was incomplete; inspect test users in Supabase Auth.'); process.exitCode = 1; }
  else if (createdUsers.length) console.log('Temporary live-test users and their owned data removed.');
}
