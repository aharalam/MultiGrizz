import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';

const teamA = '11111111-1111-4111-8111-111111111111';
const teamB = '22222222-2222-4222-8222-222222222222';
const userId = '33333333-3333-4333-8333-333333333333';
const squadId = '44444444-4444-4444-8444-444444444444';
const config = { port: 4000, host: '127.0.0.1', frontendOrigins: ['http://localhost:3000'], supabaseUrl: 'http://supabase.test', supabasePublishableKey: 'test-key', supabaseSecretKey: 'server-key', ollamaBaseUrl: 'http://127.0.0.1:11434', gemmaModel: 'gemma4:e2b' };

function setup(options: { authUnavailable?: boolean } = {}) {
  const accessed: string[] = [];
  let storedSquad = { id: squadId, team_id: teamA, name: 'Research', goal: 'Preserve the research objective' };
  let storedRun = { id: squadId, team_id: teamA, squad_id: squadId, status: 'running', error: null as string | null };
  const supabaseFetch: typeof fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    accessed.push(url.pathname + url.search);
    const headers = new Headers(init?.headers);
    if (url.pathname === '/auth/v1/user') {
      if (options.authUnavailable) return Response.json({ message: 'upstream unavailable' }, { status: 503 });
      if (headers.get('authorization') !== 'Bearer valid-token') return Response.json({ message: 'invalid token' }, { status: 401 });
      return Response.json({ id: userId, aud: 'authenticated', role: 'authenticated', email: 'tester@example.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' });
    }
    if (url.pathname === '/rest/v1/team_members') {
      assert.equal(url.searchParams.get('user_id'), `eq.${userId}`);
      return Response.json(url.searchParams.get('team_id') === `eq.${teamA}` ? [{ team_id: teamA, user_id: userId }] : []);
    }
    if (url.pathname === '/rest/v1/agents') {
      assert.equal(headers.get('apikey'), 'test-key');
      assert.equal(headers.get('authorization'), 'Bearer valid-token');
      assert.equal(url.searchParams.get('team_id'), `eq.${teamA}`);
      return Response.json([{ id: 'agent-1', team_id: teamA, name: 'Researcher' }]);
    }
    if (url.pathname === '/rest/v1/teams' && url.searchParams.get('limit') === '0') {
      assert.equal(headers.get('apikey'), 'server-key');
      return Response.json([]);
    }
    if (url.pathname === '/rest/v1/squads') {
      assert.equal(url.searchParams.get('team_id'), `eq.${teamA}`);
      if (init?.method === 'PATCH') {
        storedSquad = { ...storedSquad, ...JSON.parse(String(init.body)) };
        return Response.json(storedSquad);
      }
      return Response.json([storedSquad]);
    }
    if (url.pathname === '/rest/v1/runs') {
      assert.equal(url.searchParams.get('team_id'), `eq.${teamA}`);
      if (init?.method === 'PATCH') { storedRun = { ...storedRun, ...JSON.parse(String(init.body)) }; return Response.json(storedRun); }
      return Response.json([storedRun]);
    }
    return Response.json({ message: 'unexpected database call' }, { status: 500 });
  };
  return { app: buildApp({ config, supabaseFetch }), accessed };
}

test('team resources reject missing bearer tokens before database access', async t => {
  const { app, accessed } = setup(); t.after(() => app.close());
  const response = await app.inject({ method: 'GET', url: `/teams/${teamA}/agents` });
  assert.equal(response.statusCode, 401); assert.deepEqual(accessed, []);
});

test('invalid bearer token cannot access team resources', async t => {
  const { app, accessed } = setup(); t.after(() => app.close());
  const response = await app.inject({ method: 'GET', url: `/teams/${teamA}/agents`, headers: { authorization: 'Bearer forged' } });
  assert.equal(response.statusCode, 401); assert.equal(accessed.length, 1);
});

test('an auth provider outage is not reported as an invalid user session', async t => {
  const { app } = setup({ authUnavailable: true }); t.after(() => app.close());
  const response = await app.inject({ url: `/teams/${teamA}/agents`, headers: { authorization: 'Bearer valid-token' } });
  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error.code, 'AUTH_UNAVAILABLE');
});

