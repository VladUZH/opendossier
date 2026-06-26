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
  it('strips diacritics (NFKD) and normalizes ligatures/fullwidth', () => {
    expect(slugify('Nestlé')).toBe('nestle');
    expect(slugify('café Münchën')).toBe('cafe-munchen');
  });
  it('produces a non-empty, schema-valid slug for all-non-ASCII names', () => {
    for (const n of ['世界', 'Москва', '株式会社', '🚀', '   ']) {
      const s = slugify(n);
      expect(s.length).toBeGreaterThan(0);
      expect(() => parseProfile({ ...valid, slug: s })).not.toThrow();
    }
  });
  it('is deterministic for the same input', () => {
    expect(slugify('世界')).toBe(slugify('世界'));
  });
});

describe('slug validation (path-traversal hardening)', () => {
  it('rejects a slug containing path separators', () => {
    expect(() => parseProfile({ ...valid, slug: '../../etc/passwd' })).toThrow(/slug/i);
  });
  it('rejects a bare parent-directory slug', () => {
    expect(() => parseProfile({ ...valid, slug: '..' })).toThrow(/slug/i);
  });
  it('rejects a slug with spaces or uppercase', () => {
    expect(() => parseProfile({ ...valid, slug: 'Acme Corp' })).toThrow(/slug/i);
  });
  it('rejects leading/trailing or doubled hyphens', () => {
    expect(() => parseProfile({ ...valid, slug: '-acme' })).toThrow(/slug/i);
    expect(() => parseProfile({ ...valid, slug: 'acme--corp' })).toThrow(/slug/i);
  });
  it('accepts a normal slugified slug', () => {
    expect(() => parseProfile({ ...valid, slug: 'acme-robotics-2' })).not.toThrow();
  });
  it('slugify always produces a schema-valid slug for real names', () => {
    for (const n of ['Acme, Inc.', 'Ben & Jerry’s', '37signals', 'Y Combinator!!!']) {
      expect(() => parseProfile({ ...valid, slug: slugify(n) })).not.toThrow();
    }
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

  it('enforces the citation boundary exactly (index === sources.length is out of range)', () => {
    const n = valid.sources.length;
    expect(() => parseProfile({ ...valid, facts: [{ label: 'F', value: 'v', citations: [n] }] })).toThrow(/citation/i);
    expect(() => parseProfile({ ...valid, facts: [{ label: 'F', value: 'v', citations: [n - 1] }] })).not.toThrow();
    expect(() =>
      parseProfile({ ...valid, sources: [], funding: [], facts: [{ label: 'F', value: 'v', citations: [0] }] }),
    ).toThrow(/citation/i);
  });

  it('rejects negative citation indices', () => {
    expect(() => parseProfile({ ...valid, facts: [{ label: 'F', value: 'v', citations: [-1] }] })).toThrow();
    expect(() => parseProfile({ ...valid, funding: [{ stage: 'Seed', citations: [-1] }] })).toThrow();
  });

  it('rejects a non-http(s) source url', () => {
    const bad = { ...valid, sources: [{ ...valid.sources[0], url: 'javascript:alert(1)' }, valid.sources[1]] };
    expect(() => parseProfile(bad)).toThrow();
    const file = { ...valid, sources: [{ ...valid.sources[0], url: 'file:///etc/passwd' }, valid.sources[1]] };
    expect(() => parseProfile(file)).toThrow();
  });

  it('exposes a usable zod schema', () => {
    expect(CompanyProfileSchema.safeParse(valid).success).toBe(true);
  });
});
