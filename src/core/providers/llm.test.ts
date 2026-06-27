import { describe, it, expect } from 'vitest';
import { buildSynthesisMessages, parseDraftResponse } from './llm.js';
import type { Evidence } from './types.js';

const evidence: Evidence = {
  name: 'Acme Robotics',
  domain: 'acme.example',
  docs: [
    {
      text: 'Acme builds robots. Founded 2019 in Boston.',
      source: { url: 'https://acme.example', title: 'Home', fetchedAt: '2026-06-27T00:00:00.000Z', kind: 'homepage' },
    },
  ],
};

describe('buildSynthesisMessages', () => {
  it('instructs JSON-only output with citation indices', () => {
    const { system } = buildSynthesisMessages(evidence);
    expect(system).toMatch(/JSON/);
    expect(system.toLowerCase()).toMatch(/cit/);
  });
  it('includes the company name and each indexed, sourced document', () => {
    const { user } = buildSynthesisMessages(evidence);
    expect(user).toMatch(/Acme Robotics/);
    expect(user).toMatch(/\[0\]/);
    expect(user).toMatch(/acme\.example/);
    expect(user).toMatch(/Founded 2019/);
  });
});

describe('parseDraftResponse', () => {
  const good = JSON.stringify({
    summary: 'Acme builds robots.',
    facts: [{ label: 'Founded', value: '2019', citations: [0] }],
    funding: [],
    competitors: ['Globex'],
    confidence: 'high',
  });

  it('parses a clean JSON object', () => {
    const d = parseDraftResponse(good, 1);
    expect(d.summary).toBe('Acme builds robots.');
    expect(d.facts[0].label).toBe('Founded');
    expect(d.confidence).toBe('high');
  });

  it('parses JSON wrapped in a ```json code fence', () => {
    const d = parseDraftResponse('Here you go:\n```json\n' + good + '\n```\nDone.', 1);
    expect(d.competitors).toEqual(['Globex']);
  });

  it('drops citations that point beyond the available docs', () => {
    const raw = JSON.stringify({
      summary: 's',
      facts: [{ label: 'X', value: 'y', citations: [0, 7] }],
    });
    const d = parseDraftResponse(raw, 1);
    expect(d.facts[0].citations).toEqual([0]);
  });

  it('defaults missing arrays and confidence', () => {
    const d = parseDraftResponse(JSON.stringify({ summary: 'only summary' }), 1);
    expect(d.facts).toEqual([]);
    expect(d.funding).toEqual([]);
    expect(d.competitors).toEqual([]);
    expect(d.confidence).toBe('medium');
  });

  it('tolerates null for optional fields (LLMs emit null, not undefined)', () => {
    const raw = JSON.stringify({
      summary: 's',
      tagline: null,
      facts: [{ label: 'X', value: 'y', citations: [0] }],
      funding: [{ stage: 'Seed', amount: '$2M', date: null, investors: null, citations: [0] }],
      competitors: ['A', null],
      swot: { strengths: null, weaknesses: [], opportunities: [], threats: [] },
    });
    const d = parseDraftResponse(raw, 1);
    expect(d.tagline).toBeUndefined();
    expect(d.funding[0].date).toBeUndefined();
    expect(d.funding[0].amount).toBe('$2M');
    expect(d.competitors).toEqual(['A']);
    expect(d.swot?.strengths).toEqual([]);
  });

  it('throws when no JSON object is present', () => {
    expect(() => parseDraftResponse('I cannot help with that.', 1)).toThrow();
  });

  it('ignores stray braces in surrounding prose', () => {
    expect(parseDraftResponse('Result {see below}: {"summary":"hi","confidence":"low"}', 1).summary).toBe('hi');
    expect(parseDraftResponse('{"summary":"hi"} Done :}', 1).summary).toBe('hi');
  });

  it('uses the real (last) ```json fence, not an illustrative first one', () => {
    const raw = 'Example:\n```json\n{"summary":"EXAMPLE"}\n```\nActual:\n```json\n{"summary":"REAL"}\n```';
    expect(parseDraftResponse(raw, 1).summary).toBe('REAL');
  });

  it('falls back to scanning raw text when the first fence holds no JSON', () => {
    expect(parseDraftResponse('```python\nprint(1)\n```\n{"summary":"hi","confidence":"low"}', 1).summary).toBe('hi');
    expect(parseDraftResponse('```\n```\nHere: {"summary":"hi"}', 1).summary).toBe('hi');
  });

  it('drops invalid citation entries (negative / float / string) instead of crashing', () => {
    expect(parseDraftResponse(JSON.stringify({ summary: 's', facts: [{ label: 'X', value: 'y', citations: [-1, 0] }] }), 1).facts[0].citations).toEqual([0]);
    expect(parseDraftResponse(JSON.stringify({ summary: 's', facts: [{ label: 'X', value: 'y', citations: [1.5, 0] }] }), 2).facts[0].citations).toEqual([0]);
    expect(parseDraftResponse(JSON.stringify({ summary: 's', facts: [{ label: 'X', value: 'y', citations: ['0', 1] }] }), 2).facts[0].citations).toEqual([1]);
  });

  it('clamps citations at exactly docCount (== docCount is dropped, < is kept)', () => {
    const d = parseDraftResponse(JSON.stringify({ summary: 's', facts: [{ label: 'X', value: 'y', citations: [0, 1, 2] }] }), 2);
    expect(d.facts[0].citations).toEqual([0, 1]);
  });

  it('still throws on a trailing comma (strict JSON — a conscious choice)', () => {
    expect(() => parseDraftResponse('{"summary":"hi","confidence":"low",}', 1)).toThrow();
  });

  it('throws when a required field (fact.label) is null rather than silently dropping the fact', () => {
    expect(() => parseDraftResponse(JSON.stringify({ summary: 's', facts: [{ label: null, value: 'y', citations: [0] }] }), 1)).toThrow();
  });
});

describe('buildSynthesisMessages — multiple docs', () => {
  it('indexes every doc and truncates each at MAX_DOC_CHARS', () => {
    const multi: Evidence = {
      name: 'Acme',
      docs: [
        { text: 'one', source: { url: 'https://one.example', title: 'a', fetchedAt: '2026-06-27T00:00:00.000Z', kind: 'homepage' } },
        { text: 'A'.repeat(6000) + 'ZZZTAIL', source: { url: 'https://two.example', title: 'b', fetchedAt: '2026-06-27T00:00:00.000Z', kind: 'search' } },
      ],
    };
    const { user } = buildSynthesisMessages(multi);
    expect(user).toContain('[1] (search) https://two.example');
    expect(user).not.toContain('ZZZTAIL');
  });
});
