// check-url.js ~ Server-side URL + backlink checker for VOA dashboard
//
// Accepts: GET ?url=https://dev.to/...&source=https://vibrationofawesome.com/...
// Returns: { live, status, finalUrl, method, backlink }
//
// Platforms that require server-side checking (block browser CORS):
// ~ Dev.to
// ~ Any platform may block CORS ~ always use this function for all URL verification

"use strict";

import dns from "dns/promises";
import net from "net";

const TIMEOUT_MS = 5000;
const MAX_BODY_CHARS = 250000;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      ...CORS_HEADERS,
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

function isPrivateIp(address) {
  if (net.isIP(address) === 4) {
    const parts = address.split(".").map(Number);
    return (
      parts[0] === 10 ||
      parts[0] === 127 ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      (parts[0] === 0)
    );
  }

  if (net.isIP(address) === 6) {
    const lower = address.toLowerCase();
    return (
      lower === "::1" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      lower.startsWith("fe80:")
    );
  }

  return false;
}

function parseHttpUrl(raw) {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed;
  } catch {
    return null;
  }
}

async function assertPublicTarget(parsed) {
  const hostname = parsed.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new Error("Localhost URLs are not allowed");
  }

  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error("Private network URLs are not allowed");
    return;
  }

  const records = await dns.lookup(hostname, { all: true });
  if (!records.length) throw new Error("Hostname did not resolve");
  if (records.some(record => isPrivateIp(record.address))) {
    throw new Error("Private network URLs are not allowed");
  }
}

function normalizeForMatch(raw) {
  return String(raw || "")
    .trim()
    .replace(/^http:\/\//i, "https://")
    .replace(/\/+$/, "")
    .toLowerCase();
}

function backlinkStatus(sourceUrl, body) {
  if (!sourceUrl) return { checked: false };

  const normalizedSource = normalizeForMatch(sourceUrl);
  const encodedSource = encodeURI(sourceUrl).toLowerCase();
  const normalizedBody = normalizeForMatch(body).slice(0, MAX_BODY_CHARS);

  const confirmed =
    normalizedBody.includes(normalizedSource) ||
    normalizedBody.includes(encodedSource) ||
    normalizedBody.includes(normalizedSource.replace(/^https:\/\//, "http://"));

  return { checked: true, confirmed };
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return response;
  } catch (error) {
    clearTimeout(timer);
    throw error;
  }
}

async function fetchPublicUrl(url, options, redirectsRemaining = 5) {
  const parsed = parseHttpUrl(url);
  if (!parsed) throw new Error("Only http/https URLs are supported");
  await assertPublicTarget(parsed);

  const response = await fetchWithTimeout(parsed.href, {
    ...options,
    redirect: "manual",
  });

  if (
    response.status >= 300 &&
    response.status < 400 &&
    response.headers.get("location") &&
    redirectsRemaining > 0
  ) {
    const nextUrl = new URL(response.headers.get("location"), parsed.href);
    return fetchPublicUrl(nextUrl.href, options, redirectsRemaining - 1);
  }

  if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
    throw new Error("Too many redirects");
  }

  return response;
}

function responseSummary(resp, method, backlink) {
  return {
    live: resp.status >= 200 && resp.status < 400,
    status: resp.status,
    finalUrl: resp.url,
    method,
    backlink,
  };
}

export async function handler(event) {
  // Handle preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return json(405, { error: "Method not allowed" });
  }

  const params = event.queryStringParameters || {};
  const url = params.url;
  const sourceUrl = params.source || "";
  if (!url) {
    return json(400, { error: "Missing ?url= parameter" });
  }

  const parsedUrl = parseHttpUrl(url);
  if (!parsedUrl) {
    return json(400, { error: "Only http/https URLs are supported" });
  }

  const parsedSource = sourceUrl ? parseHttpUrl(sourceUrl) : null;
  if (sourceUrl && !parsedSource) {
    return json(400, { error: "source must be an http/https URL when provided" });
  }

  const requestHeaders = {
    // Mimic a real browser so platforms do not reject the default serverless UA.
    "User-Agent":
      "Mozilla/5.0 (compatible; VOA-Dashboard/1.0; +https://vibrationofawesome.com)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  };

  try {
    const headResp = await fetchPublicUrl(parsedUrl.href, {
      method: "HEAD",
      headers: requestHeaders,
    });

    const needsGet =
      Boolean(parsedSource) ||
      headResp.status === 403 ||
      headResp.status === 405 ||
      headResp.status >= 500;

    if (!needsGet) {
      return json(200, responseSummary(headResp, "HEAD", { checked: false }));
    }

    const getResp = await fetchPublicUrl(parsedUrl.href, {
      method: "GET",
      headers: {
        ...requestHeaders,
        "Range": "bytes=0-65535",
      },
    });

    let backlink = { checked: Boolean(parsedSource), confirmed: false };
    const contentType = getResp.headers.get("content-type") || "";
    if (parsedSource && /text|html|xml|json|javascript/i.test(contentType)) {
      const body = (await getResp.text()).slice(0, MAX_BODY_CHARS);
      backlink = backlinkStatus(parsedSource.href, body);
    }

    return json(200, responseSummary(getResp, "GET", backlink));
  } catch (err) {
    const timedOut = err.name === "AbortError";
    return json(200, {
      live: false,
      status: timedOut ? 0 : -1,
      error: timedOut ? "timeout" : err.message,
      backlink: { checked: Boolean(parsedSource), confirmed: false },
    });
  }
}
