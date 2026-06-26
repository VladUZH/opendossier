import Link from 'next/link';
import { Corpus } from '../src/core/store/corpus.js';
import { dataDir } from '../src/core/config.js';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const corpus = new Corpus(dataDir());
  const companies = await corpus.list();

  return (
    <main>
      <section className="hero">
        <div className="wrap">
          <span className="kicker">Open-source company intelligence</span>
          <h1>
            Build a sourced <em>dossier</em> on any company.
          </h1>
          <p className="lede">
            OpenDossier researches the public web and compiles a cited company profile — funding,
            facts, competitors, the works. Self-hosted, bring your own LLM, no telemetry. The
            Crunchbase alternative you actually run yourself.
          </p>

          <div className="searchcard">
            <form action="/research" method="get">
              <input
                type="text"
                name="q"
                placeholder="Research a company — e.g. Anthropic, Stripe, Linear…"
                aria-label="Company name"
                autoComplete="off"
              />
              <button type="submit">Compile ›</button>
            </form>
            <div className="hint">
              <span>No account · no API key required to browse or run the offline engine</span>
              <span>{companies.length} companies on file</span>
            </div>
          </div>
        </div>
      </section>

      <div className="wrap">
        <div className="sec-head">
          <h2>The Directory</h2>
          <span className="count">{companies.length} dossiers</span>
        </div>

        <div className="grid">
          {companies.map((c, i) => (
            <Link
              key={c.slug}
              href={`/c/${c.slug}`}
              className="card reveal"
              style={{ animationDelay: `${Math.min(i * 35, 500)}ms` }}
            >
              <div className="idx">№ {String(i + 1).padStart(2, '0')}</div>
              <h3>{c.name}</h3>
              {c.tagline && <div className="dom">{c.tagline}</div>}
              <p className="blurb">{c.summary || 'No summary yet.'}</p>
              <div className="meta">
                <span>{c.sourceCount} sources</span>
                <span>·</span>
                <span>{c.generator}</span>
                <span>·</span>
                <span className="conf">
                  <span className={`dot ${c.confidence}`} /> {c.confidence}
                </span>
              </div>
            </Link>
          ))}
        </div>

        {companies.length === 0 && (
          <p className="note">
            The directory is empty. Run <code className="mono">npm run seed</code> to populate it, or
            research a company above.
          </p>
        )}
      </div>
    </main>
  );
}
