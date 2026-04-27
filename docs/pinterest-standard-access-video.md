# Pinterest Standard Access Video

This is the strongest local demo flow in the repo for the exact rejection Pinterest gave you.

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

Pinterest support explicitly said data integration counts, not only pin creation. So showing authenticated Pinterest data on a local dashboard is acceptable, as long as the reviewer can clearly see that the API calls happened after OAuth.

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
  - `POST /v5/oauth/token`
  - `GET /v5/user_account`
  - `GET /v5/boards?page_size=10`
- an optional sandbox `POST /v5/pins` attempt for a stronger write-integration demo
- raw JSON summaries so the reviewer can see the integration clearly

## Where the sandbox pin goes

The sandbox pin is not something you should rely on showing up on your normal public Pinterest profile or regular board view.

Treat it like this:

- production board view: what normal Pinterest users see
- sandbox pin create: proof that your app can make the write API request in Pinterest's sandbox environment

For the approval video, the safest proof is the on-screen request and response in the demo page, not hunting around Pinterest trying to find the sandbox pin visually.

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
4. Show the local demo page in the browser and keep the browser address bar visible.
5. Click `Start OAuth Demo`.
6. Show the Pinterest login / consent screen.
7. Grant access to the app.
8. After Pinterest redirects back, pause on `http://localhost:9877/callback?...code=...` so the returned `code` is visible in the address bar.
9. Pause long enough for the callback page to show:
   - the full callback URL
   - the code from the URL
   - token exchange request summary
   - token exchange success
   - account info from `GET /v5/user_account`
   - boards from `GET /v5/boards`
   - sandbox pin create section
   - raw API response blocks
10. Scroll the result page slowly so they can clearly see each section.
11. End the video only after the reviewer checklist is visible on-screen.

## Exact recording order

Use this exact sequence:

1. Open the Pinterest rejection email.
2. Open the Pinterest app settings and show `http://localhost:9877/callback` is registered.
3. In a terminal, run `npm run pinterest-demo`.
4. In the browser, show the demo home page.
5. Click `Start OAuth Demo`.
6. On Pinterest, show the app authorization screen before clicking approve.
7. Approve access.
8. On redirect, stop moving for 2 to 3 seconds so the callback URL with `code=` is visible.
9. Let the result page load fully.
10. Read the section titles out loud as you scroll:
    - OAuth Callback
    - Token Exchange
    - User Account API
    - Boards API
    - Sandbox Pin Create
    - Boards API Raw Result
11. Stop on the Reviewer Checklist.
12. Do not waste time trying to prove the sandbox pin is visible on your public board unless you already know exactly where Pinterest exposes it.

## Exactly what to say

Use this script almost verbatim:

```text
This video shows the full Pinterest OAuth flow for my app and a working API integration.
I am starting from my registered local callback URL demo.
I will click Start OAuth Demo, log into Pinterest, and show the authorize-app screen.
After approval, Pinterest redirects back to my registered callback URI with an authorization code.
This demo then exchanges that code for an access token using the Pinterest OAuth token endpoint.
After the token exchange succeeds, it calls the Pinterest user account endpoint and the boards endpoint and renders the live results on-screen.
The demo also shows a sandbox pin-create request so the reviewer can see the write integration path.
The sandbox pin-create proof is shown directly in the demo page, because sandbox content might not appear in the normal public Pinterest board view.
```

## Exactly what not to skip

- Do not cut away before the Pinterest authorize-app screen appears.
- Do not trim out the callback URL with `code=`.
- Do not stop at the UI only. The result page must be visible.
- Do not submit a video shorter than the full end-to-end flow.

## After recording

When you resubmit, include a note like this:

```text
I re-recorded the demo to show the full OAuth flow and live API integration in one continuous video.
The video shows the Pinterest login page, the authorize-app screen, redirect back to my registered callback URI with the code in the URL, server-side code exchange for an access token, and live API results from the authenticated Pinterest account.
```

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
