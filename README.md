# Vibration of Awesome

**vibrationofawesome.com** ~ Hugo static site deployed via Vercel. Serverless functions (`/api/*`) are also hosted on Vercel.

Roots in the Earth, Crown in the Stars. The Future is Ours.

---

## Site Architecture

```
/                       → Hugo homepage (layouts/index.html)
/posts/                 → Hugo-rendered blog posts from content/posts/
/admin/                 → VOA Post Studio (custom post editor)
/blog/                  → Static dual-blog hub (legacy/generated HTML lane system)
/blog/matt/             → From the Forest Temple ~ Matt EarthStar's personal lane
/blog/boom/             → Boom Frequency ~ Matty BoomBoom AI SEO lane
/art-store/             → Static art store landing page
/aura/                  → Aura experience
```

---

## Dual-Blog Content Engine

### Agent Memory Rule

Any AI agent working in this repo must read the repo memory docs before making non-trivial changes: `CLAUDE.md`, this `README.md`, `content-strategy/niche-map.md`, `static/_data/topic-clusters.json`, and the relevant files in `shared-config/`.

If a change affects publishing, syndication, SEO, topic clusters, internal linking, visuals, content strategy, or automation behavior, update the relevant markdown/data memory files in the same pass. Building without updating repo memory is considered incomplete work.

### Quick Start

```bash
# Install dependencies
npm install

# Copy env template and fill in your API keys
cp .env.example .env
```

### Generate a Blog Post

```bash
# Matt lane ~ personal voice, raw + honest
node scripts/generate-post.js --lane matt --title "Why I Spent 20 Years Doing Internet Marketing Wrong"

# BoomBot lane ~ SEO-optimized, Matty BoomBoom voice
node scripts/generate-post.js --lane boom --niche ai-creator-tools --keyword "how to use claude api for musicians"

# Generate for a specific EarthStar niche
node scripts/generate-post.js --lane boom --niche self-betrayal-avoidance --keyword "how to stop betraying yourself"
```

**What it does:**
1. Calls the Claude API with the appropriate system prompt for each lane
2. Generates full blog post as markdown
3. Converts to HTML and writes to `static/blog/[lane]/posts/[slug].html`
4. Updates `static/_data/[lane]-posts.json` with post metadata
5. Static lane indexes keep reading from `static/_data/`

### Syndicate a Post to Social Media

```bash
node scripts/syndicate.js --lane boom --slug "how-to-use-claude-api-for-musicians"
```

**What it does:**
- Calls Claude to generate platform-specific captions for the configured platforms
- Posts directly where approved, and routes Pinterest, Instagram, and Threads through Publer
- Logs success/failure per platform independently

### Check Syndication Readiness

```bash
npm run check:syndication
```

This performs non-publishing auth/config checks for the syndication engine. It does not create posts.

To write stored backlink evidence into the dashboard data after syndication:

```bash
npm run verify:backlinks -- --slug post-slug
```

The verifier uses platform APIs and direct page fetches from the local machine or GitHub Actions.

If Blogger reports `invalid_grant`, regenerate it:

```bash
npm run blogger-token
```

That opens Google consent, validates the new Blogger refresh token, saves it to `.env`, and updates the GitHub Actions `BLOGGER_REFRESH_TOKEN` secret when `gh` is authenticated.

The Blogger OAuth helper opens Safari by default on macOS so the correct Google account can stay isolated from Brave. To use another browser, set `BLOGGER_OAUTH_BROWSER` in `.env`, for example `BLOGGER_OAUTH_BROWSER="Google Chrome"`. It defaults to `http://localhost:8090/` so VLC can keep using port `8080`. If Google shows `redirect_uri_mismatch`, add `http://localhost:8090/` as an authorized redirect URI on the Google OAuth client, or set `BLOGGER_REDIRECT_PORT` in `.env` to another authorized port.

### EarthStar 8-Niche Content System

Boom Frequency now rotates across eight niches:

