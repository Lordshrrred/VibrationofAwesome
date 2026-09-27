# Vibration of Awesome ~ Agent Instructions (Claude Code and Codex)

This is the shared, always-loaded core for every AI agent in this repo. Codex reads it directly; `CLAUDE.md` imports it. Keep it small: rules and pointers only. Details live in `docs/modules/`, history in `docs/decisions.md`, live state in generated files.

This repository is the canonical code/content repository for VibrationOfAwesome.com: a Hugo + static-HTML site on Vercel, plus Node automation that writes blog posts with Claude and syndicates them across ~15 platforms via GitHub Actions.

## Start of every session (fresh sessions are normal, not a loss)

1. Run `npm run orient` (Claude runs it automatically on start). It prints live queue/health state, the current `docs/handoff.md`, and recent human decisions from git. About one screen of text.
2. If `BMO_CONTEXT.md` exists (Matt's Mac only; it is private and never committed), read it for voice, brand, and collaboration context. If it is missing (cloud, Codex elsewhere), continue with this file and say so when brand/voice judgment matters. Never invent its contents.
3. Read only the module doc(s) for the task (index below). Don't read all of them.
4. The current user request outranks everything older. Verify operational facts (numbers, schedules, models) against code and fresh state before trusting prose.

## End of a work session

- Update the relevant `docs/modules/*.md` when behavior changes (same commit). Code, tests, and workflow files stay the source of truth; don't restate them.
- Rewrite `docs/handoff.md` (overwrite, don't append; keep it under ~60 lines): what's in progress, open problems, next actions, anything Matt decided in chat that isn't in code yet.
- Add a dated entry to `docs/decisions.md` only for a real decision or incident whose *why* would otherwise be lost.
- Durable brand/collaboration decisions go in `BMO_CONTEXT.md` (local only). Temporary run status never goes into any doc.

## Module index (read on demand)

| Working on | Read |
|---|---|
| Drip schedule, drafts, queue replenishment, cluster rotation | `docs/modules/publishing-queue.md` |
| Syndication, Publer, backlinks, anti-duplication, account IDs | `docs/modules/syndication.md` + `shared-config/syndication-policy-v1.md` |
| Health checks, email/issue alerts, Blogger reconnect, auto-heal | `docs/modules/monitoring.md` |
| Post generation, prompts, clusters, internal linking, templates | `docs/modules/content-generation.md` + `content-strategy/niche-map.md` |
| Changing models, tokens, caching, spend | `docs/modules/models-and-cost.md` |
| Search Console / GA4 intelligence, dashboard SEO panel | `docs/modules/seo-intelligence.md` |
| Images, Pinterest/Instagram visuals, registries | `docs/modules/visuals.md` + `shared-config/visual-generation-policy-v1.md` |
| Hugo, Vercel, redirects, nav, static pages, env vars | `docs/modules/site-and-hosting.md` + `docs/voa-public-site-truth.md` |
| Why something is the way it is | `docs/decisions.md` |
| Platform auth repair runbooks | `docs/syndication-auth-repair.md`, `docs/wordpress-oauth.md` |

## Context budget

- Never read these whole; query them with `node -e`/`jq`/`grep`: `static/_data/orchestration-state.json`, `syndication-results.json`, `syndication-log.json`, `image-registry.json`, `boom-posts.json`, `drip-queue.json`, `topic-queue.json`, `generation-memory.json`, `heal-log.json`, `package-lock.json`, and post HTML under `static/blog/`.
- Most commits are `[automated]` bot commits. Filter them out when looking for decisions.

## Core working rules

- Inspect before rewriting. Prefer incremental, testable changes. Preserve working behavior and sound architecture.
- Do not invent product claims, achievements, testimonials, partnerships, statistics, or history, in docs or in generated content.
- Do not turn VOA into generic wellness, motivational, spiritual, or AI-SaaS branding. Avoid corporate/startup copy. No em dashes in published copy (`npm run check:emdash`).
- Protect privacy. Never commit secrets, tokens, personal information, or identifying metadata. Keep public content about the project, not Matt's private life.
- Inspect `git status` before editing, preserve unrelated work, stage only your task's files.
- Validate meaningful changes before calling them done.

## Brand north star

Vibration of Awesome helps people cultivate a more alive, creative, connected, purposeful, authentic way of being. It is not about pretending everything is awesome. VOA is the public philosophy/content destination; EarthStar Rising (ESR) is social discovery; EarthStar Command (ESC) is a separate operations/intelligence system; Publer handles publishing where applicable. Don't replace VOA context with ESC's broader personal context.

## Invariants (do not break)

- **Anti-duplication:** every backlink/companion article gets a unique title and body and one link back to VOA; social captions are unique per platform; before any Publer create, `findExistingPublerPost()` checks Publer's live posts. Dev.to "canonical url has already been taken" = success. Details: `docs/modules/syndication.md`.
- **Canonical first:** external distribution happens only after the VOA URL is verified live.
- **Spend caps:** replenishment ≤ 8 article attempts/UTC day; topic planning and weekly research have persisted cooldowns; auto-heal ≥ 1h apart and ≤ 3/day; routine SEO intelligence makes zero paid model/search calls. Ask Matt before large manual Opus batches.
- **Models:** `generate-post.js` stays on Opus 4.8. Don't swap it (including to Opus 5) without reading `docs/modules/models-and-cost.md`.
- **Truthfulness in generated posts:** no fabricated first-person lived experience. The rules block is shared by `generate-post.js` and `generate-from-inspiration.js`; keep both in sync.
- **CLI guard:** any script with a top-level `main()` must not run on import. Use:
  ```js
  import { pathToFileURL as __voaPathToFileURL } from "node:url";
  const __voaIsCli = process.argv[1] && import.meta.url === __voaPathToFileURL(process.argv[1]).href;
  if (__voaIsCli) { main().catch(...); }
  ```
  (`syndicate.js`/`retry-failed-syndication.js` use `path.resolve`, `vercel-ignore-build.js` uses `fs.realpathSync`; all three are valid.)
- **Redirects:** never create a flat `static/blog/matt/posts/{slug}.html`; archive redirects live in `vercel.json`.
- **Don't delete** `static/admin/`, either image registry, or `BOOM_IMAGES` pool images without reading the relevant module doc. `/art-store/` is a live page, not a 404.
- **`BMO_CONTEXT.md` stays excluded** from Git and deployment uploads.

## Standing orders

- **Wire it up; don't ask Matt to do it by hand** when it can be done programmatically: Vercel env via `npm run push:vercel-env` or the Vercel API, GitHub secrets via `gh secret set`, Stripe via `node scripts/setup-stripe.js`, health via `node scripts/check-syndication-config.js --write`, retries via `node scripts/retry-failed-syndication.js`, deploys by pushing to `main`. If the current environment can't (cloud sessions have no `.env`, no `gh`), say exactly what needs running and where.
- Nav order everywhere: Field Guide ✦ · Art Store · AURA ✦ · EarthStar ✦ · Blog.
- Old log errors are historical evidence; check `static/_data/syndication-health.json` and fresh runs before escalating.
