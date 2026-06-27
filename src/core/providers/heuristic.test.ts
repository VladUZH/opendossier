import { describe, it, expect } from 'vitest';
import { HeuristicProvider } from './heuristic.js';
import type { Evidence } from './types.js';

function ev(docs: { text: string; url: string; kind?: any }[]): Evidence {
  return {
    name: 'Acme Robotics',
    domain: 'acme.example',
    docs: docs.map((d) => ({
      text: d.text,
      source: {
        url: d.url,
        title: 'src',
        fetchedAt: '2026-06-27T00:00:00.000Z',
        kind: d.kind ?? 'other',
      },
    })),
  };
}

const evidence = ev([
  {
    url: 'https://acme.example',
    kind: 'homepage',
    text: 'Acme Robotics builds warehouse automation robots. Founded in 2019 and headquartered in Boston, Massachusetts, Acme helps fulfillment centers move faster.',
  },
  {
    url: 'https://en.wikipedia.org/wiki/Acme_Robotics',
    kind: 'wikipedia',
    text: 'Acme Robotics is an American robotics company. In 2022, Acme raised $80 million in a Series B round led by Globex Ventures. Competitors include Symbotic and Locus Robotics.',
  },
]);

describe('HeuristicProvider', () => {
  it('identifies as the zero-key heuristic backend', () => {
    expect(new HeuristicProvider().id).toBe('heuristic');
  });

  it('extracts a non-empty summary mentioning the company', async () => {
    const d = await new HeuristicProvider().synthesize(evidence);
    expect(d.summary.length).toBeGreaterThan(0);
    expect(d.summary).toMatch(/Acme/);
  });

  it('extracts the founding year cited to the homepage', async () => {
    const d = await new HeuristicProvider().synthesize(evidence);
    const founded = d.facts.find((f) => f.label === 'Founded');
    expect(founded?.value).toBe('2019');
    expect(founded?.citations).toContain(0);
  });

  it('extracts headquarters cited to the homepage', async () => {
    const d = await new HeuristicProvider().synthesize(evidence);
    const hq = d.facts.find((f) => f.label === 'Headquarters');
    expect(hq?.value).toMatch(/Boston/);
    expect(hq?.citations).toContain(0);
  });

  it('extracts a funding round with amount and stage cited to wikipedia', async () => {
    const d = await new HeuristicProvider().synthesize(evidence);
    expect(d.funding.length).toBeGreaterThan(0);
    const round = d.funding[0];
    expect(round.amount).toMatch(/\$80 million/i);
    expect(round.stage).toMatch(/Series B/i);
    expect(round.citations).toContain(1);
  });

  it('extracts competitors from an "include" list', async () => {
    const d = await new HeuristicProvider().synthesize(evidence);
    expect(d.competitors).toContain('Symbotic');
    expect(d.competitors).toContain('Locus Robotics');
  });

  it('extracts headquarters when the cue is capitalized at the start of a sentence', async () => {
    const e = ev([
      { url: 'https://x.example', kind: 'homepage', text: 'Headquartered in Boston, Massachusetts, the company builds robots.' },
    ]);
    const d = await new HeuristicProvider().synthesize(e);
    expect(d.facts.find((f) => f.label === 'Headquarters')?.value).toMatch(/Boston/);
  });

  it('does not treat "raised concerns/prices" near a dollar figure as funding', async () => {
    const e = ev([
      { url: 'https://a.example', text: 'Critics raised concerns about the $2 billion acquisition.' },
      { url: 'https://b.example', text: 'The company raised prices this year and now makes $5 billion in annual revenue.' },
    ]);
    const d = await new HeuristicProvider().synthesize(e);
    expect(d.funding).toHaveLength(0);
  });

  it('deduplicates an identical funding round reported by multiple sources', async () => {
    const e = ev([
      { url: 'https://a.example', text: 'Acme raised $80 million in a Series B round.' },
      { url: 'https://b.example', text: 'Acme raised $80 million in a Series B round.' },
    ]);
    const d = await new HeuristicProvider().synthesize(e);
    expect(d.funding).toHaveLength(1);
  });

  it('strips trailing punctuation from a funding amount', async () => {
    const e = ev([{ url: 'https://x.example', text: 'In 2021 the startup raised $5,000,000.' }]);
    const d = await new HeuristicProvider().synthesize(e);
    expect(d.funding[0].amount).toBe('$5,000,000');
  });

  it('rejects an implausible founding year', async () => {
    const e = ev([{ url: 'https://x.example', text: 'Acme was founded in 9999.' }]);
    const d = await new HeuristicProvider().synthesize(e);
    expect(d.facts.find((f) => f.label === 'Founded')).toBeUndefined();
  });

  it('does not treat a product launch year as the founding year', async () => {
    const e = ev([{ url: 'https://x.example', text: 'The iPhone launched in 2007 to great acclaim.' }]);
    const d = await new HeuristicProvider().synthesize(e);
    expect(d.facts.find((f) => f.label === 'Founded')).toBeUndefined();
  });

  it('does not invent competitors from filler/negation phrases', async () => {
    const e = ev([{ url: 'https://x.example', text: 'Its rivals are difficult to identify.' }]);
    const d = await new HeuristicProvider().synthesize(e);
    expect(d.competitors).toHaveLength(0);
  });

  it('excludes investor firms and locations the source conflates with competitors', async () => {
    const e = ev([
      { url: 'https://x.example', text: 'Competitors include Netlify, San Francisco (United States), and Bessemer Venture Partners.' },
    ]);
    const d = await new HeuristicProvider().synthesize(e);
    expect(d.competitors).toContain('Netlify');
    expect(d.competitors).not.toContain('San Francisco (United States)');
    expect(d.competitors.some((c) => /Partners/.test(c))).toBe(false);
  });

  it('extracts an employee count cited to its source', async () => {
    const e = ev([{ url: 'https://x.example', text: 'The firm has 10,000+ employees worldwide.' }]);
    const d = await new HeuristicProvider().synthesize(e);
    const emp = d.facts.find((f) => f.label === 'Employees');
    expect(emp?.value).toBe('10,000+');
    expect(emp?.citations).toEqual([0]);
  });

  it('does not treat a bare valuation/market-cap figure as a funding round', async () => {
    const e = ev([
      {
        url: 'https://x.example',
        text: 'The company is backed by major investors and is reportedly valued at $965 billion in 2026.',
      },
    ]);
    const d = await new HeuristicProvider().synthesize(e);
    expect(d.funding).toHaveLength(0);
  });

  it('marks confidence low and explains it ran without an LLM', async () => {
    const d = await new HeuristicProvider().synthesize(evidence);
    expect(d.confidence).toBe('low');
    expect(d.notes).toMatch(/heuristic|without an LLM|offline/i);
  });

  it('never emits a citation index beyond the available docs', async () => {
    const d = await new HeuristicProvider().synthesize(evidence);
    const all = [...d.facts.flatMap((f) => f.citations), ...d.funding.flatMap((f) => f.citations)];
    for (const c of all) expect(c).toBeLessThan(evidence.docs.length);
  });

  it('handles empty evidence without throwing', async () => {
    const empty: Evidence = { name: 'Nobody', docs: [] };
    const d = await new HeuristicProvider().synthesize(empty);
    expect(d.confidence).toBe('low');
    expect(d.notes).toBeTruthy();
  });
});
