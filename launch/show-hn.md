# Show HN draft

## Title (pick one — keep ≤ 80 chars, no emoji)

**Primary:**
> Show HN: OpenDossier – Open-source AI company research, bring your own LLM

**Alternates:**
> Show HN: OpenDossier – Self-hosted "Crunchbase" that cites its sources
> Show HN: OpenDossier – Open-source company-research tool (no API key to try)

## URL
https://github.com/VladUZH/opendossier

## Body

Hi HN — OpenDossier is an open-source tool that researches the public web and compiles a **source-cited** dossier on any company: summary, key facts, funding, competitors. It runs as a self-hosted Next.js app plus a CLI, and the whole dataset is just a folder of JSON files you own.

A few of these "AI reads the web and writes you a company profile" tools have shown up recently, and they're genuinely handy — but they're hosted black boxes. You can't self-host them, you can't see or steer their sources, you can't bring your own model to control cost, and your queries go to someone else's servers. On one of them, the top comment here was literally "do you plan to open source it?" — the maker said no, citing API costs. OpenDossier is a take on what the open version looks like.

Three things I tried to get right:

1. **It runs with no API key.** The default engine pattern-matches the actual fetched sources (DuckDuckGo + Wikipedia) — no LLM required — so a fresh clone is useful before you paste anything. `git clone && npm install && npm run dev` and you're browsing. Want better profiles? Point it at Claude, OpenAI, or a local Ollama model with one env var. Bring your own key dissolves the cost objection.

2. **Every claim is cited and dated.** Facts link to a numbered source with the fetch date, and each dossier records which engine produced it and a confidence level — so you can judge it instead of trusting it. The no-key engine is honestly labeled "low confidence."

3. **Your data is files, not a SaaS.** Dossiers are `data/companies/<slug>.json` — greppable, diffable, forkable, exportable. No rug-pull, no lock-in, no telemetry.

The core (sources → synthesize → cited profile) is small and the LLM/search/store are all behind interfaces, so the whole pipeline is deterministically unit-tested with no network and no keys (55 tests).

Honest about what it's *not*: v1 does the one core job. No scheduled refresh, no profile-history diffs, no semantic search, no auth/hosted mode yet — those are on the roadmap and called out as not-built in the README. The no-key heuristic engine is deliberately shallow; the LLM path is where the rich profiles come from.

Repo (MIT): https://github.com/VladUZH/opendossier

Would love feedback on the source-gathering and the citation model especially — what would make this trustworthy enough to actually use?

## Notes for the poster (delete before posting)
- Post Tue–Thu, ~8–10am PT. Be at your desk for the first 1–2 hours.
- First comment from you (immediately): a 2–3 line "how it works under the hood" or a known limitation you'd flag yourself — shows good faith.
- Reply fast, concede real points, never argue. Velocity of thoughtful replies in the first hour matters more than the title.
- Do NOT ask for upvotes anywhere. No voting rings. Organic only.
