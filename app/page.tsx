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
          <div className="hero-grid">
            <div className="hero-main">
              <span className="kicker">Open-source company intelligence</span>
              <h1>
                Field-grade <em>dossiers</em> on any company.
              </h1>
              <p className="lede">
                OpenDossier researches the public web and compiles a fully cited profile — funding,
                facts, competitors, sources. Self-hosted, bring your own LLM, zero telemetry. The
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
                  <span>No account · no key needed to browse or run the offline engine</span>
                  <span>{companies.length} on file</span>
                </div>
              </div>
            </div>

            <div className="hero-console" aria-hidden="true">
              <div className="hc-bar">
                <span className="hc-dot" />
                <span className="hc-dot" />
                <span className="hc-dot" />
                <span className="hc-title">opendossier · research</span>
                <span className="hc-live">
                  <span className="pulse" />
                  LIVE
                </span>
              </div>
              <div className="hc-body">
                <div className="hc-line" style={{ animationDelay: '150ms' }}>
                  <span className="tick">▸</span> searching public web…
                </div>
                <div className="hc-line dim" style={{ animationDelay: '360ms' }}>
                  · 8 candidate sources found
                </div>
                <div className="hc-line" style={{ animationDelay: '560ms' }}>
                  <span className="tick">▸</span> reading en.wikipedia.org <span className="cref">[1]</span>
                </div>
                <div className="hc-line" style={{ animationDelay: '780ms' }}>
                  <span className="tick">▸</span> reading anthropic.com <span className="cref">[2]</span>
                </div>
                <div className="hc-line ok" style={{ animationDelay: '1060ms' }}>
                  <span className="ok-mark">✓</span> Founded 2021 <span className="cref">[1]</span> · San
                  Francisco <span className="cref">[2]</span>
                </div>
                <div className="hc-line ok" style={{ animationDelay: '1300ms' }}>
                  <span className="ok-mark">✓</span> Series C · $450M <span className="cref">[2]</span>
                </div>
                <div className="hc-line" style={{ animationDelay: '1540ms' }}>
                  <span className="tick">▸</span> synthesizing dossier…
                  <span className="cursor" />
                </div>
              </div>
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
