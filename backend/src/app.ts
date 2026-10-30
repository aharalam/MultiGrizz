import Fastify, { type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z, ZodError } from 'zod';
import type { Config } from './config.js';
import { OllamaClient } from './ollama.js';
import { RunQueue } from './queue.js';
import { executeRun } from './runner.js';
import { createEventSquads, runMission } from './mission.js';

declare module 'fastify' {
  interface FastifyRequest { actor: { id: string; db: SupabaseClient } | null }
}

class HttpError extends Error {
  constructor(public statusCode: number, public code: string, message: string) { super(message); }
}

function database<T>(result: { data: T; error: { code?: string } | null }): T {
  if (result.error) {
    const code = result.error.code;
    if (code === 'PGRST205' || code === '42P01' || code === 'PGRST202') throw new HttpError(503, 'SCHEMA_NOT_READY', 'Apply the backend SQL migration in Supabase first.');
    if (code === '23505') throw new HttpError(409, 'CONFLICT', 'This resource or active run already exists.');
    if (code === '42501') throw new HttpError(403, 'FORBIDDEN', 'You cannot access this resource.');
    if (code === '23503' || code === '23514' || code === 'P0001' || code === '22023') throw new HttpError(400, 'INVALID_REFERENCE', 'Invalid input, invite code, or related resource.');
    throw new HttpError(502, 'DATABASE_ERROR', 'The database request failed.');
  }
  return result.data;
}

const uuid = z.string().uuid();
const name = z.string().trim().min(1).max(100);
const teamParams = z.object({ teamId: uuid });
const squadParams = z.object({ teamId: uuid, squadId: uuid });
const contentBody = z.object({ content: z.string().trim().min(1).max(16000) }).strict();
const agentBody = z.object({ name, role: z.string().trim().min(1).max(100), instructions: z.string().trim().min(1).max(2000) }).strict();
const squadBody = z.object({ name, goal: z.string().trim().max(2000).default('') }).strict();

