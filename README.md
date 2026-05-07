# Vibration of Awesome

**vibrationofawesome.com** ~ Hugo static site deployed via GitHub Pages, with Netlify retained for serverless/functions workflows.

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
node scripts/generate-post.js --lane boom --keyword "how to use claude api for musicians" --topic "AI tools for independent artists"
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

If Blogger reports `invalid_grant`, regenerate it:

```bash
npm run blogger-token
```

That opens Google consent, validates the new Blogger refresh token, saves it to `.env`, and updates the GitHub Actions `BLOGGER_REFRESH_TOKEN` secret when `gh` is authenticated.

The Blogger OAuth helper defaults to `http://localhost:8090/` so VLC can keep using port `8080`. If Google shows `redirect_uri_mismatch`, add `http://localhost:8090/` as an authorized redirect URI on the Google OAuth client, or set `BLOGGER_REDIRECT_PORT` in `.env` to another authorized port.

### Boom Drip Rate

The current drip queue is configured for `2` Boom Frequency posts per publish run at `10:00 UTC`. The GitHub Actions drip workflow is manual-only until its schedule is re-enabled.

### SEO Keyword Research

```bash
node scripts/seo-research.js --topic "AI tools for musicians"
```

**What it does:**
- Generates 20 long-tail keyword variations via Claude
- Outputs formatted list to terminal
- Saves results to `static/_data/topic-queue.json`

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

GitHub Actions deploys the Hugo site to GitHub Pages on push to `main`.

Netlify remains useful for serverless functions and any future authenticated admin hosting.

### Environment Variables Required

```
NETLIFY_AUTH_TOKEN    → In GitHub repo secrets (for Actions deploy)
NETLIFY_SITE_ID       → In GitHub repo secrets
```

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
- GitHub remains the source of truth for content, but GitHub Pages alone still cannot safely hold write credentials in the browser.
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
