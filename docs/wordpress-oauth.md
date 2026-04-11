# WordPress.com OAuth Setup

VOA can publish to EarthStarRising directly through the WordPress.com REST API.
This bypasses Publer for WordPress if `WORDPRESS_OAUTH2_TOKEN` is set.

Official docs:
- https://developer.wordpress.com/docs/api/oauth2/
- https://developer.wordpress.com/docs/api/1.1/post/sites/%24site/posts/new/

## What To Create In WordPress.com

1. Open the WordPress.com Applications Manager.
2. Create a new application.
3. Set the redirect URI to:

```text
http://localhost:9878/callback
```

4. Copy the client id and client secret.
5. If your WordPress.com account uses 2FA, create an Application Password for the password-grant shortcut.

## Env Vars

Add these to `.env`:

```env
WORDPRESS_CLIENT_ID=
WORDPRESS_CLIENT_SECRET=
WORDPRESS_REDIRECT_URI=http://localhost:9878/callback
WORDPRESS_SCOPE=posts media
WORDPRESS_BLOG=https://earthstarrisingsun.wordpress.com
WORDPRESS_USERNAME=
WORDPRESS_APPLICATION_PASSWORD=
WORDPRESS_OAUTH2_TOKEN=
WORDPRESS_CATEGORY_NAMES=EarthStar Rising
WORDPRESS_TAG_NAMES=
```

## Fast Dev Token For Your Own Site

This is the quickest path for your own WordPress.com site:

```bash
python3 scripts/get-wordpress-oauth-token.py --flow password --write-env
```

## Full OAuth Code Flow

Generate the authorization URL:

```bash
python3 scripts/get-wordpress-oauth-token.py --flow auth-url
```

Authorize in the browser, then paste either the `code` value or the full callback URL:

```bash
python3 scripts/get-wordpress-oauth-token.py --flow exchange --code 'PASTE_CODE_OR_CALLBACK_URL' --write-env
```

## Verify The Token

```bash
python3 scripts/get-wordpress-oauth-token.py --flow verify
```

## Live Publishing

Once `WORDPRESS_OAUTH2_TOKEN` and `WORDPRESS_BLOG` are set, `scripts/syndicate.js` will publish WordPress posts directly through the WordPress.com API before falling back to Publer.