export function buildApp(options: { config: Config; supabaseFetch?: typeof fetch }) {
  const { config } = options;
  const app = Fastify({ bodyLimit: 65536, logger: false, requestTimeout: 30000 });
  const model = new OllamaClient({ baseUrl: config.ollamaBaseUrl, model: config.gemmaModel, timeoutMs: 90000 });
  const queue = new RunQueue(8);
  const scheduledRuns = new Set<string>();
  const requestFetch: typeof fetch = (input, init) => (options.supabaseFetch ?? fetch)(input, {
    ...init, signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000),
  });
  const dbFor = (token?: string) => createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: requestFetch, ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}) },
  });
  app.decorateRequest('actor', null);
  app.register(cors, { origin: config.frontendOrigins, methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Authorization', 'Content-Type'] });
  app.register(rateLimit, { max: 300, timeWindow: '1 minute' });

  app.addHook('onRequest', async request => {
    const origin = request.headers.origin;
    if (origin && !config.frontendOrigins.includes(origin)) throw new HttpError(403, 'ORIGIN_DENIED', 'This browser origin is not allowed.');
  });
  app.addHook('preHandler', async request => {
    if (request.routeOptions.url === '/health' || request.routeOptions.url === '/ready') return;
    const token = /^Bearer ([^\s]+)$/i.exec(request.headers.authorization ?? '')?.[1];
    if (!token) throw new HttpError(401, 'UNAUTHORIZED', 'A Supabase access token is required.');
    const db = dbFor(token);
    const result = await db.auth.getUser(token);
    if (result.error && (!result.error.status || result.error.status >= 500)) throw new HttpError(503, 'AUTH_UNAVAILABLE', 'Authentication is temporarily unavailable. Try again shortly.');
    if (result.error || !result.data.user) throw new HttpError(401, 'UNAUTHORIZED', 'Your session is invalid or expired.');
    request.actor = { id: result.data.user.id, db };
  });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) return reply.code(400).send({ error: { code: 'INVALID_INPUT', message: 'Invalid request fields.', fields: error.issues.map(issue => issue.path.join('.')) } });
    if (error instanceof HttpError) return reply.code(error.statusCode).send({ error: { code: error.code, message: error.message } });
    const status = Number((error as { statusCode?: number }).statusCode);
    if (status === 413 || status === 429 || status === 400) return reply.code(status).send({ error: { code: 'REQUEST_REJECTED', message: status === 429 ? 'Too many requests. Try again shortly.' : 'Request is malformed or too large.' } });
    return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'The request could not be completed.' } });
  });
  app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Endpoint not found.' } }));

  async function authorize(request: FastifyRequest, teamId: string) {
    const actor = request.actor!;
    const membership = database(await actor.db.from('team_members').select('team_id,user_id').eq('team_id', teamId).eq('user_id', actor.id).maybeSingle());
    if (!membership) throw new HttpError(403, 'FORBIDDEN', 'You are not a member of this team.');
    return actor;
  }
  async function squad(request: FastifyRequest) {
    const params = squadParams.parse(request.params);
    const actor = await authorize(request, params.teamId);
    const row = database(await actor.db.from('squads').select('*').eq('team_id', params.teamId).eq('id', params.squadId).maybeSingle());
    if (!row) throw new HttpError(404, 'NOT_FOUND', 'Squad not found.');
    return { ...params, actor, row };
  }

  app.get('/health', async () => ({ status: 'ok', service: 'multigrizz-backend', inference: 'local' }));
  app.get('/ready', async (_request, reply) => {
    const modelReady = await model.health();
    // Only this zero-row schema probe uses the server key. User data routes always use their JWT.
    const probe = config.supabaseSecretKey ? createClient(config.supabaseUrl, config.supabaseSecretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: requestFetch },
    }) : dbFor();
    const schema = await probe.from('teams').select('id').limit(0);
    const databaseReady = !schema.error;
    return reply.code(modelReady && databaseReady ? 200 : 503).send({ status: modelReady && databaseReady ? 'ready' : 'not_ready', model: { ready: modelReady, name: config.gemmaModel, provider: 'ollama-local' }, database: { ready: databaseReady }, queue: { pending: queue.pending } });
  });
  app.get('/me', async request => ({ data: { id: request.actor!.id } }));
  app.get('/teams', async request => ({ data: database(await request.actor!.db.from('teams').select('*').order('created_at').limit(100)) }));
  app.post('/teams', async (request, reply) => {
    const body = z.object({ name }).strict().parse(request.body);
    const result = database(await request.actor!.db.rpc('create_team', { team_name: body.name }).single());
    return reply.code(201).send({ data: result });
  });
  app.post('/teams/join', async request => {
    const body = z.object({ invite_code: z.string().regex(/^[a-f0-9]{32}$/i) }).strict().parse(request.body);
    return { data: database(await request.actor!.db.rpc('join_team', { code: body.invite_code.toLowerCase() }).single()) };
  });
  app.get('/teams/:teamId', async request => {
    const { teamId } = teamParams.parse(request.params); const { db } = await authorize(request, teamId);
    return { data: database(await db.from('teams').select('*').eq('id', teamId).single()) };
  });
  app.get('/teams/:teamId/members', async request => {
    const { teamId } = teamParams.parse(request.params); const { db } = await authorize(request, teamId);
    return { data: database(await db.from('team_members').select('user_id,joined_at').eq('team_id', teamId).order('joined_at').limit(100)) };
  });
  app.get('/teams/:teamId/agents', async request => {
    const { teamId } = teamParams.parse(request.params); const { db } = await authorize(request, teamId);
    return { data: database(await db.from('agents').select('*').eq('team_id', teamId).order('created_at').limit(100)) };
  });
  app.post('/teams/:teamId/agents', async (request, reply) => {
    const { teamId } = teamParams.parse(request.params); const body = agentBody.parse(request.body); const { db } = await authorize(request, teamId);
    return reply.code(201).send({ data: database(await db.from('agents').insert({ ...body, team_id: teamId }).select().single()) });
  });
  app.patch('/teams/:teamId/agents/:agentId', async request => {
    const { teamId, agentId } = z.object({ teamId: uuid, agentId: uuid }).parse(request.params);
    const body = agentBody.partial().refine(value => Object.keys(value).length > 0).parse(request.body); const { db } = await authorize(request, teamId);
    const updated = database(await db.from('agents').update(body).eq('team_id', teamId).eq('id', agentId).select().maybeSingle());
    if (!updated) throw new HttpError(404, 'NOT_FOUND', 'Agent not found.');
    return { data: updated };
  });
  app.get('/teams/:teamId/squads', async request => {
    const { teamId } = teamParams.parse(request.params); const { db } = await authorize(request, teamId);
    return { data: database(await db.from('squads').select('*').eq('team_id', teamId).order('created_at').limit(100)) };
  });
  app.post('/teams/:teamId/squads', async (request, reply) => {
    const { teamId } = teamParams.parse(request.params); const body = squadBody.parse(request.body); const { db } = await authorize(request, teamId);
    return reply.code(201).send({ data: database(await db.from('squads').insert({ ...body, team_id: teamId }).select().single()) });
  });
  app.get('/teams/:teamId/squads/:squadId', async request => {
    const { teamId, squadId, actor, row } = await squad(request);
    const agents = database(await actor.db.from('squad_agents').select('agent_id,position,agents(*)').eq('team_id', teamId).eq('squad_id', squadId).order('position'));
    return { data: { ...row, agents } };
  });
  app.patch('/teams/:teamId/squads/:squadId', async request => {
    const body = z.object({ name: name.optional(), goal: z.string().trim().max(2000).optional() }).strict().refine(value => Object.keys(value).length > 0).parse(request.body);
    const { teamId, squadId, actor } = await squad(request);
    return { data: database(await actor.db.from('squads').update(body).eq('team_id', teamId).eq('id', squadId).select().single()) };
  });
  app.post('/teams/:teamId/squads/:squadId/agents', async (request, reply) => {
    const body = z.object({ agent_id: uuid, position: z.number().int().min(0).max(99).default(0) }).strict().parse(request.body);
    const { teamId, squadId, actor } = await squad(request);
    const agent = database(await actor.db.from('agents').select('id').eq('team_id', teamId).eq('id', body.agent_id).maybeSingle());
    if (!agent) throw new HttpError(404, 'NOT_FOUND', 'Agent not found in this team.');
    return reply.code(201).send({ data: database(await actor.db.from('squad_agents').insert({ ...body, squad_id: squadId, team_id: teamId }).select().single()) });
  });
  app.delete('/teams/:teamId/squads/:squadId/agents/:agentId', async (request, reply) => {
    const { agentId } = z.object({ agentId: uuid }).parse(request.params); const { teamId, squadId, actor } = await squad(request);
    database(await actor.db.from('squad_agents').delete().eq('team_id', teamId).eq('squad_id', squadId).eq('agent_id', agentId));
    return reply.code(204).send();
  });
  app.get('/teams/:teamId/squads/:squadId/context', async request => {
    const { teamId, squadId, actor } = await squad(request);
    const query = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50), before: z.iso.datetime({ offset: true }).optional() }).parse(request.query);
    let select = actor.db.from('context_entries').select('*').eq('team_id', teamId).eq('squad_id', squadId).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(query.limit);
    if (query.before) select = select.lt('created_at', query.before);
    return { data: (database(await select) ?? []).reverse() };
  });
  app.post('/teams/:teamId/squads/:squadId/context', async (request, reply) => {
    const body = contentBody.parse(request.body); const { teamId, squadId, actor } = await squad(request);
    return reply.code(201).send({ data: database(await actor.db.from('context_entries').insert({ ...body, team_id: teamId, squad_id: squadId, kind: 'note', created_by: actor.id }).select().single()) });
  });
  app.post('/teams/:teamId/squads/:squadId/handoffs', async (request, reply) => {
    const body = contentBody.extend({ target_squad_id: uuid }).strict().parse(request.body); const { teamId, squadId, actor } = await squad(request);
    if (body.target_squad_id === squadId) throw new HttpError(400, 'INVALID_TARGET', 'Choose a different squad.');
    const target = database(await actor.db.from('squads').select('id').eq('team_id', teamId).eq('id', body.target_squad_id).maybeSingle());
    if (!target) throw new HttpError(404, 'NOT_FOUND', 'Target squad not found in this team.');
    return reply.code(201).send({ data: database(await actor.db.from('context_entries').insert({ team_id: teamId, squad_id: body.target_squad_id, source_squad_id: squadId, kind: 'handoff', content: body.content, created_by: actor.id }).select().single()) });
  });
  app.post('/teams/:teamId/squads/:squadId/runs', { config: { rateLimit: { max: 8, timeWindow: '1 minute' } } }, async (request, reply) => {
    const body = z.object({ goal: z.string().trim().min(1).max(2000) }).strict().parse(request.body);
    const { teamId, squadId, actor, row } = await squad(request);
    if (queue.pending >= 8) throw new HttpError(503, 'QUEUE_FULL', 'The local model queue is full. Try again shortly.');
    const assignments = database(await actor.db.from('squad_agents').select('agent_id,position,agents(*)').eq('team_id', teamId).eq('squad_id', squadId).order('position').limit(4)) ?? [];
    if (!assignments.length || assignments.length > 3) throw new HttpError(400, 'SQUAD_SIZE', 'Assign between one and three agents before running a squad.');
    const run = database(await actor.db.from('runs').insert({ team_id: teamId, squad_id: squadId, created_by: actor.id, goal: body.goal, status: 'queued' }).select().single());
    scheduledRuns.add(run.id);
    const accepted = queue.enqueue(async () => {
      try { await executeRun({ db: actor.db, run, squad: row, agents: assignments.map((assignment: any) => assignment.agents), model }); }
      finally { scheduledRuns.delete(run.id); }
    });
    if (!accepted) {
      scheduledRuns.delete(run.id);
      database(await actor.db.from('runs').update({ status: 'failed', error: 'Local queue full.' }).eq('id', run.id).eq('team_id', teamId));
      throw new HttpError(503, 'QUEUE_FULL', 'The local model queue is full. Try again shortly.');
    }
    return reply.code(202).send({ data: run });
  });
  app.post('/teams/:teamId/event-squads', { config: { rateLimit: { max: 4, timeWindow: '1 minute' } } }, async (request, reply) => {
    const { teamId } = teamParams.parse(request.params); const { db } = await authorize(request, teamId);
    return reply.code(201).send({ data: await createEventSquads(db, teamId, database) });
  });
  app.post('/teams/:teamId/missions', { config: { rateLimit: { max: 4, timeWindow: '1 minute' } } }, async (request, reply) => {
    const body = z.object({ brief: z.string().trim().min(1).max(1500), venue_squad_id: uuid, promo_squad_id: uuid, logistics_squad_id: uuid }).strict().parse(request.body);
    const { teamId } = teamParams.parse(request.params); const { db } = await authorize(request, teamId);
    const ids = [body.venue_squad_id, body.promo_squad_id, body.logistics_squad_id];
    if (new Set(ids).size !== 3) throw new HttpError(400, 'INVALID_TARGET', 'Choose three different squads.');
    const found = database(await db.from('squads').select('id').eq('team_id', teamId).in('id', ids)) ?? [];
    if (found.length !== 3) throw new HttpError(404, 'NOT_FOUND', 'Squad not found in this team.');
    const active = database(await db.from('runs').select('id').eq('team_id', teamId).in('squad_id', ids).in('status', ['queued', 'running']).limit(1)) ?? [];
    if (active.length) throw new HttpError(409, 'CONFLICT', 'One of these squads already has an active run.');
    if (queue.pending >= 8) throw new HttpError(503, 'QUEUE_FULL', 'The local model queue is full. Try again shortly.');
    const note = database(await db.from('context_entries').insert({ team_id: teamId, squad_id: body.venue_squad_id, kind: 'note', content: `Event brief: ${body.brief}`, created_by: request.actor!.id }).select().single());
    const steps = { venue: body.venue_squad_id, promo: body.promo_squad_id, logistics: body.logistics_squad_id };
    const accepted = queue.enqueue(() => runMission({ db, teamId, userId: request.actor!.id, brief: body.brief, steps, model,
      track: (runId, on) => { if (on) scheduledRuns.add(runId); else scheduledRuns.delete(runId); } }));
    if (!accepted) throw new HttpError(503, 'QUEUE_FULL', 'The local model queue is full. Try again shortly.');
    return reply.code(202).send({ data: { status: 'queued', brief_entry_id: note.id, steps: body } });
  });
  app.get('/teams/:teamId/squads/:squadId/runs', async request => {
    const { teamId, squadId, actor } = await squad(request);
    return { data: database(await actor.db.from('runs').select('*').eq('team_id', teamId).eq('squad_id', squadId).order('created_at', { ascending: false }).limit(30)) };
  });
  app.get('/teams/:teamId/runs/:runId', async request => {
    const { teamId, runId } = z.object({ teamId: uuid, runId: uuid }).parse(request.params); const { db } = await authorize(request, teamId);
    const run = database(await db.from('runs').select('*').eq('team_id', teamId).eq('id', runId).maybeSingle());
    if (!run) throw new HttpError(404, 'NOT_FOUND', 'Run not found.');
    const entries = database(await db.from('context_entries').select('*').eq('team_id', teamId).eq('run_id', runId).order('created_at').limit(100));
    return { data: { ...run, entries } };
  });
  app.post('/teams/:teamId/runs/:runId/recover', async request => {
    z.object({ confirm_interrupted: z.literal(true) }).strict().parse(request.body);
    const { teamId, runId } = z.object({ teamId: uuid, runId: uuid }).parse(request.params);
    const { db } = await authorize(request, teamId);
    if (scheduledRuns.has(runId)) throw new HttpError(409, 'RUN_ACTIVE', 'This run is still queued or executing in this backend.');
    const run = database(await db.from('runs').select('*').eq('team_id', teamId).eq('id', runId).maybeSingle());
    if (!run) throw new HttpError(404, 'NOT_FOUND', 'Run not found.');
    if (run.status !== 'queued' && run.status !== 'running') return { data: run };
    const recovered = database(await db.from('runs').update({ status: 'failed', error: 'Recovered after a confirmed backend interruption. Start a new run to retry.' }).eq('team_id', teamId).eq('id', runId).in('status', ['queued', 'running']).select().maybeSingle());
    if (!recovered) throw new HttpError(409, 'RUN_CHANGED', 'The run changed while being recovered. Refresh its status.');
    return { data: recovered };
  });
  return app;
}
