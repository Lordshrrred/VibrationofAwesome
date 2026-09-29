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
| `.env` | symlink to iCloud `Dev Secrets/VibrationofAwesome/env` | Sign in to the same iCloud, then `ln -s "$HOME/Library/Mobile Documents/com~apple~CloudDocs/Dev Secrets/VibrationofAwesome/env" .env`. Without iCloud, copy the file by hand. |
| `BMO_CONTEXT.md` | repo root, gitignored, one copy on Matt's Mac | Copy it over by hand (AirDrop or iCloud). If absent, agents continue from `AGENTS.md` and say so; they never invent its contents. |
| CLI logins | `gh` and `vercel` keychains | `gh auth login`, `vercel login`. Needed for `gh secret set` and `npm run push:vercel-env`. |

## Check it worked
- `npm run orient` shows `.env: present` and `node_modules: present`.
- `node scripts/check-syndication-config.js` runs without missing-env errors.

## Cloud sessions
No `.env`, no `BMO_CONTEXT.md`, no `gh`. Use GitHub MCP tools; hand Matt the exact local command for anything needing secrets.
