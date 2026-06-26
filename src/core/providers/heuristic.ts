import type { Fact, FundingRound } from '../schema/profile.js';
import type { Evidence, EvidenceDoc, LLMProvider, ProfileDraft } from './types.js';

const HEURISTIC_NOTE =
  'Generated offline by the no-LLM heuristic extractor — facts are pattern-matched ' +
  'from the cited sources and may be incomplete. Configure an LLM provider ' +
  '(Anthropic, OpenAI or a local Ollama model) for richer, fuller synthesis.';

function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Rank docs so we summarise from the most authoritative narrative source first. */
function docPriority(d: EvidenceDoc): number {
  if (d.source.kind === 'homepage') return 0;
  if (d.source.kind === 'wikipedia') return 1;
  return 2;
}

function extractSummary(docs: EvidenceDoc[]): string {
  const ranked = [...docs].sort((a, b) => docPriority(a) - docPriority(b));
  for (const d of ranked) {
    const ss = sentences(d.text);
    if (ss.length === 0) continue;
    let out = ss[0];
    if (ss[1] && out.length < 160) out += ' ' + ss[1];
    return out.slice(0, 320);
  }
  return '';
}

function firstMatchFact(
  docs: EvidenceDoc[],
  re: RegExp,
  label: string,
  transform: (m: RegExpMatchArray) => string,
): Fact | null {
  for (let i = 0; i < docs.length; i++) {
    const m = docs[i].text.match(re);
    if (m) return { label, value: transform(m).trim().replace(/[,.\s]+$/, ''), citations: [i] };
  }
  return null;
}

function extractFunding(docs: EvidenceDoc[]): FundingRound[] {
  const rounds: FundingRound[] = [];
  const amountRe = /\$\s?\d[\d,.]*\s*(?:billion|million|trillion|bn|m|k)?/i;
  const stageRe = /\b(pre-seed|seed|angel|series\s+[a-k]|ipo)\b/i;
  const investorRe = /led by\s+([A-Z][\w.&' ]+?)(?:[.,;]|\s+and\b|$)/;
  for (let i = 0; i < docs.length; i++) {
    for (const s of sentences(docs[i].text)) {
      const amount = s.match(amountRe);
      if (!amount) continue;
      // Require an actual raise verb or funding stage — not loose words like
      // "backed" or "valued", which match market-cap/valuation sentences too.
      if (!/\b(rais(e|ed|ing)|series\s+[a-k]\b|pre-seed|seed round|venture round|funding round)\b/i.test(s))
        continue;
      const stage = s.match(stageRe);
      const investor = s.match(investorRe);
      rounds.push({
        amount: amount[0].replace(/\s+/g, ' ').trim(),
        ...(stage ? { stage: titleCase(stage[1]) } : {}),
        ...(investor ? { investors: [investor[1].trim()] } : {}),
        citations: [i],
      });
    }
  }
  return rounds;
}

function extractCompetitors(docs: EvidenceDoc[]): string[] {
  const found = new Set<string>();
  const re = /\b(?:competitors?|rivals?|alternatives?)\b[^.]*?\b(?:include|are|:)\s+([^.]+)/gi;
  for (const d of docs) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(d.text))) {
      for (const part of m[1].split(/,|\band\b|&/)) {
        const name = part.replace(/\b(such as|other|various)\b/gi, '').trim();
        if (name && /[A-Za-z]/.test(name) && name.length < 40) found.add(name);
      }
    }
  }
  return [...found];
}

function titleCase(s: string): string {
  return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

/**
 * Zero-key synthesis backend. It does NOT call any model — it pattern-matches
 * the gathered sources. Honest, deterministic, offline, and the default so a
 * fresh clone is genuinely useful before anyone pastes an API key.
 */
export class HeuristicProvider implements LLMProvider {
  readonly id = 'heuristic' as const;

  async synthesize(evidence: Evidence): Promise<ProfileDraft> {
    const docs = evidence.docs;
    const facts: Fact[] = [];

    const founded = firstMatchFact(
      docs,
      /\b(?:founded|established|est\.?|launched|incorporated)\s+(?:in\s+)?(\d{4})\b/i,
      'Founded',
      (m) => m[1],
    );
    if (founded) facts.push(founded);

    const hq = firstMatchFact(
      docs,
      /\b(?:headquartered in|based in|headquarters (?:in|are in)|hq in)\s+([A-Z][\w.]*(?:[ ][A-Z][\w.]*)*(?:,\s*[A-Z][\w.]*(?:[ ][A-Z][\w.]*)*)?)/,
      'Headquarters',
      (m) => m[1],
    );
    if (hq) facts.push(hq);

    const employees = firstMatchFact(
      docs,
      /\b([\d,]+(?:\+|\s*(?:to|–|-)\s*[\d,]+)?)\s+employees\b/i,
      'Employees',
      (m) => m[1],
    );
    if (employees) facts.push(employees);

    return {
      summary: extractSummary(docs),
      facts,
      funding: extractFunding(docs),
      competitors: extractCompetitors(docs),
      confidence: 'low',
      notes: HEURISTIC_NOTE,
    };
  }
}
