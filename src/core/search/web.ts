import { parse } from 'node-html-parser';
import type { SourceKind } from '../schema/profile.js';
import type { FetchedPage, SearchHit, SourceGatherer } from './types.js';

const MAX_PAGE_CHARS = 8000;
const DEFAULT_UA = 'OpenDossier/0.1 (+https://github.com/VladUZH/opendossier)';

export type HttpGet = (url: string) => Promise<string>;

async function defaultHttpGet(url: string, userAgent: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'user-agent': userAgent,
      accept: 'text/html,application/json',
      'accept-language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.text();
}

/** Strip scripts/nav/chrome from an HTML page and return its title + readable text. */
export function extractText(html: string): { title: string; text: string } {
  const root = parse(html);
  const title = root.querySelector('title')?.text.trim() ?? '';
  const metaDesc =
    root.querySelector('meta[name="description"]')?.getAttribute('content') ??
    root.querySelector('meta[property="og:description"]')?.getAttribute('content') ??
    '';

  root
    .querySelectorAll('script, style, noscript, nav, header, footer, svg, form, aside')
    .forEach((n) => n.remove());

  const main =
    root.querySelector('main') ?? root.querySelector('article') ?? root.querySelector('body') ?? root;
  // structuredText inserts line breaks between block elements, so adjacent
  // blocks don't get concatenated into run-on words (e.g. "rely onAnthropic").
  let text = main.structuredText.replace(/\s+/g, ' ').trim();
  if (metaDesc) text = `${metaDesc.trim().replace(/\s+/g, ' ')} ${text}`;
  return { title, text };
}

function decodeDdgHref(href: string): string {
  try {
    const u = new URL(href, 'https://duckduckgo.com');
    const uddg = u.searchParams.get('uddg');
    if (uddg) return decodeURIComponent(uddg);
  } catch {
    /* fall through */
  }
  if (href.startsWith('//')) return `https:${href}`;
  return href;
}

/** Parse the DuckDuckGo HTML endpoint's result list into hits. */
export function parseDuckDuckGoResults(html: string): SearchHit[] {
  const root = parse(html);
  const hits: SearchHit[] = [];
  for (const a of root.querySelectorAll('.result__a')) {
    const href = a.getAttribute('href');
    if (!href) continue;
    const url = decodeDdgHref(href);
    if (!/^https?:\/\//.test(url)) continue;
    const container = a.closest('.result') ?? a.parentNode;
    const snippet = container?.querySelector('.result__snippet')?.text.trim() ?? '';
    hits.push({ url, title: a.text.trim(), snippet });
  }
  return hits;
}

function kindFor(url: string): SourceKind {
  try {
    return /(^|\.)wikipedia\.org$/i.test(new URL(url).hostname) ? 'wikipedia' : 'homepage';
  } catch {
    return 'other';
  }
}

/**
 * Live, no-API-key source gatherer: DuckDuckGo's HTML endpoint for discovery plus
 * Wikipedia's open-search for an authoritative anchor. The transport is injectable,
 * so the parsing logic is unit-tested without any network calls.
 */
export class WebGatherer implements SourceGatherer {
  private httpGet: HttpGet;

  constructor(opts: { httpGet?: HttpGet; userAgent?: string } = {}) {
    const ua = opts.userAgent ?? DEFAULT_UA;
    this.httpGet = opts.httpGet ?? ((url) => defaultHttpGet(url, ua));
  }

  async search(query: string): Promise<SearchHit[]> {
    const hits: SearchHit[] = [];

    try {
      const html = await this.httpGet(
        `https://html.duckduckgo.com/html/?kl=us-en&q=${encodeURIComponent(query)}`,
      );
      hits.push(...parseDuckDuckGoResults(html).slice(0, 8));
    } catch {
      /* search is best-effort */
    }

    try {
      const term = query.replace(/\s+(company|inc\.?|llc)$/i, '');
      const raw = await this.httpGet(
        `https://en.wikipedia.org/w/api.php?action=opensearch&limit=1&namespace=0&format=json&search=${encodeURIComponent(term)}`,
      );
      const data = JSON.parse(raw);
      const url = data?.[3]?.[0];
      if (typeof url === 'string') {
        hits.unshift({ url, title: data?.[1]?.[0] ?? 'Wikipedia', snippet: data?.[2]?.[0] ?? '' });
      }
    } catch {
      /* wikipedia is best-effort */
    }

    const seen = new Set<string>();
    return hits.filter((h) => (seen.has(h.url) ? false : (seen.add(h.url), true)));
  }

  async fetch(url: string): Promise<FetchedPage> {
    const html = await this.httpGet(url);
    const { title, text } = extractText(html);
    return {
      url,
      title: title || url,
      text: text.slice(0, MAX_PAGE_CHARS),
      kind: kindFor(url),
    };
  }
}
