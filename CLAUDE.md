# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vibration of Awesome (vibrationofawesome.com) is an AI-powered content creation and syndication platform. It combines a Hugo static site with Node.js automation scripts that generate blog posts via Claude API and distribute them across social media platforms.

## Commands

### Local Development
```bash
hugo server -D          # Run Hugo dev server at http://localhost:1313
npm install             # Install Node.js dependencies
```

### Content Generation
```bash
# Matt lane (personal, reflective voice)
node scripts/generate-post.js --lane matt --title "Post Title Here"

# Boombot lane (SEO-optimized, AI persona "Matty BoomBoom")
node scripts/generate-post.js --lane boom --keyword "target keyword" --topic "content angle"

# SEO keyword research → saves to static/_data/topic-queue.json
npm run research

# Syndicate most recent post to all social platforms
npm run syndicate
```

### Maintenance
```bash
npm run sitemap         # Regenerate sitemap
npm run fb-token        # Refresh Facebook OAuth token
npm run pinterest-token # Refresh Pinterest OAuth token
node scripts/retry-failed-syndication.js   # Retry any platforms that failed recently
```

## Architecture

### Two Content Lanes
- **Matt lane** (`static/blog/matt/`): Personal voice, raw/reflective writing by Matt EarthStar
- **Boom lane** (`static/blog/boom/`): SEO-optimized content under AI persona "Matty BoomBoom"

Each post is generated as standalone HTML and indexed in `static/_data/[lane]-posts.json` with fields: `{title, slug, date, excerpt, url, tags}`.

### Content Generation Pipeline
`generate-post.js` calls Claude API with lane-specific system prompts → converts markdown to HTML via `marked` → writes to `static/blog/[lane]/posts/[slug].html` → updates the lane's JSON index.

### Syndication Engine
`syndicate.js` reads recent posts, calls `generate-captions.js` for platform-specific copy, calls `select-image.js` (Pexels/local images) and Ideogram for images, then posts to: Bluesky VOA, Mastodon VOA, Facebook VOA, Instagram VOA, Threads VOA, Pinterest VOA, Dev.to, Tumblr VOA, Blogger, and WordPress EarthStar. Results are logged to `static/_data/syndication-log.json` and `static/_data/syndication-results.json`. Uses Publer API for Instagram/Threads/Pinterest and direct APIs for others.

### Drip Queue
99 pre-generated boom posts live in `static/blog/boom/drafts/`. `drip-publish.js` moves one per run from drafts → posts, updates `boom-posts.json`, and syndicates. Runs at 9am ET (self-help post) and 6pm ET (AI/creator post) via `.github/workflows/drip-posts.yml`. Auto-retry for failed platforms runs after each publish.

### Hugo Site
Hugo watches `content/posts/*.md` and renders with `layouts/` templates. The `hugo.toml` has `unsafe = true` for goldmark to allow raw HTML in markdown. Deployed to GitHub Pages via `.github/workflows/hugo.yml` on push to main.

### AURA Chatbot (Serverless)
`api/chat.js` is a Vercel serverless function (ESM) that proxies to Claude Sonnet API with the AURA system prompt. The chatbot UI lives at `/aura/`. Stripe checkout and subscription verification live in `api/create-checkout.js` and `api/verify-subscription.js`.

### Hosting
- **GitHub Pages**: Static site (built by Hugo workflow on every push to main)
- **Vercel**: Serverless functions only (`/api/*`) ~ AURA chat, Stripe checkout, backlink verification
- Vercel project ID: `prj_guDrrflKSY3FwVbmFMNyQRZyTwI9`
- Vercel org ID: `team_YNP01D3hmpGWSbkZOSV8l0O0`

## Environment Variables
Copy `.env.example` to `.env`. Required keys:
- `ANTHROPIC_API_KEY` ~ content generation and AURA chatbot
- `PEXELS_API_KEY` ~ image selection for syndication
- `IDEOGRAM_API_KEY` ~ AI image generation for Pinterest/Instagram
- `VERCEL_TOKEN` ~ push env vars to Vercel programmatically (see below)
- OAuth credentials for each social platform (see `.env.example` for full list)
- `DASHBOARD_PASSWORD` ~ protects the admin dashboard

## AGENT STANDING ORDERS

### Always wire it up ~ never ask Matt to do it manually
Matt's explicit preference: **if something can be done programmatically, do it without asking**. This applies to:

