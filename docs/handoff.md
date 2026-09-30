# Handoff (current state)

Status board, not a log. Overwrite blocks in place and delete what's resolved; git and `docs/decisions.md` keep the past. Keep it under ~60 lines. Rules live in `AGENTS.md` and `docs/modules/`. New machine? `docs/new-machine.md`.

Last updated: 2026-09-29 (Spring print sources recovered for all current Art Store designs).

## At a glance
- **Most recent work:** the live Art Store was extracted into a generated inventory without changing `/art-store/`. Full-resolution Spring uploads for all eight current design worlds were recovered to `/Users/matt/Documents/EarthStar Art Store Masters/recovered-from-spring/`; see `reports/art-store-source-recovery.md`. Some are reusable standalone art, while ADHD Higher Dimension and Uncontrollably Awesome are currently recovered as product-specific mug wraps.
- **Waiting on Matt (decision):** go-ahead to remove Dev.to (`devto`, `devto2`) from syndication. Evidence: `dev.to/awesomesaucyvibe`, `dev.to/earthstarrising` and all their article pages return 404 publicly while the API still lists 93 and 245 articles; both API keys return 401. Looks like suspension/shadow-ban. Full research 2026-09-29: every sampled article back to the first (acct 2: 2026-03-13, acct 1: 2026-06-17) returns 404, so all ~338 Dev.to backlinks are effectively gone; the API shows 0 views, 0 reactions, 0 comments ever. Live Dev.to body links use rel=noopener noreferrer (no nofollow), but that is moot while pages are hidden. Canonical points to VOA, so link value was small anyway. Not verified: whether Google ever indexed them, or the exact date they were hidden.
- **Waiting on Matt (manual):** on a new machine, sign in to iCloud and recreate the `.env` and `BMO_CONTEXT.md` symlinks (both now live in the private iCloud folder; see `docs/new-machine.md`).
- **If nothing is assigned:** ask Matt which item to take.

## Modules

### Syndication: `docs/modules/syndication.md`
- **Status:** working paths are Feeder, Bluesky, Mastodon, Pinterest, Threads, Instagram, Tumblr, WordPress. Dev.to is dead (above).
- **Next (once Matt approves):** remove `devto`/`devto2` from the syndication config, `scripts/check-syndication-config.js`, the `backlinks-only` / `art-devto2-only` profiles and `docs/modules/publishing-queue.md`; update `shared-config/syndication-policy-v1.md`; reassign the freed backlink slots (Blogger, WordPress, Tumblr; Matt picks); rerun `npm run check:syndication -- --write`. Then sweep failed GitHub Actions runs from the last 7 days.

### Site and dashboard: `docs/modules/site-and-hosting.md`
- **Art Store:** `npm run art-store:audit` writes the canonical current inventory and human report. `/art-store/` stays production; the future `/art-store-v2/` remains separate until complete. All eight current design sources are locally recovered. Next: use Vibration of Awesome Spiral as the end-to-end pilot for print QA, a private Spring listing, and an isolated v2 catalog entry.
- **Open:** the dashboard ESC recommendations panel is stale. `static/_data/latest-voa-recommendations.json` expired 2026-06-03 and `lordshrrred.github.io/VOA_Feeder/latest-voa-recommendations.json` is 404 (EarthStar Command isn't exporting it; fix belongs in the ESC repo). It is cosmetic. Suggested: hide the panel until ESC exports again.

### Publishing queue: `docs/modules/publishing-queue.md`
- **Status:** active, ~20 drafts. Three recovered orphan drafts (`recovered_orphan: true`) are still queued and publish through normal rotation.

## Verified 2026-09-29
`build-info.json` live and current; `deployment-health.json` written and current with origin; GitHub issue 26 is informational only.

## Decided in chat, not yet in code
- Art Store UX stays ADHD-friendly: one obvious next action, strong defaults, automatic saving, and technical options hidden under Advanced. Dev.to removal is recommended, not yet approved.