test('outsiders cannot list another team agents or start its runs', async t => {
  const { app, accessed } = setup(); t.after(() => app.close());
  const response = await app.inject({ method: 'GET', url: `/teams/${teamB}/agents`, headers: { authorization: 'Bearer valid-token' } });
  assert.equal(response.statusCode, 403);
  assert.equal(accessed.some(path => path.startsWith('/rest/v1/agents')), false);
  const run = await app.inject({ method: 'POST', url: `/teams/${teamB}/squads/${teamA}/runs`, headers: { authorization: 'Bearer valid-token' }, payload: { goal: 'private work' } });
  assert.equal(run.statusCode, 403);
  assert.equal(accessed.some(path => path.startsWith('/rest/v1/runs')), false);
});

test('members list their shared agents using a caller-scoped database client', async t => {
  const { app } = setup(); t.after(() => app.close());
  const response = await app.inject({ method: 'GET', url: `/teams/${teamA}/agents`, headers: { authorization: 'Bearer valid-token' } });
  assert.equal(response.statusCode, 200); assert.equal(response.json().data[0].name, 'Researcher');
});

test('malformed and spoofed team identifiers are rejected', async t => {
  const { app } = setup(); t.after(() => app.close());
  const headers = { authorization: 'Bearer valid-token' };
  const response = await app.inject({ method: 'GET', url: '/teams/not-a-uuid/agents', headers });
  assert.equal(response.statusCode, 400);
  const spoof = await app.inject({ method: 'POST', url: `/teams/${teamA}/agents`, headers, payload: { name: 'Agent', role: 'Writer', instructions: 'Help', team_id: teamB } });
  assert.equal(spoof.statusCode, 400);
});

test('untrusted browser origins receive no access', async t => {
  const { app } = setup(); t.after(() => app.close());
  const response = await app.inject({ method: 'GET', url: '/health', headers: { origin: 'https://untrusted.invalid' } });
  assert.equal(response.statusCode, 403);
  assert.equal(response.headers['access-control-allow-origin'], undefined);
});

test('health endpoint works without credentials or a model request', async t => {
  const { app, accessed } = setup(); t.after(() => app.close());
  const response = await app.inject('/health');
  assert.equal(response.statusCode, 200); assert.equal(response.json().status, 'ok'); assert.deepEqual(accessed, []);
});

test('readiness uses the server probe key without exposing it in responses', async t => {
  const { app, accessed } = setup(); t.after(() => app.close());
  const response = await app.inject('/ready');
  assert.equal(response.json().database.ready, true);
  assert.equal(response.body.includes('server-key'), false);
  assert.equal(accessed.some(path => path.startsWith('/auth/')), false);
});

test('renaming a squad preserves its existing goal and empty patch is rejected', async t => {
  const { app } = setup(); t.after(() => app.close());
  const url = `/teams/${teamA}/squads/${squadId}`;
  const headers = { authorization: 'Bearer valid-token' };
  const renamed = await app.inject({ method: 'PATCH', url, headers, payload: { name: 'Renamed' } });
  assert.equal(renamed.statusCode, 200);
  assert.equal(renamed.json().data.goal, 'Preserve the research objective');
  const empty = await app.inject({ method: 'PATCH', url, headers, payload: {} });
  assert.equal(empty.statusCode, 400);
});

test('an interrupted persisted run can be recovered explicitly by its own team only', async t => {
  const { app } = setup(); t.after(() => app.close());
  const headers = { authorization: 'Bearer valid-token' };
  const url = `/teams/${teamA}/runs/${squadId}/recover`;
  const unconfirmed = await app.inject({ method: 'POST', url, headers, payload: {} });
  assert.equal(unconfirmed.statusCode, 400);
  const recovered = await app.inject({ method: 'POST', url, headers, payload: { confirm_interrupted: true } });
  assert.equal(recovered.statusCode, 200); assert.equal(recovered.json().data.status, 'failed');
  const outsider = await app.inject({ method: 'POST', url: `/teams/${teamB}/runs/${squadId}/recover`, headers, payload: { confirm_interrupted: true } });
  assert.equal(outsider.statusCode, 403);
});
