# X / Twitter thread draft

Tip: attach the **demo GIF** (`docs/demo.gif`) to tweet 1 — the dark live-research console is the scroll-stopper. Put the repo link in tweet 2+ (first-tweet links get throttled). One idea per tweet.

---

**1/**
The "AI that researches any company for you" tools are everywhere now — and they're all closed, hosted black boxes.

So I built the open one you run yourself: OpenDossier. Self-hosted company research that cites every fact. Bring your own LLM, or none. 🧵

[attach: docs/demo.gif — the live research console]

**2/**
Point it at a company → it reads the public web → compiles a cited dossier: summary, facts, funding, competitors.

Every fact links to a numbered source with the date it was fetched. Uncited claims get dropped. You check it, you don't just trust it.

github.com/VladUZH/opendossier

**3/**
It runs with NO API key.

The default engine reads the actual fetched pages — no LLM required. `git clone && npm install && npm run dev` and you're browsing.

Want richer profiles? One env var points it at Claude, OpenAI, or a local Ollama model.

**4/**
Model-agnostic, on purpose. Same pipeline, your choice of brain:
• Claude / OpenAI (your key, your cost)
• Ollama (the model stays on your machine)
• heuristic (zero-key, $0)

The LLM is behind an interface. Swap it with a string.

**5/**
Your data is a folder of JSON files.

Greppable. Diffable. Forkable. Exportable. No database, no telemetry, no lock-in, no rug-pull.

The opposite of a closed directory you rent access to.

**6/**
It also got a proper UI — a dark "intelligence console" that streams the research live and shows every citation.

And since you self-host it, I hardened it before launch: fixed a path-traversal + an SSRF in my own code, both with tests.

[attach: docs/profile.png]

**7/**
Honest scope: v1 does the one core job well. No scheduled refresh, history diffs, or hosted mode yet — all roadmapped and marked "not built" in the README.

MIT. Built it because I wanted it to exist.

github.com/VladUZH/opendossier
