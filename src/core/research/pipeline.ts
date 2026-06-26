import { parseProfile, slugify, type CompanyProfile } from '../schema/profile.js';
import type { Evidence, EvidenceDoc, LLMProvider } from '../providers/types.js';
import type { SourceGatherer } from '../search/types.js';

export interface ResearchDeps {
  provider: LLMProvider;
  gatherer: SourceGatherer;
  /** Max web sources to fetch per company (default 5). */
  maxSources?: number;
  /** Injectable clock for deterministic timestamps. */
  now?: () => Date;
}

function hostname(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

/**
 * The research pipeline: discover sources → fetch them → synthesize a cited dossier.
 * Every dependency (web access, the LLM) is injected, so the whole thing runs
 * deterministically in tests and swaps transports/models without code changes.
 */
export async function researchCompany(name: string, deps: ResearchDeps): Promise<CompanyProfile> {
  const { provider, gatherer } = deps;
  const maxSources = deps.maxSources ?? 5;
  const fetchedAt = (deps.now ?? (() => new Date()))().toISOString();

  // 1. Discover candidate sources.
  let hits: { url: string }[] = [];
  try {
    hits = await gatherer.search(`${name} company`);
  } catch {
    hits = [];
  }
  const urls = [...new Set(hits.map((h) => h.url))].slice(0, maxSources);

  // 2. Fetch each, tolerating individual failures.
  const settled = await Promise.allSettled(urls.map((u) => gatherer.fetch(u)));
  const pages = settled
    .filter((s): s is PromiseFulfilledResult<Awaited<ReturnType<SourceGatherer['fetch']>>> =>
      s.status === 'fulfilled',
    )
    .map((s) => s.value);

  // 3. Assemble evidence (doc order === citation index === final source order).
  const docs: EvidenceDoc[] = pages.map((p) => ({
    source: { url: p.url, title: p.title, fetchedAt, kind: p.kind },
    text: p.text,
  }));
  const primary = pages.find((p) => p.kind !== 'wikipedia') ?? pages[0];
  const domain = primary ? hostname(primary.url) : undefined;
  const evidence: Evidence = { name, domain, docs };

  // 4. Synthesize (LLM or heuristic — same interface).
  const draft = await provider.synthesize(evidence);

  // 5. Assemble + validate the dossier.
  const profile: CompanyProfile = {
    slug: slugify(name),
    name,
    domain,
    tagline: draft.tagline,
    summary: draft.summary,
    facts: draft.facts,
    funding: draft.funding,
    competitors: draft.competitors,
    swot: draft.swot,
    sources: docs.map((d) => d.source),
    meta: {
      generatedAt: fetchedAt,
      generator: provider.id,
      model: provider.model,
      confidence: draft.confidence,
      notes: draft.notes,
    },
  };
  return parseProfile(profile);
}
