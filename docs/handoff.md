# Handoff (current state)

Status board, not a log. Overwrite blocks in place and delete what's resolved; git and `docs/decisions.md` keep the past. Keep it under ~60 lines. Rules live in `AGENTS.md` and `docs/modules/`. New machine? `docs/new-machine.md`.

Last updated: 2026-09-29 (Spring print sources recovered for all current Art Store designs).

## At a glance
- **Most recent work:** the live Art Store was extracted into a generated inventory without changing `/art-store/`. Full-resolution Spring uploads for all eight current design worlds were recovered to `/Users/matt/Documents/EarthStar Art Store Masters/recovered-from-spring/`; see `reports/art-store-source-recovery.md`. Some are reusable standalone art, while ADHD Higher Dimension and Uncontrollably Awesome are currently recovered as product-specific mug wraps.
- **Dev.to: DONE 2026-09-29.** Removed from code, health checks, dashboards, docs, workflows; GitHub secrets and Vercel env deleted (see `docs/decisions.md`). Health is 14/14.
- **Waiting on Matt (approval to run):** rewrite public git history to remove old references to a private synced folder path (present in 4 commits: 13711827, 738fe46e, 5ce8f1db, faf5585a, plus messages). The sandbox blocked the force-push rewrite, so it has not been run. Plan: fresh mirror clone, `git filter-repo --replace-text/--replace-message`, verify zero matches, force-push `refs/heads/*`, reset local clones, then ask GitHub Support to purge cached views and `refs/pull/*` (PR 32/33 refs may still hold old text). Not yet checked: whether sibling repos (VOA_Feeder etc.) are private or contain the same strings.
- **Waiting on Matt (manual):** on a new machine, restore the private synced folder and recreate the `.env` and `BMO_CONTEXT.md` symlinks (both now live in the private synced folder; see `docs/new-machine.md`).
- **If nothing is assigned:** ask Matt which item to take.

## Modules

### Syndication: `docs/modules/syndication.md`
- **Status:** working paths are Feeder, Bluesky, Mastodon, Pinterest, Threads, Instagram, Tumblr, WordPress, Blogger. Dev.to is removed.
- **Next:** reassign backlink slot emphasis if wanted (Blogger, WordPress, Tumblr carry the tier). Sweep failed GitHub Actions runs from the last 7 days.

### Site and dashboard: `docs/modules/site-and-hosting.md`
- **Art Store:** `npm run art-store:audit` writes the canonical current inventory and human report. `/art-store/` stays production; the future `/art-store-v2/` remains separate until complete. All eight current design sources are locally recovered. Next: use Vibration of Awesome Spiral as the end-to-end pilot for print QA, a private Spring listing, and an isolated v2 catalog entry.
- **Open:** the dashboard ESC recommendations panel is stale. `static/_data/latest-voa-recommendations.json` expired 2026-06-03 and `lordshrrred.github.io/VOA_Feeder/latest-voa-recommendations.json` is 404 (EarthStar Command isn't exporting it; fix belongs in the ESC repo). It is cosmetic. Suggested: hide the panel until ESC exports again.

### Publishing queue: `docs/modules/publishing-queue.md`
- **Status:** active, ~20 drafts. Three recovered orphan drafts (`recovered_orphan: true`) are still queued and publish through normal rotation.

## Verified 2026-09-29
`build-info.json` live and current; `deployment-health.json` written and current with origin; GitHub issue 26 is informational only.

## Decided in chat, not yet in code
- Art Store UX stays ADHD-friendly: one obvious next action, strong defaults, automatic saving, and technical options hidden under Advanced.
