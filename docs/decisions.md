# VOA decision and incident log

Layer 4 memory: why things are the way they are. Read on demand when a rule in `AGENTS.md` or a module doc seems odd, or before undoing one. Newest first. Each entry: what happened → rule it produced (the rule itself lives in the linked module doc).

For anything not here, Matt's own commit messages are the detailed record: `git log --invert-grep --grep='\[automated\]'` (cloud clones are shallow; `npm run orient` deepens them).

## 2026-09-27 ~ Loose ends from the memory audit fixed
- Three finished drafts from the Aug/Sep Opus cost tests sat in `drafts/` with no queue entry. They passed a quality check (FAQ schema, related links, whisper widget, hero images, no fabricated first-person claims), so they were queued (flag `recovered_orphan: true`) into thin clusters rather than deleted. Orient now flags orphans.
- The ESC orchestration export claimed 2 posts/day and warned at 30 drafts; corrected to 4/day and 14.
- The dashboards read the committed local ESC recommendations file first and stopped, so a fresher feeder export was never shown. They now load both and use the newest.
- `deployment-health.json` was only ever committed from a local run (CI uploaded it as an artifact, and had no Vercel CLI). Replaced with a deploy-time commit stamp plus a 12-hourly committed refresh.

## 2026-09-27 ~ Agent memory restructured into layers
`CLAUDE.md` had grown to ~68KB (~17k tokens loaded every session), mixing rules, dated incident write-ups, and stale operational numbers. Split into: `AGENTS.md` (shared core for Claude and Codex, imported by `CLAUDE.md`), `docs/modules/*` (read by topic), this log, generated live state (`npm run orient`, run automatically by a Claude SessionStart hook), and a small overwrite-in-place `docs/handoff.md`. Stale facts corrected in the move: queue warn threshold (14, not 30), posting rate (4/day), captions model (Haiku, not Sonnet), Dev.to 2 routing (backlinks-only slots), Facebook via Publer (page-token expiry no longer blocks VOA posts). Removed leftover Opus 5 experiment files `.sysprompt.mjs` / `.eff-tmp.mjs`.

## 2026-09-16 ~ Balanced four-per-day cluster rotation
Daily AI-only and art-only reserved slots retired. All four daily slots draw from all 11 clusters, least-recently-published first. Matt approved four/day, not eleven/day. → `docs/modules/publishing-queue.md`

## 2026-09-01 ~ Cloud-hosted Publer delivery alerts
Local Mac alerts were unreliable (asleep Mac; macOS `mail` exits 0 with no mail service). Moved to a 15-minute GitHub Actions monitor with an assigned GitHub issue as the guaranteed alert. → `docs/modules/monitoring.md`

## 2026-08-06 ~ Opus 5 tried and reverted for post generation
Same list price, but default thinking billed as output made every effort level more expensive than Opus 4.8 ($0.071–$0.127 vs $0.058/post). `extractText()` kept as a guard. → `docs/modules/models-and-cost.md`

## 2026-08-05 ~ CLI guard on every script
37 scripts ran their full `main()` when merely imported (spending Opus, publishing, mutating Vercel/Stripe). All now use the `pathToFileURL` guard in `AGENTS.md`. Also corrected drifted model claims in docs (generate-from-inspiration = Sonnet 4.6, companions = Haiku).

## 2026-08-05/06 ~ Automatic queue reserve and publishing mix
Queue ran dry; added `replenish-drip-queue.js` with daily budget caps. 80% of posts were in `ai-creator-tools`; the fix was to cap AI volume via rotation, not relabel. (Superseded in detail by 2026-09-16.)

## 2026-07-28 ~ Ebook covers, social previews, fabricated first-person claims
Transparent `StarLogo.png` made ugly link previews → default social image is `eartstarart.jpg`. 15 Boom posts had invented lived experience ("I threw a 40-page PDF into NotebookLM") → rewritten, and TRUTHFULNESS RULES expanded in both generator prompts. Mobile announcement bar overlapped the header → measured padding. Ebook cover artwork later replaced with Matt EarthStar versions and obsolete hashed PDFs deleted.

## 2026-07-24 ~ Publer duplicate posting; Instagram utility cards
A live Instagram duplicate: `retry-failed-syndication.js` always passes `--force`, bypassing the only (local) dedup check, while a 60s timeout could record a slow-but-successful Publer publish as failed. Fix: `findExistingPublerPost()` checks Publer's live post list before every create. One confirmed duplicate was deleted. Separately, the Instagram feed was 100% AI art; added deterministic utility-card archetypes in the same rotation engine. → `docs/modules/syndication.md`, `docs/modules/visuals.md`

## 2026-07-19 ~ Search Console cleanups
- A flat `static/blog/matt/posts/{slug}.html` redirect file shadowed the real archive article under `cleanUrls` (and `generate-legacy-redirects.js` had overwritten a real article with a redirect-to-itself). Redirects moved to `vercel.json`. Archive posts also carried a leftover `noindex` from the Wayback import; flipped to `index, follow`.
- `/blog/boombot/` → `/blog/boom/` rename had no redirect; old backlinks 404'd. Added.
- Published drafts were never deleted from `drafts/`; 163 duplicate-content files had accumulated. Drafts are now deleted on publish and `drafts/` is blocked in `robots.txt`.
→ `docs/modules/site-and-hosting.md`, `docs/modules/publishing-queue.md`

## 2026-07-10 ~ AI-search structure and reciprocal links
Audit of live posts: BlogPosting-only schema, 0% question H2s, forward-only internal links. Added question H2s, direct-answer-first sections, FAQ/HowTo schema (Boom only), and `backlinkOlderPosts()`. Verified on two live generations. → `docs/modules/content-generation.md`

## 2026-07-09 ~ Hero images were up to 37MB
Hero images were served at up to 18000px / 37MB with `fetchpriority="high"`, hurting LCP. Resized to 1600px (~162MB → ~3MB). Five genuinely unused full-res images deleted (~343MB). → `docs/modules/visuals.md`

## 2026-07-08 ~ Cluster backfill
68 of 80 unclustered posts backfilled for free with the local heuristic; the rest were too generic. Revealed a genuinely lopsided cluster distribution (addressed by the later rotation work).

## 2026-07-07 ~ Prompt caching verified
Real two-call test confirmed 13,294-token cache write then read on `generate-post.js`.

## 2026-05-17 ~ Old Blogger/Publer errors judged historical
March 2026 Blogger OAuth and Publer 404 entries in `syndication-log.json` were verified stale by live checks. Rule: old log errors are evidence, not current health.

## Deferred plans (do not build until Matt asks)

**Shared calendar.** A single source of truth for scheduled/published content across VOA and ESR. Should read System B's `visual-registry.json`. Schema stub:

```json
{
  "event_id": "uuid", "content_id": "post-slug", "brand": "VOA | ESR",
  "lane": "boom | matt | esr",
  "content_type": "creator | philosophy | nervous-system | earthstar | general",
  "niche": "ai-creator-tools | ...",
  "status": "draft | queued | published | syndicated | promoted | retired",
  "scheduled_at": "ISO 8601", "published_at": "ISO 8601",
  "syndications": [{ "platform": "bluesky_voa", "status": "published", "url": "..." }],
  "campaign_id": null,
  "assets": { "hero_image": { "source": "pexels", "url": "..." } },
  "feeder": { "status": "published", "feeder_url": "..." },
  "performance": { "pinterest_saves": 0, "bluesky_likes": 0 }
}
```

**Platform-native transformations** instead of suppression (see `docs/modules/syndication.md`).
