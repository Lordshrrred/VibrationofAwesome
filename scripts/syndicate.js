#!/usr/bin/env node
/**
 * syndicate.js ~ Full content syndication engine for vibrationofawesome.com
 *
 * Platforms: Bluesky · Mastodon · Facebook (VOA + EarthStar)
 *            Pinterest · Instagram · Threads (via Publer)
 *            Dev.to · Tumblr
 *            Blogger · WordPress (EarthStarRising direct API)
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
import {
  BACKLINK_TIER,
  detectContentType,
  getSocialPlatforms,
  logPolicyDecision,
  getNextCTA,
  selectPinterestBoard,
  logPinterestBoard,
  PINTEREST_BOARDS,
} from "./lib/policy.js";

dotenv.config({ override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = path.resolve(__dirname, "..");
const LOG_FILE     = path.join(ROOT, "static", "_data", "syndication-log.json");
const RESULTS_FILE = path.join(ROOT, "static", "_data", "syndication-results.json");
const CACHE_DIR    = path.join(ROOT, ".cache");
const LOCK_DIR     = path.join(CACHE_DIR, "syndication.lock");
const LOCK_STALE_MS = Number(process.env.SYNDICATION_LOCK_STALE_MS || 45 * 60 * 1000);
const LOCK_WAIT_MS  = Number(process.env.SYNDICATION_LOCK_WAIT_MS || 60 * 60 * 1000);

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

function readLockInfo() {
  try {
    return JSON.parse(fs.readFileSync(path.join(LOCK_DIR, "owner.json"), "utf8"));
  } catch (_) {
    return null;
  }
}

function isLockStale(info) {
  const createdAt = Date.parse(info?.createdAt || "");
  return !createdAt || Date.now() - createdAt > LOCK_STALE_MS;
}

async function acquireSyndicationLock(label) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const startedAt = Date.now();
  const owner = {
    label,
    pid: process.pid,
    createdAt: new Date().toISOString(),
  };

  while (true) {
    try {
      fs.mkdirSync(LOCK_DIR);
      fs.writeFileSync(path.join(LOCK_DIR, "owner.json"), JSON.stringify(owner, null, 2), "utf8");
      console.log(`  [lock] Syndication lock acquired for ${label}.`);
      return () => {
        try {
          fs.rmSync(LOCK_DIR, { recursive: true, force: true });
          console.log(`  [lock] Syndication lock released for ${label}.`);
        } catch (_) { /* lock already gone */ }
      };
    } catch (err) {
      if (err.code !== "EEXIST") throw err;

      const info = readLockInfo();
      if (isLockStale(info)) {
        console.warn(`  [lock] Removing stale syndication lock from ${info?.label || "unknown owner"}.`);
        fs.rmSync(LOCK_DIR, { recursive: true, force: true });
        continue;
      }

      if (Date.now() - startedAt > LOCK_WAIT_MS) {
        throw new Error(`Timed out waiting for syndication lock held by ${info?.label || "another process"}`);
      }

      console.log(`  [lock] Another syndication run is active (${info?.label || "unknown"}). Waiting 30s...`);
      await sleep(30_000);
    }
  }
}

function firstNonEmpty(...values) {
  return values.find(v => typeof v === "string" && v.trim()) || null;
}

function getTumblrConfig(prefix = "") {
  const p = prefix ? `${prefix}_` : "";
  return {
    label: prefix || "TUMBLR",
    consumerKey:    firstNonEmpty(process.env[`${p}TUMBLR_CONSUMER_KEY`], prefix === "ESR" ? process.env.TUMBLR_CONSUMER_KEY : null),
    consumerSecret: firstNonEmpty(process.env[`${p}TUMBLR_CONSUMER_SECRET`], prefix === "ESR" ? process.env.TUMBLR_CONSUMER_SECRET : null),
    token:          firstNonEmpty(process.env[`${p}TUMBLR_TOKEN`], prefix === "ESR" ? process.env.TUMBLR_TOKEN : null),
    tokenSecret:    firstNonEmpty(process.env[`${p}TUMBLR_TOKEN_SECRET`], prefix === "ESR" ? process.env.TUMBLR_TOKEN_SECRET : null),
    blogName:       firstNonEmpty(process.env[`${p}TUMBLR_BLOG_NAME`], prefix === "ESR" ? process.env.TUMBLR_BLOG_NAME : null),
  };
}

