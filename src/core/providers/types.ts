import type { Fact, FundingRound, Source, Swot } from '../schema/profile.js';

/** A single gathered source plus its extracted plain text. */
export interface EvidenceDoc {
  source: Source;
  text: string;
}

/**
 * Everything the pipeline gathered about a company, handed to a provider for synthesis.
 * The index of a doc in `docs` IS its citation index in the final profile.
 */
export interface Evidence {
  name: string;
  domain?: string;
  docs: EvidenceDoc[];
}

/** The synthesised body of a dossier (the pipeline adds slug/name/sources/meta around it). */
export interface ProfileDraft {
  tagline?: string;
  summary: string;
  facts: Fact[];
  funding: FundingRound[];
  competitors: string[];
  swot?: Swot;
  confidence: 'low' | 'medium' | 'high';
  notes?: string;
}

/**
 * Pluggable synthesis backend. Swappable by design — that LLM-agnosticism is the
 * core differentiator: bring your own key (Anthropic/OpenAI), run it locally
 * (Ollama), or use the zero-key heuristic. Same interface, your choice.
 */
export interface LLMProvider {
  id: 'heuristic' | 'anthropic' | 'openai' | 'ollama';
  model?: string;
  synthesize(evidence: Evidence): Promise<ProfileDraft>;
}
