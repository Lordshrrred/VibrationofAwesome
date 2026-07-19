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

# Deterministic internal linking / topical authority
npm run links:audit       # Audit Boom posts/drafts for internal-link coverage
npm run links:apply       # Backfill/refresh generated related-reading blocks

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

Each post is generated as standalone HTML and indexed in `static/_data/[lane]-posts.json` with fields such as `{title, slug, date, excerpt, url, tags, niche, cluster}`.

### Content Generation Pipeline
`generate-post.js` calls Claude API with lane-specific system prompts → converts markdown to HTML via `marked` → writes to `static/blog/[lane]/posts/[slug].html` → updates the lane's JSON index.

### Syndication Engine
`syndicate.js` reads recent posts, calls `generate-captions.js` for platform-specific copy, calls `select-image.js` (Pexels/local images) and Ideogram for images, then posts to: Bluesky VOA, Mastodon VOA, Facebook VOA, Instagram VOA, Threads VOA, Pinterest VOA, Dev.to, Tumblr VOA, Blogger, and WordPress EarthStar. Results are logged to `static/_data/syndication-log.json` and `static/_data/syndication-results.json`. Uses Publer API for Instagram/Threads/Pinterest and direct APIs for others.

### Drip Queue
Pre-generated Boom posts live in `static/blog/boom/drafts/`. `drip-publish.js` moves selected drafts → posts, updates `boom-posts.json`, regenerates the sitemap, writes `drip-last-published.json`, and lets `post-live-syndicate.js` syndicate only after the canonical VOA URL is live.

Current schedule in `.github/workflows/drip-posts.yml` (Phase Three, active July 4 2026):
- `9:00 AM ET` (`0 13 * * *`) ~ normal Boom post, full social + full backlinks
- `12:00 PM ET` (`0 16 * * *`) ~ AI Advantage campaign, SEO backlinks only (no social)
- `3:00 PM ET` (`0 19 * * *`) ~ AI Advantage campaign, SEO backlinks only (no social)
- `6:00 PM ET` (`0 22 * * *`) ~ normal Boom post, full social + full backlinks
- `9:00 PM ET` (`0 1 * * *`) ~ art-buyer post, full backlinks only (devto2 + Blogger + WP + Tumblr), no social, no feeder

Social accounts get exactly **2 posts/day** (9am and 6pm slots only). AI Advantage publishes 2/day (noon + 3pm). Normal posts publish 2/day with social distribution. Art buyer publishes 1/day backlinks-only. ~36 AI Advantage posts remaining as of July 4 → campaign finishes ~July 22.

Art-extra queue items use `syndication_profile: "art-devto2-only"`, `syndicate_on_publish: true`, and `trigger_feeder_on_publish: false`. Despite the profile name, the `art-devto2-only` profile now routes to the full backlink tier (devto2 + blogger + wordpress_earthstar + tumblr_voa) ~ social and feeder remain suppressed.

### Hugo Site
Hugo watches `content/posts/*.md` and renders with `layouts/` templates. The `hugo.toml` has `unsafe = true` for goldmark to allow raw HTML in markdown. Deployed via Vercel (auto-deploys on push to main via GitHub webhook).

### AURA Chatbot (Serverless)
`api/chat.js` is a Vercel serverless function (ESM) that proxies to Claude Sonnet API with the AURA system prompt. The chatbot UI lives at `/aura/`. Stripe checkout and subscription verification live in `api/create-checkout.js` and `api/verify-subscription.js`.

### Hosting
- **Vercel**: Static site + serverless functions (`/api/*`) ~ AURA chat, Stripe checkout, backlink verification. Auto-deploys on push to main via GitHub webhook.
- **Cloudflare**: DNS, SSL, front door. Both `vibrationofawesome.com` and `www` route to Vercel.
- **GitHub**: Source control only. GitHub Pages is retired.
- Vercel project ID: `prj_guDrrflKSY3FwVbmFMNyQRZyTwI9`
- Vercel org ID: `team_YNP01D3hmpGWSbkZOSV8l0O0`

## Hero image size (technical SEO)

