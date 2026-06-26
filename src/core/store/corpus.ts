import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parseProfile, isValidSlug, type CompanyProfile } from '../schema/profile.js';

/** A lightweight summary for directory/search listings (no need to ship the whole profile). */
export interface ProfileSummary {
  slug: string;
  name: string;
  tagline?: string;
  summary: string;
  generatedAt: string;
  generator: CompanyProfile['meta']['generator'];
  confidence: CompanyProfile['meta']['confidence'];
  sourceCount: number;
}

function toSummary(p: CompanyProfile): ProfileSummary {
  return {
    slug: p.slug,
    name: p.name,
    tagline: p.tagline,
    summary: p.summary,
    generatedAt: p.meta.generatedAt,
    generator: p.meta.generator,
    confidence: p.meta.confidence,
    sourceCount: p.sources.length,
  };
}

/**
 * The dossier corpus: a folder of `<slug>.json` files under `<root>/companies`.
 * Plain files on purpose — greppable, diffable, forkable, and trivially exported
 * (the "weekly data dump, no rugpull" property). No database to stand up.
 */
export class Corpus {
  private readonly companiesDir: string;

  constructor(rootDir: string) {
    this.companiesDir = join(rootDir, 'companies');
  }

  private file(slug: string): string {
    // Defense in depth: never let a slug become a traversing path, even if it reached
    // here without going through schema validation.
    if (!isValidSlug(slug)) throw new Error(`invalid slug "${slug}": refusing path traversal`);
    return join(this.companiesDir, `${slug}.json`);
  }

  async save(profile: CompanyProfile): Promise<void> {
    const valid = parseProfile(profile); // throws on invalid — never persist a bad profile
    await mkdir(this.companiesDir, { recursive: true });
    await writeFile(this.file(valid.slug), JSON.stringify(valid, null, 2) + '\n', 'utf8');
  }

  async load(slug: string): Promise<CompanyProfile | null> {
    // An unsafe slug can never name a corpus file: treat it as "not found" and, crucially,
    // never touch the filesystem with it (this is the read-side path-traversal guard).
    if (!isValidSlug(slug)) return null;
    let raw: string;
    try {
      raw = await readFile(this.file(slug), 'utf8');
    } catch (err: any) {
      if (err?.code === 'ENOENT') return null;
      throw err;
    }
    return parseProfile(JSON.parse(raw));
  }

  private async loadAll(): Promise<CompanyProfile[]> {
    let entries: string[];
    try {
      entries = await readdir(this.companiesDir);
    } catch (err: any) {
      if (err?.code === 'ENOENT') return [];
      throw err;
    }
    const slugs = entries.filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
    // One corrupt or schema-invalid file must not take down the whole directory:
    // skip anything that fails to read/parse rather than rejecting the listing.
    const profiles = await Promise.all(slugs.map((s) => this.load(s).catch(() => null)));
    return profiles.filter((p): p is CompanyProfile => p !== null);
  }

  async list(): Promise<ProfileSummary[]> {
    const profiles = await this.loadAll();
    return profiles.map(toSummary).sort((a, b) => a.name.localeCompare(b.name));
  }

  async search(query: string): Promise<ProfileSummary[]> {
    const q = query.trim().toLowerCase();
    if (!q) return this.list();
    const all = await this.list();
    return all.filter((s) =>
      [s.name, s.tagline ?? '', s.summary].some((field) => field.toLowerCase().includes(q)),
    );
  }
}
