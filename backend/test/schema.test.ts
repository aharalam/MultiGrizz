import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

// Run the real migration and policies in PostgreSQL. The Auth fixture supplies
// only the roles/users/JWT-sub lookup normally provided by hosted Supabase.
test('initial schema enforces player-team isolation in PostgreSQL', async (t) => {
  const db = new PGlite();
  const user1 = '00000000-0000-4000-8000-000000000001';
  const user2 = '00000000-0000-4000-8000-000000000002';
  const user3 = '00000000-0000-4000-8000-000000000003';
  type Team = { id: string; name: string; invite_code: string };
  type Entity = { id: string };

  const actor = async (id: string) => {
    await db.exec('reset role; set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
  };
  const rejected = async (sql: string, params: unknown[], code: string) => {
    await assert.rejects(db.query(sql, params), (error: unknown) => {
      assert.equal((error as { code?: string }).code, code);
      return true;
    });
  };

  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      grant usage on schema auth to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;
    `);
    await db.query('insert into auth.users(id) values ($1), ($2), ($3)', [user1, user2, user3]);
    const migration = await readFile(new URL('../migrations/001_initial.sql', import.meta.url), 'utf8');
    await db.exec(migration);

    await actor(user1);
    const a = (await db.query<Team>('select * from public.create_team($1)', ['Alpha'])).rows[0]!;
    const squadA = (await db.query<Entity>(
      'insert into public.squads(team_id,name) values ($1,$2) returning id', [a.id, 'Research'],
    )).rows[0]!;
    const targetA = (await db.query<Entity>(
      'insert into public.squads(team_id,name) values ($1,$2) returning id', [a.id, 'Product'],
    )).rows[0]!;
    const agentA = (await db.query<Entity>(
      'insert into public.agents(team_id,name,role,instructions) values ($1,$2,$3,$4) returning id',
      [a.id, 'Analyst', 'research', 'Use sources'],
    )).rows[0]!;

    await actor(user3);
    const b = (await db.query<Team>('select * from public.create_team($1)', ['Bravo'])).rows[0]!;
    const squadB = (await db.query<Entity>(
      'insert into public.squads(team_id,name) values ($1,$2) returning id', [b.id, 'Private'],
    )).rows[0]!;
    const agentB = (await db.query<Entity>(
      'insert into public.agents(team_id,name,role,instructions) values ($1,$2,$3,$4) returning id',
      [b.id, 'Hidden', 'private', 'Private details'],
    )).rows[0]!;

    await t.test('all application tables have row-level security enabled', async () => {
      await db.exec('reset role');
      const result = await db.query<{ relname: string; relrowsecurity: boolean }>(`
        select relname, relrowsecurity from pg_class
        where relnamespace = 'public'::regnamespace
        and relname in ('teams','team_members','agents','squads','squad_agents','runs','context_entries')
        order by relname
      `);
      assert.equal(result.rows.length, 7);
      assert.ok(result.rows.every((row) => row.relrowsecurity));
    });

    await t.test('creating a team atomically adds its creator as a member', async () => {
      await actor(user1);
      assert.deepEqual((await db.query('select user_id from public.team_members where team_id=$1', [a.id])).rows,
        [{ user_id: user1 }]);
      assert.match(a.invite_code, /^[a-f0-9]{32}$/);
      assert.notEqual(a.invite_code, b.invite_code);
    });

    await t.test('an outsider cannot inspect another team or its agents', async () => {
      await actor(user2);
      assert.deepEqual((await db.query('select id from public.teams where id=$1', [a.id])).rows, []);
      assert.deepEqual((await db.query('select id from public.agents where team_id=$1', [a.id])).rows, []);
      assert.deepEqual((await db.query('select user_id from public.team_members where team_id=$1', [a.id])).rows, []);
    });

    await t.test('clients cannot grant themselves membership directly', async () => {
      await actor(user2);
      await rejected('insert into public.team_members(team_id,user_id) values ($1,auth.uid())', [a.id], '42501');
    });

    await t.test('a valid invitation shares team data without recursive membership policies', async () => {
      await actor(user2);
      const joined = (await db.query<Team>('select * from public.join_team($1)', [a.invite_code])).rows[0]!;
      assert.equal(joined.id, a.id);
      assert.deepEqual((await db.query('select id from public.agents where team_id=$1', [a.id])).rows,
        [{ id: agentA.id }]);
      assert.equal((await db.query('select user_id from public.team_members where team_id=$1', [a.id])).rows.length, 2);
      // Joining twice is idempotent rather than duplicating membership.
      await db.query('select * from public.join_team($1)', [a.invite_code]);
      assert.equal((await db.query('select user_id from public.team_members where team_id=$1', [a.id])).rows.length, 2);
    });

    let completedRun: Entity;
    await t.test('simultaneous active runs are rejected and terminal status releases the slot', async () => {
      await actor(user2);
      completedRun = (await db.query<Entity>(
        'insert into public.runs(team_id,squad_id,created_by,goal) values ($1,$2,auth.uid(),$3) returning id',
        [a.id, squadA.id, 'Find evidence'],
      )).rows[0]!;
      await rejected(
        'insert into public.runs(team_id,squad_id,created_by,goal) values ($1,$2,auth.uid(),$3)',
        [a.id, squadA.id, 'Duplicate'], '23505',
      );
      await db.query("update public.runs set status='completed' where id=$1", [completedRun.id]);
      const next = await db.query(
        'insert into public.runs(team_id,squad_id,created_by,goal) values ($1,$2,auth.uid(),$3) returning status',
        [a.id, squadA.id, 'Next task'],
      );
      assert.deepEqual(next.rows, [{ status: 'queued' }]);
    });

    await t.test('a handoff can reference the source run in a different squad of the same team', async () => {
      await actor(user2);
      const result = await db.query(
        `insert into public.context_entries(team_id,squad_id,kind,content,source_squad_id,run_id,created_by)
         values ($1,$2,'handoff','Verified finding',$3,$4,auth.uid()) returning squad_id, source_squad_id, run_id`,
        [a.id, targetA.id, squadA.id, completedRun!.id],
      );
      assert.deepEqual(result.rows, [{ squad_id: targetA.id, source_squad_id: squadA.id, run_id: completedRun!.id }]);
    });

    await t.test('a different team cannot inspect handoffs or runs', async () => {
      await actor(user3);
      assert.deepEqual((await db.query('select id from public.context_entries where team_id=$1', [a.id])).rows, []);
      assert.deepEqual((await db.query('select id from public.runs where team_id=$1', [a.id])).rows, []);
    });

    await t.test('members cannot forge the author of context or runs', async () => {
      await actor(user2);
      await rejected(
        "insert into public.context_entries(team_id,squad_id,kind,content,created_by) values ($1,$2,'note','Forged',$3)",
        [a.id, squadA.id, user3], '42501',
      );
      await rejected(
        'insert into public.runs(team_id,squad_id,created_by,goal) values ($1,$2,$3,$4)',
        [a.id, targetA.id, user3, 'Forged run'], '42501',
      );
    });

    await t.test('cross-team agent assignment fails even when the caller belongs to both teams', async () => {
      await actor(user1);
      await db.query('select * from public.join_team($1)', [b.invite_code]);
      await rejected('insert into public.squad_agents(team_id,squad_id,agent_id) values ($1,$2,$3)',
        [a.id, squadA.id, agentB.id], '23503');
    });

    await t.test('cross-team handoff origins are rejected by the composite reference', async () => {
      await actor(user1);
      await rejected(
        `insert into public.context_entries(team_id,squad_id,kind,content,source_squad_id,created_by)
         values ($1,$2,'handoff','Cross team',$3,auth.uid())`,
        [a.id, squadA.id, squadB.id], '23503',
      );
    });

    await t.test('a context row cannot reference a run in another team', async () => {
      await actor(user3);
      const runB = (await db.query<Entity>(
        'insert into public.runs(team_id,squad_id,created_by,goal) values ($1,$2,auth.uid(),$3) returning id',
        [b.id, squadB.id, 'Private work'],
      )).rows[0]!;
      await actor(user1);
      await rejected(
        `insert into public.context_entries(team_id,squad_id,kind,content,run_id,created_by)
         values ($1,$2,'result','Cross team',$3,auth.uid())`,
        [a.id, squadA.id, runB.id], '23503',
      );
    });

    await t.test('working-row team identity cannot be moved by a client', async () => {
      await actor(user1);
      await rejected('update public.agents set team_id=$1 where id=$2', [b.id, agentA.id], '42501');
      assert.deepEqual((await db.query('select team_id from public.agents where id=$1', [agentA.id])).rows,
        [{ team_id: a.id }]);
    });

    await t.test('invalid invitations do not create membership', async () => {
      await actor(user3);
      await rejected('select * from public.join_team($1)', ['bad'], '22023');
      await rejected('select * from public.join_team($1)', ['00000000000000000000000000000000'], '22023');
      assert.deepEqual((await db.query('select id from public.teams where id=$1', [a.id])).rows, []);
    });

    await t.test('anonymous clients cannot select application data', async () => {
      await db.exec('reset role; set role anon');
      for (const table of ['teams', 'team_members', 'agents', 'squads', 'squad_agents', 'runs', 'context_entries']) {
        await rejected(`select * from public.${table}`, [], '42501');
      }
    });

    await t.test('authenticated role without an Auth identity cannot create a team', async () => {
      await actor('');
      await rejected('select * from public.create_team($1)', ['No identity'], '28000');
    });
  } finally {
    await db.close();
  }
});
