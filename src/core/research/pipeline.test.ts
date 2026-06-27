import { describe, it, expect } from 'vitest';
import { researchCompany } from './pipeline.js';
import { HeuristicProvider } from '../providers/heuristic.js';
import type { SourceGatherer, FetchedPage, SearchHit } from '../search/types.js';

const PAGES: Record<string, FetchedPage> = {
  'https://acme.example': {
    url: 'https://acme.example',
    title: 'Acme Robotics',
    kind: 'homepage',
    text: 'Acme Robotics builds warehouse automation robots. Founded in 2019 and headquartered in Boston, Massachusetts, Acme helps fulfillment centers move faster.',
  },
  'https://en.wikipedia.org/wiki/Acme_Robotics': {
    url: 'https://en.wikipedia.org/wiki/Acme_Robotics',
    title: 'Acme Robotics - Wikipedia',
    kind: 'wikipedia',
    text: 'Acme Robotics is an American robotics company. In 2022, Acme raised $80 million in a Series B round led by Globex Ventures. Competitors include Symbotic and Locus Robotics.',
  },
};

function gatherer(overrides: Partial<SourceGatherer> = {}): SourceGatherer {
  return {
    async search(): Promise<SearchHit[]> {
      return [
        { url: 'https://acme.example', title: 'Acme Robotics', snippet: 'robots' },
        { url: 'https://en.wikipedia.org/wiki/Acme_Robotics', title: 'Wikipedia', snippet: 'company' },
      ];
    },
    async fetch(url: string): Promise<FetchedPage> {
      const p = PAGES[url];
      if (!p) throw new Error(`no fixture for ${url}`);
      return p;
    },
    ...overrides,
  };
}

const fixedNow = () => new Date('2026-06-27T12:00:00.000Z');

