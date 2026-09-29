# Handoff (current work state)

Overwrite this file at the end of each session; don't append history (that goes in `docs/decisions.md` or commit messages). Keep it under ~60 lines. Last updated: 2026-09-29.

## In progress
- Nothing mid-flight. 2026-09-29 local session verified the live state below; no code changed.

## Verified 2026-09-29 (from Matt's Mac)
- `https://vibrationofawesome.com/build-info.json` is live and tracks the latest deployed commit.
- `static/_data/deployment-health.json` is being written by the health run and reads current with origin.
- Drip publish, Feeder callback, and Publer Delivery Monitor runs are succeeding; queue active, 20 drafts left.
- Three recovered orphan drafts (`recovered_orphan: true` in `drip-queue.json`) are still queued and will publish through normal rotation.

## Open problems
- **Dev.to auth is broken (health 14/16).** Both `DEVTO_API_KEY` and `DEVTO2_API_KEY` in `.env` return 401 from `https://dev.to/api/users/me`, so the keys were revoked or expired (both passed ~2026-09-27). Needs Matt to generate new keys in each Dev.to account (Settings > Extensions). Then wire them: update `.env`, `npm run push:vercel-env`, `gh secret set DEVTO_API_KEY` and `gh secret set DEVTO2_API_KEY`, then `npm run check:syndication -- --write`.
- **ESC recommendations panel is stale.** `static/_data/latest-voa-recommendations.json` expired 2026-06-03, and `lordshrrred.github.io/VOA_Feeder/latest-voa-recommendations.json` returns 404 (the file is not in the VOA_Feeder repo at all). EarthStar Command is not exporting to VOA_Feeder; the fix belongs in the ESC repo.
- GitHub issue 26 is an informational notice only.

## Next actions
- Matt: create the two Dev.to keys (or tell me to drive it in Chrome with approval), then wire them per above.
- Matt: decide whether to fix the ESC export in the ESC repo.

## Decided in chat, not yet in code
- (none)
