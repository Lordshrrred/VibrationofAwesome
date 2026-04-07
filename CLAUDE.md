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
node scripts/generate-post.js --lane boombot --keyword "target keyword" --topic "content angle"

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
```

## Architecture

### Two Content Lanes
- **Matt lane** (`static/blog/matt/`): Personal voice, raw/reflective writing by Matt EarthStar
- **Boombot lane** (`static/blog/boombot/`): SEO-optimized content under AI persona "Matty BoomBoom"

Each post is generated as standalone HTML and indexed in `static/_data/[lane]-posts.json` with fields: `{title, slug, date, excerpt, url, tags}`.

### Content Generation Pipeline
`generate-post.js` calls Claude API with lane-specific system prompts → converts markdown to HTML via `marked` → writes to `static/blog/[lane]/posts/[slug].html` → updates the lane's JSON index.

### Syndication Engine
`syndicate.js` reads recent posts, calls `generate-captions.js` for platform-specific copy, calls `select-image.js` (Pexels API) for images, then posts to: Bluesky, Mastodon, Facebook, Instagram, Threads, Pinterest, Dev.to, Tumblr, and Blogger. Results are logged to `static/_data/syndication-log.json`. Uses OAuth 1.0a (Tumblr) and OAuth 2.0 (Meta, Pinterest, Mastodon).

### Hugo Site
Hugo watches `content/posts/*.md` and renders with `layouts/` templates. The `hugo.toml` has `unsafe = true` for goldmark to allow raw HTML in markdown. Deployed to GitHub Pages via `.github/workflows/hugo.yml` on push to main.

### Post Editing
`static/admin/` is the custom VOA Post Studio editor for `content/posts/`. It currently uses a GitHub-token save path from the browser and is meant to feel like a focused post manager for existing Hugo content. A future password-only flow requires a server-side auth layer, not GitHub Pages alone.

### AURA Chatbot (Serverless)
`netlify/functions/chat.js` is a POST endpoint that proxies requests to Claude Sonnet API with an AURA (spiritual companion AI) system prompt. The chatbot UI lives at `/aura/`. Netlify handles the serverless hosting separately from GitHub Pages.

### Dual Hosting
- **GitHub Pages**: Static site (built by Hugo workflow)
- **Netlify**: Serverless functions only (`/.netlify/functions/chat`)

## Environment Variables
Copy `.env.example` to `.env`. Required keys:
- `ANTHROPIC_API_KEY` — content generation and AURA chatbot
- `PEXELS_API_KEY` — image selection for syndication
- OAuth credentials for each social platform (see `.env.example` for full list)
- `DASHBOARD_PASSWORD` — protects the admin dashboard
