# Contributing to OpenDossier

Thanks for being here. OpenDossier is meant to be a small, readable, honest codebase — easy to understand in an afternoon and easy to extend. Issues, ideas, and PRs are all welcome.

## Dev setup

```bash
git clone https://github.com/VladUZH/opendossier
cd opendossier
npm install
npm run dev        # http://localhost:3000 — zero config, no API key
```

```bash
npm test           # vitest — deterministic, no network, no keys
npm run typecheck  # tsc --noEmit
npm run build      # production build
```

No API key is needed to develop or run the tests. The default engine (`heuristic`) and the web gatherer (DuckDuckGo + Wikipedia) need no credentials.

## How it's laid out

```
src/core/        framework-agnostic engine (used by the CLI and the web app)
  schema/        the CompanyProfile zod schema + slug rules
  providers/     LLM abstraction — heuristic (no key), anthropic, openai, ollama
  search/        SourceGatherer — the web fetcher (+ SSRF guard)
  research/      researchCompany(): gather → synthesize → cited dossier
  store/         the file corpus (data/companies/<slug>.json)
src/cli/         `npm run research` and `npm run seed`
app/             Next.js (App Router) — directory, profile, streaming /research
```

## The one hard rule: tests stay deterministic

Every external dependency — the LLM, the web, the clock, the filesystem root — is **injected**, so the whole suite runs with no network and no keys. New code should keep that property:

- Provider transports take an injectable `complete` fn; the gatherer takes an injectable `httpGet`; `researchCompany` takes `{ provider, gatherer, now }`.
- Write the test first, watch it fail, then make it pass. No network or real keys in tests.

## Good places to start

A few roadmap items that are self-contained and well-scoped:

- **A new search provider** behind `SourceGatherer` (Brave, Tavily, SerpAPI) selected via `SEARCH_PROVIDER` — the interface is tiny.
- **Export** a dossier to CSV / Markdown from the CLI.
- **Local-model reports**: run the Ollama path against a model and share whether the JSON + citations held up (open an issue with results).
- **A new fact extractor** in the heuristic engine (with a fixture test).
- **More seed companies** (`npm run seed -- "Name"`).

Check the [issues](https://github.com/VladUZH/opendossier/issues) and the README roadmap, or open one to discuss before a big change.

## Conventions

- TypeScript strict. ESM with `.js` import specifiers that resolve to `.ts`.
- Never commit secrets — keys live in `.env.local` (gitignored). The CI scans for this.
- Keep the core free of framework/vendor lock-in; keep claims in the README honest and backed by code.

By contributing, you agree your contributions are licensed under the project's [MIT license](LICENSE).