- **Vercel env vars** ~ use the Vercel API directly. `VERCEL_TOKEN` and project ID are in `.env` / `.vercel/project.json`. Push like this:
  ```js
  // Push a single env var to Vercel (all environments)
  const resp = await fetch(`https://api.vercel.com/v10/projects/prj_guDrrflKSY3FwVbmFMNyQRZyTwI9/env`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'KEY_NAME', value: 'value', type: 'encrypted', target: ['production','preview','development'] }),
  });
  // If 409 (already exists), PATCH it: /v10/projects/{id}/env/{envId}
  ```
  Or use the existing script: `npm run push:vercel-env` (pushes all .env vars to Vercel).

- **GitHub Actions secrets** ~ use `gh secret set KEY --body "value"`. Never ask Matt to go to the GitHub UI.
  ```bash
  gh secret set PUBLER_INSTAGRAM_ACCOUNT_ID --body "6a0698ee1f0e47d9f3f18a43"
  ```

- **Stripe product/price setup** ~ run `node scripts/setup-stripe.js`. It creates the product, saves the price ID to `.env`, and outputs next steps.

- **Health checks** ~ run `node scripts/check-syndication-config.js --write` locally, commit the result. Don't wait for CI to do it.

- **Syndication retries** ~ run `node scripts/retry-failed-syndication.js`. Don't ask Matt to manually re-run platforms.

- **Hugo deploys** ~ triggered automatically on every push to main. To force one: `gh workflow run hugo.yml --ref main`.

- **Drip workflow** ~ to test a drip run: `gh workflow run drip-posts.yml --ref main`.

### Key account IDs (VOA ~ do not confuse with ESR accounts)
```
PUBLER_INSTAGRAM_ACCOUNT_ID = 6a0698ee1f0e47d9f3f18a43   (VOA Instagram @vibrationofawesome)
PUBLER_THREADS_ACCOUNT_ID   = 6a069b7979cc0b32f3235166   (VOA Threads @vibrationofawesome)
PUBLER_PINTEREST_ACCOUNT_ID = 6a052b620ce3c7cac0c7ebac   (VOA Pinterest @awesomevibe)
PUBLER_PINTEREST_BOARD_ID   = 641129765641663037           (Vibration of Awesome board)
```
ESR accounts exist in Publer but are NOT used by the VOA blog engine. If an account ID looks like `673d...`, it is ESR ~ verify before using.

### Facebook token expiry
Facebook page tokens expire every ~60 days. Current expiry: **Jul 13, 2026**. The dashboard FB-V chip shows the expiry date. When expired, run `npm run fb-token` locally and commit the updated `.cache/fb-tokens.json`.

### Tumblr env var fallback
Both `syndicate.js` and `check-syndication-config.js` fall back to generic `TUMBLR_*` env vars for all prefixes (VOA/ESR). GitHub Actions only needs `TUMBLR_CONSUMER_KEY`, `TUMBLR_CONSUMER_SECRET`, `TUMBLR_TOKEN`, `TUMBLR_TOKEN_SECRET`, `TUMBLR_BLOG_NAME` ~ no `VOA_TUMBLR_*` variants needed.

### Dev.to canonical URL handling
If Dev.to returns "canonical url has already been taken", treat it as **success** ~ the post is already live from a previous run whose commit was lost. The code in `syndicate.js` handles this automatically.

### Historical syndication warnings ~ resolved, do not treat as current without fresh evidence
- **Blogger OAuth**: `syndication-log.json` contains historical Blogger failures from **Mar 24, 2026**. Live checks on **May 17, 2026** show `Blogger token refresh: token ok`, and recent Blogger successes exist on **May 14-16, 2026**. Do not run `npm run blogger-token` unless the current health check fails.
- **Publer Instagram/Threads 404s**: `syndication-log.json` contains a historical Publer `404` entry from **Mar 13, 2026**. Live checks on **May 17, 2026** confirm the VOA Instagram ID resolves to `vibrationofawesome` and the VOA Threads ID resolves to `@vibrationofawesome`; recent successful syndication exists for both platforms after that date. Treat the old `404` as stale unless a fresh run reproduces it.
- **Rule for logs**: old `syndication-log.json` errors are historical evidence, not present-tense health. Check `static/_data/syndication-health.json`, current env wiring, and recent results before escalating.

### Nav bar order (all pages)
Standard order: **Field Guide ✦ · Art Store · AURA ✦ · EarthStar ✦ · Blog**
Portfolio does NOT appear on any nav except the art store page. When generating new pages or modifying navs, enforce this order.

### Blog post template rules
- Boom posts use local images from `/images/boom/` (not external NASA API URLs)
- CTAs use content-type-aware rotation via `getNextCTA(lane, contentType)` in `scripts/lib/policy.js`
- Every post gets the art store whisper widget (`data-art-store-whisper`) after the ebook CTA
- Run `node scripts/patch-draft-posts.js` after any template change to backfill existing drafts
- Run `node scripts/backfill-art-store-whisper.js` to add the whisper to posts that predate it
- `scripts/build-blog-index.js` is a maintenance utility for `static/blog/matt/index.html`; run `npm run build:matt-index` after changing `static/_data/matt-posts.json`.

### /admin/ CMS (legacy/optional ~ do not break, do not prioritize)
`static/admin/config.yml` is a Netlify CMS (Decap CMS) config that enables a git-backed post editor at `/admin/`. It references `vibrationofawesome.netlify.app` as the auth domain and is marked **legacy/optional**. The primary post editor is the VOA Post Studio backed by `api/editor-login.js` + `api/editor-save.js`. Do not delete `static/admin/`, but do not prioritize fixing or extending it either. If you touch the admin CMS, update the `site_domain` in `static/admin/config.yml` to the correct Vercel URL.

### Art store page (DO NOT flag as 404)
`/art-store/` IS a live page. It exists at `static/art-store/index.html` and is served by GitHub Pages as `vibrationofawesome.com/art-store/`. Do not remove the `art-store` CTA from policy.js. Do not flag it as missing. It is a static directory page, not a Hugo-rendered page ~ that is why it does not appear in `content/`.

---

## ANTI-DUPLICATION PRIME DIRECTIVE

This system publishes content across 15+ platforms. Duplication is a spam risk, a compliance risk, and a brand trust risk. Every agent working in this repo must follow these rules without exception.

### Content uniqueness rules

| Content type | Rule |
|---|---|
| Main VOA post | Canonical source. Unique slug, unique title, unique body. |
| Blogger companion | AI-generated fresh article. **Unique title required.** Different angle, not a rewrite. Links back to VOA. |
| WordPress companion | AI-generated fresh article. **Unique title required.** Distinct from both VOA and Blogger versions. Links back to VOA. |
| Dev.to post | Same title as VOA (acceptable ~ canonical URL is set to VOA, preventing duplicate indexing). Body is Claude-generated caption, not the article body. |
| Tumblr post | Claude-generated caption text only. Not the article body. Links back to VOA. |
| VOA Feeder companion | AI-generated fresh article with deterministic slug suffix (`-signal`, `-shift`, `-insight`, `-guide`). Unique title. Not a rewrite. |
| Social captions | Claude generates **unique, platform-native copy** for each platform ~ Facebook, Bluesky, Mastodon, Pinterest, Threads, Instagram. Never copy-paste the same caption across platforms. |

### Slug rules
- VOA slug: `how-to-reinvent-yourself`
- WordPress slug: `how-to-reinvent-yourself-earthstar` (auto-appended in `syndicate.js`)
- Blogger slug: auto-generated from unique title via Blogger API (no custom slug needed)
- Feeder slug: `how-to-reinvent-yourself-signal` (or `-shift`, `-insight`, `-guide`)
- Dev.to slug: auto-generated by Dev.to from same title (canonical URL prevents SEO conflict)
- **Never copy the exact VOA slug to another platform that does not set a canonical URL**

### Backlink uniqueness verification
Every backlink platform article must:
1. Have a **unique title** (not copied from VOA)
2. Have a **unique body** (AI-generated from the source, not excerpted/pasted from it)
3. Include **one natural backlink** to the original VOA post
4. Set a **canonical URL** pointing to VOA where the platform supports it (Dev.to does; Blogger/WordPress do not)

### Social caption uniqueness
`generate-captions.js` calls Claude Sonnet once and generates platform-specific sections (FACEBOOK, BLUESKY, MASTODON, PINTEREST, DEVTO, TUMBLR, THREADS, INSTAGRAM). Each section is independently written for that platform's voice and format. This is the correct behavior. Do not collapse these into one shared caption.

### What to do if a duplicate is detected
- If Dev.to returns "canonical url has already been taken" → treat as **success**, do not retry
- If Blogger or WordPress returns a duplicate title error → retry with a modified title prompt
- If any platform has an existing `status: "success"` in `syndication-results.json` → skip unless `--force` is passed

---

## QUEUE DEPLETION MONITORING

The drip queue has ~98 posts of runway (as of 2026-05-17). At 1 post/run × 2 runs/day = ~2 posts/day = ~49 days. When queue drops below 30 posts, `drip-publish.js` logs a warning. When queue is empty, publishing stops silently.

**To replenish**: `node scripts/generate-all-drafts.js` ~ generates a new batch of boom drafts and adds them to the queue.

Do not wait for the queue to hit zero. Replenish proactively when the warning fires.

---

## Visual Architecture ~ System A vs System B

- **System A** is the live lightweight syndication layer. `generate-pinterest-image.js` supports the current automated post flow, and `image-registry.json` records those live asset decisions.
- **System B** is the future multi-asset visual ecosystem. `build-visual-prompts.js` prepares richer per-post visual sets and writes `visual-registry.json`, but it remains manual/future-facing today.
- The coexistence is intentional: System A keeps current publishing stable while System B is developed without changing runtime behavior.
- Eventual migration path: shared calendar/orchestration work should read approved System B assets first, then only replace the live System A path after end-to-end validation.

## IMAGE REGISTRIES (two systems ~ do not confuse)

There are two image registries in `static/_data/`. They serve different purposes and must NOT be merged until the full visual OS (System B) is wired to live syndication.

### `image-registry.json` ~ System A (live, automated syndication)
Written by `syndicate.js → recordImageUsage()` after each Pexels selection or Ideogram generation during a drip-publish run. Lightweight audit log.
- `post_slug`, `source` (ideogram/pexels/local), `url`, `platforms_used`, `pinterest_board`, `ideogram_prompt`, `timestamp`
- Capped at 500 entries (rolling)

### `visual-registry.json` ~ System B (future canonical visual OS, manual only)
Written by `scripts/lib/build-visual-prompts.js --generate`. Not created yet ~ appears on first `--generate` run. Stores all 4 visual types per post: `pinterest`, `instagram`, `sacred_diagram`, `field_guide_artifact`.
- Richer schema including per-type Ideogram prompts, dimensions, style, board
- This is the intended long-term registry once System B is wired to live syndication

### Visual system direction
- **Now**: System A is live. `generate-pinterest-image.js` runs automatically in drip/syndication.
- **Future**: System B (`build-visual-prompts.js`) becomes canonical when safely wired to the pipeline.
- **Shared calendar**: When built, should reference `visual-registry.json` (System B) as the visual asset source.
- **Do not merge or delete either file** until System B is live and tested end-to-end.

See `shared-config/visual-generation-policy-v1.md` for the full pipeline status note and brand guidelines.

---

## TOPICAL AUTHORITY SYSTEM

VOA is building long-term topical authority across 10 semantic clusters. Each cluster is a distinct territory with a pillar topic, supporting angles, related niches, and natural Pinterest board destinations.

### Cluster system files
- `static/_data/topic-clusters.json` ~ full cluster definitions (pillar, supporting angles, related niches, content type, Pinterest board)
- `static/_data/generation-memory.json` ~ rolling registry of recent hooks, titles, narrative structures, emotional arcs, opening styles (capped at 30 each)
- `static/_data/demand-signals.json` ~ scaffolded for future performance analytics (currently empty)
- `scripts/lib/generation-memory.js` ~ reads memory before generation, writes after

### The 10 clusters

| Key | Display Name | Content Type | Pinterest Board |
|---|---|---|---|
| `ai-creator-tools` | AI Creator Tools | creator | conscious-creator-tools |
| `nervous-system-creativity` | Nervous System & Creativity | nervous-system | nervous-system-reset |
| `dopamine-attention` | Dopamine & Attention | nervous-system | dopamine-detox |
| `authentic-self-expression` | Authentic Self-Expression | philosophy | vibration-of-awesome |
| `creator-automation` | Creator Automation | creator | conscious-creator-tools |
| `spiritual-productivity` | Spiritual Productivity | philosophy | purpose-and-direction |
| `purpose-direction` | Purpose & Direction | philosophy | purpose-and-direction |
| `building-life-that-fits` | Building a Life That Feels Like Yours | philosophy | empower-thyself |
| `emotional-regulation` | Emotional Regulation | nervous-system | nervous-system-reset |
| `consciousness-technology` | Consciousness & Technology | earthstar | earthstar |

### How clusters are used in generation

```bash
# Generate with explicit cluster context
node scripts/generate-post.js --lane boom --keyword "..." --cluster ai-creator-tools