describe('researchCompany', () => {
  it('produces a valid, slugged, cited profile from gathered sources', async () => {
    const profile = await researchCompany('Acme Robotics', {
      provider: new HeuristicProvider(),
      gatherer: gatherer(),
      now: fixedNow,
    });
    expect(profile.slug).toBe('acme-robotics');
    expect(profile.name).toBe('Acme Robotics');
    expect(profile.sources).toHaveLength(2);
    expect(profile.summary).toMatch(/Acme/);
    const founded = profile.facts.find((f) => f.label === 'Founded');
    expect(founded?.value).toBe('2019');
  });

  it('records provenance and freshness in meta', async () => {
    const profile = await researchCompany('Acme Robotics', {
      provider: new HeuristicProvider(),
      gatherer: gatherer(),
      now: fixedNow,
    });
    expect(profile.meta.generator).toBe('heuristic');
    expect(profile.meta.generatedAt).toBe('2026-06-27T12:00:00.000Z');
    expect(profile.sources[0].fetchedAt).toBe('2026-06-27T12:00:00.000Z');
  });

  it('derives the domain from the non-wikipedia source', async () => {
    const profile = await researchCompany('Acme Robotics', {
      provider: new HeuristicProvider(),
      gatherer: gatherer(),
      now: fixedNow,
    });
    expect(profile.domain).toBe('acme.example');
  });

  it('skips sources that fail to fetch and still builds a profile', async () => {
    const flaky = gatherer({
      async fetch(url: string): Promise<FetchedPage> {
        if (url.includes('wikipedia')) throw new Error('network blip');
        return PAGES[url];
      },
    });
    const profile = await researchCompany('Acme Robotics', {
      provider: new HeuristicProvider(),
      gatherer: flaky,
      now: fixedNow,
    });
    expect(profile.sources).toHaveLength(1);
    expect(profile.sources[0].kind).toBe('homepage');
  });

  it('returns a low-confidence profile (no throw) when nothing could be gathered', async () => {
    const empty = gatherer({
      async search(): Promise<SearchHit[]> {
        return [];
      },
    });
    const profile = await researchCompany('Ghost Co', {
      provider: new HeuristicProvider(),
      gatherer: empty,
      now: fixedNow,
    });
    expect(profile.slug).toBe('ghost-co');
    expect(profile.sources).toHaveLength(0);
    expect(profile.meta.confidence).toBe('low');
    expect(profile.summary).toBe('');
  });

  it('produces a non-empty slug for a non-Latin company name', async () => {
    const empty = gatherer({
      async search(): Promise<SearchHit[]> {
        return [];
      },
    });
    const profile = await researchCompany('日本語', {
      provider: new HeuristicProvider(),
      gatherer: empty,
      now: fixedNow,
    });
    expect(profile.name).toBe('日本語');
    expect(profile.slug.length).toBeGreaterThan(0);
  });

  it('honors maxSources, limiting both fetches and final sources', async () => {
    let fetches = 0;
    const g = gatherer({
      async search(): Promise<SearchHit[]> {
        return [
          { url: 'https://acme.example', title: 'a', snippet: '' },
          { url: 'https://b.example', title: 'b', snippet: '' },
          { url: 'https://c.example', title: 'c', snippet: '' },
          { url: 'https://en.wikipedia.org/wiki/Acme_Robotics', title: 'w', snippet: '' },
        ];
      },
      async fetch(url: string): Promise<FetchedPage> {
        fetches++;
        return { url, title: url, text: 'x.', kind: 'homepage' };
      },
    });
    const profile = await researchCompany('Acme Robotics', {
      provider: new HeuristicProvider(),
      gatherer: g,
      maxSources: 2,
      now: fixedNow,
    });
    expect(fetches).toBe(2);
    expect(profile.sources).toHaveLength(2);
  });

  it('dedups duplicate search URLs before applying maxSources', async () => {
    let fetches = 0;
    const g = gatherer({
      async search(): Promise<SearchHit[]> {
        return [
          { url: 'https://acme.example', title: 'a', snippet: '' },
          { url: 'https://acme.example', title: 'a2', snippet: '' },
          { url: 'https://acme.example', title: 'a3', snippet: '' },
          { url: 'https://en.wikipedia.org/wiki/Acme_Robotics', title: 'w', snippet: '' },
        ];
      },
      async fetch(url: string): Promise<FetchedPage> {
        fetches++;
        return PAGES[url];
      },
    });
    const profile = await researchCompany('Acme Robotics', {
      provider: new HeuristicProvider(),
      gatherer: g,
      maxSources: 2,
      now: fixedNow,
    });
    expect(fetches).toBe(2);
    expect(profile.sources.map((s) => s.url)).toEqual([
      'https://acme.example',
      'https://en.wikipedia.org/wiki/Acme_Robotics',
    ]);
  });

  it('compacts citation indices when a middle source fails to fetch', async () => {
    const g = gatherer({
      async search(): Promise<SearchHit[]> {
        return [
          { url: 'https://acme.example', title: 'h', snippet: '' },
          { url: 'https://mid.example', title: 'm', snippet: '' },
          { url: 'https://en.wikipedia.org/wiki/Acme_Robotics', title: 'w', snippet: '' },
        ];
      },
      async fetch(url: string): Promise<FetchedPage> {
        if (url.includes('mid')) throw new Error('blip');
        return PAGES[url];
      },
    });
    const profile = await researchCompany('Acme Robotics', {
      provider: new HeuristicProvider(),
      gatherer: g,
      now: fixedNow,
    });
    expect(profile.sources.map((s) => s.kind)).toEqual(['homepage', 'wikipedia']);
    const fund = profile.funding[0];
    expect(fund.citations).toEqual([1]);
    expect(profile.sources[fund.citations[0]].kind).toBe('wikipedia');
  });

  it('prefers a non-wikipedia source for the domain even when wikipedia is fetched first', async () => {
    const g = gatherer({
      async search(): Promise<SearchHit[]> {
        return [
          { url: 'https://en.wikipedia.org/wiki/Acme_Robotics', title: 'w', snippet: '' },
          { url: 'https://acme.example', title: 'h', snippet: '' },
        ];
      },
    });
    const profile = await researchCompany('Acme Robotics', {
      provider: new HeuristicProvider(),
      gatherer: g,
      now: fixedNow,
    });
    expect(profile.domain).toBe('acme.example');
    expect(profile.sources[0].kind).toBe('wikipedia');
  });

  it('returns an empty low-confidence profile when every fetch fails', async () => {
    const g = gatherer({
      async fetch(): Promise<FetchedPage> {
        throw new Error('blocked');
      },
    });
    const profile = await researchCompany('Acme Robotics', {
      provider: new HeuristicProvider(),
      gatherer: g,
      now: fixedNow,
    });
    expect(profile.sources).toHaveLength(0);
    expect(profile.summary).toBe('');
    expect(profile.facts).toHaveLength(0);
    expect(profile.meta.confidence).toBe('low');
  });

  it('surfaces a provider synthesis error', async () => {
    const boom = {
      id: 'anthropic' as const,
      async synthesize() {
        throw new Error('model down');
      },
    };
    await expect(
      researchCompany('Acme Robotics', { provider: boom, gatherer: gatherer(), now: fixedNow }),
    ).rejects.toThrow('model down');
  });

  it('drops facts and funding the engine left uncited (every shipped claim is cited)', async () => {
    const mixed = {
      id: 'anthropic' as const,
      async synthesize() {
        return {
          summary: 'x',
          facts: [
            { label: 'Cited', value: 'yes', citations: [0] },
            { label: 'Uncited', value: 'no', citations: [] },
          ],
          funding: [
            { stage: 'Seed', amount: '$1M', citations: [0] },
            { stage: 'A', amount: '$5M', citations: [] },
          ],
          competitors: [],
          confidence: 'low' as const,
        };
      },
    };
    const profile = await researchCompany('Acme Robotics', { provider: mixed, gatherer: gatherer(), now: fixedNow });
    expect(profile.facts.map((f) => f.label)).toEqual(['Cited']);
    expect(profile.funding.map((f) => f.stage)).toEqual(['Seed']);
  });

  it('throws (not silently degrades) when a provider over-cites beyond the sources', async () => {
    const overciter = {
      id: 'anthropic' as const,
      async synthesize() {
        return {
          summary: '',
          facts: [{ label: 'X', value: 'Y', citations: [9] }],
          funding: [],
          competitors: [],
          confidence: 'low' as const,
        };
      },
    };
    await expect(
      researchCompany('Acme Robotics', { provider: overciter, gatherer: gatherer(), now: fixedNow }),
    ).rejects.toThrow(/citation index 9/);
  });
});
