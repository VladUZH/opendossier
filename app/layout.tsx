import type { Metadata } from 'next';
import { Instrument_Serif, Newsreader, JetBrains_Mono } from 'next/font/google';
import Link from 'next/link';
import './globals.css';

const display = Instrument_Serif({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});
const serif = Newsreader({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
});
const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

const REPO = 'https://github.com/VladUZH/opendossier';

export const metadata: Metadata = {
  title: 'OpenDossier — open-source AI company research',
  description:
    'Build a sourced dossier on any company. Self-hosted, bring your own LLM, no telemetry. The open-source Crunchbase alternative you run yourself.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${serif.variable} ${mono.variable}`}>
      <body>
        <header className="masthead">
          <div className="wrap masthead-row">
            <Link href="/" className="wordmark">
              OPEN<span className="slash">/</span>DOSSIER
            </Link>
            <nav>
              <Link href="/">Directory</Link>
              <Link href="/research">Research</Link>
              <a href={REPO} target="_blank" rel="noreferrer">
                GitHub
              </a>
              <span className="live">
                <span className="pulse" />
                self-hosted
              </span>
            </nav>
          </div>
        </header>
        {children}
        <footer className="foot">
          <div className="wrap" style={{ display: 'contents' }}>
            <span>OpenDossier · MIT · self-hosted · no telemetry</span>
            <span>
              <a href={REPO} target="_blank" rel="noreferrer">
                source on github
              </a>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
