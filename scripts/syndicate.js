#!/usr/bin/env node
/**
 * syndicate.js ~ Full content syndication engine for vibrationofawesome.com
 *
 * Platforms: Bluesky · Mastodon · Facebook (VOA + EarthStar) · Pinterest
 *            Dev.to · Tumblr · Instagram (Publer) · Threads (Publer)
 *            Blogger · WordPress (EarthStarRising via Publer)
 *
 * CLI:  node scripts/syndicate.js --lane [matt|boom] --slug <post-slug> [--keyword "search term"] [--blogger-only]
 * API:  import { syndicatePost } from "./syndicate.js"
 */

/*
  SYNDICATION CONTENT RULE

  When syndicating to ANY platform ~ Blogger,
  Bluesky, Mastodon, Pinterest, Dev.to,
  Tumblr or any future platform ~ we NEVER copy
  and paste the original article.

  We always use the Claude API to generate fresh,
  related content inspired by the source material.
  Think of it like a human writer who read the
  original and wrote something new from their own
  perspective ~ same themes, different expression.

  Source article = context and inspiration only.
  Every syndicated post is original content.
  Every syndicated post links back to VOA.
  Every syndicated post is posted as DRAFT first.
*/

import Anthropic from "@anthropic-ai/sdk";
import crypto    from "crypto";
import dotenv    from "dotenv";
import { fileURLToPath } from "url";
import path      from "path";
import fs        from "fs";
import minimist  from "minimist";

import { generateCaptions } from "./generate-captions.js";
import { selectImage }      from "./select-image.js";

dotenv.config({ override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = path.resolve(__dirname, "..");
const LOG_FILE     = path.join(ROOT, "static", "_data", "syndication-log.json");
const RESULTS_FILE = path.join(ROOT, "static", "_data", "syndication-results.json");
const CACHE_DIR    = path.join(ROOT, ".cache");

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Strip HTML tags, collapse whitespace */
function stripHtml(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** First N words of a string */
function firstWords(str, n) {
  return str.split(/\s+/).slice(0, n).join(" ");
}

/** RFC 3986 percent-encode (for OAuth 1.0a) */
function pctEncode(s) {
  return encodeURIComponent(String(s))
    .replace(/!/g, "%21").replace(/'/g, "%27")
    .replace(/\(/g, "%28").replace(/\)/g, "%29").replace(/\*/g, "%2A");
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function makeBlockId(prefix = "blk") {
  return `${prefix}_${crypto.randomBytes(5).toString("hex")}`;
}

function firstNonEmpty(...values) {
  return values.find(v => typeof v === "string" && v.trim()) || null;
}

async function fetchPublerJson(url, options = {}, attempts = 3) {
  let lastResponse = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const response = await fetch(url, options);
    lastResponse = response;
    if (response.status !== 429) {
      const data = await response.json().catch(() => ({}));
      return { response, data };
    }

    const retryAfter = Number(response.headers.get("retry-after")) || (attempt + 1) * 3;
    if (attempt < attempts - 1) {
      await sleep(retryAfter * 1000);
      continue;
    }
  }

  const data = await lastResponse?.json().catch(() => ({}));
  return { response: lastResponse, data };
}

function parseCsvEnv(value, fallback = []) {
  if (!value || !String(value).trim()) return fallback;
  return String(value)
    .split(",")
    .map(part => part.trim())
    .filter(Boolean);
}

function resolvePublerTaxonomyIds(requestedIds, availableItems, fallbackIds = []) {
  const availableIds = Array.isArray(availableItems)
    ? availableItems
        .map(item => String(item?.id || "").trim())
        .filter(Boolean)
    : [];

  if (!availableIds.length) return requestedIds.length ? requestedIds : fallbackIds;
  if (!requestedIds.length) return availableIds.length ? availableIds : fallbackIds;

  const matchedIds = requestedIds.filter(id => availableIds.includes(String(id)));
  if (matchedIds.length) return matchedIds;
  return availableIds.length ? availableIds : fallbackIds;
}

function getPublerConfig() {
  const key  = process.env.PUBLER_API_KEY;
  const wsId = process.env.PUBLER_WORKSPACE_ID;
  if (!key)  throw new Error("PUBLER_API_KEY not set");
  if (!wsId) throw new Error("PUBLER_WORKSPACE_ID not set");

  return {
    BASE: "https://app.publer.com/api/v1",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `Bearer-API ${key}`,
      "Publer-Workspace-Id": wsId,
    },
  };
}

async function pollPublerJob(jobId, headers, baseUrl = "https://app.publer.com/api/v1", maxAttempts = 30, delayMs = 2000) {
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(delayMs);
    const { data: status } = await fetchPublerJson(`${baseUrl}/job_status/${jobId}`, { headers }, 3);
    if (status.status === "complete" || status.status === "completed") return status;
    if (status.status === "failed" || status.status === "error") return status;
  }
  throw new Error("Publer job timed out");
}

function extractPublerFailure(jobStatus) {
  const failures = jobStatus?.payload?.failures;
  if (!failures) return null;
  const firstFailureGroup = Object.values(failures).find(Array.isArray);
  if (firstFailureGroup?.[0]?.message) return firstFailureGroup[0].message;
  return null;
}

async function uploadPublerMediaFromUrl(imageUrl, headers, baseUrl = "https://app.publer.com/api/v1") {
  const { response: upResp, data: upData } = await fetchPublerJson(`${baseUrl}/media/from-url`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      media: [{ url: imageUrl, name: "post-image" }],
      type: "single",
      direct_upload: false,
      in_library: false,
    }),
  }, 3);
  if (!upResp.ok) throw new Error(`Publer media upload: ${upData.message || upResp.status}`);

  if (!upData.job_id) {
    return Array.isArray(upData) ? upData[0]?.id : upData.id;
  }

  const job = await pollPublerJob(upData.job_id, headers, baseUrl);
  const failure = extractPublerFailure(job);
  if (failure) throw new Error(`Publer media upload: ${failure}`);
  const mediaId = Array.isArray(job.payload) ? job.payload[0]?.id : job.payload?.id;
  if (!mediaId) throw new Error("Publer media upload timed out");
  return mediaId;
}

