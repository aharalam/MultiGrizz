import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// Live end-to-end event mission: temporary admin-confirmed user → team → event squads → mission.
// Prints each squad's runs and entries as they finish. Removes the temporary user unless KEEP=1.
const url = process.env.SUPABASE_URL!, publicKey = process.env.SUPABASE_PUBLISHABLE_KEY!, secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !publicKey || !secretKey) throw new Error('Supabase environment configuration is required.');
const base = 'http://127.0.0.1:4000';
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, secretKey, options);
const brief = 'Organize a networking event for 50 people on December 12 at 6 PM near Oakland University in Rochester Hills, Michigan. Find an available venue, create a promotional flyer and video, invite 50 people through email with an option to save the event to their calendars, and set up a reminder 24 hours before the event. If the venue is unavailable, find alternative dates and suggest the best option.';
let userId: string | undefined;

async function api(token: string, path: string, method = 'GET', body?: object) {
  const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${json.error?.code ?? ''}`);
  return json.data;
}

try {
  const email = `demo-${randomUUID()}@multigrizz.example`, password = randomBytes(24).toString('base64url');
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw new Error('Temporary user creation failed.');
  userId = created.data.user.id;
  const session = await createClient(url, publicKey, options).auth.signInWithPassword({ email, password });
  const token = session.data.session!.access_token;
  const team = await api(token, '/teams', 'POST', { name: 'Event demo team' });
  const squads = await api(token, `/teams/${team.id}/event-squads`, 'POST');
  const started = Date.now();
  await api(token, `/teams/${team.id}/missions`, 'POST', { brief, venue_squad_id: squads.venue_squad_id, promo_squad_id: squads.promo_squad_id, logistics_squad_id: squads.logistics_squad_id });
  console.log(`team ${team.id} mission queued`);
  for (const [label, squadId] of [['VENUE', squads.venue_squad_id], ['PROMO', squads.promo_squad_id], ['LOGISTICS', squads.logistics_squad_id]]) {
    let run: any;
    while (true) {
      // Polling tolerates brief auth/network hiccups; the mission keeps running server-side.
      try { [run] = await api(token, `/teams/${team.id}/squads/${squadId}/runs`); } catch { run = undefined; }
      if (run && (run.status === 'completed' || run.status === 'failed')) break;
      if (Date.now() - started > 1500000) throw new Error('Mission timed out.');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    console.log(`\n===== ${label} ${run.status} at ${Math.round((Date.now() - started) / 1000)}s ${run.error ?? ''}`);
    const detail = await api(token, `/teams/${team.id}/runs/${run.id}`);
    for (const entry of detail.entries) console.log(`--- ${entry.kind}${entry.squad_id !== squadId ? ' → other squad' : ''}\n${entry.content}`);
    if (run.status === 'failed') break;
  }
} finally {
  if (userId && process.env.KEEP !== '1') await admin.auth.admin.deleteUser(userId);
}
