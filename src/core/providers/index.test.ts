import { describe, it, expect, vi, afterEach } from 'vitest';
import { AnthropicProvider, OpenAIProvider, OllamaProvider, getProvider } from './index.js';
import type { Evidence } from './types.js';

function fakeRes(opts: { ok?: boolean; status?: number; json?: unknown; text?: string }) {
  return {
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    json: async () => opts.json,
    text: async () => opts.text ?? '',
    headers: new Map(),
  } as unknown as Response;
}

const evidence: Evidence = {
  name: 'Acme',
  docs: [
    {
      text: 'Acme builds robots. Founded 2019.',
      source: { url: 'https://acme.example', title: 'Home', fetchedAt: '2026-06-27T00:00:00.000Z', kind: 'homepage' },
    },
  ],
};

const canned = JSON.stringify({
  summary: 'Acme builds robots.',
  facts: [{ label: 'Founded', value: '2019', citations: [0] }],
  confidence: 'high',
});

describe('cloud/local providers (injected transport)', () => {
  it('AnthropicProvider synthesises from the model response', async () => {
    const p = new AnthropicProvider({ apiKey: 'k', complete: async () => canned });
    const d = await p.synthesize(evidence);
    expect(p.id).toBe('anthropic');
    expect(p.model).toBe('claude-opus-4-8');
    expect(d.facts[0].value).toBe('2019');
    expect(d.confidence).toBe('high');
  });

  it('OpenAIProvider synthesises and respects a custom model', async () => {
    const p = new OpenAIProvider({ apiKey: 'k', model: 'gpt-4o', complete: async () => canned });
    const d = await p.synthesize(evidence);
    expect(p.id).toBe('openai');
    expect(p.model).toBe('gpt-4o');
    expect(d.summary).toBe('Acme builds robots.');
  });

  it('OllamaProvider needs no key', async () => {
    const p = new OllamaProvider({ complete: async () => canned });
    const d = await p.synthesize(evidence);
    expect(p.id).toBe('ollama');
    expect(d.facts).toHaveLength(1);
  });
});

