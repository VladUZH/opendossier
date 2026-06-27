# Reddit drafts (one per subreddit — do NOT cross-post the same text)

Repo: https://github.com/VladUZH/opendossier
Rules of engagement: read each sub's self-promo rules first; **space posts out over days, not all at once** (shared audiences + similar ledes = self-promo flag risk); **attach a screenshot/GIF** (r/selfhosted especially); reply to every early comment; never ask for upvotes. Each draft below leads with that sub's specific payoff — keep it that way.

---

## r/selfhosted

**Title:** `docker compose up` company research — self-hosted, no telemetry, dossiers are plain JSON files you own

**Attach:** the demo GIF (`docs/demo.gif`) or `docs/home.png` + `docs/profile.png`. A UI tool posted here with no screenshot gets "any screenshots?" as the first reply — lead with the visual.

I wanted to research companies without a hosted black box reading my queries, so I built one you run yourself.

**OpenDossier** points at a company name, reads the public web, and compiles a cited dossier (summary, facts, funding, competitors). For self-hosters specifically:

- Runs with `docker compose up` or `npm run dev` — no account, no signup. A prebuilt multi-arch image is published to GHCR on each release, so you can pull instead of build.
- No telemetry. It talks only to the web sources and the LLM *you* configure — and it disables Next.js's own telemetry too. Want it fully offline of search as well? `SEARCH_PROVIDER=none`.
- Your data is plain files — `data/companies/<slug>.json`, mounted to a host volume. Grep it, back it up, version it, export it. No DB.
- No API key required at all: the default engine pattern-matches the fetched sources (low-confidence, honestly labeled). Add Claude/OpenAI/Ollama for the rich version.
- It runs a server-side fetcher, so before launch I added an SSRF guard (blocks loopback/link-local/cloud-metadata targets and non-http(s) schemes) and fixed a path-traversal in the save path — both with regression tests.

Honest limits: source coverage is DuckDuckGo + Wikipedia today, and the no-key engine is deliberately shallow. MIT, Next.js + a small TS core. What would you want for a clean deploy?

Repo: https://github.com/VladUZH/opendossier

---

## r/LocalLLaMA

**Title:** Company research with your local Ollama model (or no LLM at all) — same pipeline as a frontier model, source-grounded JSON

Note on "local": your **prompts and synthesis stay local** via Ollama; the tool does reach out to the public web for the research step (DuckDuckGo + Wikipedia). Not claiming air-gapped — just that the model is yours.

The substance for this crowd isn't "it's model-agnostic" (that's the easy part) — it's the layer that makes small local models usable for structured extraction:

- `LLM_PROVIDER=ollama` runs against your local model; the same system prompt + the same JSON parser are shared across providers, so it's an easy "is my 8B good enough?" A/B against a frontier model. (Caveat: JSON-mode is on for Ollama/OpenAI but not Anthropic, so it's not perfectly apples-to-apples.)
- The JSON layer is built for messy local output: lenient zod, balanced-brace extraction (tolerates prose/braces around the object), fenced-code handling, null-stripping, and dropping invalid citation indices instead of crashing. There's also a zero-LLM heuristic extractor if you want a no-model baseline.
- Source-grounded: it hands the model numbered fetched pages and asks each fact to cite one; the schema then rejects any citation that doesn't point to a real source, and uncited facts are dropped.
- Known limits I'd state plainly: default model is `llama3.1`, docs are truncated to ~6k chars (small context windows lose sources), and there's no retry/repair if a model returns no JSON yet.

If you run it against a local model, I'd genuinely like a report — did the JSON hold, were the citations sane? MIT: https://github.com/VladUZH/opendossier

---

## r/opensource

**Title:** OpenDossier (MIT): an open, inspectable take on the closed "AI company research" tools — swappable everything, deterministic tests

A category of closed SaaS has popped up: point it at a company, it reads the web, writes a profile. Useful, but hosted and proprietary. Here's an MIT take built to be inspected and extended.

What I think matters for an open project:

- No key required to try it — a heuristic engine works with zero config; LLMs (Claude/OpenAI/Ollama) are an opt-in upgrade. Low barrier to actually running it.
- Swappable everything — the LLM, the search source, and the storage are all small interfaces. The core has no framework or vendor lock-in, and the whole pipeline is deterministically tested (no network, no keys in CI — 129 tests).
- Transparent output — every shipped fact links to a numbered source with a fetch date, plus provenance and a confidence level. Uncited claims are dropped.
- Data as files — the corpus is greppable/forkable JSON, so the dataset itself is open and portable.

Small, readable codebase (TS core + Next.js UI + CLI) with a CONTRIBUTING guide and "good first issue" areas. Roadmap and "what's intentionally not built yet" are spelled out. Feedback and PRs welcome.

https://github.com/VladUZH/opendossier