`static/images/boom/` is the local NASA/Hubble hero-image pool (referenced from posts as CSS `background-image` on the post header, not `<img>` tags ~ so they're invisible to Google Image Search regardless of size, and carry no alt text). On 2026-07-09 these were found being served at up to 18000x18000px / 37MB each, `fetchpriority="high"` preloaded ~ directly hurting Largest Contentful Paint (Core Web Vitals, a Google ranking factor). Fixed via `scripts/optimize-hero-images.js` (uses `sharp`, added as a dependency): resized to a 1600px long edge, JPEG quality 80, **in place** (same filename) for the 10 JPGs so no post HTML needed updating; the 2 PNGs were converted to JPEG (photographic content compresses far better as JPEG) which did require updating the post files that referenced the old `.png` path ~ the script does that automatically. Result: the ~162MB of images actually referenced by live posts dropped to ~3MB (98.2% reduction), verified zero broken references afterward.

`scripts/patch-draft-posts.js`'s `BOOM_IMAGES` array is a **rotation pool** for assigning hero images to future draft posts ~ several of its entries aren't referenced by any *currently published* post, so don't treat "unreferenced by a live post" as "safe to delete" without checking this list first. Separately, 5 genuinely-unused full-res images (referenced only in historical `static/_data/image-registry.json` / `syndication-log.json` audit entries, not by any script or post) were deleted, saving ~343MB of repo bloat.

**Known gap, not yet fixed:** no favicon exists anywhere on the site (not in `layouts/_default/baseof.html`, not in any post, no `static/favicon.ico`). Needs actual brand art direction, not a placeholder ~ flagged for a future pass.

## Legacy archive redirects (Matt lane)

The 16 `isArchive: true` posts in `static/_data/matt-posts.json` (old pre-2026 content like `self-love-acceptance`, `vibration-of-awesome`, `indigo-children-*`) live at `static/blog/matt/posts/{slug}/index.html`. Old external links sometimes use a flat `{slug}.html` form for these ~ that compatibility redirect is handled via a `vercel.json` `redirects` entry (`/blog/matt/posts/{slug}.html` → the real directory URL), generated automatically by `scripts/generate-legacy-redirects.js`.

**Do not** create a physical `static/blog/matt/posts/{slug}.html` file for this purpose ~ under Vercel's `cleanUrls: true`, a flat `{slug}.html` file takes routing priority over `{slug}/index.html` for the clean URL, so the flat file silently shadows the real article at its own canonical URL. This exact bug shipped and went undetected until Google Search Console flagged it (`Excluded by 'noindex' tag` for 3 posts already crawled, `Discovered - currently not indexed` for the other 13) ~ found and fixed 2026-07-19. `generate-legacy-redirects.js` now writes to `vercel.json` instead of creating the colliding file, and guards `parseArchiveCanonical()`'s legacy-path branch against writing back over the same file it just read the canonical tag from (the original bug: an archive post's canonical self-references its own URL, so the "legacy path" resolved to the post's own file, and `writeRedirect()` overwrote the real article with a redirect-to-itself stub).

All 16 archive posts also had `<meta name="robots" content="noindex, follow">` baked into their own HTML by `scripts/build-archive.js`'s import template (left over from the original Wayback Machine import, never revisited once they became live canonical content). Flipped to `index, follow` on 2026-07-19, both in the template (so any future rerun doesn't regress it) and in the 16 already-generated files.

**Boombot → boom rename left no redirect (fixed 2026-07-19):** the Boom lane was originally served at `/blog/boombot/` before being renamed to `/blog/boom/` (see `scripts/fix-boombot-urls.cjs` / `scripts/archive/rename-boombot.js`, both migration cleanup scripts, not active). No redirect was ever added for the old namespace, so any old `/blog/boombot/...` backlink 404s. Added `vercel.json` redirects: `/blog/boombot/:path*` → `/blog/boom/:path*`, plus a specific fix for a truncated `/blog/boom/posts/ai` stray link → `/blog/boom/posts/ai-tools-for-independent-artists`. Found via GSC's "Not found (404)" report.

## Environment Variables
Copy `.env.example` to `.env`. Required keys:
- `ANTHROPIC_API_KEY` ~ content generation and AURA chatbot
- `PEXELS_API_KEY` ~ image selection for syndication
- `IDEOGRAM_API_KEY` ~ AI image generation for Pinterest/Instagram
- `VERCEL_TOKEN` ~ push env vars to Vercel programmatically (see below)
- OAuth credentials for each social platform (see `.env.example` for full list)
- `DASHBOARD_PASSWORD` ~ protects the admin dashboard
- `DEVTO_API_KEY` ~ primary Dev.to account
- `DEVTO2_API_KEY` ~ second Dev.to account used only by art-buyer extra slots unless explicitly requested

