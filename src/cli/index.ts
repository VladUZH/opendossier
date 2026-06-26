#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { researchCompany } from '../core/research/pipeline.js';
import { getProvider } from '../core/providers/index.js';
import { getGatherer, dataDir } from '../core/config.js';
import { Corpus } from '../core/store/corpus.js';
import type { SourceGatherer } from '../core/search/types.js';
import { renderDossier } from './render.js';

/** Minimal .env loader (no dependency): load .env.local then .env without overriding real env. */
function loadEnv(): void {
  for (const file of ['.env.local', '.env']) {
    try {
      const text = readFileSync(join(process.cwd(), file), 'utf8');
      for (const line of text.split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
        if (m && !(m[1] in process.env)) {
          process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
        }
      }
    } catch {
      /* file optional */
    }
  }
}

function usage(): never {
  process.stderr.write(
    `OpenDossier — open-source AI company research\n\n` +
      `Usage:\n` +
      `  npm run research -- "<company name>" [--save] [--json] [--no-color]\n\n` +
      `Flags:\n` +
      `  --save       write the dossier into the local corpus (data/companies/)\n` +
      `  --json       print raw JSON instead of a formatted report\n` +
      `  --no-color   disable ANSI colors\n\n` +
      `Provider is selected by LLM_PROVIDER (default: heuristic, no key required).\n`,
  );
  process.exit(1);
}

/** Wrap a gatherer to print live progress to stderr (keeps stdout clean for piping). */
function withProgress(base: SourceGatherer): SourceGatherer {
  return {
    async search(q) {
      process.stderr.write(`  · searching the web…\n`);
      const hits = await base.search(q);
      process.stderr.write(`  · found ${hits.length} candidate source(s)\n`);
      return hits;
    },
    async fetch(url) {
      let host = url;
      try {
        host = new URL(url).hostname;
      } catch {
        /* keep url */
      }
      process.stderr.write(`  · reading ${host}…\n`);
      return base.fetch(url);
    },
  };
}

async function main(): Promise<void> {
  loadEnv();
  let args = process.argv.slice(2);
  // Allow both `opendossier research "X"` and `npm run research -- "X"` (npm eats "research").
  if (args[0] === 'research') args = args.slice(1);

  const flags = new Set(args.filter((a) => a.startsWith('--')));
  const name = args.filter((a) => !a.startsWith('--')).join(' ').trim();
  if (!name) usage();

  const provider = getProvider();
  const gatherer = withProgress(getGatherer());

  process.stderr.write(`\n🔎 Researching “${name}” (provider: ${provider.id})\n`);
  const profile = await researchCompany(name, { provider, gatherer });
  process.stderr.write(`  · synthesizing dossier…\n\n`);

  if (flags.has('--json')) {
    process.stdout.write(JSON.stringify(profile, null, 2) + '\n');
  } else {
    process.stdout.write(renderDossier(profile, { color: !flags.has('--no-color') }) + '\n');
  }

  if (flags.has('--save')) {
    const corpus = new Corpus(dataDir());
    await corpus.save(profile);
    process.stderr.write(`\n✔ saved to ${join(dataDir(), 'companies', profile.slug + '.json')}\n`);
  }
}

main().catch((err) => {
  process.stderr.write(`\n✖ ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
