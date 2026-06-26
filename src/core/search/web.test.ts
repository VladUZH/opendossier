import { describe, it, expect } from 'vitest';
import { extractText, parseDuckDuckGoResults, WebGatherer, assertFetchableUrl } from './web.js';

const PAGE_HTML = `<!doctype html><html><head>
  <title>Acme Robotics</title>
  <meta name="description" content="Acme builds warehouse robots.">
</head><body>
  <script>var x=1; console.log('SECRET_SCRIPT_TOKEN')</script>
  <nav>Home About Careers</nav>
  <main><h1>Acme Robotics</h1><p>Founded in 2019 in Boston, Massachusetts.</p></main>
  <footer>© Acme 2026</footer>
</body></html>`;

const DDG_HTML = `<div class="result">
  <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Facme.example%2F&rut=abc">Acme Robotics</a>
  <a class="result__snippet">Acme builds warehouse robots.</a>
</div>
<div class="result">
  <a class="result__a" href="https://en.wikipedia.org/wiki/Acme_Robotics">Acme Robotics - Wikipedia</a>
  <a class="result__snippet">An American robotics company.</a>
</div>`;

describe('extractText', () => {
  it('handles empty / head-only / script-only HTML without throwing', () => {
    expect(extractText('')).toEqual({ title: '', text: '' });
    expect(extractText('<html><head></head></html>')).toEqual({ title: '', text: '' });
    const only = extractText('<html><body><script>var s="SECRET_TOKEN"</script></body></html>');
    expect(only.text).toBe('');
    expect(only.text).not.toMatch(/SECRET_TOKEN/);
  });
  it('pulls the title and visible text, dropping scripts/nav/footer', () => {
    const { title, text } = extractText(PAGE_HTML);
    expect(title).toBe('Acme Robotics');
    expect(text).toMatch(/Founded in 2019 in Boston/);
    expect(text).not.toMatch(/SECRET_SCRIPT_TOKEN/);
    expect(text).not.toMatch(/Careers/);
  });
  it('includes the meta description as a lead', () => {
    const { text } = extractText(PAGE_HTML);
    expect(text).toMatch(/Acme builds warehouse robots/);
  });
});

describe('parseDuckDuckGoResults', () => {
  it('decodes redirect hrefs and pairs titles with snippets', () => {
    const hits = parseDuckDuckGoResults(DDG_HTML);
    expect(hits).toHaveLength(2);
    expect(hits[0]).toEqual({
      url: 'https://acme.example/',
      title: 'Acme Robotics',
      snippet: 'Acme builds warehouse robots.',
    });
    expect(hits[1].url).toBe('https://en.wikipedia.org/wiki/Acme_Robotics');
  });

  it('decodes the uddg param exactly once and never leaks the DDG redirect URL', () => {
    const corrupt = parseDuckDuckGoResults(
      '<a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fpath%2520x">T</a>',
    );
    expect(corrupt[0].url).toBe('https://example.com/path%20x');
    const literalPct = parseDuckDuckGoResults(
      '<a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2F%25">T</a>',
    );
    expect(literalPct[0].url).not.toMatch(/duckduckgo\.com/);
    expect(literalPct[0].url).toBe('https://example.com/%');
  });

  it('drops result anchors whose decoded href is not http(s)', () => {
    const html =
      '<a class="result__a" href="javascript:alert(1)">a</a>' +
      '<a class="result__a" href="mailto:x@y.com">b</a>' +
      '<a class="result__a" href="/relative/path">c</a>' +
      '<a class="result__a" href="ftp://h/f">d</a>' +
      '<a class="result__a" href="data:text/html,hi">e</a>';
    expect(parseDuckDuckGoResults(html)).toHaveLength(0);
  });
});

