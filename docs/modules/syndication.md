# Module: Syndication, backlinks, and anti-duplication

Read this before touching `syndicate.js`, `generate-captions.js`, `post-live-syndicate.js`, `retry-failed-syndication.js`, `backlink-backfill.yml`, `syndication-catchup.yml`, Publer, or any platform credential. Also read `shared-config/syndication-policy-v1.md` (routing policy) and, for auth failures, `docs/syndication-auth-repair.md`.

## Engine

`syndicate.js` reads recent posts, calls `generate-captions.js` (Haiku 4.5, one call, a separate section per platform) and `select-image.js` (Pexels/local) plus Ideogram for images, then posts to Bluesky VOA, Mastodon VOA, Facebook VOA, Instagram VOA, Threads VOA, Pinterest VOA, Dev.to, Tumblr VOA, Blogger, and WordPress EarthStar. Facebook, Instagram, Threads, and Pinterest go through Publer; the others use direct APIs. Results: `static/_data/syndication-log.json` and `syndication-results.json` (both large; query them, never read them whole).

Retry anything that failed recently with `node scripts/retry-failed-syndication.js`. Do not ask Matt to re-run platforms by hand.

## Anti-duplication prime directive

Duplication is a spam, compliance, and brand-trust risk across 15+ platforms.

| Content type | Rule |
|---|---|
| Main VOA post | Canonical source. Unique slug, title, body. |
| Blogger companion | Fresh AI article, **unique title**, different angle, links back to VOA. |
| WordPress companion | Fresh AI article, **unique title**, distinct from VOA and Blogger, links back. |
| Dev.to | Same title as VOA is fine (canonical URL set to VOA). Body is a generated teaser, not the article. |
| Tumblr | Generated caption text only, links back. |
| VOA Feeder companion | Fresh article, slug suffix `-signal` / `-shift` / `-insight` / `-guide`, unique title. |
| Social captions | Unique platform-native copy per platform. Never collapse into one shared caption. |

Slugs: WordPress appends `-earthstar`; Blogger derives from its unique title; never reuse the exact VOA slug on a platform that does not set a canonical URL.

Every backlink article: unique title, unique body, one natural backlink to the VOA post, canonical URL to VOA where supported (Dev.to yes; Blogger/WordPress no).

If a duplicate is detected:
- Dev.to "canonical url has already been taken" → **success**, do not retry (the post is already live from a run whose commit was lost).
- Blogger/WordPress duplicate-title error → retry with a modified title prompt.
- Existing `status: "success"` in `syndication-results.json` → skip unless `--force`.

**Publer invariant:** `findExistingPublerPost()` in `postViaPubler()` checks Publer's own live post list (target account, last 72h, exact normalized caption) before any create, on every path including `--force`, for facebook/pinterest/threads/instagram. It fails open on read errors. Do not add a second local-only dedup layer; extend this function. Background: `docs/decisions.md` (2026-07-24).

## Companion ecosystem and platform transformations

Each platform gets a **transformation**, not a copy.

| Platform | Transformation | Voice | URL in post? |
|---|---|---|---|
| Feeder | Companion article | Matt EarthStar | Yes |
| Blogger | Companion article | Matt EarthStar | Yes |
| WordPress | Companion article | EarthStarRising | Yes |
| Dev.to | Teaser, same title + canonical | Technical/creator | Canonical |
| Tumblr | Text post | Matt/BoomBot mix | Yes |
| Bluesky | One thought, ≤300 chars, no hashtags | Direct | Yes |
| Mastodon | 2-3 sentences + 2-3 hashtags | Thoughtful | Yes |
| Facebook | 2-3 sentences + question | Conversational | Yes |
| Threads | 3-part mini-thread (1/3..3/3) | Reflective | In 3/3 |
| Instagram | Visual hook + emotional context + hashtags | Raw/cosmic | No |
| Pinterest | Ideogram image + keyword description + board | Evergreen | Yes |

Companion model: `COMPANION_MODEL` in `syndicate.js` defaults to Haiku 4.5; override with `SYNDICATION_COMPANION_MODEL` rather than editing the constant.

Future direction (do not build yet): transform weak-fit content into platform-native variants (quote cards, text transformations, board rerouting) instead of suppressing it. Don't hardcode assumptions that prevent this.

## Routing

- VOA Instagram and Threads are early-growth accounts: **all content types route to both**. Revisit content-type filtering only once there is real engagement data (>5k followers or 3+ months of history).
- Pinterest is suppressed only for the `philosophy` content type.
- ESR accounts are not used by the VOA blog engine.
- Dev.to account 2 (`DEVTO2_API_KEY`, platform key `devto2`) is not in the default backlink tier. It runs for the `backlinks-only` / `art-devto2-only` profiles (see `docs/modules/publishing-queue.md`) or with explicit `--platforms devto2`.
- Tumblr: both `syndicate.js` and `check-syndication-config.js` fall back to the generic `TUMBLR_*` env vars, so Actions needs only `TUMBLR_CONSUMER_KEY`, `TUMBLR_CONSUMER_SECRET`, `TUMBLR_TOKEN`, `TUMBLR_TOKEN_SECRET`, `TUMBLR_BLOG_NAME`.

## Key account IDs (VOA; do not confuse with ESR)

```
PUBLER_INSTAGRAM_ACCOUNT_ID = 6a0698ee1f0e47d9f3f18a43   (VOA Instagram @vibrationofawesome)
PUBLER_THREADS_ACCOUNT_ID   = 6a069b7979cc0b32f3235166   (VOA Threads @vibrationofawesome)
PUBLER_PINTEREST_ACCOUNT_ID = 6a052b620ce3c7cac0c7ebac   (VOA Pinterest @awesomevibe)
PUBLER_PINTEREST_BOARD_ID   = 641129765641663037           (Vibration of Awesome board)
PUBLER_FACEBOOK_ACCOUNT_ID  = 5f189becdb27977d231aea50   (VOA Facebook Page, fb_page)
```

An ID starting `673d...` is ESR. Verify before using.

Facebook VOA publishes **through Publer**, not the direct Meta Graph path (blocked; see `docs/facebook-voa-publishing-provider.md`). Page-token expiry therefore does not block VOA Facebook posts; `npm run fb-token` only matters for the legacy direct path.

## Reading logs

Old `syndication-log.json` errors are historical evidence, not current health. Before escalating, check `static/_data/syndication-health.json` (updated every 12h by `syndication-health.yml`), current env wiring, and recent results. Run `node scripts/check-syndication-config.js --write` for a fresh check.

Health, alerting, Blogger reconnect, and auto-heal: `docs/modules/monitoring.md`.
