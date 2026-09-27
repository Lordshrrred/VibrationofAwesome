# Handoff (current work state)

Overwrite this file at the end of each session; don't append history (that goes in `docs/decisions.md` or commit messages). Keep it under ~60 lines. Last updated: 2026-09-27.

## In progress
- Branch `claude/nifty-gates-1phvkp` holds the agent-memory restructure plus the loose-end fixes below. It must be merged to `main` before new sessions (and the SessionStart hook) see any of it.

## Verify after the merge deploys
- `https://vibrationofawesome.com/build-info.json` should exist and show the deployed commit. If it's missing, check that Vercel's "Automatically expose System Environment Variables" is on and the build log shows `build-info: <sha>`.
- The next `syndication-health.yml` run (every 12h) should commit a fresh `static/_data/deployment-health.json`; the dashboard's Deployment Health card should read Current with a "Why" line.
- ESC recommendations panel: the dashboard now shows whichever export is newest (local vs `lordshrrred.github.io/VOA_Feeder`). If it still shows "Expired Jun 3", EarthStar Command itself has stopped exporting to VOA_Feeder, and the fix belongs in the ESC repo.
- Three recovered drafts (`recovered_orphan: true` in `drip-queue.json`) will publish through normal rotation.

## Open problems
- None known in this repo.

## Next actions
- None assigned. Ask Matt what to work on.

## Decided in chat, not yet in code
- (none)