describe('assertFetchableUrl (SSRF guard)', () => {
  it('rejects internal, loopback, link-local, metadata and non-http(s) targets', () => {
    for (const u of [
      'http://169.254.169.254/latest/meta-data/',
      'http://localhost:8080/',
      'http://127.0.0.1/',
      'http://[::1]/',
      'http://10.0.0.5/',
      'http://192.168.1.1/',
      'http://172.16.3.4/',
      'http://metadata.google.internal/',
      'http://api.internal/',
      'file:///etc/passwd',
      'gopher://x/',
    ]) {
      expect(() => assertFetchableUrl(u), u).toThrow();
    }
  });
  it('allows ordinary public http(s) URLs', () => {
    expect(assertFetchableUrl('https://example.com/x').hostname).toBe('example.com');
    expect(assertFetchableUrl('http://acme.example/').protocol).toBe('http:');
    // a hostname that merely starts with fc/fd is not an IPv6 address and must be allowed
    expect(() => assertFetchableUrl('https://fc-barcelona.com/')).not.toThrow();
  });
});

describe('WebGatherer (injected transport)', () => {
  it('fetch() extracts a page and classifies wikipedia vs homepage', async () => {
    const g = new WebGatherer({ httpGet: async () => PAGE_HTML });
    const home = await g.fetch('https://acme.example');
    expect(home.kind).toBe('homepage');
    expect(home.title).toBe('Acme Robotics');
    expect(home.text).toMatch(/Founded in 2019/);

    const wiki = await g.fetch('https://en.wikipedia.org/wiki/Acme_Robotics');
    expect(wiki.kind).toBe('wikipedia');
  });

  it('fetch() refuses internal/metadata/non-http targets without touching the transport', async () => {
    let transportCalls = 0;
    const g = new WebGatherer({
      httpGet: async () => {
        transportCalls++;
        return '<html></html>';
      },
    });
    for (const u of [
      'http://169.254.169.254/latest/meta-data/',
      'http://localhost:8080/',
      'http://127.0.0.1/',
      'http://[::1]/',
      'http://10.0.0.5/',
      'http://192.168.1.1/',
      'file:///etc/passwd',
    ]) {
      await expect(g.fetch(u)).rejects.toThrow();
    }
    expect(transportCalls).toBe(0);
  });

  it('fetch() bounds the page title length', async () => {
    const huge = 'A'.repeat(50000);
    const g = new WebGatherer({
      httpGet: async () => `<html><head><title>${huge}</title></head><body><main>x</main></body></html>`,
    });
    const page = await g.fetch('https://acme.example');
    expect(page.title.length).toBeLessThanOrEqual(8000);
  });

  it('search() survives malformed/empty Wikipedia responses and never surfaces a non-http(s) hit', async () => {
    const g = new WebGatherer({
      httpGet: async (url) => (url.includes('api.php') ? 'NOT JSON {' : DDG_HTML),
    });
    const hits = await g.search('Acme Robotics company');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.url === 'https://acme.example/')).toBe(true);

    const wikiJson = JSON.stringify(['Acme', ['Acme'], ['desc'], ['javascript:alert(1)']]);
    const g2 = new WebGatherer({
      httpGet: async (url) => (url.includes('api.php') ? wikiJson : DDG_HTML),
    });
    const hits2 = await g2.search('Acme Robotics company');
    expect(hits2.every((h) => /^https?:\/\//.test(h.url))).toBe(true);
  });

  it('search() merges DuckDuckGo results with the top Wikipedia match, deduped', async () => {
    const wikiJson = JSON.stringify([
      'Acme Robotics',
      ['Acme Robotics'],
      ['An American robotics company'],
      ['https://en.wikipedia.org/wiki/Acme_Robotics'],
    ]);
    const httpGet = async (url: string) =>
      url.includes('api.php') ? wikiJson : DDG_HTML;
    const g = new WebGatherer({ httpGet });
    const hits = await g.search('Acme Robotics company');
    const urls = hits.map((h) => h.url);
    // wikipedia top match present and not duplicated despite also being in DDG results
    expect(urls.filter((u) => u.includes('wikipedia')).length).toBe(1);
    expect(urls).toContain('https://acme.example/');
  });
});
