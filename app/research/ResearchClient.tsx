'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Dossier from '../_components/Dossier';
import type { CompanyProfile } from '../../src/core/schema/profile.js';

export default function ResearchClient({ initialQuery }: { initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<string[]>([]);
  const [result, setResult] = useState<CompanyProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedSlug, setSavedSlug] = useState<string | null>(null);
  const startedFor = useRef<string | null>(null);

  const run = useCallback(async (name: string) => {
    const q = name.trim();
    if (!q || startedFor.current === q) return;
    startedFor.current = q;
    setRunning(true);
    setSteps([]);
    setResult(null);
    setError(null);
    setSavedSlug(null);
    try {
      const res = await fetch(`/api/research?q=${encodeURIComponent(q)}`);
      if (!res.body) throw new Error('no response stream');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const obj = JSON.parse(line);
          if (obj.type === 'step') setSteps((s) => [...s, obj.msg]);
          else if (obj.type === 'done') setResult(obj.profile);
          else if (obj.type === 'error') setError(obj.msg);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    if (initialQuery) run(initialQuery);
  }, [initialQuery, run]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startedFor.current = null;
    run(query);
  };

  const save = async () => {
    if (!result) return;
    const res = await fetch('/api/save', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profile: result }),
    });
    const data = await res.json();
    if (data.ok) setSavedSlug(data.slug);
    else setError(data.error || 'save failed');
  };

  return (
    <main>
      <div className="wrap-narrow">
        <header className="dossier-head" style={{ borderBottom: 'none', paddingBottom: 8 }}>
          <span className="filed">Research desk</span>
          <h1 className="display" style={{ fontSize: 'clamp(36px,6vw,60px)' }}>
            Compile a dossier
          </h1>
        </header>

        <div className="searchcard" style={{ marginTop: 8 }}>
          <form onSubmit={onSubmit}>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Company name — e.g. Anthropic, Stripe, Linear…"
              aria-label="Company name"
              autoComplete="off"
              disabled={running}
            />
            <button type="submit" disabled={running}>
              {running ? 'Working…' : 'Compile ›'}
            </button>
          </form>
          <div className="hint">
            <span>Runs the configured engine over live public sources.</span>
            <span>no telemetry</span>
          </div>
        </div>

        {!running && steps.length === 0 && !result && !error && (
          <div className="examples">
            <span>try</span>
            {['Anthropic', 'Stripe', 'Linear', 'Figma', 'Vercel'].map((name) => (
              <button
                key={name}
                type="button"
                className="example-chip"
                onClick={() => {
                  setQuery(name);
                  startedFor.current = null;
                  run(name);
                }}
              >
                {name}
              </button>
            ))}
          </div>
        )}

        {(running || steps.length > 0) && (
          <div className="console" aria-live="polite">
            {steps.map((s, i) => (
              <div className="step" key={i} style={{ animationDelay: `${i * 20}ms` }}>
                <span className="tick">▸</span> {s}
              </div>
            ))}
            {running && (
              <div>
                <span className="cursor" />
              </div>
            )}
          </div>
        )}

        {error && <div className="note">⚠ {error}</div>}

        {result && (
          <div style={{ marginTop: 30 }}>
            <header className="dossier-head">
              <h1 className="display">{result.name}</h1>
              {result.domain && (
                <a className="dom" href={`https://${result.domain}`} target="_blank" rel="noreferrer">
                  {result.domain} ↗
                </a>
              )}
            </header>
            <Dossier profile={result} />
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
              {savedSlug ? (
                <Link className="btn" href={`/c/${savedSlug}`}>
                  Saved ✓ — view in directory ›
                </Link>
              ) : (
                <button className="btn" onClick={save}>
                  Save to directory
                </button>
              )}
              <Link className="btn ghost" href="/">
                Back to directory
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
