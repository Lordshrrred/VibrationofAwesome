# Module: Publishing queue (drip, replenishment, drafts)

Read this before touching `drip-publish.js`, `post-live-syndicate.js`, `replenish-drip-queue.js`, `.github/workflows/drip-posts.yml`, `queue-replenishment.yml`, or `static/blog/boom/drafts/`.

Live numbers (queue size, last publish): run `npm run orient` or read `static/_data/syndication-health.json` → `drip`. Do not hand-copy them into docs.

## Drip queue

Pre-generated Boom posts live in `static/blog/boom/drafts/`, listed in `static/_data/drip-queue.json`. `drip-publish.js` moves selected drafts → `static/blog/boom/posts/`, runs the deterministic internal linker, updates `boom-posts.json`, regenerates the sitemap, writes `drip-last-published.json`, and lets `post-live-syndicate.js` syndicate only after the canonical VOA URL is verified live.

Schedule (`.github/workflows/drip-posts.yml`, balanced cluster rotation, approved by Matt 2026-09-16):

- Four posts/day at 13:00, 16:00, 22:00, and 01:00 UTC. Every slot draws from all 11 canonical clusters. With healthy inventory each cluster gets a post about every 2.75 days. Matt approved four/day, not eleven/day.
- The least-recently-published eligible cluster wins. Ties favor thinner historical clusters. Explicit `cluster` metadata beats niche inference; several clusters share one niche.
- 13:00 and 22:00 UTC: normal social + backlinks + feeder (Dev.to account 1).
- 16:00 and 01:00 UTC: `--syndication-profile backlinks-only` → Dev.to account 2 + Blogger + WordPress + Tumblr. No social, no Pinterest, no feeder. The canonical URL goes to only one Dev.to account.
- The old daily AI-only and art-only reserved slots are retired. Historical campaign/art profiles (`art-devto2-only`) remain readable for old inventory and route like `backlinks-only`.

**Drafts are deleted on publish.** Both the normal path and the collision-guard path (file already in `posts/`) delete the source draft. `static/blog/boom/drafts/` is also blocked in `robots.txt`. Do not reintroduce a copy-without-delete (see `docs/decisions.md`, 2026-07-19).

Only slugs in `drip-queue.json` ever publish. A draft HTML file without a queue entry is an orphan and will sit forever; `npm run orient` flags orphans and queue entries missing their file. When generating drafts outside `queue:replenish` (tests, experiments), either add a queue entry with `niche`/`cluster`/`pillar`/`keyword` or delete the file.

`drip-publish.js` warns when fewer than 14 drafts remain (`QUEUE_WARN_THRESHOLD`). An empty queue stops publishing; the dashboard shows it as empty, not "active".

Manual triggers (from a machine with `gh`): `gh workflow run drip-posts.yml --ref main` for a drip test run, `gh workflow run hugo.yml --ref main` to force a deploy. Other maintenance: `npm run sitemap`, `npm run pinterest-token`.

## Replenishment (`scripts/replenish-drip-queue.js`, `queue-replenishment.yml`)

The daily workflow checks before publishing. At **14 drafts or fewer**, it replenishes toward **22**, with **at most eight article-generation attempts per UTC day**, checkpointed before each attempt. Partial batches are allowed. A paused queue incurs no automatic spend. Two generation failures stop the batch; successful drafts and budget checkpoints are committed even if a later step fails, then a failure issue opens.

Planning and publishing share `selectBalancedClusterRows()` in `scripts/lib/internal-linking.js`. Planning fills the thinnest queued cluster first, then oldest-served. Generation passes `--cluster` explicitly so shared niches do not collapse into the AI cluster.

Candidates come from `static/_data/topic-queue.json` and unused niche research. If a cluster has fewer than two unused candidates, one Haiku 4.5 call proposes up to six evergreen ideas per thin cluster (zero SDK retries, 10,000 output-token ceiling, persisted 24-hour cooldown even on failure). Accepted ideas are saved in the topic queue and deduplicated against published titles, queued drafts, draft filenames, and other candidates. These are model-proposed **hypotheses, not verified search demand**.

Weekly cluster research: one bounded Haiku request, at most 11 web-search calls (one per cluster), zero retries, persisted seven-day cooldown. Returned source URLs and observed queries are saved in the topic queue, reused up to 14 days, and fed to planning with fresh Search Console observations. They inform intent/gaps, not measured volume or difficulty. No per-article search, no routine paid rank tracking. Failed research preserves the prior cache and fails the workflow. Time-sensitive AI Advantage campaign research stays manual. Main articles keep Opus 4.8.

```bash
npm run queue:replenish                       # no-spend preview
npm run queue:replenish -- --execute          # bounded refill
npm run queue:replenish -- --research-only --execute   # refresh weekly evidence only
```

Flags: `--no-topics` disables research + planning; `--niche` narrows candidates; `--force` bypasses the inventory/pause gate but not the daily article budget or topic cooldown; `--max` / `QUEUE_REPLENISH_MAX` sets the daily attempt ceiling (default 8).

Tests: `node --test scripts/test-balanced-replenishment.js`.

`node scripts/generate-all-drafts.js` is the older manual batch generator. Prefer `queue:replenish`, which respects the budget and cluster balance. Get Matt's confirmation of count/budget before any large manual batch.

## Cluster metadata backfill (`scripts/backfill-cluster-metadata.js`)

Zero-cost: applies the local `inferCluster()` heuristic to posts missing `cluster` in `boom-posts.json`. Dry run by default, `--execute` to write (same convention as `backfill-feeder.js` / `backfill-backlinks.js`). A few generic titles do not match any rule; `scripts/classify-unmatched-clusters.js` (Haiku) exists for those. Historic imbalance (most posts in `ai-creator-tools`) is being corrected by the balanced rotation above, not by relabeling.
