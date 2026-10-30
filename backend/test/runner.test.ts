import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Message, OllamaClient } from '../src/ollama.ts';
import { executeRun } from '../src/runner.ts';

const teamId = '11111111-1111-4111-8111-111111111111';
const otherTeam = '22222222-2222-4222-8222-222222222222';
const squadId = '33333333-3333-4333-8333-333333333333';
const targetId = '44444444-4444-4444-8444-444444444444';
const userId = '55555555-5555-4555-8555-555555555555';
const runId = '66666666-6666-4666-8666-666666666666';

class Db {
  rows: Record<string, any[]> = {
    team_members: [{ team_id: teamId, user_id: userId }],
    squads: [{ id: squadId, team_id: teamId, name: 'Research', goal: 'Review evidence' }, { id: targetId, team_id: teamId, name: 'Product', goal: 'Design solution' }],
    runs: [{ id: runId, team_id: teamId, squad_id: squadId, created_by: userId, goal: 'Make a recommendation', status: 'queued' }],
    context_entries: [],
  };
  failStatus = '';
  failOperation: { table: string; operation: string } | undefined;
  from(table: string) { return new Query(this, table); }
  get client() { return this as unknown as SupabaseClient; }
}

class Query implements PromiseLike<any> {
  private filters: Array<[string, unknown]> = [];
  private ordering: Array<[string, boolean]> = [];
  private maximum = Infinity;
  private columns = '*';
  private operation = 'select';
  private values: any;
  constructor(private db: Db, private table: string) {}
  select(columns = '*') { this.columns = columns; return this; }
  eq(key: string, value: unknown) { this.filters.push([key, value]); return this; }
  order(key: string, options: { ascending?: boolean } = {}) { this.ordering.push([key, options.ascending !== false]); return this; }
  limit(value: number) { this.maximum = value; return this; }
  update(values: any) { this.operation = 'update'; this.values = values; return this; }
  insert(values: any) { this.operation = 'insert'; this.values = values; return this; }
  async maybeSingle() { const result = this.execute(); return { ...result, data: result.data?.[0] ?? null }; }
  async single() { return this.maybeSingle(); }
  then<TResult1 = any, TResult2 = never>(fulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null, rejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null): PromiseLike<TResult1 | TResult2> { return Promise.resolve(this.execute()).then(fulfilled, rejected); }
  private execute() {
    if (this.operation === 'update' && this.values.status === this.db.failStatus) return { data: null, error: { message: 'SECRET failure' } };
    if (this.db.failOperation?.table === this.table && this.db.failOperation.operation === this.operation) return { data: null, error: { message: 'SECRET persistence failure' } };
    const all = this.db.rows[this.table] ?? [];
    let rows = all.filter((row) => this.filters.every(([key, value]) => row[key] === value));
    if (this.operation === 'insert') {
      const value = { id: randomUUID(), created_at: new Date().toISOString(), ...this.values };
      all.push(value); this.db.rows[this.table] = all; rows = [value];
    } else if (this.operation === 'update') { for (const row of rows) Object.assign(row, this.values); }
    rows = [...rows].sort((a, b) => {
      for (const [key, ascending] of this.ordering) { if (a[key] !== b[key]) return (a[key] < b[key] ? -1 : 1) * (ascending ? 1 : -1); }
      return 0;
    }).slice(0, this.maximum);
    if (this.columns !== '*') rows = rows.map((row) => Object.fromEntries(this.columns.split(',').map((key) => [key, row[key]])));
    return { data: rows, error: null };
  }
}

function setup(replies: Message[] = [{ role: 'assistant', content: 'Recommendation ready.' }]) {
  const db = new Db();
  const calls: Message[][] = [];
  const model = { async chat(messages: Message[]) { calls.push(structuredClone(messages)); const reply = replies.shift(); if (!reply) throw new Error('SECRET unexpected model failure'); return reply; } } as unknown as OllamaClient;
  const agents = [{ id: randomUUID(), team_id: teamId, name: 'Analyst', role: 'researcher', instructions: 'Review supplied evidence.' }];
  return { db, calls, model, agents, run: db.rows.runs![0], squad: db.rows.squads![0] };
}

