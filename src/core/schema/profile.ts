import { z } from 'zod';

/**
 * The central data structure: a company "dossier".
 *
 * Design goals that make OpenDossier different from a closed research SaaS:
 *  - Every factual claim cites a numbered entry in `sources` (no orphan claims).
 *  - `sources[].fetchedAt` + `meta.generatedAt` make freshness explicit.
 *  - `meta.generator` records HOW it was produced (no-key heuristic vs a real LLM),
 *    so readers can judge confidence instead of trusting a black box.
 *  - It serialises to a single JSON file — a greppable, forkable corpus, not a locked DB.
 */

export const SourceKindSchema = z.enum(['homepage', 'wikipedia', 'search', 'other']);
export type SourceKind = z.infer<typeof SourceKindSchema>;

export const SourceSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  fetchedAt: z.string().datetime(),
  kind: SourceKindSchema,
});

export const FactSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  /** Indices into the profile's `sources` array. */
  citations: z.array(z.number().int().nonnegative()).default([]),
});

export const FundingRoundSchema = z.object({
  stage: z.string().optional(),
  amount: z.string().optional(),
  date: z.string().optional(),
  investors: z.array(z.string()).optional(),
  citations: z.array(z.number().int().nonnegative()).default([]),
});

export const SwotSchema = z.object({
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  opportunities: z.array(z.string()).default([]),
  threats: z.array(z.string()).default([]),
});

export const ProfileMetaSchema = z.object({
  generatedAt: z.string().datetime(),
  generator: z.enum(['heuristic', 'anthropic', 'openai', 'ollama']),
  model: z.string().optional(),
  confidence: z.enum(['low', 'medium', 'high']),
  notes: z.string().optional(),
});

export const CompanyProfileSchema = z
  .object({
    slug: z.string().min(1),
    name: z.string().min(1),
    domain: z.string().optional(),
    tagline: z.string().optional(),
    summary: z.string().default(''),
    facts: z.array(FactSchema).default([]),
    funding: z.array(FundingRoundSchema).default([]),
    competitors: z.array(z.string()).default([]),
    swot: SwotSchema.optional(),
    sources: z.array(SourceSchema).default([]),
    meta: ProfileMetaSchema,
  })
  .superRefine((p, ctx) => {
    const max = p.sources.length;
    const check = (cites: number[], where: string) => {
      for (const c of cites) {
        if (c >= max) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${where} references citation index ${c}, but there are only ${max} sources`,
          });
        }
      }
    };
    p.facts.forEach((f, i) => check(f.citations, `facts[${i}] (${f.label})`));
    p.funding.forEach((f, i) => check(f.citations, `funding[${i}]`));
  });

export type Source = z.infer<typeof SourceSchema>;
export type Fact = z.infer<typeof FactSchema>;
export type FundingRound = z.infer<typeof FundingRoundSchema>;
export type Swot = z.infer<typeof SwotSchema>;
export type ProfileMeta = z.infer<typeof ProfileMetaSchema>;
export type CompanyProfile = z.infer<typeof CompanyProfileSchema>;

/** Parse and validate untrusted data into a CompanyProfile (throws on invalid). */
export function parseProfile(data: unknown): CompanyProfile {
  return CompanyProfileSchema.parse(data);
}

/** Turn a company name into a stable, URL-safe slug. */
export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
