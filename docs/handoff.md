# Handoff (current state)

Status board, not a log. Overwrite blocks in place and delete what's resolved; git and `docs/decisions.md` keep the past. Keep it under ~60 lines. Rules live in `AGENTS.md` and `docs/modules/`. New machine? `docs/new-machine.md`.

Last updated: 2026-10-19 (bounded refill verified; article-body backlink checks wired in).

## At a glance
- **Most recent work:** full Sonnet refill produced complete drafts with cache reuse and zero thinking tokens; a rejected truncated response led to an explicit word budget, without raising caps. Conflicting personal-feeling instructions and overconfident claims in new health drafts corrected. Article-body backlink verification now runs before catch-up.
- **Dev.to: DONE 2026-09-29.** Removed from code, health checks, dashboards, docs, workflows; GitHub secrets and Vercel env deleted (see `docs/decisions.md`). Current readiness separately flags inventory and research gaps.
- **Waiting on Matt (approval to run):** rewrite public git history to remove old references to a private synced folder path (present in 4 commits: 13711827, 738fe46e, 5ce8f1db, faf5585a, plus messages). The sandbox blocked the force-push rewrite, so it has not been run. Plan: fresh mirror clone, `git filter-repo --replace-text/--replace-message`, verify zero matches, force-push `refs/heads/*`, reset local clones, then ask GitHub Support to purge cached views and `refs/pull/*` (PR 32/33 refs may still hold old text). Not yet checked: whether sibling repos (VOA_Feeder etc.) are private or contain the same strings.
- **Waiting on Matt (manual):** on a new machine, restore the private synced folder and recreate the `.env` and `BMO_CONTEXT.md` symlinks (both now live in the private synced folder; see `docs/new-machine.md`).
- **If nothing is assigned:** ask Matt which item to take.

## Modules

### Syndication: `docs/modules/syndication.md`
- **Status:** working paths are Feeder, Bluesky, Mastodon, Pinterest, Threads, Instagram, Tumblr, WordPress, Blogger. Dev.to is removed.
- **Next:** inspect ongoing article-body verification and reconcile historical live posts absent from distribution records, separately from tracked-only catch-up. Blocked checks never trigger reposting. Persisted slot profiles exclude intentional Feeder skips; cadence is unchanged. Owned links do not prove indexing or ranking credit.

### Site and dashboard: `docs/modules/site-and-hosting.md`
- **Art Store:** `npm run art-store:audit` writes the canonical current inventory and human report. `/art-store/` stays production; the future `/art-store-v2/` remains separate until complete. All eight current design sources are locally recovered. Next: use Vibration of Awesome Spiral as the end-to-end pilot for print QA, a private Spring listing, and an isolated v2 catalog entry.
- **Open:** the dashboard ESC recommendations panel is stale. `static/_data/latest-voa-recommendations.json` expired 2026-06-03 and `lordshrrred.github.io/VOA_Feeder/latest-voa-recommendations.json` is 404 (EarthStar Command isn't exporting it; fix belongs in the ESC repo). It is cosmetic. Suggested: hide the panel until ESC exports again.

### Publishing queue: `docs/modules/publishing-queue.md`
- **Status:** the cheaper writer produced complete drafts in the bounded cloud refill. Its incomplete output was rejected and remains counted in the daily budget. The tighter word brief keeps the existing token ceiling. Publishing remains four/day; read generated queue state for inventory.
- **Research:** fresh October 18 editorial web evidence covers all 11 clusters, explicitly not search-volume proof. Automatic parser fixes have regression coverage; the next allowed weekly attempt verifies live recovery.
- **Consolidation:** 86 later URLs across 22 repeated-title groups redirect to 347 retained articles. Zero identical bodies or cross-title 50% phrase-overlap pairs in that retained snapshot. `article-redirects.json` excludes retired sources from catch-up; history is preserved. Re-run consolidation in preview mode for a fresh audit.
- **Next:** verify later normal refills rebuild the healthy reserve and stay within the word brief. Automatic research next becomes eligible October 23 at 14:56 UTC; do not reset that cooldown for a smoke test. Tool analytics records usage without answer choices or result profiles.

## Verified 2026-09-29
`build-info.json` live and current; `deployment-health.json` written and current with origin; GitHub issue 26 is informational only.

## Decided in chat, not yet in code
- Art Store UX stays ADHD-friendly: one obvious next action, strong defaults, automatic saving, and technical options hidden under Advanced.
