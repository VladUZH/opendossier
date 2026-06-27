<div align="center">

# OpenDossier

### Self-hosted, open-source company research that cites every fact — bring your own LLM (or none), no telemetry.

Point it at a company name; it researches the public web and compiles a **source-cited** profile — summary, key facts, funding, competitors — that you own as plain files. Runs with no API key, in your terminal or a Next.js app.

[![CI](https://github.com/VladUZH/opendossier/actions/workflows/ci.yml/badge.svg)](https://github.com/VladUZH/opendossier/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-A4361F.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-2C4A68.svg)](tsconfig.json)
![Zero-config](https://img.shields.io/badge/first%20run-zero%20config%20·%20no%20API%20key-4A6B3A.svg)

![OpenDossier — researching a company live, into a cited dossier](docs/demo.gif)

</div>

## Why

If you research companies, you've probably hit the new wave of closed "AI company research" tools: point one at a company, it reads the web, hands you a profile. Useful — but hosted black boxes. You can't self-host them, can't see or steer their sources, can't bring your own model to control cost, and your queries live on someone else's servers.

OpenDossier is the open version, built around three things those tools don't give you:

- **No key required to try it.** The default engine reads real fetched sources and needs no LLM, so a fresh clone is useful before you paste anything. Point it at Claude, OpenAI, or a local Ollama model for richer output — you control (and pay) your own model cost, or run a local model / the no-key engine for **free**.
- **Every fact links to its source, with a fetch date.** A citation tells you *where a claim came from* so you can check it — not that the source is correct (that's why each dossier also shows which engine produced it and a confidence level). Uncited claims are dropped, not shown.
- **Your data is files, not a SaaS.** Dossiers are `data/companies/<slug>.json` — greppable, diffable, forkable, exportable. No database, no lock-in, no rug-pull.

*For analysts, founders, and tinkerers who want to research companies without renting a black box.* (The nudge to build it: one of these tools hit the HN front page and the top comment asked if it'd be open-sourced — the maker declined, citing API costs. Bring-your-own-key is the answer to that.)

## What it does

- 🔎 **Research a company → a structured, source-cited dossier** (web UI *and* CLI). Sources today are DuckDuckGo + Wikipedia, so coverage tracks a company's public web footprint (more connectors are on the roadmap).
- 🧾 **Every shipped fact links to a numbered source, with a fetch date.** Uncited claims are dropped. Provenance (which engine produced it) and a confidence level are shown, not hidden — built to be *audited*, not trusted.
- 🔌 **LLM-agnostic.** Anthropic (Claude), OpenAI, a local **Ollama** model, or a **zero-key heuristic** engine — same pipeline, your choice, swappable with one env var.
- 🆓 **Works with no API key at all.** The default heuristic engine pattern-matches real fetched sources (honestly labeled low-confidence), so a fresh clone is useful before you paste any key.
- 📁 **Your data is a folder of files.** Dossiers live in `data/companies/<slug>.json` — greppable, diffable, forkable, trivially exportable. No database to stand up, no lock-in.
- 🙈 **No telemetry.** It calls the web sources and the LLM *you* configured. Nothing else (it even disables Next.js's own telemetry).
- 🏠 **Self-hostable by construction.** It's a Next.js app plus a file corpus — `docker compose up` or `npm install && npm run dev`.

![Browse a seeded directory of 15 companies, each a cited dossier](docs/home.png)

## 30-second quickstart

```bash
git clone https://github.com/VladUZH/opendossier
cd opendossier
npm install
npm run dev
# → open http://localhost:3000
```

That's it — **no API key, no config, no database.** Browse the seeded directory of 15 companies, or type a new company into the search box and watch it research live.

Prefer Docker?

```bash
docker compose up        # → http://localhost:3000
```

Your dossiers persist on the host in `./data` and stay human-readable. Add an LLM by dropping a key into `.env.local` (see below) — Compose picks it up automatically.

Prefer the terminal?

```bash
npm run research -- "Anthropic"          # compile a dossier to stdout
npm run research -- "Stripe" --save      # …and save it into the corpus
npm run research -- "Linear" --json      # machine-readable output
```

```
🔎 Researching "Anthropic" (provider: heuristic)
  · searching the web…
  · found 8 candidate source(s)
  · reading en.wikipedia.org…
  · reading www.anthropic.com…
  · synthesizing dossier…

Anthropic  (anthropic.com)

Anthropic is an AI safety and research company working to build reliable,
interpretable, and steerable AI systems.

Facts
  • Founded: 2021 [1]
  • Headquarters: San Francisco, California [1]

Sources
  [1] Anthropic — Wikipedia — https://en.wikipedia.org/wiki/Anthropic (2026-06-27)
  ...

Generated by heuristic · confidence: low · 2026-06-27
```

### Upgrade to an LLM (optional)

The heuristic engine is honest but shallow. For richer dossiers (funding rounds, competitors, fuller facts), point OpenDossier at a model — **bring your own key**:

```bash
cp .env.example .env.local
```

```ini
# .env.local — pick ONE
LLM_PROVIDER=anthropic                 # or openai | ollama | heuristic (default)
ANTHROPIC_API_KEY=sk-ant-...
# ANTHROPIC_MODEL=claude-opus-4-8      # set claude-haiku-4-5 to cut cost
```

Running a local model? `LLM_PROVIDER=ollama` needs no key at all. Your key and your data never leave your machine.

## How it works

```
   company name
        │
        ▼
┌──────────────────┐   ┌────────────────────┐   ┌─────────────────────┐
│  Gather sources  │──▶│   Synthesize       │──▶│  Cited dossier      │
│  DuckDuckGo +    │   │   heuristic / LLM  │   │  facts → sources[]  │
│  Wikipedia       │   │   (swappable)      │   │  + provenance/date  │
└──────────────────┘   └────────────────────┘   └─────────────────────┘
        no API key            your model, your cost        data/companies/*.json
```

Source-gathering, the LLM, and the file store are all behind small interfaces, so every part is swappable and the whole pipeline is covered by **129 deterministic tests** — no network, no keys in CI.

![A dossier with citations and provenance](docs/profile.png)

## Security

You self-host this, and it runs a server-side web fetcher — so it was hardened before launch. Two issues were found and fixed in pre-release code, both now covered by regression tests:

- An **unauthenticated path-traversal** via the save endpoint's slug (`/api/save`): slugs are validated on read *and* write, so they can't escape the corpus directory. ([test](src/core/store/corpus.test.ts))
- An **SSRF** in the web fetcher: it now refuses private / loopback / link-local / cloud-metadata addresses and non-`http(s)` schemes, re-checked on every redirect hop. ([test](src/core/search/web.test.ts))

This is diligence, not a guarantee — it's MIT software you run yourself. Found something? Please [open an issue](https://github.com/VladUZH/opendossier/issues).

## How it compares

| | **OpenDossier** | Closed "AI company research" SaaS | Crunchbase |
|---|:---:|:---:|:---:|
| Open source (MIT) | ✅ | ❌ | ❌ |
| Self-hostable | ✅ | ❌ | ❌ |
| Run with **no API key** | ✅ (heuristic) | ❌ | ❌ |
| **Bring your own LLM** / model-agnostic | ✅ | ❌ | n/a |
| Local model (Ollama) | ✅ | ❌ | ❌ |
| Every claim **source-cited + dated** | ✅ | partial | partial |
| Data is **yours / exportable** (plain files) | ✅ | ❌ | ❌ |
| No telemetry | ✅ | ❌ | ❌ |
| Free | ✅ | ❌ | ❌ (paywalled) |

✅ = shipped in this repo today. See the roadmap for what's intentionally *not* built yet.

## Roadmap (not built yet)

These are deliberately out of scope for v1 — the core above is complete and works end-to-end. Contributions welcome.

- [ ] Scheduled re-runs / freshness refresh (re-research stale dossiers on a cron)
- [ ] Profile history & diffs (track how a company's dossier changes over time)
- [ ] Semantic search across the corpus (embeddings)
- [ ] More source connectors (news, filings, job boards) and per-source weighting
- [ ] Export to CSV / Markdown; a public read-only API + webhooks
- [ ] Optional multi-user / hosted mode with auth

## Configuration

All settings are environment variables (see [`.env.example`](.env.example)); **every one is optional**.

| Variable | Default | What it does |
|---|---|---|
| `LLM_PROVIDER` | `heuristic` | `heuristic` (no key) · `anthropic` · `openai` · `ollama` |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | — / `claude-opus-4-8` | Claude key + model |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | — / `gpt-4o-mini` | OpenAI key + model |
| `OLLAMA_BASE_URL` / `OLLAMA_MODEL` | `http://localhost:11434` / `llama3.1` | Local model |
| `SEARCH_PROVIDER` | `duckduckgo` | `duckduckgo` or `none` |
| `OPENDOSSIER_DATA_DIR` | `./data` | Where the corpus lives |

## Development

```bash
npm test          # vitest — 129 tests, deterministic, no network/keys
npm run typecheck # tsc --noEmit
npm run build     # production build
npm run seed      # (re)generate the seeded directory with the configured provider
```

The codebase is a small, framework-agnostic core (`src/core/`) — `schema`, `providers`, `search`, `research`, `store` — used by both the CLI (`src/cli/`) and the Next.js app (`app/`).

## Contributing

It's a small, readable codebase (a framework-agnostic TypeScript core + a Next.js app + a CLI) and a friendly place to start — see [CONTRIBUTING.md](CONTRIBUTING.md). Issues, ideas, and PRs are all welcome.

## License

[MIT](LICENSE) — yours to run, fork, and build on.
