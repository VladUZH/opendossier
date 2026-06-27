import { z } from 'zod';
import { SwotSchema } from '../schema/profile.js';
import type { Evidence, ProfileDraft } from './types.js';

const MAX_DOC_CHARS = 6000;

/** Models emit messy citation arrays (floats, strings, negatives). Keep only the valid
 *  non-negative integers and drop the rest, rather than discarding the whole response. */
const CitationsSchema = z
  .array(z.unknown())
  .default([])
  .transform((arr) => arr.filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0));

/** The JSON contract we ask any LLM to fill. Lenient: coerces and defaults. */
const DraftResponseSchema = z.object({
  tagline: z.string().optional(),
  summary: z.string().default(''),
  facts: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
        citations: CitationsSchema,
      }),
    )
    .default([]),
  funding: z
    .array(
      z.object({
        stage: z.string().optional(),
        amount: z.string().optional(),
        date: z.string().optional(),
        investors: z.array(z.string()).optional(),
        citations: CitationsSchema,
      }),
    )
    .default([]),
  competitors: z.array(z.string()).default([]),
  swot: SwotSchema.optional(),
  confidence: z.enum(['low', 'medium', 'high']).default('medium'),
  notes: z.string().optional(),
});

export function buildSynthesisMessages(evidence: Evidence): { system: string; user: string } {
  const system = [
    'You are a meticulous company-research analyst building a factual dossier.',
    'You will be given numbered source documents. Using ONLY those sources, produce a company profile.',
    'Return ONLY a single JSON object (no prose, no markdown fences) with this shape:',
    '{ "tagline": string, "summary": string, "facts": [{ "label": string, "value": string, "citations": number[] }],',
    '  "funding": [{ "stage"?: string, "amount"?: string, "date"?: string, "investors"?: string[], "citations": number[] }],',
    '  "competitors": string[], "swot": { "strengths": string[], "weaknesses": string[], "opportunities": string[], "threats": string[] },',
    '  "confidence": "low" | "medium" | "high" }',
    'Every fact and funding round MUST include `citations`: the 0-based indices of the source documents that support it.',
    'Do not invent facts. If a source does not support a claim, omit it. Prefer recent, specific, verifiable details.',
  ].join('\n');

  const docs = evidence.docs
    .map((d, i) => `[${i}] (${d.source.kind}) ${d.source.url}\n${d.text.slice(0, MAX_DOC_CHARS)}`)
    .join('\n\n');

  const user =
    `Company: ${evidence.name}` +
    (evidence.domain ? `\nDomain: ${evidence.domain}` : '') +
    `\n\nSOURCES:\n${docs}\n\nProduce the JSON dossier now.`;

  return { system, user };
}

/** Scan text for top-level balanced `{...}` objects, respecting string literals/escapes. */
function balancedObjects(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = -1;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}' && depth > 0) {
      if (--depth === 0 && start >= 0) {
        out.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return out;
}

/**
 * Extract the model's JSON object, tolerating surrounding prose, stray braces, and
 * illustrative code fences. Prefers the LAST ```json fence (the real answer usually
 * follows an example), then falls back to scanning the whole response — so a brace in
 * the prose or an example block can't shadow or break the real object.
 */
function extractJson(raw: string): unknown {
  const fences = [...raw.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map((m) => m[1]);
  const candidates = [...fences.reverse(), raw];
  for (const cand of candidates) {
    for (const obj of balancedObjects(cand)) {
      try {
        const parsed = JSON.parse(obj);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
      } catch {
        /* not valid JSON — try the next balanced candidate */
      }
    }
  }
  throw new Error('No JSON object found in model response');
}

/** LLMs emit `null` for "no value"; our optional fields expect absence. Recursively
 *  drop null object keys and null array elements so defaults/optionals apply cleanly. */
function stripNulls(v: unknown): unknown {
  if (Array.isArray(v)) return v.filter((x) => x !== null).map(stripNulls);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) {
      if (val !== null) out[k] = stripNulls(val);
    }
    return out;
  }
  return v;
}

/** Parse + validate a model response into a ProfileDraft, dropping invalid citations. */
export function parseDraftResponse(raw: string, docCount: number): ProfileDraft {
  const parsed = DraftResponseSchema.parse(stripNulls(extractJson(raw)));
  const clamp = (cites: number[]) => cites.filter((c) => c < docCount);
  return {
    ...parsed,
    facts: parsed.facts.map((f) => ({ ...f, citations: clamp(f.citations) })),
    funding: parsed.funding.map((f) => ({ ...f, citations: clamp(f.citations) })),
  };
}
