# VOA Self-Healing Syndication System

## Does Self-Healing Exist?

Yes. `scripts/auto-heal.js` is the self-healing engine. It runs automatically via `.github/workflows/voa-watchdog.yml`.

## When It Runs

Three triggers:
1. **Workflow failure**: fires when the Drip Publish or Syndication Catch-up workflow fails.
2. **Daily schedule**: 3:30am ET every day (07:30 UTC cron).
3. **Manual dispatch**: `gh workflow run voa-watchdog.yml --ref main`.

## Two Tiers of Repair

### Tier 1 ~ Deterministic (no AI, no credits)

- Scans for em-dash violations (`—`) in scripts, layouts, and markdown.
- Replaces them with `~` and commits the fix.
- Re-triggers the drip workflow if the failure was drip-related.
- Never calls Claude. Never spends API credits.

### Tier 2/3 ~ Claude Haiku (code/config issues only)

- Reads `static/_data/syndication-health.json` for failing checks.
- **Hard-blocks Claude calls for auth failures** (see below).
- For non-auth failures, sends the health data and script excerpts to Claude Haiku.
- Claude may return a `code_patch`, `config_update`, `token_expired`, `platform_outage`, or `human_required` diagnosis.
- High-confidence `code_patch` responses targeting allowed files are applied automatically and committed.
- All other responses are surfaced via email to Matt.

## What Self-Healing Can Repair

| Failure type | Repairable? | How |
|---|---|---|
| Em-dash in scripts/layouts/markdown | Yes (Tier 1) | Deterministic replace + commit |
| Transient platform API error | Diagnosis only | Claude diagnoses, email alert sent |
| Code bug in syndication scripts | Maybe (Tier 2) | Claude code patch if high confidence |
| Wrong config value (non-secret) | Maybe (Tier 2) | Claude config suggestion |

## What Self-Healing Cannot Repair

These failure types are hard-blocked from Claude calls. The system pre-classifies them as `auth_reconnect_required` and immediately sends an email alert without spending credits.

| Failure type | Why AI cannot fix it | Correct repair |
|---|---|---|
| `invalid_grant` (Blogger, Google OAuth) | OAuth refresh token expired/revoked. A new token requires external Google consent. No API call can fabricate a valid OAuth token. | `npm run blogger-token` + browser consent |
| `pages_manage_posts` missing (Facebook VOA) | Meta API permission gap. Claude cannot grant API scopes or modify app permissions. | Route through Publer after verifying account mapping, or pursue a Meta publishing permission review |
| Missing refresh token | Token was never saved or was deleted. Requires the full OAuth flow. | Run the relevant `npm run *-token` command |
| Revoked token (any platform) | Token was explicitly revoked. Cannot be unrevoked by code. | Re-authenticate with the platform |

## Blogger `invalid_grant` Classification

When `check:syndication` reports `invalid_grant: Token has been expired or revoked.` for Blogger:

- `failureType` in the health JSON is `auth_reconnect_required`.
- `auto-heal.js` classifies it as `auth_reconnect_required` with `confidence: high`.
- **No Claude call is made. No Anthropic credits are spent.**
- The email subject is `VOA Needs Attention ~ health check failed` with a `REAUTH REQUIRED` section.
- The correct repair is `npm run blogger-token`.

This is the intended behavior. The system does not retry, self-patch, or spend credits on an auth failure.

## Facebook VOA `pages_manage_posts` Classification

When `check:syndication` reports `missing required Page posting scope(s): pages_manage_posts`:

- `failureType` in the health JSON is `auth_reconnect_required`.
- `auto-heal.js` pre-classifies it without calling Claude.
- The recommended repair is to route Facebook VOA through Publer (see `docs/syndication-auth-repair.md`).

## Spending / Credit Guardrails

- Auth failures (`invalid_grant`, `pages_manage_posts`, revoked tokens) are **hard-blocked** from the Claude call path.
- Claude is called only when `healableFailures.length > 0` (non-auth failures remain after filtering).
- There is no `--use-ai` flag requirement today, but auth failures will never reach the AI path regardless.
- If Claude is unavailable or returns an unparseable response, failures fall back to `human_required` without retry.
- The watchdog workflow does not loop; it runs once per trigger.

## How to Safely Run Self-Healing Manually

```bash
node scripts/auto-heal.js
```

This runs Tier 1 (em-dash scan) and Tier 2 (Claude diagnosis for non-auth failures). It reads `.env` for `ANTHROPIC_API_KEY`. If the only failures are auth-related, no Claude call is made.

To see what health check failures exist without triggering any healing:

```bash
npm run check:syndication -- --write
```

This is always safe: read-only platform checks, no posting, no AI calls.

## How to Disable the Watchdog

To stop the daily cron without removing the workflow, comment out the `schedule:` trigger in `.github/workflows/voa-watchdog.yml` and push. The `workflow_run` trigger will still fire on drip failures.

To fully disable, remove or rename `.github/workflows/voa-watchdog.yml`.

## Current Readiness Status

As of 2026-06-09: 12/14 platforms ready.

Blocked (external reauth required, AI cannot fix):
- **Facebook VOA**: direct Meta provider missing `pages_manage_posts` scope.
- **Blogger**: Google refresh token `invalid_grant` (expired/revoked). Run `npm run blogger-token`.

See `docs/syndication-auth-repair.md` for repair procedures.
