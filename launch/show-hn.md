# Show HN draft

Write it plainer and more technical than the README. No emoji, no bold-everywhere, no marketing voice — HN distrusts polish. The engineering carries it.

## Title (≤ 80 chars, no emoji — lead with the differentiator)

**Primary:**
> Show HN: OpenDossier – self-hostable company research that cites every fact

**Alternates:**
> Show HN: OpenDossier – company research that runs with no API key (bring your own LLM)
> Show HN: OpenDossier – open, inspectable AI company research you host yourself

(Avoid the "Crunchbase" framing — Crunchbase is a curated structured-data DB; this summarizes a couple of web sources, and the analogy just invites "this is nothing like Crunchbase.")

## URL
https://github.com/VladUZH/opendossier

## Body

OpenDossier researches the public web and compiles a source-cited dossier on a company — summary, key facts, funding, competitors. It's a self-hosted Next.js app plus a CLI, and the dataset is just a folder of JSON files you own.

I built it because the recent wave of "AI reads the web and writes you a company profile" tools are hosted black boxes: you can't self-host them, can't see or steer their sources, can't bring your own model, and your queries go to someone else's servers.

I want to be upfront about the shape of it, because it pre-empts the obvious objection: today it gathers from DuckDuckGo + Wikipedia, and the no-key default engine just pattern-matches those pages (it's labeled low-confidence). The rich profiles come from the LLM path. So yes, at one level this is "an LLM over a couple of web sources." What I think is worth looking at is the contract around that:

- It runs with no API key. The default engine needs no LLM, so a fresh clone is useful before you paste anything. One env var points it at Claude, OpenAI, or a local Ollama model — your key, your cost, or a local model / the no-key engine for free.
- Every fact links to a numbered source with a fetch date, and uncited claims are dropped rather than shown. Important caveat I'd rather say first than have you say: a citation tells you *where a claim came from so you can check it* — not that the source actually substantiates it. That's why each dossier also carries the engine that produced it and a confidence level. It's built to be audited, not trusted.
- The LLM, the search source, and the store are all behind small interfaces, so the pipeline is deterministically unit-tested with no network and no keys (129 tests). The schema rejects any fact whose citation index doesn't point to a real fetched source, so a model can't cite something that wasn't retrieved.
- Your data is files: `data/companies/<slug>.json` — greppable, diffable, forkable, exportable. No database, no telemetry, no lock-in.

Honest about scope: v1 does the one core job. No scheduled refresh, no history diffs, no semantic search, no hosted/multi-user mode — all on the roadmap and marked "not built" in the README. Coverage tracks a company's public web footprint, so an obscure or non-English name will come back thin.

The genuinely open problem I'd love HN's take on: closing the gap between "this claim cites source [3]" and "source [3] actually says this." Citation integrity is enforced; claim-to-source *entailment* isn't, and that's the hard part. Ideas welcome.

Repo (MIT): https://github.com/VladUZH/opendossier

## Your first comment (post it yourself, right after submitting)

> One thing I did before launch, since you self-host this and it runs a server-side web fetcher: I ran a security pass on my own (unreleased) code and found and fixed two things — an unauthenticated path-traversal via the save endpoint's slug (`/api/save`), and an SSRF in the fetcher. Both are fixed with defense-in-depth (slug validation on read and write; the fetcher refuses private/loopback/link-local/cloud-metadata addresses and non-http(s) schemes, re-checked on each redirect), and both have regression tests. Flagging it openly rather than quietly patching — that's the standard I want to hold the project to. Commits: [link the two commits].

(Frame it exactly as pre-launch hardening of unreleased code — true — not as a patched live vuln. Pair it with the honest limitation above so it reads as diligence, not a humblebrag.)

## Notes for the poster (delete before posting)
- Post Tue–Thu, ~8–10am PT. Be at your desk for the first 1–2 hours.
- Reply fast, concede real points, never argue. Velocity of thoughtful replies in the first hour matters more than the title.
- Do NOT ask for upvotes or stars anywhere, in the post or the thread.
- If someone asks "which tool inspired this?", don't name it — keep it about what you built.
