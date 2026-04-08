# Pinterest Standard Access Video

This is the simplest way to make the demo video Pinterest support asked for.

## What support wants to see

The video must show two things:

1. OAuth flow
2. Integration

OAuth flow means:

- Pinterest login page
- you granting access to the app
- redirect back to your site
- the callback URL visibly showing the `code`
- the code being exchanged for an access token

Integration means:

- a real Pinterest API call
- visible results from that call

Pinterest support explicitly said data integration counts, not only pin creation. So showing authenticated Pinterest data on a local dashboard is acceptable.

## What I added

Run:

```bash
npm run pinterest-demo
```

This starts a local demo app at:

```text
http://localhost:9877
```

It gives you:

- a start page
- a button that launches the Pinterest OAuth flow
- a callback page that shows the returned code
- server-side token exchange
- live API results from:
  - `GET /v5/user_account`
  - `GET /v5/boards?page_size=10`

## Before recording

In the Pinterest developer app settings, make sure this redirect URI is registered:

```text
http://localhost:9877/callback
```

Also make sure the demo uses these scopes:

```text
boards:read,boards:write,pins:read,pins:write,user_accounts:read
```

## Video shot list

Record these in one continuous flow if possible:

1. Show the Pinterest support email so the reviewer sees what you are addressing.
2. Show your Pinterest app settings with the redirect URI.
3. Run `npm run pinterest-demo`.
4. Show the local demo page in the browser.
5. Click `Start OAuth Demo`.
6. Show the Pinterest login / consent screen.
7. Grant access to the app.
8. Show the redirect back to `http://localhost:9877/callback?...code=...`
9. Pause long enough for the callback page to show:
   - the code from the URL
   - token exchange success
   - account info from `GET /v5/user_account`
   - boards from `GET /v5/boards`
10. Scroll the result page so they can clearly see the API results.

## What to say in the video

Keep it plain:

```text
This demo shows the full Pinterest OAuth flow for my app, including the login page,
granting access, redirect back to my registered callback URI, code capture, token
exchange, and live Pinterest API usage. After authentication, the app fetches the
authenticated user account and boards and renders the results in the demo page.
```

## If you want an even stronger version later

The next-level demo would also show:

- sandbox pin creation
- the created pin appearing in Pinterest

But for now, this demo already covers the exact missing area support called out:
complete OAuth plus visible API integration.
