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

/**
 * A slug is URL-safe AND path-safe: lowercase alphanumerics in hyphen-separated words,
 * with no slashes, dots, spaces, or `..`. This exactly matches `slugify()`'s output, and —
 * because a slug becomes a filename in the corpus (`<slug>.json`) — enforcing it here is what
 * stops path traversal from an untrusted profile (e.g. a crafted `/api/save` body).
 */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

export const SourceSchema = z.object({
  // Restrict to http(s): a dossier source is something we fetched over the web, and this
  // keeps javascript:/data:/file: URLs out of stored profiles and rendered links.
  url: z
    .string()
    .url()
    .refine((u) => /^https?:\/\//i.test(u), 'source url must be http(s)'),
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
    slug: z
      .string()
      .regex(
        SLUG_PATTERN,
        'slug must be lowercase alphanumeric words separated by single hyphens (no slashes, dots, or spaces)',
      ),
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

/** Turn a company name into a stable, URL-safe, path-safe slug (matches SLUG_PATTERN). */
export function slugify(name: string): string {
  const base = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (base) return base;
  // Names with no ASCII alphanumerics (CJK, Cyrillic, emoji, symbols) would otherwise
  // slugify to '' and crash the pipeline at parseProfile. Fall back to a deterministic
  // short id so every non-empty name yields a stable, schema-valid slug.
  let h = 5381;
  for (let i = 0; i < name.length; i++) h = (Math.imul(h, 33) + name.charCodeAt(i)) >>> 0;
  return `co-${h.toString(36)}`;
}