async function listPublerAccounts(headers, baseUrl = "https://app.publer.com/api/v1") {
  const { response: resp, data } = await fetchPublerJson(`${baseUrl}/accounts`, { headers }, 3);
  if (!resp.ok) throw new Error(`Publer accounts: ${data.message || resp.status}`);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

async function findRecentPublerWordPressPost(accountId, title, headers, baseUrl = "https://app.publer.com/api/v1") {
  const params = new URLSearchParams({
    "account_ids[]": accountId,
    limit: "10",
  });
  const { response: resp, data } = await fetchPublerJson(`${baseUrl}/posts?${params.toString()}`, { headers }, 3);
  if (!resp.ok) return null;

  const posts = Array.isArray(data?.posts) ? data.posts : [];
  const normalizedTitle = String(title || "").trim().toLowerCase();
  const match = posts.find(post =>
    String(post?.title || "").trim().toLowerCase() === normalizedTitle
      && firstNonEmpty(post?.post_link, post?.url)
  );
  return firstNonEmpty(match?.post_link, match?.url);
}

async function getPublerWordPressAccount(headers, baseUrl = "https://app.publer.com/api/v1") {
  const explicitId = process.env.PUBLER_WORDPRESS_EARTHSTAR_ACCOUNT_ID
    || process.env.PUBLER_WORDPRESS_ACCOUNT_ID;
  if (explicitId) {
    return {
      id: explicitId,
      provider: "wordpress_oauth",
      name: process.env.PUBLER_WORDPRESS_EARTHSTAR_ACCOUNT_NAME || "Earthstarrising",
      permissions: { can_access: false },
      wordpress_categories: [],
      wordpress_tags: [],
    };
  }

  const accounts = await listPublerAccounts(headers, baseUrl);
  const preferredName = (process.env.PUBLER_WORDPRESS_EARTHSTAR_ACCOUNT_NAME || "Earthstarrising").trim().toLowerCase();
  const matchByName = accounts.find(account =>
    account?.provider === "wordpress_oauth"
    && String(account?.name || "").trim().toLowerCase() === preferredName
  );
  if (!matchByName?.id) {
    throw new Error("Could not find Publer WordPress account for EarthStarRising");
  }
  return matchByName;
}

// ── OAuth 1.0a (Tumblr) ───────────────────────────────────────────────────────

/**
 * Build an OAuth 1.0a Authorization header (HMAC-SHA1).
 * bodyParams: plain object of extra non-oauth request body params to include in signature.
 */
function buildOAuthHeader({ method, url, bodyParams = {}, consumerKey, consumerSecret, token, tokenSecret }) {
  const oauthParams = {
    oauth_consumer_key:     consumerKey,
    oauth_nonce:            crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp:        String(Math.floor(Date.now() / 1000)),
    oauth_token:            token,
    oauth_version:          "1.0",
  };

  const allParams = { ...oauthParams, ...bodyParams };
  const paramStr  = Object.keys(allParams).sort()
    .map(k => `${pctEncode(k)}=${pctEncode(allParams[k])}`).join("&");

  const baseStr    = `${method.toUpperCase()}&${pctEncode(url)}&${pctEncode(paramStr)}`;
  const signingKey = `${pctEncode(consumerSecret)}&${pctEncode(tokenSecret)}`;
  const signature  = crypto.createHmac("sha1", signingKey).update(baseStr).digest("base64");

  oauthParams.oauth_signature = signature;
  const headerParts = Object.entries(oauthParams)
    .filter(([k]) => k.startsWith("oauth_"))
    .map(([k, v]) => `${pctEncode(k)}="${pctEncode(v)}"`).join(", ");

  return `OAuth ${headerParts}`;
}

// ── Facebook: long-lived token exchange ───────────────────────────────────────

/**
 * Exchange a short-lived page token for a long-lived one (60 days).
 * Requires META_APP_ID and META_APP_SECRET in .env.
 * Results are cached in .cache/fb-tokens.json so this runs once per token.
 */
async function getLongLivedToken(label, shortToken) {
  const appId     = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) return shortToken; // Can't exchange without app creds

  // Check cache
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const cacheFile = path.join(CACHE_DIR, "fb-tokens.json");
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(cacheFile, "utf8")); } catch (_) { /* fresh */ }

  if (cache[label]) {
    const expiresAt = new Date(cache[label].expiresAt);
    if (expiresAt > new Date()) {
      return cache[label].token;
    }
  }

  // Exchange token
  try {
    const qs   = new URLSearchParams({
      grant_type:         "fb_exchange_token",
      client_id:          appId,
      client_secret:      appSecret,
      fb_exchange_token:  shortToken,
    });
    const resp = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${qs}`);
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message);

    const expiresAt = new Date(Date.now() + (data.expires_in || 5184000) * 1000).toISOString();
    cache[label] = { token: data.access_token, expiresAt };
    fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
    console.log(`  [fb-tokens] Exchanged long-lived token for ${label} (expires ${expiresAt})`);
    return data.access_token;
  } catch (err) {
    console.warn(`  [fb-tokens] Token exchange failed for ${label}: ${err.message} ~ using original`);
    return shortToken;
  }
}

// ── Platform post functions ───────────────────────────────────────────────────

/** Post to Bluesky using AT Protocol */
async function postToBluesky(caption, postUrl, postTitle, postExcerpt) {
  const handle   = process.env.BLUESKY_HANDLE;
  const password = process.env.BLUESKY_APP_PASSWORD;
  if (!handle || !password) throw new Error("BLUESKY_HANDLE or BLUESKY_APP_PASSWORD not set");

  const base = "https://bsky.social/xrpc";

  // Create session
  const sessionResp = await fetch(`${base}/com.atproto.server.createSession`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ identifier: handle, password }),
  });
  const session = await sessionResp.json();
  if (!sessionResp.ok) throw new Error(`Bluesky auth failed: ${session.message || sessionResp.status}`);

  const { accessJwt, did } = session;

  // Build post record with external link embed
  const record = {
    $type:     "app.bsky.feed.post",
    text:      caption.slice(0, 300),
    createdAt: new Date().toISOString(),
    embed: {
      $type:    "app.bsky.embed.external",
      external: {
        uri:         postUrl,
        title:       postTitle,
        description: postExcerpt || "",
      },
    },
  };

  const postResp = await fetch(`${base}/com.atproto.repo.createRecord`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessJwt}` },
    body:    JSON.stringify({ repo: did, collection: "app.bsky.feed.post", record }),
  });
  const postData = await postResp.json();
  if (!postResp.ok) throw new Error(`Bluesky post failed: ${postData.message || postResp.status}`);

  const rkey    = postData.uri?.split("/").pop();
  const handle2 = handle.replace("@", "");
  return {
    postId:  postData.uri,
    postUrl: `https://bsky.app/profile/${handle2}/post/${rkey}`,
  };
}

