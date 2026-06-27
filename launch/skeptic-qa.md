# Skeptic Q&A — answers ready for the first hour

Honest, specific, non-defensive. Concede real limitations; never argue. These are the questions a sharp HN/Reddit reader will actually ask.

---

**1. "Isn't this just another thin wrapper around an LLM + web search?"**
The wrapper *is* the product, and the value is in the parts most wrappers skip: it's source-grounded (every fact cites a fetched page), provenance- and freshness-aware, model-agnostic, and runs with no key at all. It's also not a wrapper in the load-bearing sense — the default engine uses no LLM. The point isn't novel ML; it's an honest, self-hostable, auditable version of a thing people currently rent as a black box.

**2. "How is this different from [the closed tool that inspired it]?"**
Same job, opposite trust model: open source vs. closed, self-hosted vs. their servers, your model/key vs. their bill, cited+dated facts vs. opaque output, and your data as portable files vs. a directory you rent. It's deliberately *less* magical (no proprietary multi-agent secret sauce) and *more* inspectable.

**3. "AI-generated company facts will be wrong/hallucinated. Why trust it?"**
You shouldn't trust it — that's why every fact is cited to a source you can click, stamped with a fetch date, and tagged with a confidence level and which engine produced it. It's built to be *audited*, not believed. The no-key heuristic engine is explicitly labeled low-confidence, and uncited claims are dropped rather than shown. Important caveat I'll say before you do: a citation tells you *where* a claim came from so you can check it — it does not prove the source substantiates it. That's exactly what the confidence label is for, and closing that gap (claim-to-source entailment) is the open problem I'd most like help with.

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
129 tests, deterministic, no network or keys in CI (the LLM, search, and store are all injected). Clean-clone verified: `git clone && npm install && npm test && npm run build` all pass from scratch. CI runs the same on every push. And you can just run it.

**11. "Is the model default (Claude Opus) going to cost me a fortune?"**
The default *engine* is the no-key heuristic — $0. If you opt into Anthropic, the default model is the strongest one, but it's one env var to switch to a cheaper model (Haiku/Sonnet/gpt-4o-mini) or a free local Ollama model. You're never surprised by a bill.

**12. "What's your business model / are you going to enshittify it?"**
No business model — it's a tool I wanted to exist, MIT, no hosted tier, no telemetry, no account. The data being plain files means even if I vanish, your dossiers are yours.

**13. "The substantive product is just an LLM over Wikipedia + DuckDuckGo, dressed up with citation chrome."** *(the single strongest objection — expect it)*
Fair, and I'll concede the shape: v1's sources are DuckDuckGo + Wikipedia, and the no-key engine is deliberately shallow (labeled low-confidence). What I think is non-trivial isn't the LLM call — it's the contract around it: source-gathering, the model, and the store are behind small interfaces; the schema rejects any fact whose citation index doesn't point to a real fetched source, so the model can't cite something that wasn't retrieved; uncited facts are dropped; every fact carries provenance + a fetch date + a confidence label; and the whole pipeline is deterministically tested (no network/keys, 129 tests). More/weighted source connectors are roadmapped and marked not-built. I'm not claiming to have solved research — I'm claiming an honest, inspectable, self-hostable version of the thing people currently rent as a black box.

**14. ""Every claim is cited" gives false confidence — the citation proves a source was fetched, not that it says the thing."**
Correct, and I say so in the post. The schema guarantees citation *integrity* (no dangling indices) and provenance, not factual *entailment* — the citation is there so you know where to go check, and the confidence label exists precisely because you should verify, not trust. Claim-to-span grounding is the obvious next hard problem; design ideas very welcome.

**15. "Why did an unreleased tool ship a path-traversal and an SSRF — is the rest unaudited?"**
Fair to ask. Both were caught in a pre-launch security pass on unreleased code, before anyone could run it; both are fixed with defense-in-depth (slug validation refuses traversal on read and write; the fetcher blocks private/loopback/link-local/cloud-metadata addresses and non-http(s) schemes, re-checked per redirect) and both have regression tests. I'm disclosing them openly rather than quietly patching — that's the standard I want for a tool people self-host.
