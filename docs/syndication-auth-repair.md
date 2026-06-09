# Syndication Auth Repair

Current readiness is 12/14. The working paths are Feeder, Bluesky VOA, Mastodon VOA, Pinterest VOA, Threads VOA, Instagram VOA, Dev.to, Tumblr VOA, and WordPress EarthStar. The remaining blockers are Facebook VOA direct posting and Blogger.

## Self-Healing Scope

The VOA auto-healer (`scripts/auto-heal.js`) **cannot repair OAuth or permission failures**. Auth failures are classified as `auth_reconnect_required` and the Claude call is hard-blocked. No Anthropic credits are spent on them. The watchdog sends an email alert and stops.

Blogger `invalid_grant` and Facebook `pages_manage_posts` are both classified as `auth_reconnect_required`. The correct repair for each is described below. Do not expect the daily watchdog cron to fix them.

See `docs/self-healing-syndication.md` for the full self-healing capability matrix.

Do not run a live publish or schedule test while repairing auth. Use the validation commands below, which check readiness without creating posts.

## Facebook VOA

Status: **resolved** — now publishing via Publer. Readiness is 14/14.

The VOA Facebook Page (`5f189becdb27977d231aea50`, "Vibration of Awesome") is confirmed and pinned in `PUBLER_FACEBOOK_ACCOUNT_ID`. The `check:syndication` health check validates the Publer account directly.

See `docs/facebook-voa-publishing-provider.md` for the full routing decision, account mapping, and why the direct Meta path remains blocked.

---

### Historical: direct Meta Graph API provider (blocked)

Root cause: the configured Facebook Page token is present and maps to the VOA Page, but it does not include the Page publishing permission required by the direct provider. The missing scope is:

```text
pages_manage_posts
```

The direct provider in `scripts/syndicate.js` posts to the Page feed with these env vars:

```text
META_PAGE_ID_VOA
META_PAGE_TOKEN_VOA
META_APP_ID
META_APP_SECRET
```

The token currently has enough access for the health check to identify the Page, but direct posting fails because Meta requires both `pages_read_engagement` and `pages_manage_posts` for Page feed publishing.

Recommended repair: route Facebook VOA through Publer after verifying the exact VOA Facebook account mapping in Publer. The Publer workspace already exposes Facebook accounts, and the codebase already has a Publer posting provider for Pinterest, Instagram, and Threads. Facebook VOA should not be enabled through Publer until the specific VOA Facebook account ID is confirmed and pinned, because picking the wrong Facebook account would post to the wrong destination.

Why not change the ESC Meta app now: keep the ESC Meta app read-only. Adding `pages_manage_posts` to that app would expand the app review and permission surface for a workflow that should remain analytics/read-only. If direct Meta publishing is desired later, use a separate publishing app/token or a future permission review dedicated to publishing.

External repair steps:

1. In Publer, confirm which connected Facebook account is the VOA Facebook Page.
2. Record only the selected account ID as a future config value, for example `PUBLER_FACEBOOK_ACCOUNT_ID` or a pinned entry in `PUBLER_VOA_ACCOUNT_IDS`.
3. Add code only after the account mapping is confirmed, so `facebook_voa` calls the Publer provider instead of the direct Meta provider.
4. Re-run readiness checks before any live post.
5. Do not run `npm run syndicate` or retry failed syndication for Facebook until an explicit dry-run or inspected live publish has been approved.

## Blogger

Status: blocked by Google OAuth refresh.

Root cause: the Blogger refresh token is present, but Google rejects it with:

```text
invalid_grant: Token has been expired or revoked.
```

The Blogger provider uses these env vars:

```text
BLOGGER_CLIENT_ID
BLOGGER_CLIENT_SECRET
BLOGGER_REFRESH_TOKEN
BLOGGER_BLOG_ID
BLOGGER_REDIRECT_PORT
BLOGGER_OAUTH_BROWSER
```

`BLOGGER_CLIENT_ID`, `BLOGGER_CLIENT_SECRET`, and `BLOGGER_BLOG_ID` should normally be preserved. The value that needs replacement is `BLOGGER_REFRESH_TOKEN`.

External repair steps:

1. Run:

```bash
npm run blogger-token
```

2. Complete the Google consent flow in the browser that opens.
3. Let the helper validate the new refresh token and save it to `.env`.
4. If GitHub CLI is authenticated, let the helper update the GitHub Actions secret `BLOGGER_REFRESH_TOKEN`.
5. If the browser or local callback port fails, set `BLOGGER_OAUTH_BROWSER` or `BLOGGER_REDIRECT_PORT` in `.env` and rerun the command.
6. Re-run the validation commands below.

## Validation

Use these commands after either repair:

```bash
npm run check:syndication -- --write
npm run check:emdash
hugo --minify
```

Expected current result before repair: `npm run check:syndication -- --write` reports 12/14 readiness and fails only Facebook VOA plus Blogger. The other commands should pass.

Publishing commands to avoid during repair:

```bash
npm run syndicate
node scripts/retry-failed-syndication.js
```

Only use retry tooling with an explicit dry-run option unless live posting has been approved.
