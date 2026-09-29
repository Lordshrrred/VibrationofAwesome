# Handoff (current state)

Status board, not a log. Overwrite blocks in place and delete what's resolved; git and `docs/decisions.md` keep the past. Keep it under ~60 lines. Rules live in `AGENTS.md` and `docs/modules/`. New machine? `docs/new-machine.md`.

Last updated: 2026-09-29 (Dev.to accounts found dead; agent handoff hardened).

## At a glance
- **Most recent work:** local verification session. Site, deploys, drip queue, Feeder callback and Publer monitor all healthy. Health is 14/16; the only failures are the two Dev.to checks. Handoff/orient/new-machine setup was upgraded (orient now shows human commits since this file was updated and machine readiness).
- **Waiting on Matt (decision):** go-ahead to remove Dev.to (`devto`, `devto2`) from syndication. Evidence: `dev.to/awesomesaucyvibe`, `dev.to/earthstarrising` and all their article pages return 404 publicly while the API still lists 93 and 245 articles; both API keys return 401. Looks like suspension/shadow-ban. Canonical points to VOA, so link value was small.
- **Waiting on Matt (manual):** on a new machine, sign in to iCloud and recreate the `.env` and `BMO_CONTEXT.md` symlinks (both now live in the private iCloud folder; see `docs/new-machine.md`).
- **If nothing is assigned:** ask Matt which item to take.

## Modules

### Syndication: `docs/modules/syndication.md`
- **Status:** working paths are Feeder, Bluesky, Mastodon, Pinterest, Threads, Instagram, Tumblr, WordPress. Dev.to is dead (above).
- **Next (once Matt approves):** remove `devto`/`devto2` from the syndication config, `scripts/check-syndication-config.js`, the `backlinks-only` / `art-devto2-only` profiles and `docs/modules/publishing-queue.md`; update `shared-config/syndication-policy-v1.md`; reassign the freed backlink slots (Blogger, WordPress, Tumblr; Matt picks); rerun `npm run check:syndication -- --write`. Then sweep failed GitHub Actions runs from the last 7 days.

### Site and dashboard: `docs/modules/site-and-hosting.md`
- **Open:** the dashboard ESC recommendations panel is stale. `static/_data/latest-voa-recommendations.json` expired 2026-06-03 and `lordshrrred.github.io/VOA_Feeder/latest-voa-recommendations.json` is 404 (EarthStar Command isn't exporting it; fix belongs in the ESC repo). It is cosmetic. Suggested: hide the panel until ESC exports again.

### Publishing queue: `docs/modules/publishing-queue.md`
- **Status:** active, ~20 drafts. Three recovered orphan drafts (`recovered_orphan: true`) are still queued and publish through normal rotation.

## Verified 2026-09-29
`build-info.json` live and current; `deployment-health.json` written and current with origin; GitHub issue 26 is informational only.

## Decided in chat, not yet in code
- (none; Dev.to removal is recommended, not yet approved)
