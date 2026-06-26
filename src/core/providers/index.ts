import { buildSynthesisMessages, parseDraftResponse } from './llm.js';
import { HeuristicProvider } from './heuristic.js';
import type { Evidence, LLMProvider, ProfileDraft } from './types.js';

export type { Evidence, EvidenceDoc, LLMProvider, ProfileDraft } from './types.js';
export { HeuristicProvider } from './heuristic.js';

/** A pluggable transport: turn (system, user) into raw model text. Injectable for tests. */
export type CompleteFn = (system: string, user: string) => Promise<string>;

const DEFAULT_MAX_TOKENS = 4096;

async function synthesizeWith(complete: CompleteFn, evidence: Evidence): Promise<ProfileDraft> {
  const { system, user } = buildSynthesisMessages(evidence);
  return parseDraftResponse(await complete(system, user), evidence.docs.length);
}

/**
 * Anthropic (Claude). Uses raw fetch to keep the provider layer dependency-light and
 * symmetric with the other backends. Note: temperature/top_p/top_k are intentionally
 * NOT sent — they are rejected by current Claude models (Opus 4.8/4.7).
 */
export class AnthropicProvider implements LLMProvider {
  readonly id = 'anthropic' as const;
  readonly model: string;
  private apiKey: string;
  private complete: CompleteFn;

  constructor(opts: { apiKey: string; model?: string; complete?: CompleteFn }) {
    this.apiKey = opts.apiKey;
    this.model = opts.model || 'claude-opus-4-8';
    this.complete = opts.complete || ((s, u) => this.call(s, u));
  }

  private async call(system: string, user: string): Promise<string> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: DEFAULT_MAX_TOKENS,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`);
    const data: any = await res.json();
    return (data.content || [])
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('');
  }

  synthesize(evidence: Evidence): Promise<ProfileDraft> {
    return synthesizeWith(this.complete, evidence);
  }
}

/** OpenAI (and OpenAI-compatible) chat completions. */
export class OpenAIProvider implements LLMProvider {
  readonly id = 'openai' as const;
  readonly model: string;
  private apiKey: string;
  private baseUrl: string;
  private complete: CompleteFn;

  constructor(opts: { apiKey: string; model?: string; baseUrl?: string; complete?: CompleteFn }) {
    this.apiKey = opts.apiKey;
    this.model = opts.model || 'gpt-4o-mini';
    this.baseUrl = opts.baseUrl || 'https://api.openai.com/v1';
    this.complete = opts.complete || ((s, u) => this.call(s, u));
  }

  private async call(system: string, user: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) throw new Error(`OpenAI API error ${res.status}: ${await res.text()}`);
    const data: any = await res.json();
    return data.choices?.[0]?.message?.content || '';
  }

  synthesize(evidence: Evidence): Promise<ProfileDraft> {
    return synthesizeWith(this.complete, evidence);
  }
}

/** Ollama — a local model server. Free, private, no API key. */
export class OllamaProvider implements LLMProvider {
  readonly id = 'ollama' as const;
  readonly model: string;
  private baseUrl: string;
  private complete: CompleteFn;

  constructor(opts: { model?: string; baseUrl?: string; complete?: CompleteFn } = {}) {
    this.model = opts.model || 'llama3.1';
    this.baseUrl = opts.baseUrl || 'http://localhost:11434';
    this.complete = opts.complete || ((s, u) => this.call(s, u));
  }

  private async call(system: string, user: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        stream: false,
        format: 'json',
      }),
    });
    if (!res.ok) throw new Error(`Ollama error ${res.status}: ${await res.text()}`);
    const data: any = await res.json();
    return data.message?.content || '';
  }

  synthesize(evidence: Evidence): Promise<ProfileDraft> {
    return synthesizeWith(this.complete, evidence);
  }
}

/**
 * Resolve the configured provider. Defaults to the zero-key heuristic so a fresh
 * clone works with no setup. Cloud providers are an explicit opt-in via LLM_PROVIDER.
 */
export function getProvider(env: Record<string, string | undefined> = process.env): LLMProvider {
  const which = (env.LLM_PROVIDER || 'heuristic').toLowerCase();
  switch (which) {
    case 'heuristic':
      return new HeuristicProvider();
    case 'anthropic': {
      if (!env.ANTHROPIC_API_KEY) {
        throw new Error(
          'LLM_PROVIDER=anthropic requires ANTHROPIC_API_KEY. Set it in .env.local, ' +
            'or use LLM_PROVIDER=heuristic (no key) or LLM_PROVIDER=ollama (local).',
        );
      }
      return new AnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY, model: env.ANTHROPIC_MODEL });
    }
    case 'openai': {
      if (!env.OPENAI_API_KEY) {
        throw new Error(
          'LLM_PROVIDER=openai requires OPENAI_API_KEY. Set it in .env.local, ' +
            'or use LLM_PROVIDER=heuristic (no key) or LLM_PROVIDER=ollama (local).',
        );
      }
      return new OpenAIProvider({
        apiKey: env.OPENAI_API_KEY,
        model: env.OPENAI_MODEL,
        baseUrl: env.OPENAI_BASE_URL,
      });
    }
    case 'ollama':
      return new OllamaProvider({ model: env.OLLAMA_MODEL, baseUrl: env.OLLAMA_BASE_URL });
    default:
      throw new Error(
        `Unknown LLM_PROVIDER "${which}" (expected: heuristic | anthropic | openai | ollama)`,
      );
  }
}