describe('real transport (global fetch stubbed)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('Anthropic request omits temperature/top_p/top_k and sets model/max_tokens/system/messages', async () => {
    let init: RequestInit | undefined;
    let url: string | undefined;
    vi.stubGlobal('fetch', vi.fn(async (u: string, i: RequestInit) => {
      url = u;
      init = i;
      return fakeRes({ json: { content: [{ type: 'text', text: canned }] } });
    }));
    await new AnthropicProvider({ apiKey: 'k' }).synthesize(evidence);
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    const body = JSON.parse(init!.body as string);
    expect(body.temperature).toBeUndefined();
    expect(body.top_p).toBeUndefined();
    expect(body.top_k).toBeUndefined();
    expect(body.max_tokens).toBe(4096);
    expect(body.model).toBe('claude-opus-4-8');
    expect(body.system).toEqual(expect.any(String));
    expect(body.messages).toEqual([{ role: 'user', content: expect.any(String) }]);
    expect((init!.headers as Record<string, string>)['x-api-key']).toBe('k');
    expect((init!.headers as Record<string, string>)['anthropic-version']).toBe('2023-06-01');
  });

  it('Anthropic joins only text content blocks (ignoring thinking/tool_use)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      fakeRes({ json: { content: [
        { type: 'thinking', text: 'IGNORE' },
        { type: 'text', text: '{"summary":"' },
        { type: 'tool_use' },
        { type: 'text', text: 'x","facts":[]}' },
      ] } }),
    ));
    const d = await new AnthropicProvider({ apiKey: 'k' }).synthesize(evidence);
    expect(d.summary).toBe('x');
  });

  it('Anthropic throws on empty content', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => fakeRes({ json: { content: [] } })));
    await expect(new AnthropicProvider({ apiKey: 'k' }).synthesize(evidence)).rejects.toThrow(/No JSON object/);
  });

  it('OpenAI request sets json_object format, temperature 0, role-tagged messages and bearer auth', async () => {
    let init: RequestInit | undefined;
    let url: string | undefined;
    vi.stubGlobal('fetch', vi.fn(async (u: string, i: RequestInit) => {
      url = u;
      init = i;
      return fakeRes({ json: { choices: [{ message: { content: canned } }] } });
    }));
    await new OpenAIProvider({ apiKey: 'k' }).synthesize(evidence);
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    const body = JSON.parse(init!.body as string);
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.temperature).toBe(0);
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.messages.map((m: { role: string }) => m.role)).toEqual(['system', 'user']);
    expect((init!.headers as Record<string, string>).authorization).toBe('Bearer k');
  });

  it('Ollama request hits /api/chat with stream:false, format:json and no auth header', async () => {
    let init: RequestInit | undefined;
    let url: string | undefined;
    vi.stubGlobal('fetch', vi.fn(async (u: string, i: RequestInit) => {
      url = u;
      init = i;
      return fakeRes({ json: { message: { content: canned } } });
    }));
    await new OllamaProvider().synthesize(evidence);
    expect(url).toBe('http://localhost:11434/api/chat');
    const body = JSON.parse(init!.body as string);
    expect(body.stream).toBe(false);
    expect(body.format).toBe('json');
    expect(body.model).toBe('llama3.1');
    expect(body.messages.map((m: { role: string }) => m.role)).toEqual(['system', 'user']);
    expect((init!.headers as Record<string, string>).authorization).toBeUndefined();
  });

  it('surfaces a non-200 response (status + body) for every provider', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => fakeRes({ ok: false, status: 429, text: 'slow down' })));
    await expect(new AnthropicProvider({ apiKey: 'k' }).synthesize(evidence)).rejects.toThrow(/Anthropic API error 429: slow down/);
    await expect(new OpenAIProvider({ apiKey: 'k' }).synthesize(evidence)).rejects.toThrow(/OpenAI API error 429: slow down/);
    await expect(new OllamaProvider().synthesize(evidence)).rejects.toThrow(/Ollama error 429: slow down/);
  });
});

describe('getProvider factory', () => {
  it('defaults to the zero-key heuristic provider', () => {
    expect(getProvider({}).id).toBe('heuristic');
  });

  it('selects anthropic with a key and the default model', () => {
    const p = getProvider({ LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k' });
    expect(p.id).toBe('anthropic');
    expect(p.model).toBe('claude-opus-4-8');
  });

  it('throws a clear error if anthropic is selected without a key', () => {
    expect(() => getProvider({ LLM_PROVIDER: 'anthropic' })).toThrow(/ANTHROPIC_API_KEY/);
  });

  it('selects ollama without requiring a key', () => {
    expect(getProvider({ LLM_PROVIDER: 'ollama' }).id).toBe('ollama');
  });

  it('applies per-provider default and override models', () => {
    expect(getProvider({ LLM_PROVIDER: 'openai', OPENAI_API_KEY: 'k' }).model).toBe('gpt-4o-mini');
    expect(getProvider({ LLM_PROVIDER: 'openai', OPENAI_API_KEY: 'k', OPENAI_MODEL: 'gpt-4o' }).model).toBe('gpt-4o');
    expect(getProvider({ LLM_PROVIDER: 'ollama' }).model).toBe('llama3.1');
    expect(getProvider({ LLM_PROVIDER: 'ollama', OLLAMA_MODEL: 'mistral' }).model).toBe('mistral');
    expect(getProvider({ LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k', ANTHROPIC_MODEL: 'claude-x' }).model).toBe('claude-x');
  });

  it('throws a clear error if openai is selected without a key', () => {
    expect(() => getProvider({ LLM_PROVIDER: 'openai' })).toThrow(/OPENAI_API_KEY/);
  });

  it('throws on an unknown provider', () => {
    expect(() => getProvider({ LLM_PROVIDER: 'bogus' })).toThrow(/unknown|unsupported/i);
  });
});