const tool = (name: string, args: Record<string, unknown> = {}): Message => ({ role: 'assistant', content: '', tool_calls: [{ function: { name, arguments: args } }] });

test('run saves results, completes, and isolates team and squad context', async () => {
  const state = setup();
  state.db.rows.context_entries = [
    { id: 'a', team_id: teamId, squad_id: squadId, kind: 'note', content: 'OUR_EVIDENCE', created_at: '2026-10-30T12:00:00Z' },
    { id: 'b', team_id: otherTeam, squad_id: squadId, kind: 'note', content: 'OTHER_TEAM_SECRET', created_at: '2026-10-30T13:00:00Z' },
    { id: 'c', team_id: teamId, squad_id: targetId, kind: 'note', content: 'OTHER_SQUAD_SECRET', created_at: '2026-10-30T13:00:00Z' },
  ];
  await executeRun({ ...state, db: state.db.client });
  assert.equal(state.run.status, 'completed');
  const prompt = JSON.stringify(state.calls);
  assert.match(prompt, /OUR_EVIDENCE/);
  assert.doesNotMatch(prompt, /OTHER_TEAM_SECRET|OTHER_SQUAD_SECRET/);
  const result = state.db.rows.context_entries!.find((row) => row.kind === 'result');
  assert.equal(result?.team_id, teamId);
  assert.equal(result?.squad_id, squadId);
  assert.equal(result?.run_id, runId);
  assert.equal(result?.created_by, userId);
  assert.match(result?.content, /Analyst.*researcher/);
  assert.match(result?.content, /Recommendation ready/);
});

test('next agent sees previous agent result while instructions remain bounded', async () => {
  const state = setup([{ role: 'assistant', content: 'FIRST_FINDING' }, { role: 'assistant', content: 'SECOND_FINDING' }]);
  state.agents.push({ ...state.agents[0]!, id: randomUUID(), name: 'Reviewer', instructions: 'X'.repeat(8000) });
  state.squad.goal = 'G'.repeat(8000);
  await executeRun({ ...state, db: state.db.client });
  assert.equal(state.run.status, 'completed');
  assert.match(JSON.stringify(state.calls[1]), /FIRST_FINDING/);
  assert.ok(JSON.stringify(state.calls[1]).length < 16000);
});

test('tool handoffs persist only to an explicitly verified same-team squad', async () => {
  const state = setup([tool('share_finding', { target_squad_id: targetId, content: 'Useful evidence' }), { role: 'assistant', content: 'Shared the finding.' }]);
  await executeRun({ ...state, db: state.db.client });
  assert.equal(state.run.status, 'completed');
  const handoff = state.db.rows.context_entries!.find((row) => row.kind === 'handoff');
  assert.equal(handoff?.squad_id, targetId);
  assert.equal(handoff?.source_squad_id, squadId);
  assert.equal(handoff?.team_id, teamId);
  assert.equal(handoff?.content, 'Useful evidence');
  assert.ok(state.calls[1]?.some((message) => message.role === 'tool' && message.tool_name === 'share_finding'));
});

test('cross-team handoff targets fail without inserting context', async () => {
  const state = setup([tool('share_finding', { target_squad_id: targetId, content: 'Must not leak' })]);
  state.db.rows.squads![1]!.team_id = otherTeam;
  await executeRun({ ...state, db: state.db.client });
  assert.equal(state.run.status, 'failed');
  assert.equal(state.db.rows.context_entries!.length, 0);
});

test('list_squads reveals only same-team public squad metadata', async () => {
  const state = setup([tool('list_squads'), { role: 'assistant', content: 'Squads checked.' }]);
  state.db.rows.squads!.push({ id: randomUUID(), team_id: otherTeam, name: 'SECRET_OTHER_TEAM', goal: 'hidden' });
  await executeRun({ ...state, db: state.db.client });
  const toolResponse = state.calls[1]?.find((message) => message.role === 'tool');
  assert.ok(toolResponse);
  assert.match(toolResponse.content, /Product/);
  assert.doesNotMatch(toolResponse.content, /SECRET_OTHER_TEAM|invite_code|team_id/);
});

