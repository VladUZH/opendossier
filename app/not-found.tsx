import Link from 'next/link';

export default function NotFound() {
  return (
    <main>
      <div className="wrap-narrow" style={{ padding: '90px 28px' }}>
        <span className="kicker">404 · not on file</span>
        <h1 className="display" style={{ fontSize: 'clamp(40px,7vw,72px)', margin: '12px 0 18px' }}>
          No such dossier.
        </h1>
        <p style={{ color: 'var(--ink-soft)', fontSize: 19, maxWidth: '52ch' }}>
          We haven&rsquo;t compiled a file on that one yet. Try the directory, or research it from
          scratch.
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <Link className="btn" href="/research">
            Research a company
          </Link>
          <Link className="btn ghost" href="/">
            Back to directory
          </Link>
        </div>
      </div>
    </main>
  );
}
