import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { test } from 'node:test';
import { buildContext, type ContextEntry } from '../src/context.ts';
import { OllamaClient } from '../src/ollama.ts';
import { RunQueue } from '../src/queue.ts';

async function server(handler: (request: IncomingMessage, response: ServerResponse) => void) {
  const instance = createServer(handler);
  await new Promise<void>((resolve) => instance.listen(0, '127.0.0.1', resolve));
  const address = instance.address();
  assert.ok(address && typeof address !== 'string');
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      instance.closeAllConnections();
      await new Promise<void>((resolve, reject) => instance.close((error) => error ? reject(error) : resolve()));
    },
  };
}

function entry(id: string, content: string, created_at = '2026-10-30T12:00:00Z'): ContextEntry {
  return { id, kind: 'note', content, created_at };
}

test('context is chronological, labels provenance, and does not mutate caller records', () => {
  const input = [entry('b', 'later', '2026-10-30T13:00:00Z'), { ...entry('a', 'earlier'), source_squad_id: 'research' }];
  const result = buildContext(input);
  assert.ok(result.indexOf('earlier') < result.indexOf('later'));
  assert.match(result, /UNTRUSTED/);
  assert.match(result, /research/);
  assert.match(result, /"kind":"note"/);
  assert.equal(input[0]?.id, 'b');
  assert.doesNotMatch(result, /unprovided-secret/);
});

test('context keeps newest records when the budget excludes older records', () => {
  const result = buildContext([entry('old', 'O'.repeat(300)), entry('new', 'N'.repeat(300), '2026-10-30T13:00:00Z')], 520);
  assert.ok(result.length <= 520);
  assert.match(result, /"id":"new"/);
  assert.doesNotMatch(result, /"id":"old"/);
  assert.match(result, /N{300}/);
});

test('oversized newest context is truncated within budget without invalid unicode', () => {
  const result = buildContext([entry('large', '🙂'.repeat(500))], 400);
  assert.ok(result.length <= 400);
  const line = result.split('\n').find((value) => value.startsWith('{'));
  assert.ok(line);
  const parsed = JSON.parse(line);
  assert.equal(parsed.id, 'large');
  assert.ok(parsed.content.length < 1000);
  assert.doesNotMatch(parsed.content, /[\uD800-\uDBFF]$/);
  assert.equal(buildContext([], 0), '');
  assert.throws(() => buildContext([], -1), RangeError);
});

test('equal timestamps use stable id ordering regardless of input order', () => {
  const result = buildContext([entry('z', 'last'), entry('a', 'first')]);
  assert.ok(result.indexOf('first') < result.indexOf('last'));
});

test('Ollama refuses remote endpoints, embedded credentials, paths, and cloud models', () => {
  for (const baseUrl of ['https://example.com', 'http://127.0.0.1.evil.test', 'http://user:password@localhost:11434', 'http://localhost:11434/remote']) {
    assert.throws(() => new OllamaClient({ baseUrl, model: 'gemma4:e2b' }));
  }
  assert.throws(() => new OllamaClient({ baseUrl: 'http://localhost:11434', model: 'gemma4:31b-cloud' }));
});

test('local Ollama receives bounded non-streaming messages and returns the actual result', async () => {
  let requestBody: Record<string, any> | undefined;
  const fixture = await server((request, response) => {
    assert.equal(request.url, '/api/chat');
    let body = '';
    request.on('data', (chunk) => body += chunk);
    request.on('end', () => {
      requestBody = JSON.parse(body);
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ model: 'gemma4:e2b', message: { role: 'assistant', content: 'Checked local findings.' }, done: true }));
    });
  });
  try {
    const client = new OllamaClient({ baseUrl: fixture.baseUrl, model: 'gemma4:e2b' });
    assert.equal((await client.chat([{ role: 'user', content: 'Review the findings.' }])).content, 'Checked local findings.');
    assert.equal(requestBody?.model, 'gemma4:e2b');
    assert.equal(requestBody?.stream, false);
    assert.equal(requestBody?.think, false);
    assert.equal(requestBody?.options.num_predict, 512);
    assert.equal(requestBody?.options.num_ctx, 4096);
    assert.deepEqual(requestBody?.messages, [{ role: 'user', content: 'Review the findings.' }]);
  } finally { await fixture.close(); }
});

