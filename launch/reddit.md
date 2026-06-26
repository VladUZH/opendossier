# Reddit drafts (one per subreddit — do not cross-post the same text)

Repo: https://github.com/VladUZH/opendossier
Rules of engagement: read each sub's self-promo rules first; space posts out over days, not all at once; reply to every early comment; never ask for upvotes.

---

## r/selfhosted

**Title:** OpenDossier – self-hosted, open-source company research that cites its sources (no telemetry, bring your own LLM)

I got tired of the new wave of "AI tells you everything about a company" tools being hosted black boxes — closed source, your queries on their servers, no way to bring your own model. So I built an open one you actually run yourself.

**OpenDossier** researches the public web and compiles a cited dossier on any company (summary, facts, funding, competitors). What makes it self-hoster-friendly:

- **Runs with `docker compose up` or `npm run dev`** — no account, no signup.
- **No telemetry.** It only talks to the web sources and the LLM *you* configure. Nothing phones home.
- **Your data is plain files.** Every dossier is a `data/companies/<slug>.json` you can grep, back up, version, and export. No database, no lock-in.
- **No API key required to run it at all** — the default engine works offline-of-LLMs by pattern-matching the actual sources. Add Claude/OpenAI/Ollama only if you want richer output.
- **Every fact is cited and dated**, with the engine + confidence level shown, so you can audit it.

MIT licensed. Stack is Next.js + a small TypeScript core, file-based corpus. Would genuinely like feedback from this crowd on the self-host story — what would you want for a clean deploy?

Repo: https://github.com/VladUZH/opendossier

---

## r/LocalLLaMA

**Title:** OpenDossier – open-source company research that runs fully local with Ollama (or no LLM at all)

Built an open-source "research any company → cited profile" tool that's **model-agnostic by design** — the LLM is behind an interface, so you can point it at a local Ollama model and nothing leaves your machine.

Why it might interest this sub:

- **`LLM_PROVIDER=ollama`** and it runs against your local model — no API key, no cloud, no data exfiltration. Also supports Claude/OpenAI if you want, or a **zero-LLM heuristic** fallback that just pattern-matches fetched sources.
- The synthesis prompt and JSON parsing are **shared across providers**, so a local model and a frontier model go through the exact same pipeline — easy to A/B "is my 8B model good enough for this task?"
- **Source-grounded:** it fetches real pages (DuckDuckGo + Wikipedia), hands them to the model as numbered sources, and forces every fact to cite one. Less hallucination surface than free-form prompting, and you can see exactly what the model was given.
- Everything is local files; no telemetry.

Curious which local models do well at the structured-extraction-with-citations task — would love reports. MIT, repo: https://github.com/VladUZH/opendossier

---

## r/opensource

**Title:** OpenDossier – an MIT-licensed, self-hostable alternative to the closed "AI company research" tools

A new category of closed SaaS has popped up: point it at a company, it reads the web and writes you a profile. Useful, but hosted and proprietary. One that hit the front page recently had its top comment ask "will you open source it?" — answer was no, citing API costs. So here's an open take.

**OpenDossier** (MIT) gathers public web sources and synthesizes a **cited** company dossier. Design goals that I think matter for an open project:

- **No key required to try it** — a heuristic engine works with zero config; LLMs (Claude/OpenAI/Ollama) are an opt-in upgrade. Lowers the barrier to actually running it.
- **Swappable everything** — the LLM, the search source, and the storage are all small interfaces. The core has no framework or vendor lock-in and is 100% deterministically unit-tested (no network/keys in CI).
- **Transparent output** — citations, fetch dates, and provenance on every dossier.
- **Data as files** — the corpus is greppable/forkable JSON, so the dataset itself is open and portable.

It's a small, readable codebase (TypeScript core + Next.js UI + CLI) — friendly to contribute to. Roadmap and "what's intentionally not built yet" are spelled out in the README. Feedback and PRs welcome.

https://github.com/VladUZH/opendossier
