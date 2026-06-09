# Facebook VOA Publishing Provider

## Status

**Ready via Publer.** The VOA Facebook Page is confirmed and pinned.
Readiness: 14/14.

## VOA Facebook Account

| Field | Value |
|---|---|
| Platform | Facebook |
| Account name | Vibration of Awesome |
| Type | fb_page |
| Publer account ID | `5f189becdb27977d231aea50` |
| Env var | `PUBLER_FACEBOOK_ACCOUNT_ID` |

This was identified via `npm run check:publer-accounts` on 2026-06-09. The other Facebook accounts in the Publer workspace are the ESR Facebook Page (`673d1530a9c20f612dd07e8d`) and Matt's personal profile (`69e1b18694bf410c604b4cb5`) — neither should be used for VOA blog syndication.

## Publishing Path

Facebook VOA posts are published via `postViaPubler("facebook", caption, null)` in `scripts/syndicate.js`.

The Facebook caption from `generate-captions.js` includes the post URL in the text. Publer automatically creates a link preview when a URL is present in the post text.

## Direct Meta Path (Blocked — Do Not Restore)

The previous path used the ESC Meta App (direct Meta Graph API) with `META_PAGE_ID_VOA` and `META_PAGE_TOKEN_VOA`.

That path was blocked because the ESC Meta App does not have the `pages_manage_posts` scope, which Meta requires for Page feed publishing.

**Do not add `pages_manage_posts` to the ESC Meta App.** The ESC Meta App is used for analytics/read-only purposes and should remain read-only. Adding a publishing scope would expand the app review surface and permission footprint unnecessarily.

The `META_PAGE_ID_VOA` and `META_PAGE_TOKEN_VOA` env vars remain in `.env` for historical reference but are no longer used by the Facebook VOA publishing path.

## Health Check

`npm run check:syndication -- --write` validates the Publer Facebook VOA account by:
1. Confirming `PUBLER_FACEBOOK_ACCOUNT_ID` is set and matches the pinned VOA ID.
2. Confirming the account is visible in the Publer workspace.
3. Confirming the account name resolves to "Vibration of Awesome".

## Env Var Locations

`PUBLER_FACEBOOK_ACCOUNT_ID=5f189becdb27977d231aea50` is set in:
- Local `.env`
- GitHub Actions secret (`PUBLER_FACEBOOK_ACCOUNT_ID`)
- Vercel environment (all targets: production, preview, development)

It is present in these workflow env blocks:
- `.github/workflows/drip-posts.yml`
- `.github/workflows/syndication-catchup.yml`
- `.github/workflows/voa-watchdog.yml`

## Safe Validation

To check Publer account mapping without posting:

```bash
npm run check:publer-accounts
npm run check:syndication -- --write
```

To see just Facebook accounts:

```bash
node scripts/list-publer-accounts.js --platform facebook
```

## ESC Meta App — Read-Only Policy

The ESC Meta App is intentionally read-only. It is used for:
- Verifying the Meta Page token is valid
- Reading Page engagement data

It is NOT used for posting. Do not add `pages_manage_posts` to this app. If direct Meta publishing is ever needed outside Publer, use a separate publishing-specific Meta App with a dedicated permission review.
