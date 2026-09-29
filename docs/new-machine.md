# Starting on a new machine (or a fresh chat anywhere)

The repo is the memory. A new chat needs only the repo plus the three local-only things below.

## Get going
1. `git clone https://github.com/Lordshrrred/VibrationofAwesome.git ~/Repos/VibrationofAwesome && cd ~/Repos/VibrationofAwesome`
2. `npm ci`
3. Open Claude Code in the folder. The SessionStart hook pulls latest and runs `npm run orient` (live state, `docs/handoff.md`, human commits since the handoff, machine readiness).
4. Say: "Get up to speed and continue." That means: read the orient output, read the module doc for the active item, name the active item and its next step, and continue.

## Local-only things (never in git)
| Thing | Where it lives | On a new machine |
|---|---|---|
| `.env` | symlink into Matt's private iCloud folder (real location is not written in this public repo) | Sign in to the same iCloud, then recreate the symlink at the repo root; Matt knows the folder, or run `ls -la .env` on his Mac. |
| `BMO_CONTEXT.md` | symlink into the same private iCloud folder | Same as `.env`: recreate the symlink. If absent, agents continue from `AGENTS.md` and say so; they never invent its contents. |
| CLI logins | `gh` and `vercel` keychains | `gh auth login`, `vercel login`. Needed for `gh secret set` and `npm run push:vercel-env`. |

## Check it worked
- `npm run orient` shows `.env: present` and `node_modules: present`.
- `node scripts/check-syndication-config.js` runs without missing-env errors.

## Cloud sessions
No `.env`, no `BMO_CONTEXT.md`, no `gh`. Use GitHub MCP tools; hand Matt the exact local command for anything needing secrets.

## Public-repo privacy rule
This repo is public. Never write private folder paths, symlink targets, key names' values, or account identifiers in tracked files. Symlinks and the files they point to are gitignored, so git never stores where they go.
