import { z } from 'zod';
import { SwotSchema } from '../schema/profile.js';
import type { Evidence, ProfileDraft } from './types.js';

const MAX_DOC_CHARS = 6000;

/** The JSON contract we ask any LLM to fill. Lenient: coerces and defaults. */
const DraftResponseSchema = z.object({
  tagline: z.string().optional(),
  summary: z.string().default(''),
  facts: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
        citations: z.array(z.number().int().nonnegative()).default([]),
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
        citations: z.array(z.number().int().nonnegative()).default([]),
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

function extractJson(raw: string): unknown {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1] : raw;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('No JSON object found in model response');
  }
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new Error('Model response was not valid JSON');
  }
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
