import type { NextRequest } from 'next/server';
import { researchCompany } from '../../../src/core/research/pipeline.js';
import { getProvider } from '../../../src/core/providers/index.js';
import { getGatherer } from '../../../src/core/config.js';
import type { SourceGatherer } from '../../../src/core/search/types.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim();
  if (!q) return new Response('missing ?q=', { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      try {
        const provider = getProvider();
        const base = getGatherer();
        send({ type: 'step', msg: `Initializing the ${provider.id} engine…` });

        const gatherer: SourceGatherer = {
          async search(query) {
            send({ type: 'step', msg: `Searching the web for “${q}”…` });
            const hits = await base.search(query);
            send({ type: 'step', msg: `Found ${hits.length} candidate source(s).` });
            return hits;
          },
          async fetch(url) {
            let host = url;
            try {
              host = new URL(url).hostname;
            } catch {
              /* keep url */
            }
            send({ type: 'step', msg: `Reading ${host}…` });
            return base.fetch(url);
          },
        };

        const profile = await researchCompany(q, { provider, gatherer });
        send({
          type: 'step',
          msg: `Compiled ${profile.facts.length} fact(s) from ${profile.sources.length} source(s).`,
        });
        send({ type: 'done', profile });
      } catch (err) {
        send({ type: 'error', msg: err instanceof Error ? err.message : String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-cache' },
  });
}