1. `ai-creator-tools` - AI + Music + Creator Tools
2. `self-betrayal-avoidance` - Self-Betrayal / Avoidance
3. `dopamine-addiction-numbing` - Dopamine Addiction / Numbing
4. `nervous-system-dysregulation` - Nervous System Dysregulation
5. `misalignment-wrong-life` - Misalignment / Living the Wrong Life
6. `direction-purpose-drift` - Lack of Direction / Purpose Drift
7. `disconnection-inner-noise` - Disconnection from Self / Inner Noise
8. `art-buyer-intent` - Buying Original Art

The source of truth is `scripts/content-niches.js`. It stores each niche slug, display name, core problem, audience pain, content angle, example article topics, keyword seed phrases, tone notes, and grouped keyword research seeds.

The master human-readable map is `content-strategy/niche-map.md`.

### Boom Drip Rate

The current drip system has four scheduled slots in `.github/workflows/drip-posts.yml`:

- `9:00 AM ET` - normal Boom post with existing syndication stack
- `12:00 PM ET` - art-buyer extra post, VOA + Dev.to account 2 only
- `6:00 PM ET` - normal Boom post with existing syndication stack
- `9:00 PM ET` - art-buyer extra post, VOA + Dev.to account 2 only

The normal slots use `drip_rate` from `static/_data/drip-queue.json` and currently publish 1 post/run. The art-extra slots call `drip-publish.js --niche art-buyer-intent --limit 1 --syndication-profile art-devto2-only`, so they do not increase Pinterest, Instagram, Threads, Facebook, Tumblr, Blogger, WordPress, or Feeder volume.

Draft generation rotates through all configured niches from `scripts/content-niches.js`:

```bash
node scripts/generate-all-drafts.js
```

### Internal Linking + Topic Clusters

VOA has a deterministic internal-linking layer for SEO/topical authority.

```bash
npm run links:audit
npm run links:apply
```

Key files:

- `static/_data/topic-clusters.json` - semantic authority clusters
- `scripts/lib/internal-linking.js` - cluster inference, related-post scoring, money-page targeting
- `scripts/internal-linking.js` - audit/apply CLI

New Boom posts get cluster-aware related-reading blocks automatically during generation/publish. Existing posts/drafts can be refreshed with `npm run links:apply`. The generated blocks use `<section data-internal-related ...>` and point clusters toward the correct money page: `/ai-engine/`, `/art-store/`, or `/field-guide/`.

### SEO Keyword Research

```bash
node scripts/seo-research.js --topic "AI tools for musicians"
node scripts/seo-research.js --niche nervous-system-dysregulation
node scripts/seo-research.js --all-niches
```

**What it does:**
- Generates long-tail keyword variations via Claude for a topic or one niche
- Groups keywords by intent: informational, problem-aware, solution-aware, comparison, and action/how-to
- Identifies low-competition/high-intent blog topic candidates
- Outputs formatted list to terminal
- Saves results to `static/_data/topic-queue.json`
- Saves per-niche strategy files to `content-strategy/keyword-research/`

`--all-niches` writes seeded keyword research files from the local niche config and does not call Claude.

### Add a Future Niche

1. Add a new object to `EARTHSTAR_NICHES` in `scripts/content-niches.js`.
2. Include the required fields: `slug`, `displayName`, `coreProblem`, `audiencePain`, `contentAngle`, `exampleArticleTopics`, `keywordSeedPhrases`, `toneNotes`, and `keywordResearch`.
3. Run `npm run research:niches` to refresh `content-strategy/keyword-research/`.
4. Update `content-strategy/niche-map.md` if the public strategy map should mention the niche.

---

## Blog Lanes

### 🌿 From the Forest Temple (`/blog/matt/`)
- **Author:** Matt EarthStar
- **Voice:** Raw, unfiltered, first person. Real experiences, real frustrations, real wins. No SEO agenda.
- **Aesthetic:** Forest green + deep amber
- **When to use:** Sharing personal stories, lessons from the trenches, Forest Temple system reflections

