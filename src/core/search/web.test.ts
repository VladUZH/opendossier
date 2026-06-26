import { describe, it, expect } from 'vitest';
import { extractText, parseDuckDuckGoResults, WebGatherer } from './web.js';

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
