import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Corpus } from './corpus.js';
import type { CompanyProfile } from '../schema/profile.js';

function makeProfile(name: string, slug: string, summary = 'A company.'): CompanyProfile {
  return {
    slug,
    name,
    tagline: `${name} tagline`,
    summary,
    facts: [],
    funding: [],
    competitors: [],
    sources: [
      { url: 'https://x.example', title: 'x', fetchedAt: '2026-06-27T00:00:00.000Z', kind: 'homepage' },
    ],
    meta: { generatedAt: '2026-06-27T00:00:00.000Z', generator: 'heuristic', confidence: 'low' },
  };
}

describe('Corpus', () => {
  let dir: string;
  let corpus: Corpus;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'opendossier-'));
    corpus = new Corpus(dir);
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('round-trips a profile through save and load', async () => {
    const p = makeProfile('Acme Robotics', 'acme-robotics');
    await corpus.save(p);
    const loaded = await corpus.load('acme-robotics');
    expect(loaded?.name).toBe('Acme Robotics');
    expect(loaded?.sources).toHaveLength(1);
  });

  it('returns null when loading a missing slug', async () => {
    expect(await corpus.load('does-not-exist')).toBeNull();
  });

  it('refuses to save an invalid profile', async () => {
    const bad = { ...makeProfile('Bad', 'bad'), name: '' };
    await expect(corpus.save(bad as CompanyProfile)).rejects.toThrow();
  });

  it('lists saved profiles as summaries sorted by name', async () => {
    await corpus.save(makeProfile('Zeta', 'zeta'));
    await corpus.save(makeProfile('Alpha', 'alpha'));
    const list = await corpus.list();
    expect(list.map((s) => s.name)).toEqual(['Alpha', 'Zeta']);
    expect(list[0]).toMatchObject({ slug: 'alpha', generator: 'heuristic', sourceCount: 1 });
  });

  it('searches by name, tagline and summary case-insensitively', async () => {
    await corpus.save(makeProfile('Acme Robotics', 'acme-robotics', 'Builds warehouse robots.'));
    await corpus.save(makeProfile('Globex', 'globex', 'Makes widgets.'));
    expect((await corpus.search('robot')).map((s) => s.slug)).toEqual(['acme-robotics']);
    expect((await corpus.search('GLOBEX')).map((s) => s.slug)).toEqual(['globex']);
    expect((await corpus.search('warehouse')).map((s) => s.slug)).toEqual(['acme-robotics']);
    expect(await corpus.search('nothingmatches')).toEqual([]);
  });

  it('refuses to save a profile whose slug escapes the corpus directory', async () => {
    const evil = makeProfile('Evil', '../escape');
    await expect(corpus.save(evil)).rejects.toThrow(/slug/i);
    // …and nothing was written one level up, outside companies/
    await expect(access(join(dir, 'escape.json'))).rejects.toThrow();
  });

  it('does not read JSON files outside the corpus via a traversing slug', async () => {
    // Plant a valid profile one level above companies/ — a `../secret` slug would reach it.
    await writeFile(join(dir, 'secret.json'), JSON.stringify(makeProfile('Secret', 'secret')), 'utf8');
    expect(await corpus.load('../secret')).toBeNull();
    expect(await corpus.load('../../../../etc/hostname')).toBeNull();
  });

  it('overwrites an existing profile on re-save', async () => {
    await corpus.save(makeProfile('Acme', 'acme', 'old'));
    await corpus.save(makeProfile('Acme', 'acme', 'new summary'));
    const loaded = await corpus.load('acme');
    expect(loaded?.summary).toBe('new summary');
    expect((await corpus.list())).toHaveLength(1);
  });

  it('skips a single malformed/invalid .json file instead of breaking the whole listing', async () => {
    await corpus.save(makeProfile('Good', 'good'));
    await writeFile(join(dir, 'companies', 'broken.json'), '{ not valid json', 'utf8');
    await writeFile(join(dir, 'companies', 'invalid.json'), '{}', 'utf8');
    expect((await corpus.list()).map((s) => s.slug)).toEqual(['good']);
    expect((await corpus.search('good')).map((s) => s.slug)).toEqual(['good']);
  });

  it('treats a whitespace-only search query as "list all"', async () => {
    await corpus.save(makeProfile('A', 'a'));
    await corpus.save(makeProfile('B', 'b'));
    expect((await corpus.search('   ')).map((s) => s.slug)).toEqual(['a', 'b']);
    expect((await corpus.search('\t\n')).map((s) => s.slug)).toEqual(['a', 'b']);
  });

  it('sorts the listing case-insensitively', async () => {
    await corpus.save(makeProfile('Banana', 'banana'));
    await corpus.save(makeProfile('apple', 'apple'));
    expect((await corpus.list()).map((s) => s.name)).toEqual(['apple', 'Banana']);
  });
});
