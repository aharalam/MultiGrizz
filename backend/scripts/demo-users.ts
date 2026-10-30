import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// Creates admin-confirmed demo players (no signup emails) and prints their sign-in details.
// Usage: npm run demo:users -- player1 player2 rival
const url = process.env.SUPABASE_URL, secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY are required.');
const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
const names = process.argv.slice(2).length ? process.argv.slice(2) : ['player1', 'player2', 'rival'];
for (const name of names) {
  const email = `${name.replace(/[^a-z0-9]/gi, '').toLowerCase()}-${randomBytes(3).toString('hex')}@multigrizz.example`;
  const password = randomBytes(9).toString('base64url');
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  console.log(created.error ? `${name}: failed (${created.error.message})` : `${name}: ${email}  ${password}`);
}
