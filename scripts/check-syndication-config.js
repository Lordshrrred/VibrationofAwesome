#!/usr/bin/env node
/**
 * Non-publishing syndication readiness checks.
 *
 * This script validates env wiring and performs safe read/auth calls only.
 * It never creates posts, pins, drafts, or media.
 */

import crypto from "crypto";
import dotenv from "dotenv";
import fs from "fs";
import minimist from "minimist";
import path from "path";
import { fileURLToPath } from "url";
import { PUBLER_VOA_ACCOUNT_IDS } from "./lib/policy.js";

dotenv.config({ override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const argv = minimist(process.argv.slice(2), {
  boolean: ["write"],
  string: ["out"],
});

const results = [];
let dripSnapshot = null;

function pctEncode(s) {
  return encodeURIComponent(String(s))
    .replace(/!/g, "%21").replace(/'/g, "%27")
    .replace(/\(/g, "%28").replace(/\)/g, "%29").replace(/\*/g, "%2A");
}

function buildOAuthHeader({ method, url, consumerKey, consumerSecret, token, tokenSecret }) {
  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: token,
    oauth_version: "1.0",
  };
  const paramStr = Object.keys(oauthParams).sort()
    .map(k => `${pctEncode(k)}=${pctEncode(oauthParams[k])}`).join("&");
  const baseStr = `${method.toUpperCase()}&${pctEncode(url)}&${pctEncode(paramStr)}`;
  const signingKey = `${pctEncode(consumerSecret)}&${pctEncode(tokenSecret)}`;
  oauthParams.oauth_signature = crypto.createHmac("sha1", signingKey).update(baseStr).digest("base64");
  return "OAuth " + Object.entries(oauthParams)
    .map(([k, v]) => `${pctEncode(k)}="${pctEncode(v)}"`).join(", ");
}

function hasEnv(...keys) {
  const missing = keys.filter(key => !process.env[key]?.trim());
  if (missing.length) throw new Error(`missing ${missing.join(", ")}`);
}

function firstNonEmpty(...values) {
  return values.find(v => typeof v === "string" && v.trim()) || null;
}

function getTumblrConfig(prefix) {
  const p = `${prefix}_`;
  return {
    label: prefix,
    consumerKey:    firstNonEmpty(process.env[`${p}TUMBLR_CONSUMER_KEY`]),
    consumerSecret: firstNonEmpty(process.env[`${p}TUMBLR_CONSUMER_SECRET`]),
    token:          firstNonEmpty(process.env[`${p}TUMBLR_TOKEN`]),
    tokenSecret:    firstNonEmpty(process.env[`${p}TUMBLR_TOKEN_SECRET`]),
    blogName:       firstNonEmpty(process.env[`${p}TUMBLR_BLOG_NAME`]),
  };
}

function isVoaTumblrBlog(blogName) {
  const clean = String(blogName || "").replace(/^https?:\/\//i, "").replace(/\/.*$/, "").replace(/\.tumblr\.com$/i, "").toLowerCase();
  return clean === "vibrationofawesome";
}

function requireTumblrConfig(prefix) {
  const cfg = getTumblrConfig(prefix);
  const missing = [];
  if (!cfg.consumerKey) missing.push(`${prefix}_TUMBLR_CONSUMER_KEY`);
  if (!cfg.consumerSecret) missing.push(`${prefix}_TUMBLR_CONSUMER_SECRET`);
  if (!cfg.token) missing.push(`${prefix}_TUMBLR_TOKEN`);
  if (!cfg.tokenSecret) missing.push(`${prefix}_TUMBLR_TOKEN_SECRET`);
  if (!cfg.blogName) missing.push(`${prefix}_TUMBLR_BLOG_NAME`);
  if (missing.length) throw new Error(`missing ${missing.join(", ")}`);
  if (prefix === "VOA" && !isVoaTumblrBlog(cfg.blogName)) {
    throw new Error(`VOA_TUMBLR_BLOG_NAME must be vibrationofawesome, got ${cfg.blogName}`);
  }
  return cfg;
}

function getBlueskyConfig(prefix) {
  const p = `${prefix}_`;
  return {
    label: prefix,
    handle: firstNonEmpty(process.env[`${p}BLUESKY_HANDLE`], prefix === "ESR" ? process.env.BLUESKY_HANDLE : null),
    password: firstNonEmpty(process.env[`${p}BLUESKY_APP_PASSWORD`], prefix === "ESR" ? process.env.BLUESKY_APP_PASSWORD : null),
  };
}

function requireBlueskyConfig(prefix) {
  const cfg = getBlueskyConfig(prefix);
  const missing = [];
  if (!cfg.handle) missing.push(`${prefix}_BLUESKY_HANDLE`);
  if (!cfg.password) missing.push(`${prefix}_BLUESKY_APP_PASSWORD`);
  if (missing.length) throw new Error(`missing ${missing.join(", ")}`);
  return cfg;
}

function getMastodonConfig(prefix) {
  const p = `${prefix}_`;
  return {
    label: prefix,
    instance: firstNonEmpty(process.env[`${p}MASTODON_INSTANCE`], prefix === "ESR" ? process.env.MASTODON_INSTANCE : null),
    token: firstNonEmpty(process.env[`${p}MASTODON_ACCESS_TOKEN`], prefix === "ESR" ? process.env.MASTODON_ACCESS_TOKEN : null),
  };
}

function requireMastodonConfig(prefix) {
  const cfg = getMastodonConfig(prefix);
  const missing = [];
  if (!cfg.instance) missing.push(`${prefix}_MASTODON_INSTANCE`);
  if (!cfg.token) missing.push(`${prefix}_MASTODON_ACCESS_TOKEN`);
  if (missing.length) throw new Error(`missing ${missing.join(", ")}`);
  return cfg;
}

// Classify failure detail strings so consumers (dashboard, auto-healer) don't
// need to re-parse raw error messages to determine remediation path.
function classifyFailure(detail) {
  const d = detail || "";
  if (/invalid_grant|token has been expired|token has been revoked/i.test(d)) return "auth_reconnect_required";
  if (/pages_manage_posts|missing required.*scope|missing.*page.*posting.*scope/i.test(d)) return "auth_reconnect_required";
  if (/missing\s+\w/i.test(d) && /env|secret|config/i.test(d)) return "missing_config";
  return "check_failed";
}

async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail: detail || "ok" });
  } catch (err) {
    results.push({ name, ok: false, detail: err.message, failureType: classifyFailure(err.message) });
  }
}