test('removed membership and invalid agent snapshots prevent model access', async () => {
  for (const scenario of ['membership', 'agent-team', 'no-agents', 'too-many-agents']) {
    const state = setup();
    if (scenario === 'membership') state.db.rows.team_members = [];
    if (scenario === 'agent-team') state.agents[0]!.team_id = otherTeam;
    if (scenario === 'no-agents') state.agents = [];
    if (scenario === 'too-many-agents') state.agents = Array.from({ length: 4 }, () => ({ ...state.agents[0]!, id: randomUUID() }));
    await executeRun({ ...state, db: state.db.client });
    assert.equal(state.run.status, 'failed', scenario);
    assert.equal(state.calls.length, 0, scenario);
  }
});

test('model and database failures persist a sanitized failed state', async () => {
  for (const scenario of ['model', 'completion-write', 'running-write', 'context-read', 'context-write']) {
    const state = setup(scenario === 'model' ? [] : [{ role: 'assistant', content: 'Result' }]);
    if (scenario === 'completion-write') state.db.failStatus = 'completed';
    if (scenario === 'running-write') state.db.failStatus = 'running';
    if (scenario === 'context-read') state.db.failOperation = { table: 'context_entries', operation: 'select' };
    if (scenario === 'context-write') state.db.failOperation = { table: 'context_entries', operation: 'insert' };
    await executeRun({ ...state, db: state.db.client });
    assert.equal(state.run.status, 'failed');
    assert.doesNotMatch(state.run.error, /SECRET/);
    assert.ok(state.run.error);
  }
});

test('runner rejects self handoffs, invalid arguments, unknown tools and empty final results', async () => {
  for (const reply of [tool('share_finding', { target_squad_id: squadId, content: 'Self handoff' }), tool('share_finding', { target_squad_id: targetId, content: 'X'.repeat(4001) }), tool('execute_shell', { command: 'anything' }), { role: 'assistant', content: '' } as Message]) {
    const state = setup([reply]);
    await executeRun({ ...state, db: state.db.client });
    assert.equal(state.run.status, 'failed');
    assert.equal(state.db.rows.context_entries!.length, 0);
  }
});

test('context retrieval uses latest fifty entries rather than oldest or unbounded history', async () => {
  const state = setup();
  state.db.rows.context_entries = Array.from({ length: 51 }, (_, index) => ({ id: String(index).padStart(3, '0'), team_id: teamId, squad_id: squadId, kind: 'note', content: index === 0 ? 'OLDEST_EXCLUDED' : `note_${index}`, created_at: new Date(Date.UTC(2026, 9, 30, 0, index)).toISOString() }));
  await executeRun({ ...state, db: state.db.client });
  assert.equal(state.run.status, 'completed');
  assert.doesNotMatch(JSON.stringify(state.calls), /OLDEST_EXCLUDED/);
  assert.match(JSON.stringify(state.calls), /note_50/);
});

test('run enforces model round and tool count limits', async () => {
  const endlesslyCalling = setup([tool('list_squads'), tool('list_squads'), tool('list_squads')]);
  await executeRun({ ...endlesslyCalling, db: endlesslyCalling.db.client });
  assert.equal(endlesslyCalling.run.status, 'failed');
  assert.equal(endlesslyCalling.calls.length, 3);
  const tooMany = setup([{ role: 'assistant', content: '', tool_calls: Array.from({ length: 3 }, () => ({ function: { name: 'list_squads', arguments: {} } })) }]);
  await executeRun({ ...tooMany, db: tooMany.db.client });
  assert.equal(tooMany.run.status, 'failed');
  assert.equal(tooMany.calls.length, 1);
});

test('run fails without saving a final result when model response exceeds the elapsed budget', async (t) => {
  let now = 0;
  t.mock.method(Date, 'now', () => now);
  const state = setup();
  state.model = { async chat() { now = 181000; return { role: 'assistant', content: 'Late result' }; } } as unknown as OllamaClient;
  await executeRun({ ...state, db: state.db.client });
  assert.equal(state.run.status, 'failed');
  assert.equal(state.db.rows.context_entries!.length, 0);
});
