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
  accept?: (m: RegExpMatchArray) => boolean,
): Fact | null {
  for (let i = 0; i < docs.length; i++) {
    const m = docs[i].text.match(re);
    if (m && (!accept || accept(m)))
      return { label, value: transform(m).trim().replace(/[,.\s]+$/, ''), citations: [i] };
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
      // The raise verb must actually govern the money ("raised $80M"), not merely co-occur
      // with a dollar figure ("raised concerns about the $2B acquisition", "raised prices …
      // makes $5B revenue"). Accept either "rais(e/ed/ing) [determiners] $…" or an explicit
      // funding-stage phrase — but never bare "backed"/"valued" (market-cap/valuation).
      const raiseGovernsMoney =
        /\brais(?:e|ed|ing)\s+(?:(?:a|an|its|the|around|about|approximately|nearly|over|under|some|additional|up to|more than|at least)\s+)*[~]?\$/i;
      const stageContext = /\b(series\s+[a-k]\b|pre-seed|seed round|venture round|funding round)\b/i;
      if (!raiseGovernsMoney.test(s) && !stageContext.test(s)) continue;
      const stage = s.match(stageRe);
      const investor = s.match(investorRe);
      rounds.push({
        amount: amount[0].replace(/\s+/g, ' ').trim().replace(/[.,]+$/, ''),
        ...(stage ? { stage: titleCase(stage[1]) } : {}),
        ...(investor ? { investors: [investor[1].trim()] } : {}),
        citations: [i],
      });
    }
  }
  // The same round is often reported by several sources — collapse identical (stage, amount)
  // rounds to one instead of emitting N copies.
  const seen = new Set<string>();
  return rounds.filter((r) => {
    const key = `${r.stage ?? ''}|${r.amount ?? ''}`;
    return seen.has(key) ? false : (seen.add(key), true);
  });
}

function extractCompetitors(docs: EvidenceDoc[]): string[] {
  const found = new Set<string>();
  const re = /\b(?:competitors?|rivals?|alternatives?)\b[^.]*?\b(?:include|are|:)\s+([^.]+)/gi;
  for (const d of docs) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(d.text))) {
      for (const part of m[1].split(/,|\band\b|&/)) {
        const name = part.replace(/\b(such as|other|various)\b/gi, '').trim();
        // Competitor names are proper nouns: require a leading capital/digit and reject
        // filler/negation phrases ("difficult to identify", "unclear", "none") that the
        // loose "rivals are …" branch otherwise invents.
        const filler = /^(the|a|an|its|their|our|difficult|hard|unclear|unknown|none|tough)\b/i;
        // …and reject investor firms / locations that nearby source text often conflates
        // with competitors (a parenthetical location, or a VC-firm suffix).
        const notCompetitor = /[()]|\b(ventures?|partners?|capital|fund|holdings|gmbh|united states|san francisco|new york|london)\b/i;
        if (name && /^[A-Z0-9]/.test(name) && name.length < 40 && !filler.test(name) && !notCompetitor.test(name))
          found.add(name);
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
      // "launched" intentionally excluded — it mislabels a product/feature launch year as
      // the company's founding ("the iPhone launched in 2007").
      /\b(?:founded|established|est\.?|incorporated)\s+(?:in\s+)?(\d{4})\b/i,
      'Founded',
      (m) => m[1],
      (m) => {
        const y = Number(m[1]);
        return y >= 1600 && y <= 2099; // reject implausible years (e.g. 9999)
      },
    );
    if (founded) facts.push(founded);

    const hq = firstMatchFact(
      docs,
      // Cue words may be capitalized at the start of a sentence; keep the location capture
      // case-sensitive (it must be a proper noun) by spelling the case variants out rather
      // than using the /i flag (which would let the location match lowercase text).
      /\b(?:[Hh]eadquartered in|[Bb]ased in|[Hh]eadquarters (?:in|are in)|[Hh][Qq] in)\s+([A-Z][\w.]*(?:[ ][A-Z][\w.]*)*(?:,\s*[A-Z][\w.]*(?:[ ][A-Z][\w.]*)*)?)/,
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