async function publerJson(pathname, options = {}) {
  hasEnv("PUBLER_API_KEY", "PUBLER_WORKSPACE_ID");
  const resp = await fetch(`https://app.publer.com/api/v1${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer-API ${process.env.PUBLER_API_KEY}`,
      "Publer-Workspace-Id": process.env.PUBLER_WORKSPACE_ID,
      Accept: "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.message || data.error || `HTTP ${resp.status}`);
  return data;
}

function extractAccounts(data) {
  return Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : [];
}

function requireConfiguredVoaPublerAccount(accounts, provider, expectedIdentifier, { field = "username" } = {}) {
  const envKey = `PUBLER_${provider.toUpperCase()}_ACCOUNT_ID`;
  hasEnv(envKey);
  const configuredId = process.env[envKey].trim();
  const expectedId = PUBLER_VOA_ACCOUNT_IDS[provider];
  if (configuredId !== expectedId) {
    throw new Error(`${envKey} is not the known VOA ${provider} account`);
  }

  const account = accounts.find(row => row.id === configuredId && row.provider === provider);
  if (!account) throw new Error(`configured VOA ${provider} account not visible in Publer`);
  const actual = account[field] || account.username || account.name || "(unknown)";
  if (actual !== expectedIdentifier) {
    throw new Error(`configured VOA ${provider} account resolves to "${actual}"`);
  }
  return `${actual} (${account.id})`;
}

async function main() {
  await check("drip queue", () => {
    const file = path.join(ROOT, "static", "_data", "drip-queue.json");
    const queue = JSON.parse(fs.readFileSync(file, "utf8"));
    dripSnapshot = {
      status: queue.status || "unknown",
      rate: queue.drip_rate || 2,
      time: queue.drip_time || "10:00 UTC",
      remaining: queue.queue?.length || 0,
      published: queue.published?.length || 0,
      syndicate_on_publish: !!queue.syndicate_on_publish,
      trigger_feeder_on_publish: !!queue.trigger_feeder_on_publish,
    };
    return `status=${queue.status}, rate=${queue.drip_rate || 2}/run, time=${queue.drip_time || "10:00 UTC"}, remaining=${queue.queue?.length || 0}`;
  });

  let publerAccounts = [];
  await check("Publer accounts", async () => {
    publerAccounts = extractAccounts(await publerJson("/accounts"));
    const providers = publerAccounts.map(a => a.provider).filter(Boolean);
    for (const provider of ["pinterest", "threads"]) {
      if (!providers.includes(provider)) throw new Error(`missing ${provider} account`);
    }
    return providers.join(", ");
  });

  await check("Publer Pinterest board", async () => {
    const pinterest = publerAccounts.find(a => a.provider === "pinterest");
    if (!pinterest?.id) throw new Error("missing Pinterest account");
    const pathPart = `/workspaces/${encodeURIComponent(process.env.PUBLER_WORKSPACE_ID)}/media_options?accounts[]=${encodeURIComponent(pinterest.id)}`;
    const rows = extractAccounts(await publerJson(pathPart));
    const boards = rows.flatMap(row => row.albums || row.boards || []);
    if (!boards.length) throw new Error("no Pinterest boards returned");
    return `${boards.length} board(s) available`;
  });

  await check("Publer VOA Instagram account", () =>
    requireConfiguredVoaPublerAccount(publerAccounts, "instagram", "vibrationofawesome")
  );

  await check("Publer VOA Threads account", () =>
    requireConfiguredVoaPublerAccount(publerAccounts, "threads", "@vibrationofawesome")
  );

  for (const prefix of ["ESR", "VOA"]) {
    await check(`Bluesky ${prefix} auth`, async () => {
      const cfg = requireBlueskyConfig(prefix);
      const resp = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: cfg.handle,
          password: cfg.password,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.message || `HTTP ${resp.status}`);
      return data.handle || "session ok";
    });
  }

  for (const prefix of ["ESR", "VOA"]) {
    await check(`Mastodon ${prefix} auth`, async () => {
      const cfg = requireMastodonConfig(prefix);
      const instance = cfg.instance.startsWith("http")
        ? cfg.instance.replace(/\/+$/, "")
        : `https://${cfg.instance.replace(/\/+$/, "")}`;
      const resp = await fetch(`${instance}/api/v1/accounts/verify_credentials`, {
        headers: { Authorization: `Bearer ${cfg.token}` },
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
      return data.acct || "account ok";
    });
  }

  // Facebook VOA ~ validated via Publer (Publer account ID pinned, not direct Meta Graph API).
  // Direct Meta path is blocked: pages_manage_posts scope is missing from the ESC Meta App.
  // The ESC Meta App should remain read-only; adding pages_manage_posts would expand its scope.
  await check("Facebook VOA", () =>
    requireConfiguredVoaPublerAccount(publerAccounts, "facebook", "Vibration of Awesome", { field: "name" })
  );

  await check("Dev.to auth", async () => {
    hasEnv("DEVTO_API_KEY");
    const resp = await fetch("https://dev.to/api/users/me", {
      headers: { "api-key": process.env.DEVTO_API_KEY },
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
    return data.username || "user ok";
  });

  for (const prefix of ["VOA"]) {
    await check(`Tumblr ${prefix} auth`, async () => {
      const cfg = requireTumblrConfig(prefix);
      const url = "https://api.tumblr.com/v2/user/info";
      const resp = await fetch(url, {
        headers: {
          Authorization: buildOAuthHeader({
            method: "GET",
            url,
            consumerKey: cfg.consumerKey,
            consumerSecret: cfg.consumerSecret,
            token: cfg.token,
            tokenSecret: cfg.tokenSecret,
          }),
        },
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || data.meta?.status >= 400) throw new Error(data.meta?.msg || `HTTP ${resp.status}`);
      return `${cfg.blogName} user ok`;
    });
  }

  await check("Blogger token refresh", async () => {
    hasEnv("BLOGGER_CLIENT_ID", "BLOGGER_CLIENT_SECRET", "BLOGGER_REFRESH_TOKEN", "BLOGGER_BLOG_ID");
    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.BLOGGER_CLIENT_ID,
        client_secret: process.env.BLOGGER_CLIENT_SECRET,
        refresh_token: process.env.BLOGGER_REFRESH_TOKEN,
        grant_type: "refresh_token",
      }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error([data.error, data.error_description].filter(Boolean).join(": ") || `HTTP ${resp.status}`);
    return "token ok";
  });

  await check("WordPress direct auth", async () => {
    hasEnv("WORDPRESS_OAUTH2_TOKEN", "WORDPRESS_BLOG");
    const resp = await fetch(`https://public-api.wordpress.com/rest/v1.1/sites/${encodeURIComponent(process.env.WORDPRESS_BLOG)}`, {
      headers: { Authorization: `Bearer ${process.env.WORDPRESS_OAUTH2_TOKEN}` },
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.message || data.error || `HTTP ${resp.status}`);
    return data.name || data.URL || "site ok";
  });

  console.log("\nSyndication readiness checks\n");
  for (const result of results) {
    console.log(`${result.ok ? "OK  " : "FAIL"} ${result.name}: ${result.detail}`);
  }

  const failed = results.filter(result => !result.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (argv.write) writeHealthFile(failed);
  if (failed.length) process.exitCode = 1;
}

function writeHealthFile(failed) {
  const outFile = path.resolve(argv.out || path.join(ROOT, "static", "_data", "syndication-health.json"));
  const topFix = failed.find(result => /blogger/i.test(result.name)) || failed[0] || null;
  const health = {
    lastChecked: new Date().toISOString(),
    status: failed.length ? "broken" : "ok",
    passed: results.length - failed.length,
    failed: failed.length,
    total: results.length,
    topFix: topFix ? {
      name: topFix.name,
      detail: topFix.detail,
      repairCommand: /blogger/i.test(topFix.name) ? "npm run blogger-token" : "npm run check:syndication -- --write",
    } : null,
    drip: dripSnapshot,
    checks: results.map(result => ({
      name: result.name,
      ok: result.ok,
      detail: result.detail,
      ...(result.failureType ? { failureType: result.failureType } : {}),
    })),
    repairs: {
      blogger: {
        label: "Redo Blogger OAuth",
        command: "npm run blogger-token",
        appliesWhen: "Blogger token refresh fails, usually with invalid_grant or Bad Request.",
      },
      health: {
        label: "Refresh dashboard health",
        command: "npm run check:syndication -- --write",
      },
    },
  };
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(health, null, 2)}\n`);
  console.log(`Health written to ${path.relative(ROOT, outFile)}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
