# X / Twitter thread draft

Tip: attach `docs/home.png` to tweet 1 and `docs/profile.png` (or a screen-recording GIF of the live /research console) to tweet 3. Put the repo link in tweet 2+ — first-tweet links get throttled. Keep the first tweet to one idea.

---

**1/**
The "AI that researches any company for you" tools are everywhere now — and they're all closed, hosted black boxes.

So I built the open one.

OpenDossier: self-hosted AI company research that cites every source. Bring your own LLM. No telemetry. 🧵

[attach: docs/home.png]

**2/**
The thing that bugged me: when one of these hit the HN front page, the top comment asked "will you open-source it?" — the maker said no, citing API costs.

That objection disappears the moment you bring your own key. So that's the whole idea.

github.com/VladUZH/opendossier

**3/**
Point it at a company → it reads the public web → compiles a cited dossier: summary, facts, funding, competitors.

Every fact links to a numbered source with the date it was fetched. You audit it, you don't just trust it.

[attach: docs/profile.png]

**4/**
It runs with NO API key.

The default engine pattern-matches the actual fetched pages — no LLM required. `git clone && npm install && npm run dev` and you're browsing.

Want richer profiles? One env var points it at Claude, OpenAI, or a local Ollama model.

**5/**
Model-agnostic, on purpose.

Same pipeline, your choice of brain:
• Claude / OpenAI (your key, your cost)
• Ollama (fully local, nothing leaves your machine)
• heuristic (zero-key)

The LLM is behind an interface. Swap it with a string.

**6/**
Your data is a folder of JSON files.

Greppable. Diffable. Forkable. Exportable. No database, no lock-in, no rug-pull.

That's the opposite of a closed directory you rent access to.

**7/**
Honest scope: v1 does the one core job well. No scheduled refresh, history diffs, or hosted mode yet — all on the roadmap, all clearly marked "not built" in the README.

MIT. Stars are earned, not bought.

github.com/VladUZH/opendossier

If it's useful, a ⭐ helps others find it.
