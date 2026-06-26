import { describe, it, expect } from 'vitest';
import { AnthropicProvider, OpenAIProvider, OllamaProvider, getProvider } from './index.js';
import type { Evidence } from './types.js';

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

  it('throws on an unknown provider', () => {
    expect(() => getProvider({ LLM_PROVIDER: 'bogus' })).toThrow(/unknown|unsupported/i);
  });
});