/** Post to Mastodon */
async function postToMastodon(caption) {
  let instance = (process.env.MASTODON_INSTANCE || "").replace(/\/+$/, "");
  const token  = process.env.MASTODON_ACCESS_TOKEN;
  if (!instance || !token) throw new Error("MASTODON_INSTANCE or MASTODON_ACCESS_TOKEN not set");
  // Ensure https:// scheme ~ users often store just "mastodon.social"
  if (!instance.startsWith("http")) instance = `https://${instance}`;

  const resp = await fetch(`${instance}/api/v1/statuses`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      Authorization:   `Bearer ${token}`,
    },
    body: JSON.stringify({ status: caption.slice(0, 500), visibility: "public" }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(`Mastodon: ${data.error || resp.status}`);
  return { postId: data.id, postUrl: data.url };
}

/** Post to a Facebook Page */
async function postToFacebookPage(pageId, pageToken, caption, postUrl) {
  const longToken = await getLongLivedToken(pageId, pageToken);
  const body      = new URLSearchParams({
    message:      caption,
    link:         postUrl,
    access_token: longToken,
  });
  const resp = await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed`, {
    method: "POST",
    body,
  });
  const data = await resp.json();
  if (!resp.ok || data.error) throw new Error(data.error?.message || `Facebook HTTP ${resp.status}`);
  return { postId: data.id, postUrl: `https://www.facebook.com/${data.id}` };
}

/** Post a Pin to Pinterest */
async function postToPinterest(caption, postTitle, postUrl, imageUrl) {
  const token   = process.env.PINTEREST_ACCESS_TOKEN;
  const boardId = process.env.PINTEREST_BOARD_ID;
  if (!token)   throw new Error("PINTEREST_ACCESS_TOKEN not set");
  if (!boardId) throw new Error("PINTEREST_BOARD_ID not set");

  const body = {
    link:        postUrl,
    title:       postTitle.slice(0, 100),
    description: caption.slice(0, 800),
    board_id:    boardId,
    ...(imageUrl ? { media_source: { source_type: "image_url", url: imageUrl } } : {}),
  };

  const resp = await fetch("https://api.pinterest.com/v5/pins", {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(`Pinterest: ${data.message || resp.status}`);
  return { postId: data.id, postUrl: `https://www.pinterest.com/pin/${data.id}/` };
}

/** Publish a teaser article on Dev.to */
async function postToDevTo(postTitle, caption, postUrl, tags) {
  const key = process.env.DEVTO_API_KEY;
  if (!key) throw new Error("DEVTO_API_KEY not set");

  const safeTags = (tags || [])
    .map(t => t.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 30))
    .filter(Boolean)
    .slice(0, 4);
  if (safeTags.length === 0) safeTags.push("ai", "creators");

  const bodyMarkdown = [
    caption,
    "",
    `---`,
    `*Originally published at [vibrationofawesome.com](${postUrl})*`,
  ].join("\n");

  const resp = await fetch("https://dev.to/api/articles", {
    method:  "POST",
    headers: { "Content-Type": "application/json", "api-key": key },
    body:    JSON.stringify({
      article: {
        title:         postTitle,
        body_markdown: bodyMarkdown,
        published:     true,
        canonical_url: postUrl,
        tags:          safeTags,
      },
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(`Dev.to: ${data.error || JSON.stringify(data.errors) || resp.status}`);
  return { postId: String(data.id), postUrl: data.url };
}

/** Post to Tumblr using OAuth 1.0a (legacy /post endpoint with form body) */
async function postToTumblr(caption, tags) {
  const consumerKey    = process.env.TUMBLR_CONSUMER_KEY;
  const consumerSecret = process.env.TUMBLR_CONSUMER_SECRET;
  const token          = process.env.TUMBLR_TOKEN;
  const tokenSecret    = process.env.TUMBLR_TOKEN_SECRET;
  const blogName       = process.env.TUMBLR_BLOG_NAME;

  if (!consumerKey || !consumerSecret || !token || !tokenSecret) {
    throw new Error("One or more TUMBLR_* env vars not set");
  }
  if (!blogName) throw new Error("TUMBLR_BLOG_NAME not set");

  // Legacy /post endpoint (form-encoded) ~ the NPF /posts endpoint returns 8001
  const url        = `https://api.tumblr.com/v2/blog/${blogName}/post`;
  const bodyParams = {
    type: "text",
    body: caption,
    tags: (tags || []).slice(0, 30).join(","),
  };

  // Form-encoded body params MUST be included in the OAuth signature base string
  const authHeader = buildOAuthHeader({
    method: "POST",
    url,
    bodyParams,
    consumerKey,
    consumerSecret,
    token,
    tokenSecret,
  });

  const resp = await fetch(url, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: authHeader },
    body:    new URLSearchParams(bodyParams).toString(),
  });
  const data = await resp.json();
  if (!resp.ok || data.meta?.status >= 400) {
    throw new Error(`Tumblr: ${data.errors?.[0]?.detail || data.meta?.msg || resp.status}`);
  }
  const postId = data.response?.id_string || data.response?.id;
  return {
    postId:  String(postId || ""),
    postUrl: `https://${blogName}.tumblr.com/post/${postId}`,
  };
}

/** Post Instagram or Threads via Publer API v1 */
async function postViaPubler(platform, caption, imageUrl) {
  const { BASE, headers } = getPublerConfig();
  const accountId = platform === "instagram"
    ? process.env.PUBLER_INSTAGRAM_ACCOUNT_ID
    : process.env.PUBLER_THREADS_ACCOUNT_ID;
  if (!accountId) throw new Error(`PUBLER_${platform.toUpperCase()}_ACCOUNT_ID not set`);

  let mediaId = null;
  if (imageUrl) mediaId = await uploadPublerMediaFromUrl(imageUrl, headers, BASE);

  // ── Step 2: publish immediately via /posts/schedule/publish ──────────────
  // Omitting scheduled_at signals immediate publish per Publer docs.
  const networkCfg = {
    type: mediaId ? "photo" : "status",
    text: caption,
    ...(mediaId ? { media: [{ id: mediaId, type: "image" }] } : {}),
  };

  const postResp = await fetch(`${BASE}/posts/schedule/publish`, {
    method: "POST", headers,
    body: JSON.stringify({
      bulk: {
        state: "scheduled",
        posts: [{ networks: { [platform]: networkCfg }, accounts: [{ id: accountId }] }],
      },
    }),
  });

  const postData = await postResp.json().catch(() => ({}));
  if (!postResp.ok) throw new Error(`Publer (${platform}): ${postData.message || postData.error || postData.errors?.[0] || postResp.status}`);

  // Response may be async (job_id) ~ extract post ID if available
  let postId = postData.post?.id || postData.id;
  const jobId2 = postData.job_id;
  if (jobId2 && !postId) {
    const status = await pollPublerJob(jobId2, headers, BASE, 10, 2000);
    const failure = extractPublerFailure(status);
    if (failure) throw new Error(`Publer (${platform}): ${failure}`);
    postId = Array.isArray(status.payload) ? status.payload[0]?.id : status.payload?.id;
  }

  return { postId: String(postId || "queued"), postUrl: null };
}

// ── Blogger (OAuth2 + Drafts API) ─────────────────────────────────────────────

/** Exchange Blogger refresh token for a fresh access token */
async function getBloggerAccessToken() {
  const clientId     = process.env.BLOGGER_CLIENT_ID;
  const clientSecret = process.env.BLOGGER_CLIENT_SECRET;
  const refreshToken = process.env.BLOGGER_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("BLOGGER_CLIENT_ID, BLOGGER_CLIENT_SECRET, or BLOGGER_REFRESH_TOKEN not set");
  }
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type:    "refresh_token",
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(`Blogger token refresh failed (${data.error}): ${data.error_description || "run 'python scripts/get_blogger_token.py' to regenerate"}`);
  return data.access_token;
}

/**
 * Use Claude to write a fresh related article inspired by the source post.
 * Returns { title, html } ~ clean HTML body content only, no wrappers.
 */
async function generateBloggerArticle(sourceTitle, sourceText, sourceUrl, anthropic) {
  const msg = await anthropic.messages.create({
    model:      "claude-opus-4-6",
    max_tokens: 2000,
    system: `You are Matt EarthStar, the voice behind Vibration of Awesome (vibrationofawesome.com). Write in Matt's authentic personal voice: reflective, honest, spiritual but grounded ~ the voice of someone who has lived through real struggles and found genuine insight. Not corporate motivation or new-age fluff. Raw, direct, human.`,
    messages: [
      {
        role:    "user",
        content: `Here is one of your earlier posts from vibrationofawesome.com:

TITLE: ${sourceTitle}
SOURCE URL: ${sourceUrl}

BODY TEXT:
${sourceText}

Write a NEW original article inspired by these themes but from a completely fresh angle. NOT a rewrite ~ a new piece. Think: a different metaphor, a more recent realization, or a personal story that connects to the same ideas.

Format your response EXACTLY like this:
TITLE: [your article title here]

[article body as clean HTML using only <p>, <h2>, <blockquote>, <strong>, <em> tags]

Requirements:
- 500-700 words
- Include one natural in-body link back to the original article that inspired this piece: <a href="${sourceUrl}">${sourceTitle}</a>
- No <html>/<head>/<body> wrappers
- No inline styles or class attributes
- No title tag in the HTML body`,
      },
    ],
  });

  const raw        = msg.content[0].text;
  const titleMatch = raw.match(/^TITLE:\s*(.+)/m);
  const title      = titleMatch ? titleMatch[1].trim() : `Reflections on ${sourceTitle}`;
  const html       = raw.replace(/^TITLE:\s*.+\n*/m, "").trim();
  return { title, html };
}

/**
 * Use Claude to write a fresh WordPress article with a unique title, excerpt,
 * and backlink to the original VOA post.
 */
async function generateWordPressArticle(sourceTitle, sourceText, sourceUrl, anthropic) {
  const msg = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 2200,
    system: `You are Matt EarthStar, writing for EarthStarRising. Keep the voice human, direct, spiritual-but-grounded, and rooted in lived experience instead of generic inspiration.`,
    messages: [
      {
        role: "user",
        content: `You are syndicating a Vibration of Awesome post to an EarthStarRising WordPress site.

SOURCE TITLE: ${sourceTitle}
SOURCE URL: ${sourceUrl}

SOURCE BODY:
${sourceText}

Write a NEW original companion article inspired by the source material, not a rewrite. It should feel native to EarthStarRising while still naturally linking back to the original.

Format your response EXACTLY like this:
TITLE: [new title]
EXCERPT: [1-2 sentence excerpt]

[article body as clean HTML using only <p>, <h2>, <blockquote>, <strong>, <em>, <a>, <ul>, <ol>, <li>]

Requirements:
- 600-900 words
- Include one natural backlink to the original source using this exact URL: ${sourceUrl}
- Keep the HTML body clean with no wrappers, classes, styles, scripts, or markdown fences
- The title must be distinct from the source title
- The excerpt should be compelling and specific`,
      },
    ],
  });

  const raw = msg.content[0].text.trim();
  const titleMatch = raw.match(/^TITLE:\s*(.+)$/m);
  const excerptMatch = raw.match(/^EXCERPT:\s*(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : `EarthStar reflection on ${sourceTitle}`;
  const excerpt = excerptMatch ? excerptMatch[1].trim() : firstWords(stripHtml(raw), 28);
  const html = raw
    .replace(/^TITLE:\s*.+$/m, "")
    .replace(/^EXCERPT:\s*.+$/m, "")
    .trim();

  return { title, excerpt, html };
}

function createWordPressContentBlocks(html) {
  return [
    {
      id: makeBlockId("html"),
      type: "html",
      data: { html: html.trim() },
    },
  ];
}

function decodeHtmlEntities(text) {
  return String(text || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function createSimpleWordPressBlocks(html) {
  const blocks = [];
  const pattern = /<(p|h2)[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    const inner = decodeHtmlEntities(match[2].replace(/<br\s*\/?>/gi, "\n").trim());
    if (!inner) continue;
    if (tag === "h2") {
      blocks.push({
        id: makeBlockId("hdr"),
        type: "header",
        data: {
          text: inner.replace(/<[^>]+>/g, "").trim(),
          level: 2,
        },
      });
    } else {
      blocks.push({
        id: makeBlockId("p"),
        type: "paragraph",
        data: { text: inner },
      });
    }
  }

  if (!blocks.length) {
    blocks.push({
      id: makeBlockId("p"),
      type: "paragraph",
      data: { text: stripHtml(html) },
    });
  }
  return blocks;
}

function buildMinimalWordPressNetwork(article) {
  return {
    type: "article",
    title: article.title,
    excerpt: article.excerpt || undefined,
    url: article.slug || undefined,
    content: createSimpleWordPressBlocks(article.html),
  };
}

async function postToWordPressViaPubler(article, imageUrl = null) {
  const { BASE, headers } = getPublerConfig();
  const account = await getPublerWordPressAccount(headers, BASE);
  const accountId = account.id;
  const requestedCategoryIds = parseCsvEnv(process.env.PUBLER_WORDPRESS_EARTHSTAR_CATEGORY_IDS, []);
  const requestedTagIds = parseCsvEnv(process.env.PUBLER_WORDPRESS_EARTHSTAR_TAG_IDS, []);
  const categoryIds = resolvePublerTaxonomyIds(requestedCategoryIds, account?.wordpress_categories, ["1"]);
  const tagIds = resolvePublerTaxonomyIds(requestedTagIds, account?.wordpress_tags, []);
  const network = buildMinimalWordPressNetwork(article);
  if (account?.permissions?.can_access !== false) {
    if (categoryIds.length) network.categories = categoryIds;
    if (tagIds.length) network.tags = tagIds;
    if (imageUrl) network.featured_media = { path: imageUrl };
  }

  const { response: resp, data } = await fetchPublerJson(`${BASE}/posts/schedule/publish`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      bulk: {
        state: "scheduled",
        posts: [{
          accounts: [{ id: accountId }],
          networks: { wordpress_oauth: network },
        }],
      },
    }),
  }, 3);
  if (!resp.ok) throw new Error(`Publer (wordpress_earthstar): ${data.message || data.error || data.errors?.[0] || resp.status}`);

  const payloadRoot = data?.data && typeof data.data === "object" ? data.data : data;
  let postId = payloadRoot?.post?.id || payloadRoot?.id || data.post?.id || data.id || null;
  let postUrl = firstNonEmpty(
    payloadRoot?.post?.post_link,
    payloadRoot?.post?.url,
    payloadRoot?.post_link,
    payloadRoot?.url,
    data.post?.post_link,
    data.post?.url,
    data.post_link,
    data.url,
  );
  const jobId = data.job_id || data?.data?.job_id || payloadRoot?.job_id || null;

  if (jobId) {
    const status = await pollPublerJob(jobId, headers, BASE, 20, 2000);
    const failure = extractPublerFailure(status);
    if (failure) throw new Error(`Publer (wordpress_earthstar): ${failure}`);

    const payload = status.payload || {};
    const success = Array.isArray(payload?.successes)
      ? payload.successes[0]
      : Array.isArray(payload)
        ? payload[0]
        : payload.success || payload.post || payload;

    postId = firstNonEmpty(String(success?.id || ""), String(success?.post_id || ""), String(postId || "")) || "queued";
    postUrl = firstNonEmpty(success?.post_link, success?.url, postUrl);
  }

  if (!postUrl) {
    postUrl = await findRecentPublerWordPressPost(accountId, article.title, headers, BASE);
  }

  return { postId: String(postId || "queued"), postUrl: postUrl || null };
}

/** Publish a post immediately to Blogger using the v3 API */
async function postToBlogger(title, htmlContent) {
  const blogId = process.env.BLOGGER_BLOG_ID;
  if (!blogId) throw new Error("BLOGGER_BLOG_ID not set");

  const accessToken = await getBloggerAccessToken();
  const resp = await fetch(
    `https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/`,
    {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ title, content: htmlContent }),
    }
  );
  const data = await resp.json();
  if (!resp.ok) throw new Error(`Blogger: ${data.error?.message || resp.status}`);

  return { postId: data.id, postUrl: data.url || null };
}

