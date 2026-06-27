# Launch plan — order, timing, mechanics

**Goal:** real stars from people who find OpenDossier useful. Organic only. One honest, high-quality launch.

**Hard rules (lose-the-bet-on-a-technicality risks):**
- Never buy stars; never use alt/bot accounts to star, upvote, or comment.
- No voting rings, no "please upvote" DMs/posts. Paid upvotes get HN domains banned for life.
- One genuine post per venue. Don't spam-blast all venues in one hour.
- Everything posts from the owner's real accounts. No automation of submissions.

## Recommended sequence

**Day 0 — primary launch (Tue, Wed, or Thu):**
1. **~8:15am PT — Show HN.** This is the main event; HN sends the most repo-curious traffic. Use `show-hn.md`. Be at the keyboard for 2+ hours. Post your own first comment (a limitation or an under-the-hood note) within minutes.
2. **~9:00am PT — X thread** (`x-thread.md`), with the screenshot/GIF. Link the HN thread in a reply once it has a few comments ("currently on HN if you want to weigh in").

**Day 0–1 — communities (space them out):**
3. **r/LocalLLaMA** (`reddit.md`) — strongest natural fit (local/Ollama angle). Post when the sub is active (US daytime/evening). Lead with the local-model story, not "I built a thing."
4. **r/selfhosted** — next day, not same hour as LocalLLaMA. Lead with the no-telemetry / own-your-data / `docker compose up` story.
5. **r/opensource** — day 1–2. Lead with the MIT / open-alternative-to-a-closed-tool angle.

**Why this order:** HN first (highest-signal, repo-clickers, and a live thread you can link elsewhere). LocalLLaMA before the other subs because it's the highest-affinity audience and a strong early reception there is real social proof. Stagger Reddit so it reads as genuine participation, not a coordinated blast.

## First-hour playbook (per venue)
- Reply to every comment, fast and substantive. Concede real points; thank critics.
- Pin/lead with a known limitation yourself — pre-empting the "it's just a wrapper" critique with the `skeptic-qa.md` answer reads as confidence.
- If someone hits a bug, fix it live and say so. A "pushed a fix, thanks" comment is worth more than any argument.
- Have `skeptic-qa.md` open. Don't get defensive on the hallucination / wrapper / moat questions — the honest answers are good.

## Pre-flight checklist (before posting anything)
- [x] Repo is **public** (STOP GATE B cleared).
- [x] Repo description + 12 topics set (discoverability).
- [x] Demo **GIF** of the live `/research` console embedded at the top of the README (`docs/demo.gif`).
- [x] CI badge green; `git clone && npm install && npm test && npm run build` verified on a fresh clone.
- [x] Test count is consistent everywhere (**129**), claims fact-checked against the code (red-team pass).
- [ ] **Upload the social-preview image** (one-time, web only): repo → Settings → Social preview → upload `docs/social-preview.png`. This is what renders when the link is shared on HN/Reddit/X.
- [ ] After the **v0.1.0 release** runs, make the **GHCR package public** (Packages → opendossier → Package settings → visibility) so `docker compose pull` works for everyone.
- [ ] Re-read the README on GitHub on a phone — images load, quickstart copy-pastes cleanly.
- [ ] Have `skeptic-qa.md` open; post your **security-hardening first comment** (in `show-hn.md`) within minutes of the Show HN, with the two commit links.
- [ ] You can be present for the first 1–2 hours after the Show HN.

## Don't
- Don't post to all venues simultaneously.
- Don't edit the Show HN title after posting.
- Don't argue with skeptics — answer or concede.
- Don't mention the bet, stars, or any growth tactic anywhere public.
