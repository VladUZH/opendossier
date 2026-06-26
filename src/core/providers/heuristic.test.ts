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