## Claude API usage & cost architecture

All Claude API call sites construct their client via `scripts/lib/anthropic-client.js` (`createAnthropicClient({ label })`), not `new Anthropic()` directly ~ it pins `maxRetries: 3` and logs a warning on every 429/5xx the SDK retries, so a runaway retry loop shows up in logs instead of silently burning spend. `api/chat.js` (AURA, raw `fetch` rather than the SDK) has its own equivalent `callAnthropicWithRetry()` with the same cap and logging.

Model tiers by task:
- **Full long-form generation, flagship reader-facing content** (blog post bodies in `generate-post.js`, `generate-from-inspiration.js`) ~ Opus. Do not downgrade without asking first.
- **Full-length but backlink/SEO-plumbing content, not reader-facing** (Blogger/WordPress companion articles in `syndicate.js`) ~ downgraded from Opus 4.6 to **Sonnet 5** on 2026-07-09. This call site fires unconditionally on every syndication run (5x/day via `drip-posts.yml`'s always-on backlink tier) ~ it was the single largest recurring Opus cost line in the system (10 Opus calls/day), and companion articles aren't what a reader judges the brand by, so the quality/cost tradeoff favors Sonnet here specifically.
- **Lighter tasks** (social captions in `generate-captions.js`, Pinterest/Instagram visual prompts, health-check diagnosis in `auto-heal.js`, one-off cluster classification) ~ Haiku.
- **Manual keyword/search research** (`seo-research.js`, invoked explicitly through `npm run seo:research`) ~ **Sonnet 5**, not Sonnet 4.6 ~ Sonnet 5's introductory pricing ($2/$10 per MTok through 2026-08-31) is currently *cheaper* than Sonnet 4.6 ($3/$15) as well as newer/better, so there's no cost argument for using 4.6 for opt-in research right now. Routine SEO intelligence does **not** call Claude or web search.

Prompt caching (`cache_control: {type: "ephemeral"}`) is applied where it can actually engage. Caching is a **prefix match with a model-dependent minimum** (Opus-tier needs ~4096 tokens in the cached prefix, Sonnet-tier needs ~2048) ~ a short system prompt marked `cache_control` on its own often sits below that floor and silently never caches. `generate-post.js` is the one call site big enough to matter: the existing-posts list (`buildExistingPostsList()`, several thousand tokens, byte-identical across an entire `generate-all-drafts.js` batch run) is placed first in the user message behind a cache breakpoint via `buildCachedUserContent()`, combined with the system prompt, so the combined prefix clears the Opus minimum. Check `usage.cache_read_input_tokens` on a batch run to confirm hits before assuming caching is helping. Verified live on 2026-07-07: a real two-call test against `generate-post.js`'s exact code path showed `cache_creation_input_tokens: 13294` on call 1 and `cache_read_input_tokens: 13294` on call 2 ~ confirmed working. AURA's system prompt in `api/chat.js` and the system prompt in `seo-research.js` are marked with `cache_control` but measure well under the ~2048-token Sonnet floor (AURA ~534, search research short) ~ harmless, structurally correct, but currently a no-op until those prompts grow. `syndicate.js`'s Blogger/WordPress system prompts were deliberately left uncached: each fires once per `syndicate.js` invocation, not in a loop within a single run, so there's no repeated-prefix-in-one-run benefit to capture.

`scripts/auto-heal.js` (run by `.github/workflows/voa-watchdog.yml`, **not** `platform-health.yml` ~ that file doesn't exist in this repo) has a hard cooldown: minimum 1 hour between runs (checked against `scripts/.last-autoheal-timestamp`, committed only on an actual run, never on a skip) and max 3 runs/day (checked against `static/_data/heal-log.json`'s today-dated entries, which naturally resets at UTC midnight since it's an ISO-date string match). Both checks run before anything else, including the Claude call. Without them, `voa-watchdog.yml` could self-retrigger without limit ~ it fires on every `drip-posts.yml`/`syndication-catchup.yml` failure via `workflow_run`, plus a daily 3:30am schedule, plus manual dispatch, and Tier 1's `retriggerDrip()` can itself cause the very workflow that re-triggers the watchdog. `auto-heal.js` prints `AUTOHEAL_STATUS=ran|skipped-cooldown|skipped-max-attempts` as its last line; the workflow's "Log auto-heal status" step captures that and appends a line to `scripts/syndication_log.txt` on every trigger, run or skipped, so there's a paper trail even when nothing executed.

### SEO Intelligence (`scripts/seo_intelligence.js`)

Weekly check (`.github/workflows/weekly-seo-intelligence.yml`, every Wednesday 9am UTC + manual dispatch) that uses Google Search Console Search Analytics and the GA4 Data API to identify page/query opportunities from actual Google visibility and actual organic visitor behavior. Default run makes zero Anthropic/OpenAI/paid web-search/rank-check calls. It writes `reports/seo-intelligence-latest.md`, a dated report, and a public-safe summary at `static/_data/seo-intelligence.json`, then appends a one-line summary to `scripts/syndication_log.txt`.

Required environment variables: `GA_CREDENTIALS_JSON` or `GOOGLE_SERVICE_ACCOUNT_JSON` (service-account JSON), `GA_PROPERTY_ID`, and optionally `GSC_SITE_URL` (defaults to `https://vibrationofawesome.com/`). The service account needs Search Console read access for the property and GA4 read access for the property. Raw/cached API responses stay under `.cache/seo-intelligence/`, which is ignored; only the small summary JSON is public.

Run manually: `npm run seo:intelligence` (or `node scripts/seo_intelligence.js --days 28 --refresh` to force fresh API pulls). Normal uncached run uses two Search Console requests and three GA4 Data API requests; cached runs reuse `.cache/seo-intelligence/`.

Manual competitive/model research is separate and explicitly cost-gated: `npm run seo:research -- --query "example query" --confirm-cost` or the existing lower-level `npm run research` path. Do not schedule it or use it as routine rank tracking.

### SEO Intelligence dashboard panel (`static/dashboard/index.html`)

Added to the existing password-gated dashboard (not a separate page). Reads three static JSON files client-side, no API calls from the browser:
- `static/_data/topic-clusters.json` + `static/_data/boom-posts.json` ~ **cluster coverage**: post count per cluster, sorted descending, unclustered-post count called out separately.
- `static/_data/seo-intelligence.json` ~ compact Search Console/GA4 status, opportunity counts, and the top three recommended SEO actions from the latest run.

All three panels render an empty/loading state gracefully before the first `weekly-seo-intelligence.yml` run has produced `seo-intelligence.json`. Render function: `renderSeoIntelligence()` (calls `renderClusterCoverage()`, `renderSeoTrend()`, `renderSeoKeywords()`), wired into `loadDashboard()`.

### Cluster metadata backfill (`scripts/backfill-cluster-metadata.js`)

Zero-API-cost fix for posts missing a `cluster` field in `boom-posts.json` ~ runs the existing local `inferCluster()` keyword heuristic (`scripts/lib/internal-linking.js`, no Claude calls) and writes the result back. Dry run by default, `--execute` to write, same convention as `backfill-feeder.js`/`backfill-backlinks.js`.

Run 2026-07-08: 68 of 80 unclustered posts matched and were backfilled for free. 12 posts remain unmatched (titles too generic for the regex rules ~ e.g. "Why You Feel Stuck in Life") and would need either better `KEYWORD_CLUSTER_RULES` patterns or a cheap Haiku classification pass to resolve. **Real, non-labeling gap surfaced by this run**: even with full backfill applied, `creator-automation` and `consciousness-technology` have zero posts, and `ai-creator-tools` now holds 112/145 posts (77%) ~ the site's cluster distribution is genuinely lopsided, not just mislabeled. Closing that requires new content in the empty/thin clusters, which costs real Opus spend per post ~ get budget/count confirmation before generating, don't auto-generate a batch.

## AGENT STANDING ORDERS

### Prime directive: read and maintain repo memory before building
Every AI agent touching this repo must orient from the agent/documentation files before making non-trivial changes. Do **not** build in the dark.

Before implementing, review at minimum:
- `CLAUDE.md` ~ current operating rules, architecture, standing orders, active strategy
- `README.md` ~ project onboarding and canonical workflow notes
- `content-strategy/niche-map.md` ~ content niches and strategic positioning
- `static/_data/topic-clusters.json` ~ topical-authority cluster map
- `shared-config/syndication-policy-v1.md` ~ syndication/backlink/social routing rules
- `shared-config/visual-generation-policy-v1.md` ~ visual generation rules when touching imagery/social visuals

After implementing any meaningful system, strategy, automation, publishing, syndication, SEO, or content-architecture change, update the relevant markdown/data memory files in the same pass. If behavior changes and the agent docs do not change, the work is incomplete.

Concrete rule: future agents should be able to read the docs above and understand what the repo is doing, why it is doing it, and what must not be broken. This is mandatory, not optional housekeeping.

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
PUBLER_FACEBOOK_ACCOUNT_ID  = 5f189becdb27977d231aea50   (VOA Facebook Page "Vibration of Awesome" ~ fb_page)
```
ESR accounts exist in Publer but are NOT used by the VOA blog engine. If an account ID looks like `673d...`, it is ESR ~ verify before using.

### Facebook token expiry
Facebook page tokens expire every ~60 days. Current expiry: **Jul 13, 2026**. The dashboard FB-V chip shows the expiry date. When expired, run `npm run fb-token` locally and commit the updated `.cache/fb-tokens.json`.

### Tumblr env var fallback
Both `syndicate.js` and `check-syndication-config.js` fall back to generic `TUMBLR_*` env vars for all prefixes (VOA/ESR). GitHub Actions only needs `TUMBLR_CONSUMER_KEY`, `TUMBLR_CONSUMER_SECRET`, `TUMBLR_TOKEN`, `TUMBLR_TOKEN_SECRET`, `TUMBLR_BLOG_NAME` ~ no `VOA_TUMBLR_*` variants needed.

### Dev.to canonical URL handling
If Dev.to returns "canonical url has already been taken", treat it as **success** ~ the post is already live from a previous run whose commit was lost. The code in `syndicate.js` handles this automatically.

### Dev.to account 2 / art-buyer extra slots
`DEVTO2_API_KEY` is supported by `scripts/syndicate.js` as platform key `devto2`. It is intentionally **not** part of the default backlink tier. It runs only when explicitly requested with `--platforms devto2` or via the drip item profile `art-devto2-only`.

Art-buyer posts run the `art-devto2-only` syndication profile which routes to the full backlink tier: devto2 + Blogger + WordPress + Tumblr. Social platforms (Publer/Instagram/Threads/Pinterest/Facebook/Bluesky/Mastodon) and the Feeder are suppressed for art posts ~ social volume stays at 2 posts/day max.

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
`/art-store/` IS a live page. It exists at `static/art-store/index.html` and is served by Vercel as `vibrationofawesome.com/art-store/`. Do not remove the `art-store` CTA from policy.js. Do not flag it as missing. It is a static directory page, not a Hugo-rendered page ~ that is why it does not appear in `content/`.

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

The active drip queue currently mixes normal posts and art-buyer extra posts. At `drip_rate: 1`, the normal slots publish ~2/day, while art-extra slots publish up to 2/day only when queued `art-buyer-intent` items exist. When queue drops below 30 posts, `drip-publish.js` logs a warning. When queue is empty, publishing stops silently.

**To replenish**: `node scripts/generate-all-drafts.js` ~ generates a new batch of boom drafts and adds them to the queue.

Do not wait for the queue to hit zero. Replenish proactively when the warning fires.

**Drafts are deleted on publish (fixed 2026-07-19):** `drip-publish.js` copies a draft from `static/blog/boom/drafts/` to `static/blog/boom/posts/`, then deletes the source draft file (both on a normal publish and on the collision-guard path where `posts/` already has the file). Previously the draft was never deleted, so every published post left a duplicate-content file sitting in the publicly-crawlable `drafts/` directory ~ 163 stale duplicates had accumulated before this was caught via a Google Search Console "Alternate page with proper canonical tag" report and cleaned up. `static/blog/boom/drafts/` is also now blocked in `robots.txt` as defense-in-depth for the legitimate pending queue.

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

VOA is building long-term topical authority across 11 semantic clusters. Each cluster is a distinct territory with a pillar topic, supporting angles, related niches, and natural Pinterest board destinations.

### Cluster system files
- `static/_data/topic-clusters.json` ~ full cluster definitions (pillar, supporting angles, related niches, content type, Pinterest board)
- `static/_data/generation-memory.json` ~ rolling registry of recent hooks, titles, narrative structures, emotional arcs, opening styles (capped at 30 each)
- `static/_data/demand-signals.json` ~ scaffolded for future performance analytics (currently empty)
- `scripts/lib/generation-memory.js` ~ reads memory before generation, writes after
- `scripts/lib/internal-linking.js` ~ deterministic cluster-aware internal-link selection/insertion
- `scripts/internal-linking.js` ~ CLI audit/apply tool for related-reading blocks

### The 11 clusters

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
| `art-buying-online` | Buying Art Online | earthstar | earthstar / vibration-of-awesome |
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

### Deterministic internal linking
Internal linking is now both prompt-driven and deterministic:

1. `buildExistingPostsList()` in `generate-post.js` still gives Claude existing posts for natural contextual links.
2. `scripts/lib/internal-linking.js` infers each post's cluster from `cluster`, `niche`, title, slug, keyword, and excerpt.
3. `ensureDeterministicInternalLinks()` inserts a generated `<section data-internal-related ...>` related-reading block before the signature/CTA area.
4. The block prefers same-cluster posts, then related-cluster posts, and adds the right money-page link where appropriate:
   - AI/creator clusters → `/ai-engine/`
   - art-buying cluster → `/art-store/`
   - self-help/nervous-system/philosophy clusters → `/field-guide/`
5. `drip-publish.js` runs the deterministic linker at publish time before writing the post file and `boom-posts.json`.
6. `generate-post.js` also runs the linker for direct non-drip generation.

Maintenance commands:

```bash
npm run links:audit
npm run links:apply
```

`npm run links:audit` reports body/contextual link count plus generated related-reading links. `npm run links:apply` refreshes generated blocks across Boom posts/drafts. Run `npm run check:emdash` after large link backfills.

Posts should carry `niche` and `cluster` metadata in `boom-posts.json` whenever the queue/source item knows it. Older posts without metadata are cluster-inferred.

**Reciprocal back-linking (added 2026-07-10):** `ensureDeterministicInternalLinks()` only makes the *new* post link forward to 2-3 older ones. `backlinkOlderPosts()` in the same file does the reverse ~ after a boom post is generated (published, not draft), it mutates each of those older posts' HTML files on disk to add a link back to the new post's `Related reading` section (creating the section if the older post doesn't have one). Idempotent (skips a post that already links to the new one), and skips rather than corrupts a file with no recognizable insertion point. Wired into `generate-post.js` right after the forward-link step, gated on `!isDraft`.

### AI-search-optimized content structure (added 2026-07-10)

Audited against 6 criteria (direct-answer-first per H2, FAQ schema, Article/HowTo schema, named/specific detail per post, question-phrased H2s, topic-cluster interlinking) by checking 3 real live posts per lane against the actual HTML output, not just the prompt. Findings: schema was BlogPosting-only (no FAQ/HowTo), H2s were 0% question-phrased, zero data points/named specifics in the 2 most recent posts, internal linking existed but was forward-only (no back-links), and none of this applied to Matt lane (personal-voice blog, intentionally excluded from these SEO-structure requirements ~ see below).

`BOOMBOT_SYSTEM` in `generate-post.js` now has an "AI-SEARCH-OPTIMIZED STRUCTURE" block requiring: H2s phrased as natural questions (not topic labels); the first 1-2 sentences under each H2 directly answering that H2's question, before any story/setup (this is per-section, and does not override the existing opening-hook rule for the article's intro); at least one concrete named tool/technique/fact per post (never a fabricated statistic ~ works alongside the existing TRUTHFULNESS RULES); `Step 1:`/`Step 2:`-style headers for genuine how-to posts; and a `## FAQ` section (3-5 `**Q: ...?**` pairs) before the closing CTA.

**Schema pipeline:** `extractFaqPairs()` and `extractHowToSteps()` parse the FAQ section and any `Step N:` headers out of the raw markdown (before HTML conversion) and `buildFaqSchema()`/`buildHowToSchema()` turn them into FAQPage/HowTo JSON-LD, injected into `buildHtml()`'s `<head>` via a new `extraSchemas` parameter (only when the corresponding content is actually present ~ HowTo needs ≥2 steps, FAQ needs ≥1 parsed pair). The existing BlogPosting schema block's `@type` is now `["BlogPosting","Article"]` (BlogPosting is already an Article subtype in schema.org; the array makes it explicit rather than implicit). **Boom-only** ~ Matt lane doesn't get FAQ/HowTo schema or the new structural prompt rules; it's personal-voice writing, not SEO-targeting content, and forcing FAQ sections into personal essays would fight the lane's actual purpose.

Verified live 2026-07-10 with two real generations: a draft (FAQPage + HowTo schema both generated, all 5 H2s question-phrased and direct-answer-first, named tools present) and a published post (confirmed `backlinkOlderPosts()` correctly mutated 3 older posts' HTML on disk, verified balanced `<section>` tags after).

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
