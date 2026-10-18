# Handoff (current state)

Status board, not a log. Overwrite blocks in place and delete what's resolved; git and `docs/decisions.md` keep the past. Keep it under ~60 lines. Rules live in `AGENTS.md` and `docs/modules/`. New machine? `docs/new-machine.md`.

Last updated: 2026-10-18 (blog/cost audit and duplicate safeguards).

## At a glance
- **Most recent work:** blog/cost audit stopped repeated topic generation, repaired research parsing, truthful analytics totals and CTA event delivery. Eight tools are live; organic discovery remains small.
- **Dev.to: DONE 2026-09-29.** Removed from code, health checks, dashboards, docs, workflows; GitHub secrets and Vercel env deleted (see `docs/decisions.md`). Current readiness separately flags inventory and research gaps.
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
- **Status:** active but zero eligible drafts; 21 repeated-title drafts in `duplicate_holds`, HTML preserved. One additional repeat published during the audit before the safeguards deployed; its live record is preserved. Today's eight generation attempts were already consumed. Next normal refill must provide fresh articles within the existing cap; no manual paid run. Thirty eligible saved topics remain across all 11 clusters.
- **Open:** four weekly research attempts failed after September 17. Terminal JSON parsing and stale-evidence health now have regression coverage; await the next scheduled paid research attempt to verify live recovery. Readiness intentionally shows inventory/research gaps.
- **Next:** verify the next bounded refill; review 22 duplicate groups in the published archive before any URL consolidation. Matt has not approved a provider/model swap, higher daily rate, or changes to author portraits.

## Verified 2026-09-29
`build-info.json` live and current; `deployment-health.json` written and current with origin; GitHub issue 26 is informational only.

## Decided in chat, not yet in code
- Art Store UX stays ADHD-friendly: one obvious next action, strong defaults, automatic saving, and technical options hidden under Advanced.
