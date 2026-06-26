# Skeptic Q&A — answers ready for the first hour

Honest, specific, non-defensive. Concede real limitations; never argue. These are the questions a sharp HN/Reddit reader will actually ask.

---

**1. "Isn't this just another thin wrapper around an LLM + web search?"**
The wrapper *is* the product, and the value is in the parts most wrappers skip: it's source-grounded (every fact cites a fetched page), provenance- and freshness-aware, model-agnostic, and runs with no key at all. It's also not a wrapper in the load-bearing sense — the default engine uses no LLM. The point isn't novel ML; it's an honest, self-hostable, auditable version of a thing people currently rent as a black box.

**2. "How is this different from [the closed tool that inspired it]?"**
Same job, opposite trust model: open source vs. closed, self-hosted vs. their servers, your model/key vs. their bill, cited+dated facts vs. opaque output, and your data as portable files vs. a directory you rent. It's deliberately *less* magical (no proprietary multi-agent secret sauce) and *more* inspectable.

**3. "AI-generated company facts will be wrong/hallucinated. Why trust it?"**
You shouldn't trust it — that's why every fact is cited to a source you can click, stamped with a fetch date, and tagged with a confidence level and which engine produced it. It's built to be *audited*, not believed. The no-key heuristic engine is explicitly labeled low-confidence. If a claim has no citation, it doesn't ship.

**4. "The no-key 'heuristic' demo profiles look shallow."**
Correct, by design. The heuristic engine is a zero-config preview that pattern-matches sources — it exists so a fresh clone is useful before you commit a key, not to match a frontier model. Point it at an LLM (one env var) for the rich version. I'd rather ship an honest shallow default than fake depth.

**5. "Scraping DuckDuckGo / Wikipedia — is that allowed / reliable?"**
It uses DuckDuckGo's HTML endpoint and Wikipedia's open API, with a real user-agent and timeouts, at human-scale volumes for personal research. The gatherer is behind an interface, so swapping in an API-based search (Brave, Tavily, SerpAPI) is a small change — that's on the roadmap. Don't point it at a million companies and expect to be loved by either site.

**6. "Why would I self-host this instead of using the hosted tool?"**
Cost control (your model, including a free local one), privacy (your queries don't go to a vendor), data ownership (portable files you can export/version), and no rug-pull risk. If none of those matter to you, the hosted tools are fine — this is for people who resent renting it.

**7. "Does it phone home / collect anything?"**
No telemetry. It makes exactly two kinds of outbound calls: to the public web sources, and to the LLM provider *you* configured. Nothing else. It's open source — grep for it.

**8. "Where's the moat? Anyone could rebuild this."**
There's intentionally no moat — it's MIT and the code is small and readable. The "moat" for a closed competitor is a proprietary dataset; here the data is generated from public sources and is itself open. That's the point, not a bug.

**9. "Can it generate stars/value at scale, or does it fall over?"**
v1 is single-user, synchronous, file-backed — great for research sessions, not a scraping farm. No queue, no rate-limit handling across thousands of jobs. That's honestly out of scope for v1 and noted in the roadmap.

**10. "Why should I believe the tests / that it actually works?"**
55 tests, deterministic, no network or keys in CI (the LLM, search, and store are all injected). Clean-clone verified: `git clone && npm install && npm test && npm run build` all pass from scratch. CI runs the same on every push. And you can just run it.

**11. "Is the model default (Claude Opus) going to cost me a fortune?"**
The default *engine* is the no-key heuristic — $0. If you opt into Anthropic, the default model is the strongest one, but it's one env var to switch to a cheaper model (Haiku/Sonnet/gpt-4o-mini) or a free local Ollama model. You're never surprised by a bill.

**12. "What's your business model / are you going to enshittify it?"**
No business model — it's a tool I wanted to exist, MIT, no hosted tier, no telemetry, no account. The data being plain files means even if I vanish, your dossiers are yours.
