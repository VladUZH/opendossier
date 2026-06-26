import { describe, it, expect } from 'vitest';
import {
  parseProfile,
  CompanyProfileSchema,
  slugify,
  type CompanyProfile,
} from './profile.js';

const valid: CompanyProfile = {
  slug: 'acme',
  name: 'Acme',
  domain: 'acme.com',
  tagline: 'We make things',
  summary: 'Acme makes things for people who need things.',
  facts: [{ label: 'Founded', value: '2020', citations: [0] }],
  funding: [{ stage: 'Seed', amount: '$2M', citations: [1] }],
  competitors: ['Globex'],
  swot: { strengths: ['brand'], weaknesses: [], opportunities: [], threats: [] },
  sources: [
    { url: 'https://acme.com', title: 'Acme', fetchedAt: '2026-06-27T00:00:00.000Z', kind: 'homepage' },
    { url: 'https://en.wikipedia.org/wiki/Acme', title: 'Acme - Wikipedia', fetchedAt: '2026-06-27T00:00:00.000Z', kind: 'wikipedia' },
  ],
  meta: {
    generatedAt: '2026-06-27T00:00:00.000Z',
    generator: 'heuristic',
    confidence: 'low',
  },
};

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });
  it('strips punctuation and collapses separators', () => {
    expect(slugify('Acme, Inc. (USA)!')).toBe('acme-inc-usa');
  });
  it('handles ampersands and dots in domains', () => {
    expect(slugify('Ben & Jerry’s')).toBe('ben-jerry-s');
  });
});

describe('parseProfile', () => {
  it('accepts a valid profile', () => {
    const p = parseProfile(valid);
    expect(p.name).toBe('Acme');
    expect(p.sources).toHaveLength(2);
  });

  it('rejects a profile missing name', () => {
    const bad = { ...valid, name: undefined };
    expect(() => parseProfile(bad)).toThrow();
  });

  it('rejects a fact citing a source index that does not exist', () => {
    const bad = { ...valid, facts: [{ label: 'Founded', value: '2020', citations: [99] }] };
    expect(() => parseProfile(bad)).toThrow(/citation/i);
  });

  it('rejects a funding round citing an out-of-range source', () => {
    const bad = { ...valid, funding: [{ stage: 'Seed', amount: '$2M', citations: [5] }] };
    expect(() => parseProfile(bad)).toThrow(/citation/i);
  });

  it('allows empty facts/funding/competitors', () => {
    const minimal = { ...valid, facts: [], funding: [], competitors: [], swot: undefined };
    expect(() => parseProfile(minimal)).not.toThrow();
  });

  it('exposes a usable zod schema', () => {
    expect(CompanyProfileSchema.safeParse(valid).success).toBe(true);
  });
});
