# Module: Content generation, topical authority, and internal linking

Read this before touching `generate-post.js`, `generate-from-inspiration.js`, generation prompts, `topic-clusters.json`, `generation-memory.js`, `internal-linking.js`, or post templates. Also read `content-strategy/niche-map.md` and `static/_data/topic-clusters.json`. Models and spend: `docs/modules/models-and-cost.md`.

## Two lanes

- **Matt lane** (`static/blog/matt/`): personal, raw, reflective writing by Matt EarthStar. Excluded from the SEO-structure rules below. After changing `static/_data/matt-posts.json`, run `npm run build:matt-index`.
- **Boom lane** (`static/blog/boom/`): SEO content by the AI persona "Matty BoomBoom" (blog name "Boom Frequency").

Posts are standalone HTML, indexed in `static/_data/[lane]-posts.json` (`title, slug, date, excerpt, url, tags, niche, cluster`).

Pipeline: `generate-post.js` → Claude with a lane-specific system prompt → markdown → `marked` → `static/blog/[lane]/posts/[slug].html` (or `drafts/`) → lane JSON index.

```bash
node scripts/generate-post.js --lane matt --title "Post Title Here"
node scripts/generate-post.js --lane boom --keyword "target keyword" --topic "content angle"
node scripts/generate-post.js --lane boom --keyword "..." --cluster ai-creator-tools
```

## Niches vs clusters

- **Niches** (8, source of truth `scripts/content-niches.js`, human map `content-strategy/niche-map.md`) describe audience pain and keyword seeds.
- **Clusters** (11, `static/_data/topic-clusters.json`) are the topical-authority territories that drive rotation, linking, and Pinterest boards. Several clusters share a niche; explicit `cluster` metadata always wins over niche inference.

| Key | Content type | Pinterest board |
|---|---|---|
| `ai-creator-tools` | creator | conscious-creator-tools |
| `nervous-system-creativity` | nervous-system | nervous-system-reset |
| `dopamine-attention` | nervous-system | dopamine-detox |
| `authentic-self-expression` | philosophy | vibration-of-awesome |
| `creator-automation` | creator | conscious-creator-tools |
| `spiritual-productivity` | philosophy | purpose-and-direction |
| `purpose-direction` | philosophy | purpose-and-direction |
| `building-life-that-fits` | philosophy | empower-thyself |
| `emotional-regulation` | nervous-system | nervous-system-reset |
| `art-buying-online` | earthstar | earthstar / vibration-of-awesome |
| `consciousness-technology` | earthstar | earthstar |

With `--cluster` or `--niche`, `generate-post.js` injects the cluster pillar + supporting angles, loads recent patterns from `generation-memory.js` for that niche, injects a "DIFFERENTIATION CONTEXT" block, and records the new post's hook, title, structure, arc, and opening style to `static/_data/generation-memory.json` (rolling 30 per category, per niche).

Differentiation targets: rotate opening style (question, blunt statement, personal story, scene-setting, counter-intuitive claim, information gap, social proof, direct address, answer-first), narrative structure (flowing, moderate sections, heavily sectioned, list-driven, blockquote, argument), emotional arc (pain → insight → action, certainty → doubt → clarity, curiosity → revelation → commitment, frustration → acceptance → move, neutral → concrete action), and title cadence (avoid back-to-back "How to X When Y" / "Why X Doesn't Work" / "The X Guide to Y"); don't hardcode CTAs in prompts (rotation lives in `getNextCTA(lane, contentType)` in `scripts/lib/policy.js`).

## Truthfulness rules (keep in sync in two files)

`BOOMBOT_SYSTEM` in `generate-post.js` and the system prompt in `generate-from-inspiration.js` share a `TRUTHFULNESS RULES` block. First person is fine for viewpoint/philosophy, **never** for specific, unsourced lived experience (no invented "I built…", "I spent six months…", origin stories, or timelines). Real claims about the site's own products (e.g. the `/ai-engine/` guide) are allowed. When you edit either prompt, update both.

## AI-search-optimized structure (Boom only)

`BOOMBOT_SYSTEM` requires: H2s phrased as natural questions; the first 1-2 sentences under each H2 answer it directly (does not override the article's opening-hook rule); at least one concrete named tool/technique/fact (never a fabricated statistic); `Step 1:`-style headers for genuine how-tos; a `## FAQ` section (3-5 `**Q: ...?**` pairs) before the closing CTA.

Schema: `extractFaqPairs()` / `extractHowToSteps()` parse the raw markdown; `buildFaqSchema()` / `buildHowToSchema()` emit FAQPage / HowTo JSON-LD into `buildHtml()`'s `<head>` via `extraSchemas` (HowTo needs ≥2 steps, FAQ ≥1 pair). The BlogPosting block's `@type` is `["BlogPosting","Article"]`.

## Deterministic internal linking (`scripts/lib/internal-linking.js`)

- `buildExistingPostsList()` gives Claude existing posts for contextual links (also the prompt-cache prefix).
- The cluster for each post is inferred from `cluster`, `niche`, title, slug, keyword, and excerpt.
- `ensureDeterministicInternalLinks()` inserts a `<section data-internal-related ...>` block before the signature/CTA: same-cluster posts first, then related clusters, plus the money page (AI/creator → `/ai-engine/`, art-buying → `/art-store/`, self-help/nervous-system/philosophy → `/field-guide/`).
- `backlinkOlderPosts()` makes the older linked posts link back to the new one (idempotent; skips files with no insertion point). It runs only for published posts, not drafts.
- Runs in `drip-publish.js` at publish time and in `generate-post.js` for direct generation.

```bash
npm run links:audit     # coverage report
npm run links:apply     # refresh generated blocks
npm run check:emdash    # run after large link backfills
```

## Blog post template rules

- Boom posts use local hero images from `/images/boom/` (not NASA API URLs).
- Every post gets the art store whisper widget (`data-art-store-whisper`) after the ebook CTA; `node scripts/backfill-art-store-whisper.js` adds it to older posts.
- After any template change run `node scripts/patch-draft-posts.js` to backfill drafts.
- No em dashes in generated copy (`npm run check:emdash`).
