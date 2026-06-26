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
});
