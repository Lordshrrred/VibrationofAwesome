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
- **Vercel**: Serverless functions only (`/api/*`) — AURA chat, Stripe checkout, backlink verification
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

### Always wire it up — never ask Matt to do it manually
Matt's explicit preference: **if something can be done programmatically, do it without asking**. This applies to:

- **Vercel env vars** — use the Vercel API directly. `VERCEL_TOKEN` and project ID are in `.env` / `.vercel/project.json`. Push like this:
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

- **GitHub Actions secrets** — use `gh secret set KEY --body "value"`. Never ask Matt to go to the GitHub UI.
  ```bash
  gh secret set PUBLER_INSTAGRAM_ACCOUNT_ID --body "6a0698ee1f0e47d9f3f18a43"
  ```

- **Stripe product/price setup** — run `node scripts/setup-stripe.js`. It creates the product, saves the price ID to `.env`, and outputs next steps.

- **Health checks** — run `node scripts/check-syndication-config.js --write` locally, commit the result. Don't wait for CI to do it.

- **Syndication retries** — run `node scripts/retry-failed-syndication.js`. Don't ask Matt to manually re-run platforms.

- **Hugo deploys** — triggered automatically on every push to main. To force one: `gh workflow run hugo.yml --ref main`.

- **Drip workflow** — to test a drip run: `gh workflow run drip-posts.yml --ref main`.

### Key account IDs (VOA — do not confuse with ESR accounts)
```
PUBLER_INSTAGRAM_ACCOUNT_ID = 6a0698ee1f0e47d9f3f18a43   (VOA Instagram @vibrationofawesome)
PUBLER_THREADS_ACCOUNT_ID   = 6a069b7979cc0b32f3235166   (VOA Threads @vibrationofawesome)
PUBLER_PINTEREST_ACCOUNT_ID = 6a052b620ce3c7cac0c7ebac   (VOA Pinterest @awesomevibe)
PUBLER_PINTEREST_BOARD_ID   = 641129765641663037           (Vibration of Awesome board)
```
ESR accounts exist in Publer but are NOT used by the VOA blog engine. If an account ID looks like `673d...`, it is ESR — verify before using.

### Facebook token expiry
Facebook page tokens expire every ~60 days. Current expiry: **Jul 13, 2026**. The dashboard FB-V chip shows the expiry date. When expired, run `npm run fb-token` locally and commit the updated `.cache/fb-tokens.json`.

### Tumblr env var fallback
Both `syndicate.js` and `check-syndication-config.js` fall back to generic `TUMBLR_*` env vars for all prefixes (VOA/ESR). GitHub Actions only needs `TUMBLR_CONSUMER_KEY`, `TUMBLR_CONSUMER_SECRET`, `TUMBLR_TOKEN`, `TUMBLR_TOKEN_SECRET`, `TUMBLR_BLOG_NAME` — no `VOA_TUMBLR_*` variants needed.

### Dev.to canonical URL handling
If Dev.to returns "canonical url has already been taken", treat it as **success** — the post is already live from a previous run whose commit was lost. The code in `syndicate.js` handles this automatically.

### Nav bar order (all pages)
Standard order: **Field Guide ✦ · Art Store · AURA ✦ · EarthStar ✦ · Blog**
Portfolio does NOT appear on any nav except the art store page. When generating new pages or modifying navs, enforce this order.

### Blog post template rules
- Boom posts use local images from `/images/boom/` (not external NASA API URLs)
- CTAs use content-type-aware rotation via `getNextCTA(lane, contentType)` in `scripts/lib/policy.js`
- Every post gets the art store whisper widget (`data-art-store-whisper`) after the ebook CTA
- Run `node scripts/patch-draft-posts.js` after any template change to backfill existing drafts
- Run `node scripts/backfill-art-store-whisper.js` to add the whisper to posts that predate it