// ── Syndication log ───────────────────────────────────────────────────────────

function loadLog() {
  try {
    if (fs.existsSync(LOG_FILE)) {
      const raw = JSON.parse(fs.readFileSync(LOG_FILE, "utf8"));
      return Array.isArray(raw.entries) ? raw : { entries: [] };
    }
  } catch (_) { /* corrupt file ~ start fresh */ }
  return { entries: [] };
}

function saveLog(log, entry) {
  log.entries.unshift(entry);
  // Keep last 100 entries
  if (log.entries.length > 100) log.entries = log.entries.slice(0, 100);
  log.lastUpdated = new Date().toISOString();
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2), "utf8");
}

/**
 * Upsert structured per-platform results to syndication-results.json.
 * One entry per slug (most recent run) in the format the dashboard matrix reads.
 */
function saveResults(slug, title, lane, voaUrl, platforms) {
  let results = [];
  try {
    if (fs.existsSync(RESULTS_FILE)) {
      results = JSON.parse(fs.readFileSync(RESULTS_FILE, "utf8"));
      if (!Array.isArray(results)) results = [];
    }
  } catch (_) { results = []; }

  const idx = results.findIndex(e => e.slug === slug);
  const existingEntry = idx >= 0 ? results[idx] : null;
  const existingSyndication = existingEntry?.syndication || {};

  // Build syndication map: { platformKey: { status, url, timestamp, error? } }
  const timestamp = new Date().toISOString();
  const syndication = { ...existingSyndication };
  for (const [key, r] of Object.entries(platforms)) {
    const next = {
      ...(existingSyndication[key] || {}),
      status:    r.success ? "success" : "failed",
      url:       r.postUrl || null,
      timestamp,
    };
    if (r.error) next.error = r.error;
    else delete next.error;
    syndication[key] = next;
  }

  const newEntry = {
    slug,
    title,
    lane,
    date:  timestamp.slice(0, 10),
    voa_url: voaUrl,
    syndication,
  };

  // Upsert: replace existing entry for this slug, or prepend
  if (idx >= 0) {
    results[idx] = newEntry;
  } else {
    results.unshift(newEntry);
  }

  fs.mkdirSync(path.dirname(RESULTS_FILE), { recursive: true });
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2), "utf8");
}

