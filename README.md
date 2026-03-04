# Vibration of Awesome — Dual-Blog Content Engine

**vibrationofawesome.com** — Two blog lanes, a Claude-powered post generator, and a social syndication pipeline.

---

## Blog Lanes

| Lane | URL | Author | Identity |
|------|-----|--------|----------|
| From the Forest Temple | `/blog/matt/` | Matt EarthStar | Raw, personal, unfiltered |
| Boom Frequency | `/blog/boombot/` | Matty BoomBoom | AI-powered, SEO-optimized, eccentric |

---

## Quick Start

### 1. Install dependencies

```bash
npm install @anthropic-ai/sdk dotenv marked twitter-api-v2
```

### 2. Set up your API keys

```bash
cp .env.example .env
# Edit .env and fill in your keys
```

At minimum, you need `ANTHROPIC_API_KEY` to run the post generator and SEO tool.

---

## Scripts

### Generate a Post

```bash
# Matt lane — personal voice, raw writing
node scripts/generate-post.js --lane matt --title "Why I Stopped Chasing Virality"

# BoomBot lane — SEO-optimized, long-form
node scripts/generate-post.js --lane boombot \
  --keyword "how to build a music brand with ai" \
  --topic "AI tools for independent musicians"
```

This will:
1. Call the Claude API with the appropriate system prompt
2. Convert the generated markdown to HTML
3. Create the post file at `blog/[lane]/posts/[slug].html`
4. Update `_data/[lane]-posts.json` with the post metadata

### Syndicate a Post to Social

```bash
node scripts/syndicate.js --lane boombot --slug "how-to-use-claude-api-for-musicians"
node scripts/syndicate.js --lane matt --slug "why-i-spent-20-years-doing-internet-marketing-wrong"
```

This will:
1. Load the post from the JSON index
2. Generate platform-specific captions via Claude (Facebook, Instagram, Twitter)
3. Post to each platform via their APIs
4. Log success/failure for each platform independently

**Requires:** All social API keys in `.env`. Each platform will fail independently — one failure won't stop the others.

### SEO Research

```bash
node scripts/seo-research.js --topic "spiritual entrepreneurship"
node scripts/seo-research.js --topic "AI tools for musicians"
```

This will:
1. Generate 20 long-tail keyword variations with search intent, titles, and H2 outlines
2. Print them to the terminal with quick-wins and priority picks highlighted
3. Save everything to `_data/topic-queue.json`

Use this before running `generate-post.js` for BoomBot to pick the right keyword.

---

## File Structure

```
vibrationofawesome.com/
├── index.html                  ← Homepage (includes Latest Transmissions feed)
├── blog/
│   ├── index.html              ← Blog hub (choose your lane)
│   ├── matt/
│   │   ├── index.html          ← "From the Forest Temple" index
│   │   └── posts/              ← Individual post HTML files
│   └── boombot/
│       ├── index.html          ← "Boom Frequency" index
│       └── posts/              ← Individual post HTML files
├── _data/
│   ├── matt-posts.json         ← Post metadata index (auto-updated by generate-post.js)
│   ├── boombot-posts.json      ← Post metadata index (auto-updated)
│   └── topic-queue.json        ← SEO research queue (auto-updated by seo-research.js)
├── scripts/
│   ├── generate-post.js        ← Claude API post generator
│   ├── syndicate.js            ← Social syndication (Facebook, Instagram, Twitter)
│   └── seo-research.js         ← Long-tail keyword brainstorm tool
├── .env.example                ← Template — copy to .env and fill in keys
├── .github/workflows/
│   ├── hugo.yml                ← Hugo build (for Hugo-based content)
│   └── deploy.yml              ← Static site deploy (for blog/scripts system)
└── netlify/functions/
    └── chat.js                 ← AURA AI chat backend
```

---

## Typical Workflow

1. **Research**: `node scripts/seo-research.js --topic "your topic"` — find the right keyword
2. **Generate**: `node scripts/generate-post.js --lane boombot --keyword "..." --topic "..."` — create the post
3. **Review**: Open the generated HTML, review and edit as needed
4. **Commit**: `git add . && git commit -m "Add new boombot post: [title]" && git push`
5. **Syndicate**: `node scripts/syndicate.js --lane boombot --slug "your-slug"` — post to social

---

## API Keys Reference

| Key | Where to get it |
|-----|----------------|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
| `FACEBOOK_PAGE_ID` + `FACEBOOK_ACCESS_TOKEN` | [developers.facebook.com](https://developers.facebook.com) — create an app, get a Page token |
| `INSTAGRAM_ACCOUNT_ID` | Same Facebook app — must have a connected Instagram Business account |
| `TWITTER_API_KEY/SECRET` + `TWITTER_ACCESS_TOKEN/SECRET` | [developer.twitter.com](https://developer.twitter.com) — Elevated access, Read+Write |

---

## Local Development

To test JSON fetching locally (the homepage and blog indexes load JSON via `fetch()`), serve from a local static server:

```bash
npx serve .
# or
python3 -m http.server 8080
```

Then open `http://localhost:3000` (or whatever port `serve` uses).

---

*Vibration of Awesome — Roots in the Earth, Crown in the Stars.*