test('Ollama preserves validated tool calls', async () => {
  const fixture = await server((_request, response) => response.end(JSON.stringify({ model: 'gemma4:e2b', message: { role: 'assistant', content: '', tool_calls: [{ function: { name: 'share_finding', arguments: { content: 'Evidence' } } }] } })));
  try {
    const client = new OllamaClient({ baseUrl: fixture.baseUrl, model: 'gemma4:e2b' });
    const result = await client.chat([{ role: 'user', content: 'Share findings' }], []);
    assert.equal(result.tool_calls?.[0]?.function.name, 'share_finding');
    assert.deepEqual(result.tool_calls?.[0]?.function.arguments, { content: 'Evidence' });
  } finally { await fixture.close(); }
});

test('tool-only Ollama responses normalize omitted content to an empty string', async () => {
  const fixture = await server((_request, response) => response.end(JSON.stringify({ model: 'gemma4:e2b', message: { role: 'assistant', tool_calls: [{ function: { name: 'read_context', arguments: {} } }] } })));
  try {
    const client = new OllamaClient({ baseUrl: fixture.baseUrl, model: 'gemma4:e2b' });
    const result = await client.chat([{ role: 'user', content: 'Read context' }], []);
    assert.equal(result.content, '');
    assert.equal(result.tool_calls?.[0]?.function.name, 'read_context');
  } finally { await fixture.close(); }
});

test('Ollama sanitizes error bodies, rejects mismatched models and malformed responses', async () => {
  for (const kind of ['error', 'wrong-model', 'malformed', 'bad-tool', 'bad-role']) {
    const fixture = await server((_request, response) => {
      if (kind === 'error') { response.statusCode = 500; response.end('SECRET_DATABASE_PASSWORD'); return; }
      response.end(JSON.stringify({ model: kind === 'wrong-model' ? 'cloud-model' : 'gemma4:e2b', message: kind === 'malformed' ? null : { role: kind === 'bad-role' ? 'system' : 'assistant', content: '', ...(kind === 'bad-tool' ? { tool_calls: [{ function: { name: 'tool', arguments: 'invalid' } }] } : {}) } }));
    });
    try {
      const client = new OllamaClient({ baseUrl: fixture.baseUrl, model: 'gemma4:e2b' });
      await assert.rejects(client.chat([{ role: 'user', content: 'test' }]), (error: Error) => {
        assert.doesNotMatch(error.message, /SECRET_DATABASE_PASSWORD/);
        return true;
      });
    } finally { await fixture.close(); }
  }
});

test('Ollama aborts a slow local response', async () => {
  const fixture = await server(() => {});
  try {
    const client = new OllamaClient({ baseUrl: fixture.baseUrl, model: 'gemma4:e2b', timeoutMs: 20 });
    await assert.rejects(client.chat([{ role: 'user', content: 'test' }]), /timed out/i);
  } finally { await fixture.close(); }
});

test('health checks installed model rather than merely server availability', async () => {
  let installed = false;
  const fixture = await server((request, response) => {
    assert.equal(request.url, '/api/tags');
    response.end(JSON.stringify({ models: installed ? [{ name: 'gemma4:e2b' }] : [{ name: 'different:latest' }] }));
  });
  try {
    const client = new OllamaClient({ baseUrl: fixture.baseUrl, model: 'gemma4:e2b' });
    assert.equal(await client.health(), false);
    installed = true;
    assert.equal(await client.health(), true);
  } finally { await fixture.close(); }
});

test('queue executes serially in FIFO order and continues after a failed job', async () => {
  const queue = new RunQueue();
  const events: string[] = [];
  let release: (() => void) | undefined;
  const first = new Promise<void>((resolve) => release = resolve);
  assert.equal(queue.enqueue(async () => { events.push('first-start'); await first; events.push('first-end'); }), true);
  assert.equal(queue.enqueue(async () => { events.push('failed'); throw new Error('job failed'); }), true);
  assert.equal(queue.enqueue(async () => { events.push('last'); }), true);
  await Promise.resolve();
  assert.deepEqual(events, ['first-start']);
  assert.equal(queue.pending, 3);
  release?.();
  await queue.onIdle();
  assert.deepEqual(events, ['first-start', 'first-end', 'failed', 'last']);
  assert.equal(queue.pending, 0);
});

test('queue rejects excess work including its active job and accepts work after draining', async () => {
  const queue = new RunQueue(1);
  let release: (() => void) | undefined;
  const first = new Promise<void>((resolve) => release = resolve);
  assert.equal(queue.enqueue(() => first), true);
  assert.equal(queue.enqueue(async () => assert.fail('rejected job must not run')), false);
  release?.();
  await queue.onIdle();
  assert.equal(queue.enqueue(async () => {}), true);
  await queue.onIdle();
});