/** Write dashboard password hash config from DASHBOARD_PASSWORD env var */
function writeDashboardConfig() {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return; // nothing to do

  const hash        = crypto.createHash("sha256").update(password).digest("hex");
  const configFile  = path.join(ROOT, "static", "_data", "dashboard-config.json");
  const existing    = fs.existsSync(configFile)
    ? JSON.parse(fs.readFileSync(configFile, "utf8"))
    : {};

  if (existing.passwordHash !== hash) {
    fs.writeFileSync(configFile, JSON.stringify({ passwordHash: hash }, null, 2), "utf8");
    console.log("  [dashboard] Password config updated.");
  }
}

// ── Core syndication function ─────────────────────────────────────────────────

/**
 * Syndicate a published post to all configured platforms.
 *
 * @param {string} lane    - "matt" or "boom"
 * @param {string} slug    - Post slug
 * @param {object} options - { keyword?: string, anthropic?: Anthropic }
 * @returns {Promise<object>} Log entry with per-platform results
 */
export async function syndicatePost(lane, slug, options = {}) {
  // ── 1. Load post metadata ──
  const dataFile = path.join(ROOT, "static", "_data", `${lane}-posts.json`);
  if (!fs.existsSync(dataFile)) throw new Error(`Data file not found: ${dataFile}`);

  const posts = JSON.parse(fs.readFileSync(dataFile, "utf8"));
  const post  = posts.find(p => p.slug === slug);
  if (!post) throw new Error(`Post "${slug}" not found in ${dataFile}`);

  const postUrl = `https://vibrationofawesome.com${post.url}`;

  // ── 2. Extract plain-text body excerpt ──
  // Try both conventions: slug.html and slug/index.html
  let htmlFile = path.join(ROOT, "static", "blog", lane, "posts", `${slug}.html`);
  if (!fs.existsSync(htmlFile)) {
    htmlFile = path.join(ROOT, "static", "blog", lane, "posts", slug, "index.html");
  }

  let bodyText   = post.excerpt || "";
  let sourceText = post.excerpt || "";
  if (fs.existsSync(htmlFile)) {
    const raw      = fs.readFileSync(htmlFile, "utf8");
    const artMatch = raw.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    const fullText = artMatch ? stripHtml(artMatch[1]) : stripHtml(raw);
    bodyText   = firstWords(fullText, 200);
    sourceText = firstWords(fullText, 600);
  }

  console.log(`\nSyndicating: ${post.title}`);
  console.log(`URL: ${postUrl}\n`);

  // ── 3. Generate captions ──
  const anthropic = options.anthropic || new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let captions;
  if (options.captions) {
    console.log("Using pre-supplied captions (API bypass)...");
    captions = options.captions;
  } else {
    console.log("Generating captions...");
    captions = await generateCaptions({ ...post, lane }, anthropic);
  }

  // ── 4. Select image ──
  const keyword = options.keyword || (post.tags || [])[0] || post.title;
  const image   = await selectImage(keyword);
  const imageUrl = image?.url || null;

  // ── 5. Extract hashtags from tumblr/instagram captions ──
  function extractHashtags(text) {
    return (text.match(/#\w+/g) || []).map(t => t.slice(1));
  }

  // ── 6. Post to each platform ──
  const results = {};

  async function attempt(platform, fn) {
    if (options.bloggerOnly && platform !== "blogger") return;
    if (options.platforms && !options.platforms.includes(platform)) return;
    try {
      const r = await fn();
      console.log(`  ✓ ${platform}${r.postUrl ? ` → ${r.postUrl}` : ""}`);
      results[platform] = { success: true, postId: r.postId || null, postUrl: r.postUrl || null, error: null };
    } catch (err) {
      console.error(`  ✗ ${platform}: ${err.message}`);
      results[platform] = { success: false, postId: null, postUrl: null, error: err.message };
    }
  }

  // Bluesky
  await attempt("bluesky", () =>
    postToBluesky(captions.bluesky, postUrl, post.title, post.excerpt));

  // Mastodon
  await attempt("mastodon", () =>
    postToMastodon(captions.mastodon));

  // Facebook VOA
  if (process.env.META_PAGE_ID_VOA && process.env.META_PAGE_TOKEN_VOA) {
    await attempt("facebook_voa", () =>
      postToFacebookPage(process.env.META_PAGE_ID_VOA, process.env.META_PAGE_TOKEN_VOA, captions.facebook, postUrl));
  } else {
    console.warn("  ~ facebook_voa: META_PAGE_ID_VOA or META_PAGE_TOKEN_VOA not set");
    results.facebook_voa = { success: false, postId: null, postUrl: null, error: "env vars not set" };
  }

  // Facebook EarthStar
  if (process.env.META_PAGE_ID_EARTHSTAR && process.env.META_PAGE_TOKEN_EARTHSTAR) {
    await attempt("facebook_earthstar", () =>
      postToFacebookPage(process.env.META_PAGE_ID_EARTHSTAR, process.env.META_PAGE_TOKEN_EARTHSTAR, captions.facebook, postUrl));
  } else {
    console.warn("  ~ facebook_earthstar: META_PAGE_ID_EARTHSTAR or META_PAGE_TOKEN_EARTHSTAR not set");
    results.facebook_earthstar = { success: false, postId: null, postUrl: null, error: "env vars not set" };
  }

  // Pinterest
  await attempt("pinterest", () =>
    postToPinterest(captions.pinterest, post.title, postUrl, imageUrl));

  // Dev.to
  await attempt("devto", () =>
    postToDevTo(post.title, captions.devto, postUrl, post.tags));

  // Tumblr
  await attempt("tumblr", () =>
    postToTumblr(captions.tumblr, extractHashtags(captions.tumblr)));

  // Instagram via Publer
  await attempt("instagram", () =>
    postViaPubler("instagram", captions.instagram, imageUrl));

  // Threads via Publer
  await attempt("threads", () =>
    postViaPubler("threads", captions.threads, null));

  // Blogger (auto-publish ~ AI-generated related article inspired by source)
  await attempt("blogger", async () => {
    const bloggerArticle = options.bloggerArticle
      || await generateBloggerArticle(post.title, sourceText, postUrl, anthropic);
    return postToBlogger(bloggerArticle.title, bloggerArticle.html);
  });

  // WordPress EarthStarRising via Publer
  await attempt("wordpress_earthstar", async () => {
    const wordpressArticle = options.wordpressArticle
      || await generateWordPressArticle(post.title, sourceText, postUrl, anthropic);
    return postToWordPressViaPubler({
      ...wordpressArticle,
      slug: `${slug}-earthstar`,
    }, imageUrl);
  });

  // ── 7. Build log entry ──
  const entry = {
    id:          String(Date.now()),
    timestamp:   new Date().toISOString(),
    lane,
    postSlug:    slug,
    postTitle:   post.title,
    postUrl,
    imageUrl,
    imageSource: image?.source || null,
    captions,
    platforms:   results,
  };

  // ── 8. Write log + dashboard config ──
  const log = loadLog();
  saveLog(log, entry);
  writeDashboardConfig();
  saveResults(slug, post.title, lane, postUrl, results);

  // ── 9. Summary ──
  const succeeded = Object.values(results).filter(r => r.success).length;
  const total     = Object.keys(results).length;
  console.log(`\nSyndication complete: ${succeeded}/${total} platforms succeeded.`);
  console.log(`Log saved → static/_data/syndication-log.json`);
  console.log(`Results saved → static/_data/syndication-results.json\n`);

  return entry;
}

// ── CLI entry point ───────────────────────────────────────────────────────────

const isCli = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isCli) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Error: ANTHROPIC_API_KEY not set."); process.exit(1);
  }

  const argv = minimist(process.argv.slice(2), {
    string:  ["lane", "slug", "keyword", "platforms"],
    boolean: ["blogger-only", "force", "verbose"],
    alias:   { l: "lane", s: "slug", k: "keyword", p: "platforms" },
  });

  if (!argv.lane || !["matt", "boom"].includes(argv.lane)) {
    console.error('Error: --lane must be "matt" or "boom"'); process.exit(1);
  }
  if (!argv.slug) {
    console.error("Error: --slug is required"); process.exit(1);
  }

  try {
    // Expand short aliases to internal platform names
    const PLATFORM_ALIASES = {
      fbv:  "facebook_voa",
      fbe:  "facebook_earthstar",
      fb:   "facebook_voa",
      dev:  "devto",
      wp:   "wordpress_earthstar",
      wordpress: "wordpress_earthstar",
    };
    const platformFilter = argv.platforms
      ? argv.platforms.split(",").map(s => {
          const key = s.trim().toLowerCase();
          return PLATFORM_ALIASES[key] || key;
        })
      : null;
    await syndicatePost(argv.lane, argv.slug, {
      keyword:     argv.keyword,
      bloggerOnly: argv["blogger-only"],
      platforms:   platformFilter,
    });
  } catch (err) {
    console.error("Fatal:", err.message);
    process.exit(1);
  }
}
