# Database setup

`001_initial.sql` is an initial, transactional migration for a fresh Supabase project. It has not been applied to the hosted project by writing this file. Do not run it against a project that already has these application objects without reviewing that schema; existing objects cause the transaction to fail rather than being dropped or silently replaced.

## Apply without a direct Postgres connection

1. Open the MultiGrizz Supabase project dashboard.
2. Open **SQL Editor** and create a new query.
3. Paste the entire contents of `001_initial.sql`, including `begin` and `commit`.
4. Run it once using the dashboard's database-owner execution role.
5. Verify the seven application tables under **Table Editor** and RLS enabled on each.

This uses the dashboard and needs no paid IPv4 add-on. The backend's normal data operations use the HTTPS Data API. Database credentials and API keys do not belong in this SQL file.

## Data and authorization contract

- Party and player team are the same entity: `teams`. There is no `parties` table.
- All authenticated members of a team can read its agents, squads, memberships, runs, and context, and manage its working data. Outsiders cannot read those rows through authenticated user-scoped API calls.
- Create a team through `rpc('create_team', { team_name })`; this atomically adds its creator to `team_members`.
- Join using `rpc('join_team', { code })`. The invite code is a random 32-character lowercase hexadecimal UUID value with 122 bits of randomness. Existing members can see it; treat it as a bearer invitation and don't put it in public logs. Apply API rate limits to joining.
- Both RPCs require a real Supabase Auth user JWT. A publishable application key alone is not a user session. Membership cannot be directly inserted, changed, or deleted by an authenticated client.
- Use `is_team_member` for policies. Its security-definer execution avoids recursion when inspecting `team_members`; it only checks the current `auth.uid()` and has an empty search path.
- Composite foreign keys require squad membership, context origins, and run links to refer to the same team. A handoff can reference its originating run while belonging to the receiving squad. A handoff has a different, non-null `source_squad_id` within the same team; other entry kinds have no source squad.
- Identity, team assignment, authors, and timestamps cannot be rewritten by an authenticated client. Column-level grants allow only working fields to be updated. New runs and context entries must identify the current user as `created_by`.
- `runs_one_active_per_squad_idx` prevents two queued/running runs for a squad, including simultaneous requests from different players. Terminal status releases the slot. The backend still needs bounded execution and recovery for interrupted runs.
- RLS protects user-scoped requests. The Supabase secret/service-role key bypasses RLS; backend code using it must independently authenticate the player and check team access before every operation. Never expose it to browsers.

## Realtime

The migration adds the application tables to `supabase_realtime` if the publication exists. It does not create or alter the publication's global settings, so it does not disturb other applications. Standard Postgres without that publication skips this step.

Use authenticated **Postgres Changes INSERT and UPDATE** subscriptions filtered by the selected team, then refetch through RLS on reconnect. Do not use public Broadcast channels for team data. Private Broadcast/Presence channels need separate `realtime.messages` authorization policies, which this migration does not create; the API team must design those before enabling them.

Supabase's DELETE-event handling does not provide the same row-filter/RLS semantics as INSERT/UPDATE. The migration leaves the default replica identity so deletes expose at most key identifiers, not deleted document contents. Do not treat DELETE subscriptions as an isolation mechanism or change to `REPLICA IDENTITY FULL` for these tables. If even cross-team identifier/existence disclosure is unacceptable, omit direct DELETE subscriptions and use a server-authorized invalidation feed or soft deletes before exposing deletions to clients. Application row access always remains subject to RLS.

## Verification after applying

Run `npm test` from `backend/` to execute `test/schema.test.ts` alongside the API/runtime checks. The schema test executes this real migration in embedded PostgreSQL with a minimal Supabase Auth fixture and tests membership, RLS, forged authors, composite references, and concurrent-run exclusion. It uses no hosted credentials and does not deploy the migration. Its plain-Postgres fixture lacks the Supabase Realtime publication, so publication registration and live delivery still need hosted verification.

Test with three Auth users: two in one team and one in another. Team members should see the same team data, while the outsider gets no rows. Try assigning a foreign team's agent to a squad and sending a handoff to its squad: both must fail. Try two active runs for one squad: the second must fail. Mark the first completed, then verify a new run succeeds. Confirm a client cannot modify a row's `team_id`, forge `created_by`, insert membership directly, or list invitation codes for teams it has not joined.

Record hosted verification separately; a local parser or test database cannot verify deployment, Supabase Auth configuration, Realtime delivery, or the current project's existing schema.
