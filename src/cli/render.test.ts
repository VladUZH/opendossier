import { describe, it, expect } from 'vitest';
import { renderDossier } from './render.js';
import type { CompanyProfile } from '../core/schema/profile.js';

const profile: CompanyProfile = {
  slug: 'acme-robotics',
  name: 'Acme Robotics',
  domain: 'acme.example',
  tagline: 'Warehouse automation',
  summary: 'Acme Robotics builds warehouse automation robots.',
  facts: [{ label: 'Founded', value: '2019', citations: [0] }],
  funding: [{ stage: 'Series B', amount: '$80 million', citations: [1] }],
  competitors: ['Symbotic', 'Locus Robotics'],
  sources: [
    { url: 'https://acme.example', title: 'Acme', fetchedAt: '2026-06-27T00:00:00.000Z', kind: 'homepage' },
    { url: 'https://en.wikipedia.org/wiki/Acme', title: 'Wikipedia', fetchedAt: '2026-06-27T00:00:00.000Z', kind: 'wikipedia' },
  ],
  meta: { generatedAt: '2026-06-27T00:00:00.000Z', generator: 'heuristic', confidence: 'low' },
};

describe('renderDossier', () => {
  const out = renderDossier(profile, { color: false });

  it('shows the name, summary and competitors', () => {
    expect(out).toMatch(/Acme Robotics/);
    expect(out).toMatch(/builds warehouse automation robots/);
    expect(out).toMatch(/Symbotic/);
  });

  it('renders facts with 1-based citation markers', () => {
    expect(out).toMatch(/Founded.*2019.*\[1\]/);
  });

  it('renders the funding round citing the second source as [2]', () => {
    expect(out).toMatch(/Series B.*\$80 million.*\[2\]/);
  });

  it('lists numbered sources with urls', () => {
    expect(out).toMatch(/\[1\].*acme\.example/);
    expect(out).toMatch(/\[2\].*wikipedia/);
  });

  it('shows provenance (generator and confidence)', () => {
    expect(out).toMatch(/heuristic/);
    expect(out).toMatch(/confidence/i);
  });

  it('renders multi-index citation markers 1-based and comma-joined', () => {
    const p = { ...profile, facts: [{ label: 'Investors', value: 'A,B', citations: [0, 1] }] };
    expect(renderDossier(p, { color: false })).toMatch(/A,B \[1,2\]/);
  });

  it('omits empty sections (no bare headers, no dangling bullets)', () => {
    const minimal: CompanyProfile = {
      slug: 'x',
      name: 'X',
      summary: '',
      facts: [],
      funding: [{ citations: [] }], // schema-valid but all-empty round
      competitors: [],
      sources: [],
      meta: { generatedAt: '2026-06-27T00:00:00.000Z', generator: 'heuristic', confidence: 'low' },
    };
    const min = renderDossier(minimal, { color: false });
    expect(min).not.toMatch(/^Facts$/m);
    expect(min).not.toMatch(/^Funding$/m);
    expect(min).not.toMatch(/^Sources$/m);
    expect(min.split('\n')).not.toContain('  • ');
    expect(min).not.toMatch(/\[1\]/);
  });

  it('strips terminal control/escape sequences from untrusted fields', () => {
    const evil = {
      ...profile,
      facts: [{ label: 'Founded', value: '2019\x1b]0;pwned\x07\x1b[2J', citations: [0] }],
      sources: [{ url: 'https://acme.example', title: 'Acme\x1b[31mRED', fetchedAt: '2026-06-27T00:00:00.000Z', kind: 'homepage' as const }],
    };
    const o = renderDossier(evil, { color: false });
    expect(o).toContain('2019');
    expect(o).not.toContain('\x1b');
    expect(o).not.toContain(']0;pwned');
  });
});
