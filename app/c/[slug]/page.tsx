import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Corpus } from '../../../src/core/store/corpus.js';
import { dataDir } from '../../../src/core/config.js';
import type { CompanyProfile } from '../../../src/core/schema/profile.js';
import Dossier from '../../_components/Dossier';

export const dynamic = 'force-dynamic';

export default async function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const corpus = new Corpus(dataDir());
  const p: CompanyProfile | null = await corpus.load(slug);
  if (!p) notFound();

  return (
    <main>
      <div className="wrap-narrow">
        <header className="dossier-head">
          <Link href="/" className="filed">
            ‹ Directory
          </Link>
          <h1 className="display">{p.name}</h1>
          {p.domain && (
            <a className="dom" href={`https://${p.domain}`} target="_blank" rel="noreferrer">
              {p.domain} ↗
            </a>
          )}
        </header>
        <Dossier profile={p} />
      </div>
    </main>
  );
}