# Cluster is auto-detected from niche if not provided
node scripts/generate-post.js --lane boom --niche ai-creator-tools --keyword "..."
```

When a `--cluster` or `--niche` is provided:
1. `generate-post.js` loads the cluster definition from `topic-clusters.json`
2. Injects the cluster pillar + supporting angles into the generation prompt (so Claude knows what territory we're in)
3. Loads `generation-memory.js` to get recent hooks/titles/structures for this niche
4. Injects the differentiation context ("avoid these recent patterns")
5. After generation, records the new post's hook, title, arc, and opening style to `generation-memory.json`

### Internal link scaffolding (v1)
`buildExistingPostsList()` in `generate-post.js` already provides Claude with a list of published posts for internal linking. Future enhancement: filter by cluster membership so Claude naturally links related posts within the same topical territory.

Posts have a `cluster` field in `{lane}-posts.json` metadata as of this pass. This enables future cluster-aware internal link suggestions.

---

## COMPANION ECOSYSTEM ARCHITECTURE

Every VOA post generates a content ecosystem. Each piece in the ecosystem has a distinct role:

```
VOA canonical post (primary)
├── Feeder companion article (SEO backlink ~ distinct angle, unique title)
├── Blogger companion article (SEO backlink ~ distinct angle, unique title)
├── WordPress companion article (SEO backlink ~ distinct angle, unique title)
├── Dev.to post (same title + canonical URL ~ not a duplicate by design)
├── Tumblr post (Claude caption ~ text post, not an article)
│
├── Platform-native social transformations
│   ├── Bluesky VOA (single punchy thought, under 300 chars)
│   ├── Mastodon VOA (contextual 2-3 sentences + hashtags)
│   ├── Facebook VOA (conversational question + link)
│   ├── Threads VOA (original mini-thread, 3-part format)
│   ├── Instagram VOA (visual hook + emotional context, no link)
│   └── Pinterest VOA (Ideogram AI image + keyword-rich description + board)
│
└── Future: ESR crossover (ESR-voice caption for philosophy/earthstar content types)
```

### Platform transformation philosophy

Syndication is NOT copy-paste distribution. Each platform receives a **transformation** of the source content, not a copy of it.

| Platform | Transformation type | Voice | URL in post? |
|---|---|---|---|
| Feeder | Companion article (distinct angle) | Matt EarthStar voice | Yes (backlink) |
| Blogger | Companion article (distinct angle) | Matt EarthStar voice | Yes (backlink) |
| WordPress | Companion article (distinct angle) | EarthStarRising voice | Yes (backlink) |
| Dev.to | Article teaser (unique body, same title + canonical URL) | Technical/creator angle | Yes (canonical) |
| Tumblr | Text post (Claude-generated caption, aesthetic tone) | Matt/BoomBot mix | Yes |
| Bluesky | Single thought (≤300 chars, zero hashtags) | Direct | Yes |
| Mastodon | Contextual 2-3 sentences + 2-3 hashtags | Thoughtful | Yes |
| Facebook | Conversational 2-3 sentences + question | Conversational | Yes |
| Threads | 3-part native mini-thread (1/3, 2/3, 3/3) | Reflective | Yes (in 3/3) |
| Instagram | Visual hook + emotional context + hashtags | Raw/cosmic | No (no clickable links) |
| Pinterest | AI-generated image (Ideogram) + keyword description + board | Evergreen/visual | Yes |

### Future transformation direction (do not implement yet)

The direction is: **transform content into platform-native variants, not suppress it.**

Instead of:
> "nervous-system content is too clinical for Instagram ~ suppress"

Move toward:
> "nervous-system content on Instagram = atmospheric image or grounding quote card + minimal emotional caption"

Platform-specific transformation variants to build when the time comes:
- **Instagram weak visual-fit** → quote card / atmospheric still / abstract visual + short emotional caption
- **Threads weak video-fit** → native conversational text transformation, not a caption
- **Facebook weak engagement-fit** → shorter reflective post, not a link-dump
- **Pinterest weak board-fit** → reroute to `vibration-of-awesome` board rather than suppress entirely

This direction is documented here so future architecture does not hardcode assumptions that prevent it.

---

## INSTAGRAM + THREADS ROUTING PHILOSOPHY

VOA Instagram (`@vibrationofawesome`) and VOA Threads (`@vibrationofawesome`) are **early-growth accounts**. During this phase, posting consistency and brand familiarity matter more than optimal content-type fit.

**Current rule**: ALL content types now route to both Instagram and Threads.

**Only suppression remaining**: Pinterest is still suppressed for `philosophy` content type (discovery/intent mismatch ~ philosophy posts don't get saved or reshared on Pinterest the way tools/wellness content does).

**When to revisit**: When Instagram has meaningful engagement data (>5k followers or 3+ months of post history), reintroduce content-type filtering based on actual engagement signal ~ not assumptions.

**ESR accounts are unaffected**: This routing change applies ONLY to VOA Instagram and VOA Threads. ESR accounts remain suppressed by default for VOA blog posts.

---

## GENERATION MEMORY SYSTEM

Every time `generate-post.js` creates a post, it records the post's:
- Opening hook (first substantive sentence)
- Title
- Narrative structure (e.g. "numbered-list with subheadings", "flowing narrative")
- Emotional arc (e.g. "pain-open → insight → hope + action close")
- Opening style (e.g. "question opening", "personal story opening")

This record is stored in `static/_data/generation-memory.json` (rolling window of 30 per category).

Before the next generation, `getDifferentiationContext()` reads this memory and injects a "DIFFERENTIATION CONTEXT" block into the Claude prompt, listing recent patterns to avoid. This prevents:
- Same title cadence repeating ("How to X When Y")
- Same opening style recurring ("If you're...")
- Same emotional arc ("pain → insight → action") dominating every post
- Same narrative structure ("6+ H2 sections") becoming the default

**Memory is per-niche**: the differentiation context is filtered by the current niche/cluster so cross-niche variation doesn't create false constraints.

---

## SEMANTIC DIFFERENTIATION RULES (BAKED INTO GENERATION)

Future Boom Frequency posts must vary across:

1. **Opening style** ~ rotate through: question, blunt statement, personal story, scene-setting, counter-intuitive claim, mystery/information-gap, social proof/counter-claim, direct reader address, reveal/answer-first
2. **Narrative structure** ~ rotate through: flowing narrative, moderate sections, heavily sectioned, list-driven, narrative with blockquote, argument-style
3. **Emotional arc** ~ rotate through: pain → insight → action, certainty → doubt → clarity, curiosity → revelation → commitment, frustration → acceptance → move, neutral → concrete action
4. **Title cadence** ~ avoid repeating "How to X When Y", "Why X Doesn't Work", "The X Guide to Y" in back-to-back posts
5. **CTA pattern** ~ the CTA rotation in `policy.js` already handles this; do not hardcode the same CTA in generation prompts

The BOOMBOT_SYSTEM prompt already encodes tone rules. The differentiation context layer (from generation-memory.js) adds the *recent history* awareness that prevents Claude from defaulting to its most common patterns.

---

## SHARED CALENDAR ARCHITECTURE (FUTURE ~ DO NOT BUILD YET)

When the shared calendar is built, it will be the single source of truth for all scheduled and published content across VOA and ESR. Schema stub for reference:

```json
{
  "event_id": "uuid",
  "content_id": "post-slug",
  "brand": "VOA | ESR",
  "lane": "boom | matt | esr",
  "content_type": "creator | philosophy | nervous-system | earthstar | general",
  "niche": "ai-creator-tools | dopamine-detox | ...",
  "status": "draft | queued | published | syndicated | promoted | retired",
  "scheduled_at": "ISO 8601",
  "published_at": "ISO 8601",
  "syndications": [{ "platform": "bluesky_voa", "status": "published", "url": "..." }],
  "campaign_id": null,
  "assets": { "hero_image": { "source": "pexels", "url": "..." } },
  "feeder": { "status": "published", "feeder_url": "..." },
  "performance": { "pinterest_saves": 0, "bluesky_likes": 0 }
}
```

Do NOT implement the calendar system until explicitly instructed. Only reference this schema when planning.