function hasTumblrConfig(prefix = "") {
  const cfg = getTumblrConfig(prefix);
  return Boolean(cfg.consumerKey && cfg.consumerSecret && cfg.token && cfg.tokenSecret && cfg.blogName);
}

function getTumblrPublicBase(blogName) {
  const clean = String(blogName || "").replace(/^https?:\/\//i, "").replace(/\/.*$/, "").replace(/\/+$/, "");
  if (!clean) return null;
  return clean.includes(".") ? `https://${clean}` : `https://${clean}.tumblr.com`;
}

function getBlueskyConfig(prefix = "ESR") {
  const p = `${prefix}_`;
  return {
    label: prefix,
    handle: firstNonEmpty(process.env[`${p}BLUESKY_HANDLE`], prefix === "ESR" ? process.env.BLUESKY_HANDLE : null),
    password: firstNonEmpty(process.env[`${p}BLUESKY_APP_PASSWORD`], prefix === "ESR" ? process.env.BLUESKY_APP_PASSWORD : null),
  };
}

function hasBlueskyConfig(prefix = "ESR") {
  const cfg = getBlueskyConfig(prefix);
  return Boolean(cfg.handle && cfg.password);
}

function getMastodonConfig(prefix = "ESR") {
  const p = `${prefix}_`;
  return {
    label: prefix,
    instance: firstNonEmpty(process.env[`${p}MASTODON_INSTANCE`], prefix === "ESR" ? process.env.MASTODON_INSTANCE : null),
    token: firstNonEmpty(process.env[`${p}MASTODON_ACCESS_TOKEN`], prefix === "ESR" ? process.env.MASTODON_ACCESS_TOKEN : null),
  };
}

function hasMastodonConfig(prefix = "ESR") {
  const cfg = getMastodonConfig(prefix);
  return Boolean(cfg.instance && cfg.token);
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

function hasWordPressDirectConfig() {
  return Boolean(process.env.WORDPRESS_OAUTH2_TOKEN && process.env.WORDPRESS_BLOG);
}

function getWordPressDirectConfig() {
  const token = process.env.WORDPRESS_OAUTH2_TOKEN;
  const blog = process.env.WORDPRESS_BLOG || process.env.WORDPRESS_SITE_URL;
  if (!token) throw new Error("WORDPRESS_OAUTH2_TOKEN not set");
  if (!blog) throw new Error("WORDPRESS_BLOG not set");
  return {
    token,
    blog,
    baseUrl: "https://public-api.wordpress.com/rest/v1.1",
  };
}

function getPublicImageUrl(imageUrl) {
  if (!imageUrl) return null;
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  if (imageUrl.startsWith("/")) return `https://vibrationofawesome.com${imageUrl}`;
  return `https://vibrationofawesome.com/${imageUrl.replace(/^\/+/, "")}`;
}

function hasSourceLink(text, postUrl) {
  if (!text || !postUrl) return false;
  const normalizedText = String(text).toLowerCase();
  const normalizedUrl = String(postUrl).toLowerCase();
  const path = new URL(postUrl).pathname.replace(/\/$/, "").toLowerCase();
  return normalizedText.includes(normalizedUrl) ||
    normalizedText.includes(normalizedUrl.replace(/^https?:\/\//, "")) ||
    (path && normalizedText.includes(path));
}

function truncatePreservingUrl(text, maxLength = 500) {
  const value = String(text || "").trim();
  if (value.length <= maxLength) return value;

  const urls = value.match(/https?:\/\/\S+|(?:vibrationofawesome\.com|www\.vibrationofawesome\.com)\/\S+/gi) || [];
  const url = urls[urls.length - 1];
  if (!url || url.length >= maxLength - 20) return value.slice(0, maxLength - 3).trimEnd() + "...";

  const withoutUrl = value.replace(url, "").replace(/\s+/g, " ").trim();
  const room = maxLength - url.length - 2;
  return `${withoutUrl.slice(0, room - 3).trimEnd()}...\n${url}`;
}

function ensureSourceLinks(captions, postUrl) {
  const linkedPlatforms = ["facebook", "bluesky", "mastodon", "pinterest", "devto", "tumblr"];
  const next = { ...captions };
  for (const platform of linkedPlatforms) {
    const caption = next[platform] || "";
    if (!caption || hasSourceLink(caption, postUrl)) continue;
    next[platform] = `${caption.trim()}\n\n${postUrl}`;
  }
  return next;
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
  const { response, data } = await fetchPublerJson(`${baseUrl}/accounts`, { headers }, 3);
  if (!response.ok) throw new Error(`Publer accounts: ${data.message || data.error || response.status}`);
  return Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : [];
}

async function getPublerAccountId(platform, headers, baseUrl = "https://app.publer.com/api/v1") {
  const envKey = `PUBLER_${platform.toUpperCase()}_ACCOUNT_ID`;
  const configured = process.env[envKey];
  if (configured?.trim()) return configured.trim();

  const accounts = await listPublerAccounts(headers, baseUrl);
  const match = accounts.find(account => account.provider === platform);
  if (!match?.id) throw new Error(`${envKey} not set and no ${platform} account found in Publer`);
  return match.id;
}

async function getPublerPinterestBoardId(accountId, headers, baseUrl = "https://app.publer.com/api/v1", boardKey = null, boardName = null) {
  // 1. Per-board env var: PUBLER_PINTEREST_BOARD_{KEY}_ID (hyphens become underscores)
  if (boardKey) {
    const perBoardEnv = `PUBLER_PINTEREST_BOARD_${boardKey.replace(/-/g, "_").toUpperCase()}_ID`;
    if (process.env[perBoardEnv]?.trim()) {
      console.log(`  [pinterest] Board ID from ${perBoardEnv}`);
      return process.env[perBoardEnv].trim();
    }
  }

  // 2. Default env var fallback before hitting the API
  const configured = process.env.PUBLER_PINTEREST_BOARD_ID || process.env.PINTEREST_BOARD_ID;
  if (configured?.trim() && !boardName) return configured.trim();

  const workspaceId = process.env.PUBLER_WORKSPACE_ID;
  if (!workspaceId) throw new Error("PUBLER_WORKSPACE_ID not set");

  const url = `${baseUrl}/workspaces/${encodeURIComponent(workspaceId)}/media_options?accounts[]=${encodeURIComponent(accountId)}`;
  const { response, data } = await fetchPublerJson(url, { headers }, 3);
  if (!response.ok) throw new Error(`Publer media options: ${data.message || data.error || response.status}`);

  const rows = Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : [];
  const row = rows.find(item => item.id === accountId) || rows[0] || {};
  const boards = row.albums || row.boards || [];

  // 3. Name-match against boards from Publer API
  if (boardName) {
    const normalise = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
    const byName = boards.find(b => normalise(b.name || b.title || "") === normalise(boardName));
    if (byName?.id) {
      console.log(`  [pinterest] Board matched by name "${boardName}" → id:${byName.id}`);
      return byName.id;
    }
    console.warn(`  [pinterest] Board "${boardName}" not found in Publer; falling back to default`);
  }

  // 4. PUBLER_PINTEREST_BOARD_DEFAULT_ID explicit default
  const defaultId = process.env.PUBLER_PINTEREST_BOARD_DEFAULT_ID?.trim();
  if (defaultId) {
    console.log(`  [pinterest] Using PUBLER_PINTEREST_BOARD_DEFAULT_ID`);
    return defaultId;
  }

  // 5. Legacy PUBLER_PINTEREST_BOARD_ID or first board in Publer
  if (configured?.trim()) return configured.trim();
  // Hard-coded "Vibration of Awesome" board as last-resort fallback
  const VOA_BOARD_ID = "641129765641663037";
  const board = boards.find(b => b.id === VOA_BOARD_ID) || boards.find(item => item.type === "pinterest") || boards[0];
  if (!board?.id) throw new Error("No Pinterest board found in Publer and no PUBLER_PINTEREST_BOARD_DEFAULT_ID set");
  console.log(`  [pinterest] Using fallback board: "${board.name || board.id}"`);
  return board.id;
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
async function postToBluesky(caption, postUrl, postTitle, postExcerpt, prefix = "ESR") {
  const { handle, password, label } = getBlueskyConfig(prefix);
  if (!handle || !password) throw new Error(`${label}_BLUESKY_HANDLE or ${label}_BLUESKY_APP_PASSWORD not set`);

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
async function postToMastodon(caption, prefix = "ESR") {
  const cfg = getMastodonConfig(prefix);
  let instance = (cfg.instance || "").replace(/\/+$/, "");
  const token  = cfg.token;
  if (!instance || !token) throw new Error(`${cfg.label}_MASTODON_INSTANCE or ${cfg.label}_MASTODON_ACCESS_TOKEN not set`);
  // Ensure https:// scheme ~ users often store just "mastodon.social"
  if (!instance.startsWith("http")) instance = `https://${instance}`;

  const resp = await fetch(`${instance}/api/v1/statuses`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      Authorization:   `Bearer ${token}`,
    },
    body: JSON.stringify({ status: truncatePreservingUrl(caption, 500), visibility: "public" }),
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
async function postToTumblr(caption, tags, prefix = "ESR") {
  const { consumerKey, consumerSecret, token, tokenSecret, blogName, label } = getTumblrConfig(prefix);

  if (!consumerKey || !consumerSecret || !token || !tokenSecret) {
    throw new Error(`One or more ${label}_TUMBLR_* env vars not set`);
  }
  if (!blogName) throw new Error(`${label}_TUMBLR_BLOG_NAME not set`);

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
  const publicBase = getTumblrPublicBase(blogName);
  return {
    postId:  String(postId || ""),
    postUrl: `${publicBase}/post/${postId}`,
  };
}

/** Post Pinterest, Instagram, or Threads via Publer API v1 */
async function postViaPubler(platform, caption, imageUrl, details = {}) {
  const { BASE, headers } = getPublerConfig();
  const accountId = await getPublerAccountId(platform, headers, BASE);

  let mediaId = null;
  if (imageUrl) mediaId = await uploadPublerMediaFromUrl(imageUrl, headers, BASE);
  if (platform === "pinterest" && !mediaId) throw new Error("Publer (pinterest): image is required");

  const accountTarget = { id: accountId };
  if (platform === "pinterest") {
    accountTarget.album_id = await getPublerPinterestBoardId(
      accountId, headers, BASE,
      details.pinterestBoardKey || null,
      details.pinterestBoardName || null,
    );
  }

  // ── Step 2: publish immediately via /posts/schedule/publish ──────────────
  // Omitting scheduled_at signals immediate publish per Publer docs.
  const networkCfg = {
    type: platform === "pinterest" ? "photo" : mediaId ? "photo" : "status",
    text: platform === "pinterest" ? caption.slice(0, 500) : caption,
    ...(platform === "pinterest" ? {
      title: (details.title || "").slice(0, 100),
      url: details.url,
    } : {}),
    ...(mediaId ? { media: [{ id: mediaId, type: platform === "pinterest" ? "photo" : "image" }] } : {}),
  };

  const postResp = await fetch(`${BASE}/posts/schedule/publish`, {
    method: "POST", headers,
    body: JSON.stringify({
      bulk: {
        state: "scheduled",
        posts: [{ networks: { [platform]: networkCfg }, accounts: [accountTarget] }],
      },
    }),
  });

  const postData = await postResp.json().catch(() => ({}));
  if (!postResp.ok) throw new Error(`Publer (${platform}): ${postData.message || postData.error || postData.errors?.[0] || postResp.status}`);

  // Response may be async (job_id) ~ extract post ID if available
  let postId = postData.post?.id || postData.id;
  let postUrl = postData.post?.post_link || postData.post_link || null;
  const jobId2 = postData.job_id;
  if (jobId2 && (!postId || !postUrl)) {
    const status = await pollPublerJob(jobId2, headers, BASE, 30, 2000);
    const failure = extractPublerFailure(status);
    if (failure) throw new Error(`Publer (${platform}): ${failure}`);
    const payload = Array.isArray(status.payload) ? status.payload[0] : status.payload;
    postId = postId || payload?.id;
    postUrl = postUrl || payload?.post_link || payload?.url || null;
  }

  return { postId: String(postId || "queued"), postUrl };
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

async function postToWordPressDirect(article, imageUrl = null) {
  const { token, blog, baseUrl } = getWordPressDirectConfig();
  const endpoint = `${baseUrl}/sites/${encodeURIComponent(blog)}/posts/new`;
  const categoryNames = parseCsvEnv(process.env.WORDPRESS_CATEGORY_NAMES, []);
  const tagNames = parseCsvEnv(process.env.WORDPRESS_TAG_NAMES, []);

  const body = new URLSearchParams({
    title: article.title,
    content: article.html,
    excerpt: article.excerpt || "",
    slug: article.slug || "",
    status: "publish",
    format: "standard",
  });

  if (categoryNames.length) body.append("categories", categoryNames.join(","));
  if (tagNames.length) body.append("tags", tagNames.join(","));
  // WordPress.com turns unsupported external media imports into a stray empty
  // gallery shortcode in some cases, so keep direct posts clean until we add a
  // proper upload/attachment flow.

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(`WordPress direct: ${data?.error_description || data?.message || data?.error || resp.status}`);
  }

  return {
    postId: String(data.ID || data.id || article.slug || "published"),
    postUrl: firstNonEmpty(data.URL, data.url, data.short_URL),
  };
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

  // Build syndication map: { platformKey: { status, url, timestamp, error?, skipped? } }
  const timestamp = new Date().toISOString();
  const syndication = { ...existingSyndication };
  for (const [key, r] of Object.entries(platforms)) {
    const next = {
      ...(existingSyndication[key] || {}),
      status:    r.success ? "success" : (r.skipped ? "skipped" : "failed"),
      url:       r.postUrl || null,
      timestamp,
    };
    if (r.error) next.error = r.error;
    else delete next.error;
    if (r.skipped) next.skipped = true;
    else delete next.skipped;
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

  const hash = crypto.createHash("sha256").update(password).digest("hex");
  const configFile = path.join(ROOT, "static", "_data", "dashboard-config.json");
  const existing = fs.existsSync(configFile)
    ? JSON.parse(fs.readFileSync(configFile, "utf8"))
    : {};
  const editorApiBase = process.env.EDITOR_API_BASE || existing.editorApiBase || "";
  const nextConfig = {
    passwordHash: hash,
    editorBackendEnabled: Boolean(editorApiBase),
    editorApiBase,
  };

  if (JSON.stringify(existing) !== JSON.stringify(nextConfig)) {
    fs.writeFileSync(configFile, JSON.stringify(nextConfig, null, 2), "utf8");
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
  const releaseLock = options.skipLock
    ? () => {}
    : await acquireSyndicationLock(`${lane}:${slug}`);

  try {
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
    captions = ensureSourceLinks(options.captions, postUrl);
  } else {
    console.log("Generating captions...");
    captions = ensureSourceLinks(await generateCaptions({ ...post, lane }, anthropic), postUrl);
  }

  // ── 4. Select image ──
  const keyword = options.keyword || (post.tags || [])[0] || post.title;
  const image   = await selectImage(keyword);
  const imageUrl = getPublicImageUrl(image?.url || null);

  // ── 5. Apply syndication policy ──
  //
  // Backlink tier (devto, tumblr, blogger, wordpress) always runs ~ no filtering.
  // Social platforms are routed by content type unless the caller explicitly
  // sets options.platforms (user choice wins) or options.allSocial (full blast).
  //
  // Override flags:
  //   options.allSocial   = true  → skip policy, post to all social platforms
  //   options.platforms   = [...] → explicit list, policy not applied
  //   options.bloggerOnly = true  → existing behaviour unchanged

  let effectivePlatforms = null; // null = attempt() uses its own existing logic

  if (!options.bloggerOnly && !options.platforms && !options.allSocial) {
    const contentType    = detectContentType({ ...post, lane });
    const socialPlatforms = getSocialPlatforms(contentType);
    const cta            = getNextCTA(lane);

    logPolicyDecision({ ...post, lane }, contentType, socialPlatforms, `${cta.label} ~ ${cta.url}`);

    // effectivePlatforms = backlink tier (always) + policy-filtered social
    effectivePlatforms = [...BACKLINK_TIER, ...socialPlatforms];
  }

  // ── 6. Extract hashtags from tumblr captions ──
  function extractHashtags(text) {
    return (text.match(/#\w+/g) || []).map(t => t.slice(1));
  }

  // ── 7. Post to each platform ──
  const results = {};

  /**
   * Attempt to post to a platform, applying policy + explicit platform filters.
   * @param {string}   platform     - Platform key (used in results map)
   * @param {Function} fn           - Async function that performs the post
   * @param {string}   [accountLabel] - Human-readable account identity for logging
   */
  async function attempt(platform, fn, accountLabel = null) {
    if (options.bloggerOnly && platform !== "blogger") return;
    if (options.platforms && !options.platforms.includes(platform)) return;
    // Policy filter: skip social platforms not approved for this content type.
    // Backlink tier platforms are always included in effectivePlatforms.
    if (effectivePlatforms && !effectivePlatforms.includes(platform)) {
      console.log(`  ~ ${platform}: skipped by social policy`);
      results[platform] = { success: false, postId: null, postUrl: null, error: "skipped by social policy", skipped: true };
      return;
    }
    try {
      const r = await fn();
      const acct = accountLabel ? ` [${accountLabel}]` : "";
      console.log(`  ✓ ${platform}${acct}${r.postUrl ? ` → ${r.postUrl}` : ""}`);
      results[platform] = { success: true, postId: r.postId || null, postUrl: r.postUrl || null, error: null };
    } catch (err) {
      console.error(`  ✗ ${platform}: ${err.message}`);
      results[platform] = { success: false, postId: null, postUrl: null, error: err.message };
    }
  }

  // ── Account identity summary ───────────────────────────────────────────────
  // Shown before attempts so CI logs clearly confirm which accounts are targeted.
  console.log("\n[accounts] VOA social destinations:");
  if (hasBlueskyConfig("VOA"))   console.log(`  bluesky_voa   → @${getBlueskyConfig("VOA").handle}`);
  if (hasMastodonConfig("VOA"))  console.log(`  mastodon_voa  → ${getMastodonConfig("VOA").instance}`);
  if (process.env.META_PAGE_ID_VOA) console.log(`  facebook_voa  → page:${process.env.META_PAGE_ID_VOA}`);
  console.log("\n[accounts] Backlink tier (always active):");
  console.log("  devto / tumblr_voa / blogger / wordpress_earthstar");
  if (hasBlueskyConfig("ESR"))  console.log(`\n[accounts] ESR crossover (suppressed by default): bluesky_esr @${getBlueskyConfig("ESR").handle}`);
  if (hasMastodonConfig("ESR")) console.log(`[accounts] ESR crossover (suppressed by default): mastodon_esr ${getMastodonConfig("ESR").instance}`);
  console.log();

  // ── Pinterest board selection ──────────────────────────────────────────────
  const pinterestBoardKey = selectPinterestBoard({ ...post, lane });
  const pinterestBoardName = PINTEREST_BOARDS[pinterestBoardKey] || pinterestBoardKey;
  logPinterestBoard(pinterestBoardKey, `niche:${post.niche || "none"}, content-type:${detectContentType({ ...post, lane })}`);

  // ── VOA Social platforms ───────────────────────────────────────────────────

  // VOA Bluesky ~ primary VOA blog destination
  if (hasBlueskyConfig("VOA")) {
    const voaBskyHandle = getBlueskyConfig("VOA").handle;
    await attempt("bluesky_voa", () =>
      postToBluesky(captions.bluesky, postUrl, post.title, post.excerpt, "VOA"),
      `@${voaBskyHandle}`);
  } else {
    console.warn("  ~ bluesky_voa: VOA_BLUESKY_* env vars not set");
    results.bluesky_voa = { success: false, postId: null, postUrl: null, error: "env vars not set" };
  }

  // VOA Mastodon ~ primary VOA blog destination
  if (hasMastodonConfig("VOA")) {
    const voaMastInstance = getMastodonConfig("VOA").instance;
    await attempt("mastodon_voa", () =>
      postToMastodon(captions.mastodon, "VOA"),
      voaMastInstance);
  } else {
    console.warn("  ~ mastodon_voa: VOA_MASTODON_* env vars not set");
    results.mastodon_voa = { success: false, postId: null, postUrl: null, error: "env vars not set" };
  }

  // Facebook VOA ~ primary VOA blog destination
  if (process.env.META_PAGE_ID_VOA && process.env.META_PAGE_TOKEN_VOA) {
    await attempt("facebook_voa", () =>
      postToFacebookPage(process.env.META_PAGE_ID_VOA, process.env.META_PAGE_TOKEN_VOA, captions.facebook, postUrl),
      `page:${process.env.META_PAGE_ID_VOA}`);
  } else {
    console.warn("  ~ facebook_voa: META_PAGE_ID_VOA or META_PAGE_TOKEN_VOA not set");
    results.facebook_voa = { success: false, postId: null, postUrl: null, error: "env vars not set" };
  }

  // Pinterest via Publer ~ VOA Pinterest account, board selected by policy
  await attempt("pinterest", () =>
    postViaPubler("pinterest", captions.pinterest, imageUrl, {
      title:               post.title,
      url:                 postUrl,
      pinterestBoardKey:   pinterestBoardKey,
      pinterestBoardName:  pinterestBoardName,
    }),
    `board:"${pinterestBoardName}"`);

  // Threads via Publer ~ text-first mini-thread content
  await attempt("threads", () =>
    postViaPubler("threads", captions.threads, null));

  // ── ESR crossover platforms (suppressed by default via policy routing) ─────
  // These are EarthStar Command accounts. The policy filter already suppresses
  // them unless options.allSocial is true or they are added to SOCIAL_ROUTING.
  // TODO (crossover v2): to enable selective ESR crossover for specific content
  // types, update SOCIAL_ROUTING in policy.js rather than enabling here globally.

  // ESR Bluesky ~ EarthStar Command account, suppressed by default for VOA blog
  if (hasBlueskyConfig("ESR")) {
    const esrBskyHandle = getBlueskyConfig("ESR").handle;
    await attempt("bluesky_esr", () =>
      postToBluesky(captions.bluesky, postUrl, post.title, post.excerpt, "ESR"),
      `@${esrBskyHandle} [ESR crossover]`);
  } else {
    results.bluesky_esr = { success: false, postId: null, postUrl: null, error: "env vars not set" };
  }

  // ESR Mastodon ~ EarthStar Command account, suppressed by default for VOA blog
  if (hasMastodonConfig("ESR")) {
    const esrMastInstance = getMastodonConfig("ESR").instance;
    await attempt("mastodon_esr", () =>
      postToMastodon(captions.mastodon, "ESR"),
      `${esrMastInstance} [ESR crossover]`);
  } else {
    results.mastodon_esr = { success: false, postId: null, postUrl: null, error: "env vars not set" };
  }

  // ── Backlink tier (always on, policy does not suppress these) ─────────────

  // Dev.to ~ canonical URL + DoFollow, high-DA tech platform
  await attempt("devto", () =>
    postToDevTo(post.title, captions.devto, postUrl, post.tags));

  // VOA Tumblr ~ primary Tumblr backlink destination
  if (hasTumblrConfig("VOA")) {
    await attempt("tumblr_voa", () =>
      postToTumblr(captions.tumblr, extractHashtags(captions.tumblr), "VOA"),
      process.env.VOA_TUMBLR_BLOG_NAME || "voa-tumblr");
  } else {
    console.warn("  ~ tumblr_voa: VOA_TUMBLR_* env vars not set");
    results.tumblr_voa = { success: false, postId: null, postUrl: null, error: "env vars not set" };
  }

  // Blogger (auto-publish ~ AI-generated related article inspired by source)
  await attempt("blogger", async () => {
    const bloggerArticle = options.bloggerArticle
      || await generateBloggerArticle(post.title, sourceText, postUrl, anthropic);
    return postToBlogger(bloggerArticle.title, bloggerArticle.html);
  });

  // WordPress EarthStarRising via direct WordPress.com API
  await attempt("wordpress_earthstar", async () => {
    const wordpressArticle = options.wordpressArticle
      || await generateWordPressArticle(post.title, sourceText, postUrl, anthropic);
    const article = {
      ...wordpressArticle,
      slug: `${slug}-earthstar`,
    };
    if (!hasWordPressDirectConfig()) {
      throw new Error("WordPress direct API is not configured. Set WORDPRESS_OAUTH2_TOKEN and WORDPRESS_BLOG.");
    }
    return postToWordPressDirect(article, imageUrl);
  });

  // ── 8. Build log entry ──
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

  // ── 9. Write log + dashboard config ──
  const log = loadLog();
  saveLog(log, entry);
  writeDashboardConfig();
  saveResults(slug, post.title, lane, postUrl, results);

  // ── 10. Summary ──
  const succeeded = Object.values(results).filter(r => r.success).length;
  const total     = Object.keys(results).length;
  console.log(`\nSyndication complete: ${succeeded}/${total} platforms succeeded.`);
  console.log(`Log saved → static/_data/syndication-log.json`);
  console.log(`Results saved → static/_data/syndication-results.json\n`);

  return entry;
  } finally {
    releaseLock();
  }
}

// ── CLI entry point ───────────────────────────────────────────────────────────

const isCli = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isCli) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Error: ANTHROPIC_API_KEY not set."); process.exit(1);
  }

  const argv = minimist(process.argv.slice(2), {
    string:  ["lane", "slug", "keyword", "platforms"],
    boolean: ["blogger-only", "force", "verbose", "all-social"],
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
      fb:   "facebook_voa",
      dev:  "devto",
      wp:   "wordpress_earthstar",
      wordpress: "wordpress_earthstar",
      bluesky: "bluesky_voa",
      bsky: "bluesky_voa",
      bskyvoa: "bluesky_voa",
      bskye: "bluesky_esr",
      bskyv: "bluesky_voa",
      mastodon: "mastodon_voa",
      mast: "mastodon_voa",
      mastvoa: "mastodon_voa",
      maste: "mastodon_esr",
      mastv: "mastodon_voa",
      tumblr: "tumblr_voa",
      t: "tumblr_voa",
      tvoa: "tumblr_voa",
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
      allSocial:   argv["all-social"],
      platforms:   platformFilter,
    });
  } catch (err) {
    console.error("Fatal:", err.message);
    process.exit(1);
  }
}
