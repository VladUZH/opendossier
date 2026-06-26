import type { NextRequest } from 'next/server';
import { Corpus } from '../../../src/core/store/corpus.js';
import { dataDir } from '../../../src/core/config.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const corpus = new Corpus(dataDir());
    await corpus.save(body.profile); // validates via schema; throws on invalid
    return Response.json({ ok: true, slug: body.profile.slug });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}
