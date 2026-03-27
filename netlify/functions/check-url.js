// check-url.js ~ Server-side URL liveness checker for VOA dashboard
//
// Accepts: GET ?url=https://dev.to/...
// Returns: { "live": true, "status": 200 }
//       or { "live": false, "status": 404 }
//
// Platforms that require server-side checking (block browser CORS):
// ~ Dev.to
// ~ Hashnode
// ~ Any platform may block CORS ~ always use this function for all URL verification

"use strict";

const TIMEOUT_MS = 5000;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
};

exports.handler = async function (event) {
  // Handle preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  const url = (event.queryStringParameters || {}).url;
  if (!url) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Missing ?url= parameter" }),
    };
  }

  // Basic safety: only allow http/https URLs
  if (!/^https?:\/\//i.test(url)) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Only http/https URLs are supported" }),
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const resp = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        // Mimic a real browser so platforms don't block bot UA
        "User-Agent":
          "Mozilla/5.0 (compatible; VOA-Dashboard/1.0; +https://vibrationofawesome.com)",
      },
    });
    clearTimeout(timer);
    const live = resp.status >= 200 && resp.status < 400;
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ live, status: resp.status }),
    };
  } catch (err) {
    clearTimeout(timer);
    const timedOut = err.name === "AbortError";
    return {
      statusCode: 200, // return 200 so dashboard can read the JSON
      headers: CORS_HEADERS,
      body: JSON.stringify({
        live: false,
        status: timedOut ? 0 : -1,
        error: timedOut ? "timeout" : err.message,
      }),
    };
  }
};
