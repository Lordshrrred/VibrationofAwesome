# Handoff (current work state)

Overwrite this file at the end of each session; don't append history (that goes in `docs/decisions.md` or commit messages). Keep it under ~60 lines. Last updated: 2026-09-27.

## In progress
- Nothing mid-flight. Publishing runs automatically (4/day, balanced clusters); health was 16/16 at last check.

## Open problems / loose ends (found in the 2026-09-27 memory audit, not yet acted on)
- `static/_data/deployment-health.json` was last generated 2026-07-11. Either whatever wrote it stopped running or it's retired. Find the writer and decide.
- `static/_data/latest-voa-recommendations.json` (the ESC → VOA recommendation bridge) expired 2026-06-03 and hasn't been refreshed. Check whether ESC still exports to VOA.
- Queue count mismatch: `syndication-health.json` said 19 drafts remaining while `static/blog/boom/drafts/` held 21 HTML files. Possibly orphan draft files not in `drip-queue.json`; worth a quick reconciliation.
- `scripts/lib/orchestration-export.js` (feeds EarthStar Command) still hardcodes `CADENCE_PER_DAY = 2` and `QUEUE_WARN_AT = 30`; reality is 4/day and 14. Fixing it changes what ESC sees, so confirm with Matt first.
- `README.md` still documents the 8-niche system alongside the 11 clusters; the relationship is now explained in `docs/modules/content-generation.md`.

## Next actions
- None assigned. Ask Matt what to work on, or pick up a loose end above.

## Decided in chat, not yet in code
- (none)
