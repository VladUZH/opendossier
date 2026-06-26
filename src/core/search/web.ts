import { parse } from 'node-html-parser';
import type { SourceKind } from '../schema/profile.js';
import type { FetchedPage, SearchHit, SourceGatherer } from './types.js';

const MAX_PAGE_CHARS = 8000;
const MAX_REDIRECTS = 5;
const DEFAULT_UA = 'OpenDossier/0.1 (+https://github.com/VladUZH/opendossier)';

export type HttpGet = (url: string) => Promise<string>;

function isPrivateIPv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  return (
    a === 0 || // 0.0.0.0/8
    a === 10 || // private
    a === 127 || // loopback
    (a === 169 && b === 254) || // link-local + cloud metadata (169.254.169.254)
    (a === 172 && b >= 16 && b <= 31) || // private
    (a === 192 && b === 168) || // private
    (a === 100 && b >= 64 && b <= 127) // CGNAT
  );
}

/**
 * SSRF guard. The pipeline fetches URLs discovered from web search results, which an
 * attacker can influence; without this an internal/cloud-metadata address (e.g.
 * 169.254.169.254) or a `file:`/`gopher:` URL could be fetched. Returns the parsed URL
 * for non-internal http(s) targets and throws otherwise. Applied to the initial URL and,
 * crucially, re-applied to every redirect hop. (DNS-rebinding is out of scope for a
 * no-dependency tool; this blocks literal internal hostnames, IP-literals, and bad schemes.)
 */
export function assertFetchableUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error(`invalid URL: ${raw}`);
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error(`refusing non-http(s) URL: ${raw}`);
  }
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const blocked = host.includes(':')
    ? host === '::1' ||
      host === '::' ||
      host.startsWith('fc') ||
      host.startsWith('fd') ||
      host.startsWith('fe80') // IPv6 loopback / unique-local / link-local
    : host === 'localhost' ||
      host.endsWith('.localhost') ||
      host.endsWith('.internal') ||
      host === 'metadata.google.internal' ||
      isPrivateIPv4(host);
  if (blocked) throw new Error(`refusing to fetch internal/loopback address: ${host}`);
  return u;
}

async function defaultHttpGet(url: string, userAgent: string): Promise<string> {
  let current = assertFetchableUrl(url).toString();
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(current, {
      headers: {
        'user-agent': userAgent,
        accept: 'text/html,application/json',
        'accept-language': 'en-US,en;q=0.9',
      },
      // Follow redirects manually so each hop is re-checked by the SSRF guard — a 30x to
      // an internal address would otherwise bypass the initial check.
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
    });
    const location = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
    if (location) {
      current = assertFetchableUrl(new URL(location, current).toString()).toString();
      continue;
    }
    if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
    return res.text();
  }
  throw new Error(`too many redirects fetching ${url}`);
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
    // searchParams.get() already percent-decodes once; decoding again corrupts URLs that
    // contain encoded characters and throws (leaking the DDG wrapper) on a literal '%'.
    if (uddg) return uddg;
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
      // Apply the same scheme gate the DDG path enforces — never surface a non-http(s) URL.
      if (typeof url === 'string' && /^https?:\/\//.test(url)) {
        hits.unshift({ url, title: data?.[1]?.[0] ?? 'Wikipedia', snippet: data?.[2]?.[0] ?? '' });
      }
    } catch {
      /* wikipedia is best-effort */
    }

    const seen = new Set<string>();
    return hits.filter((h) => (seen.has(h.url) ? false : (seen.add(h.url), true)));
  }

  async fetch(url: string): Promise<FetchedPage> {
    assertFetchableUrl(url); // SSRF guard before the transport is ever touched
    const html = await this.httpGet(url);
    const { title, text } = extractText(html);
    return {
      url,
      title: (title || url).slice(0, MAX_PAGE_CHARS), // bound the title like the body
      text: text.slice(0, MAX_PAGE_CHARS),
      kind: kindFor(url),
    };
  }
}