### ⚡ Boom Frequency (`/blog/boom/`)
- **Author:** Matty BoomBoom (AI persona)
- **Voice:** Helpful, eccentric, transmission-style. Spiritual seekers + neurodivergent creators + AI-curious musicians.
- **Aesthetic:** Electric cyan on deep black, frequency/wave motifs
- **When to use:** SEO-targeted content, long-tail keyword posts, guides and how-tos

---

## Deployment

**Static site**: Vercel auto-deploys Hugo on every push to `main` via its GitHub webhook integration. `vibrationofawesome.com` and `www.vibrationofawesome.com` both resolve through Cloudflare to Vercel. `.github/workflows/hugo.yml` exists as a manual build-check only (no automatic trigger).

**Serverless functions (`/api/*`)**: Hosted on Vercel. Auto-deploys via Vercel dashboard webhook on push to `main`. No GitHub Actions step needed for Vercel ~ it watches the repo directly.

**Admin CMS (`/admin/`)**: Netlify CMS config exists at `static/admin/config.yml` but is marked legacy/optional. The primary post editor is the VOA Post Studio backed by `api/editor-login.js` + `api/editor-save.js`.

### Key Secrets (GitHub Actions)

```
ANTHROPIC_API_KEY      → Claude API for post generation and captions
VOA_FEEDER_TRIGGER_TOKEN → GitHub PAT to fire VOA_Feeder workflow
PUBLER_API_KEY         → Publer for Instagram / Threads / Pinterest
DEVTO_API_KEY          → Dev.to backlink posting
DEVTO2_API_KEY         → second Dev.to account for art-buyer extra slots only
TUMBLR_*               → Tumblr OAuth 1.0a credentials
BLOGGER_REFRESH_TOKEN  → Blogger OAuth2 refresh token
WORDPRESS_OAUTH2_TOKEN → WordPress.com direct API token
META_PAGE_ID_VOA, META_PAGE_TOKEN_VOA → Facebook VOA page
```

See `.env.example` for the full list.

---

## Local Development

```bash
# Run Hugo dev server
hugo server -D

# Site is available at http://localhost:1313
```

## Post Editing Dashboard

`/admin/` is now a custom GUI called VOA Post Studio. It is the primary editing surface for the live Forest Temple HTML posts, defaults to a WYSIWYG editor, and is designed to feel more like a post manager than a CMS config screen.

- `/admin/` is the custom branded editor.
- Existing posts load into the left-hand library and open into the edit surface on click.
- The preferred save path is now a tiny backend broker that accepts the same dashboard password, opens a short-lived editor session, and commits to GitHub server-side.
- GitHub remains the source of truth for content, but static hosting alone cannot safely hold write credentials in the browser.
- If the backend is not configured, the editor can still fall back to a browser-side GitHub token for local/admin use.

---

## Required API Keys (`.env`)

```env
ANTHROPIC_API_KEY=          # Required for post generation + syndication captions
FACEBOOK_PAGE_ID=           # Facebook page syndication
FACEBOOK_ACCESS_TOKEN=      # Facebook Graph API
INSTAGRAM_ACCOUNT_ID=       # Instagram account (via Meta Business)
TWITTER_API_KEY=            # Twitter/X API v2
TWITTER_API_SECRET=
TWITTER_ACCESS_TOKEN=
TWITTER_ACCESS_SECRET=
```

See `.env.example` for the full template.

---

## Post Index Format

`static/_data/matt-posts.json` and `static/_data/boom-posts.json`:

```json
[
  {
    "title": "Post Title Here",
    "slug": "post-slug-here",
    "date": "2026-03-01",
    "excerpt": "First 150 characters of post body...",
    "url": "/blog/matt/posts/post-slug-here.html",
    "tags": ["tag1", "tag2"]
  }
]
```

Posts are stored newest-first. The homepage and lane index pages display the latest 3.

---

*© 2026 Vibration of Awesome*
