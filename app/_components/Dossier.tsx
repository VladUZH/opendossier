import type { CompanyProfile } from '../../src/core/schema/profile.js';

function Cites({ citations }: { citations: number[] }) {
  if (!citations?.length) return null;
  return (
    <sup className="cite">
      [
      {citations.map((c, i) => (
        <span key={c}>
          {i > 0 && ','}
          <a href={`#src-${c + 1}`}>{c + 1}</a>
        </span>
      ))}
      ]
    </sup>
  );
}

/** Presentational dossier body — works in both server and client trees (no hooks, no I/O). */
export default function Dossier({ profile: p }: { profile: CompanyProfile }) {
  const compiled = p.meta.generatedAt.slice(0, 10);
  return (
    <>
      <div className="dossier-grid">
        <div>
          {p.summary ? (
            <p className="summary firstletter">{p.summary}</p>
          ) : (
            <p className="summary" style={{ color: 'var(--ink-faint)' }}>
              No summary could be compiled from the available sources.
            </p>
          )}

          {p.facts.length > 0 && (
            <div className="block">
              <h2>Key Facts</h2>
              <dl style={{ margin: 0 }}>
                {p.facts.map((f, i) => (
                  <div className="factrow" key={i}>
                    <dt>{f.label}</dt>
                    <dd>
                      {f.value}
                      <Cites citations={f.citations} />
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {p.funding.length > 0 && (
            <div className="block">
              <h2>Funding</h2>
              {p.funding.map((r, i) => (
                <div className="fundrow" key={i}>
                  <span className="stage">{r.stage || 'Round'}</span>
                  <span className="amt">{r.amount || '—'}</span>
                  {r.investors?.length ? (
                    <span style={{ color: 'var(--ink-soft)', fontSize: 15 }}>
                      led by {r.investors.join(', ')}
                    </span>
                  ) : null}
                  <Cites citations={r.citations} />
                </div>
              ))}
            </div>
          )}

          {p.competitors.length > 0 && (
            <div className="block">
              <h2>Competitors</h2>
              <div className="tags">
                {p.competitors.map((c) => (
                  <span className="tag" key={c}>
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          {p.swot && (
            <div className="block">
              <h2>SWOT</h2>
              <div className="swot">
                {(
                  [
                    ['Strengths', p.swot.strengths],
                    ['Weaknesses', p.swot.weaknesses],
                    ['Opportunities', p.swot.opportunities],
                    ['Threats', p.swot.threats],
                  ] as const
                ).map(([label, items]) => (
                  <div key={label}>
                    <h4>{label}</h4>
                    {items.length ? (
                      <ul>
                        {items.map((it, k) => (
                          <li key={k}>{it}</li>
                        ))}
                      </ul>
                    ) : (
                      <span style={{ color: 'var(--ink-faint)', fontSize: 14 }}>—</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {p.meta.notes && <div className="note">{p.meta.notes}</div>}
        </div>

        <aside className="aside">
          {p.domain && (
            <div className="stamp">
              <div className="k">Domain</div>
              <div className="v">{p.domain}</div>
            </div>
          )}
          <div className="stamp">
            <div className="k">Confidence</div>
            <div className="v">
              <span className={`dot ${p.meta.confidence}`} /> {p.meta.confidence}
            </div>
          </div>
          <div className="stamp">
            <div className="k">Compiled by</div>
            <div className="v">{p.meta.generator}</div>
          </div>
          {p.meta.model && (
            <div className="stamp">
              <div className="k">Model</div>
              <div className="v">{p.meta.model}</div>
            </div>
          )}
          <div className="stamp">
            <div className="k">Date filed</div>
            <div className="v">{compiled}</div>
          </div>
          <div className="stamp">
            <div className="k">Sources</div>
            <div className="v">{p.sources.length} cited</div>
          </div>
        </aside>
      </div>

      <div className="block" id="sources">
        <h2>Sources</h2>
        <ol className="sources">
          {p.sources.map((s, i) => (
            <li key={i} id={`src-${i + 1}`}>
              <span className="n">[{i + 1}]</span>
              <span>
                <span className="t">
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.title}
                  </a>
                </span>
                <br />
                <span className="u">{s.url}</span>
              </span>
              <span className="when">
                {s.kind} · {s.fetchedAt.slice(0, 10)}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
