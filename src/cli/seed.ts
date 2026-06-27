#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { researchCompany } from '../core/research/pipeline.js';
import { getProvider } from '../core/providers/index.js';
import { getGatherer, dataDir } from '../core/config.js';
import { Corpus } from '../core/store/corpus.js';

function loadEnv(): void {
  for (const file of ['.env.local', '.env']) {
    try {
      for (const line of readFileSync(join(process.cwd(), file), 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
        if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    } catch {
      /* optional */
    }
  }
}

/** A curated set of well-known companies to seed the directory so a fresh clone
 *  is browsable with zero configuration. Re-run with an LLM provider set to enrich. */
const COMPANIES = [
  'Anthropic',
  'OpenAI',
  'Stripe',
  'Vercel',
  'Linear',
  'Supabase',
  'Hugging Face',
  'Notion',
  'Figma',
  'Cloudflare',
  'Ramp',
  'Plausible Analytics',
  'Railway',
  'Perplexity AI',
  'Replicate',
];

async function main(): Promise<void> {
  loadEnv();
  const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const names = only.length ? only : COMPANIES;
  const provider = getProvider();
  const gatherer = getGatherer();
  const corpus = new Corpus(dataDir());

  process.stderr.write(`Seeding ${names.length} companies with provider "${provider.id}"…\n`);
  let ok = 0;
  for (const name of names) {
    try {
      const profile = await researchCompany(name, { provider, gatherer });
      await corpus.save(profile);
      ok++;
      process.stderr.write(
        `  ✔ ${name} → ${profile.facts.length} facts, ${profile.sources.length} sources\n`,
      );
    } catch (err) {
      process.stderr.write(`  ✖ ${name}: ${err instanceof Error ? err.message : String(err)}\n`);
    }
  }
  process.stderr.write(`Done: ${ok}/${names.length} saved to ${join(dataDir(), 'companies')}\n`);
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
