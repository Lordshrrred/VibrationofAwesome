# Module: SEO intelligence and dashboard

Read this before touching `scripts/seo_intelligence.js`, `weekly-seo-intelligence.yml`, `seo-research.js`, or the dashboard's SEO panel. Latest findings: `reports/seo-intelligence-latest.md` (dated copies alongside).

## Weekly intelligence (`scripts/seo_intelligence.js`)

`.github/workflows/weekly-seo-intelligence.yml` runs Wednesdays 09:00 UTC (and on manual dispatch). It uses the Google Search Console Search Analytics and GA4 Data APIs to find page/query opportunities from actual Google visibility and organic behavior. **Zero** Anthropic/OpenAI/paid search/rank-check calls. Outputs: `reports/seo-intelligence-latest.md`, a dated report, the public-safe summary `static/_data/seo-intelligence.json`, and one line appended to `scripts/syndication_log.txt`.

Env: `GA_CREDENTIALS_JSON` or `GOOGLE_SERVICE_ACCOUNT_JSON`, `GA_PROPERTY_ID`, optional `GSC_SITE_URL` (default `https://vibrationofawesome.com/`). The service account needs Search Console and GA4 read access. Raw responses cache under `.cache/seo-intelligence/` (ignored).

```bash
npm run seo:intelligence
node scripts/seo_intelligence.js --days 28 --refresh   # force fresh pulls
```

An uncached run makes two Search Console + three GA4 requests.

## Manual competitive research (cost-gated)

`npm run seo:research -- --query "example query" --confirm-cost` (or the lower-level `npm run research`, which writes `static/_data/topic-queue.json`). Never schedule this or use it as rank tracking. The bounded weekly cluster-evidence research in `docs/modules/publishing-queue.md` is the one authorized automatic research path.

## Dashboard SEO panel (`static/dashboard/index.html`)

Part of the password-gated dashboard. Reads static JSON only: `topic-clusters.json` + `boom-posts.json` (cluster coverage, unclustered count) and `seo-intelligence.json` (GSC/GA4 status, opportunity counts, top three actions). Renders empty/loading states gracefully. Entry: `renderSeoIntelligence()` (→ `renderClusterCoverage()`, `renderSeoTrend()`, `renderSeoKeywords()`), wired into `loadDashboard()`.
