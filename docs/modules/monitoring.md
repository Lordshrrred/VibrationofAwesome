# Module: Monitoring, alerts, and self-healing

Read this before touching `syndication-health.yml`, `publer-delivery-monitor.yml`, `workflow-failure-alerts.yml`, `voa-watchdog.yml`, `auto-heal.js`, or Blogger OAuth. Deeper runbooks: `docs/self-healing-syndication.md`, `docs/syndication-auth-repair.md`.

## Publer delivery monitor (2026-09-01)

- `.github/workflows/publer-delivery-monitor.yml` runs every 15 minutes in the cloud, even when Matt's Mac is asleep.
- `scripts/publer-delivery-monitor.js` checks new failed posts across the shared Publer workspace and publishing access for EarthStarRising and LumiVale TikTok. It deduplicates through a closed, machine-owned GitHub issue.
- The guaranteed durable alert is an **assigned open GitHub issue**. Gmail (existing OAuth client/refresh-token secrets, `gmail.send` scope) is secondary and activates once that grant is refreshed. Never replace either with local macOS `mail`, which can exit 0 with no mail service running.
- `workflow_dispatch` with `send_test_email: true` is the end-to-end test. Keep workflow permissions at `contents: read` + `issues: write`, so state stays durable without committing generated files.

## Syndication health alerts

`syndication-health.yml` runs every 12 hours. It emails `earthlingoflight@gmail.com` for new Blogger refresh failures, active inventory below eight drafts, and recovery; unchanged states stay quiet. Gmail SMTP app-password is preferred (it does not share Google OAuth Testing expiry), with the Gmail API as fallback. A send counts only after SMTP recipient acceptance or a Gmail message ID. Failed email creates an assigned repair issue, persists pending delivery, retries after 24h, and fails the workflow. `workflow_dispatch` supports `send_test_email=true`. A closed state issue deduplicates alerts and holds no tokens.

`workflow-failure-alerts.yml` ("VOA Workflow Failure Alerts") separately emails that address when a scheduled publishing, replenishment, SEO, backlink, build, deployment, feeder, subscriber-reply, or watchdog workflow fails.

## Blogger

- The Google OAuth app must be **In production** (Testing expires refresh tokens after 7 days). Reconnect after changing status. Production tokens can still be revoked, so monitoring stays necessary.
- Reconnect: `npm run blogger-token`, **run locally from the VOA repo** (opens Safari after binding the localhost callback, verifies OAuth state, validates the token, saves `.env`, updates the GitHub Actions secret, never prints tokens). A failed GitHub secret sync counts as a failed repair even if the local save succeeded. Cloud sessions cannot do this; tell Matt.
- The dashboard always shows a **Reconnect Blogger** disclosure with the copyable command (the static dashboard cannot run shell commands). `invalid_grant`/revoked errors are recognized; health-check failures are only deduplicated when a visible token warning exists; a dismissed chip cannot hide a failed check.
- Backlink backfill reserves at most **four extra Blogger catch-up attempts per UTC day**, checkpointed via each result's `backfill_attempted_at` before posting and preserved by syndication merges. Auth is checked once before generating companions; other platforms still proceed. The workflow shares publishing concurrency.

## Auto-heal (`scripts/auto-heal.js`, run by `voa-watchdog.yml`)

The watchdog fires on every `drip-posts.yml`/`syndication-catchup.yml` failure (`workflow_run`), daily at 3:30am ET, and on manual dispatch, and Tier 1's `retriggerDrip()` can re-trigger the watchdog. So auto-heal has hard limits, checked before anything else, including the Claude call:
- At least 1 hour between runs (`scripts/.last-autoheal-timestamp`, committed only on an actual run).
- At most 3 runs/day (today-dated entries in `static/_data/heal-log.json`).

Its last output line is `AUTOHEAL_STATUS=ran|skipped-cooldown|skipped-max-attempts`; the workflow appends it to `scripts/syndication_log.txt` on every trigger. There is no `platform-health.yml` in this repo.
