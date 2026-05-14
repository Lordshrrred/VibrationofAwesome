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
    consumerKey:    firstNonEmpty(process.env[`${p}TUMBLR_CONSUMER_KEY`], prefix === "ESR" ? process.env.TUMBLR_CONSUMER_KEY : null),
    consumerSecret: firstNonEmpty(process.env[`${p}TUMBLR_CONSUMER_SECRET`], prefix === "ESR" ? process.env.TUMBLR_CONSUMER_SECRET : null),
    token:          firstNonEmpty(process.env[`${p}TUMBLR_TOKEN`], prefix === "ESR" ? process.env.TUMBLR_TOKEN : null),
    tokenSecret:    firstNonEmpty(process.env[`${p}TUMBLR_TOKEN_SECRET`], prefix === "ESR" ? process.env.TUMBLR_TOKEN_SECRET : null),
    blogName:       firstNonEmpty(process.env[`${p}TUMBLR_BLOG_NAME`], prefix === "ESR" ? process.env.TUMBLR_BLOG_NAME : null),
  };
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
  return cfg;
}

async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail: detail || "ok" });
  } catch (err) {
    results.push({ name, ok: false, detail: err.message });
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
    for (const provider of ["pinterest", "instagram", "threads"]) {
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

  await check("Bluesky auth", async () => {
    hasEnv("BLUESKY_HANDLE", "BLUESKY_APP_PASSWORD");
    const resp = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: process.env.BLUESKY_HANDLE,
        password: process.env.BLUESKY_APP_PASSWORD,
      }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.message || `HTTP ${resp.status}`);
    return data.handle || "session ok";
  });

  await check("Mastodon auth", async () => {
    hasEnv("MASTODON_INSTANCE", "MASTODON_ACCESS_TOKEN");
    const instance = process.env.MASTODON_INSTANCE.startsWith("http")
      ? process.env.MASTODON_INSTANCE.replace(/\/+$/, "")
      : `https://${process.env.MASTODON_INSTANCE.replace(/\/+$/, "")}`;
    const resp = await fetch(`${instance}/api/v1/accounts/verify_credentials`, {
      headers: { Authorization: `Bearer ${process.env.MASTODON_ACCESS_TOKEN}` },
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
    return data.acct || "account ok";
  });

  for (const [label, idKey, tokenKey] of [
    ["Facebook VOA", "META_PAGE_ID_VOA", "META_PAGE_TOKEN_VOA"],
    ["Facebook EarthStar", "META_PAGE_ID_EARTHSTAR", "META_PAGE_TOKEN_EARTHSTAR"],
  ]) {
    await check(label, async () => {
      hasEnv(idKey, tokenKey);
      const qs = new URLSearchParams({ fields: "id,name", access_token: process.env[tokenKey] });
      const resp = await fetch(`https://graph.facebook.com/v19.0/${process.env[idKey]}?${qs}`);
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || data.error) throw new Error(data.error?.message || `HTTP ${resp.status}`);
      return data.name || data.id || "page ok";
    });
  }

  await check("Dev.to auth", async () => {
    hasEnv("DEVTO_API_KEY");
    const resp = await fetch("https://dev.to/api/users/me", {
      headers: { "api-key": process.env.DEVTO_API_KEY },
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
    return data.username || "user ok";
  });

  for (const prefix of ["ESR", "VOA"]) {
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
