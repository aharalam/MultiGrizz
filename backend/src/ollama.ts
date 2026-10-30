export type ToolCall = {
  function: { name: string; arguments: Record<string, unknown>; index?: number };
};

export type Message = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_name?: string;
  tool_calls?: ToolCall[];
};

type OllamaOptions = { baseUrl: string; model: string; timeoutMs?: number };

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validToolCall(value: unknown): value is ToolCall {
  if (!isObject(value) || !isObject(value.function)) return false;
  const call = value.function;
  return typeof call.name === 'string' && call.name.length > 0 && isObject(call.arguments)
    && (call.index === undefined || (typeof call.index === 'number' && Number.isInteger(call.index) && call.index >= 0));
}

export class OllamaClient {
  readonly model: string;
  private readonly baseUrl: URL;
  private readonly timeoutMs: number;

  constructor({ baseUrl, model, timeoutMs = 180000 }: OllamaOptions) {
    let parsed: URL;
    try { parsed = new URL(baseUrl); }
    catch { throw new Error('Ollama requires a valid loopback URL.'); }
    if (!['http:', 'https:'].includes(parsed.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname)
      || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
      throw new Error('Ollama must use a loopback-only endpoint without credentials or a path.');
    }
    if (!/^gemma[a-z0-9.-]*:[a-z0-9_.-]+$/i.test(model) || /cloud/i.test(model)) {
      throw new Error('A tagged local Gemma model is required; cloud models are disabled.');
    }
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 180000) {
      throw new RangeError('Ollama timeout must be between 1 and 180000 milliseconds.');
    }
    this.baseUrl = parsed;
    this.model = model;
    this.timeoutMs = timeoutMs;
  }

  async chat(messages: Message[], tools?: unknown[]): Promise<Message> {
    const payload = await this.request('/api/chat', this.timeoutMs, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model, messages, ...(tools ? { tools } : {}),
        stream: false, think: false,
        options: { num_ctx: 4096, num_predict: 512, temperature: 0.2 },
      }),
    });
    if (!isObject(payload) || payload.model !== this.model || payload.error || !isObject(payload.message)) {
      throw new Error('Local Ollama returned an invalid response.');
    }
    const message = payload.message;
    if (message.role !== 'assistant' || (message.content !== undefined && typeof message.content !== 'string')
      || (message.tool_calls !== undefined && (!Array.isArray(message.tool_calls) || !message.tool_calls.every(validToolCall)))
      || (!(typeof message.content === 'string' && message.content.trim()) && (!Array.isArray(message.tool_calls) || !message.tool_calls.length))) {
      throw new Error('Local Ollama returned an invalid response.');
    }
    return { role: 'assistant', content: typeof message.content === 'string' ? message.content : '', ...(message.tool_calls !== undefined ? { tool_calls: message.tool_calls as ToolCall[] } : {}) };
  }

  async health(): Promise<boolean> {
    try {
      const payload = await this.request('/api/tags', 3000);
      return isObject(payload) && Array.isArray(payload.models)
        && payload.models.some((entry: unknown) => isObject(entry) && entry.name === this.model);
    } catch { return false; }
  }

  private async request(path: string, timeoutMs: number, init: RequestInit = {}): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(new URL(path, this.baseUrl), { ...init, redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
      if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
        throw new Error('Local Ollama request timed out.');
      }
      throw new Error('Local Ollama request failed.');
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`Local Ollama request failed (HTTP ${response.status}).`);
    }
    try { return await response.json(); }
    catch { throw new Error('Local Ollama returned an invalid response.'); }
  }
}
