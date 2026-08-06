#!/usr/bin/env node
/**
 * Repair VOA Tumblr backlink bodies so the source URL is an actual HTML link.
 *
 * Dry run:
 *   node scripts/repair-tumblr-backlinks.js
 *
 * Execute:
 *   node scripts/repair-tumblr-backlinks.js --execute
 */
import crypto from "crypto";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import minimist from "minimist";

import { pathToFileURL as __voaPathToFileURL } from "node:url";
dotenv.config({ override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const RESULTS_FILE = path.join(ROOT, "static", "_data", "syndication-results.json");

const argv = minimist(process.argv.slice(2), {
  boolean: ["execute"],
  string: ["slug"],
});

function pctEncode(s) {
  return encodeURIComponent(String(s))
    .replace(/!/g, "%21").replace(/'/g, "%27")
    .replace(/\(/g, "%28").replace(/\)/g, "%29").replace(/\*/g, "%2A");
}

function buildOAuthHeader({ method, url, params = {}, consumerKey, consumerSecret, token, tokenSecret }) {
  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: token,
    oauth_version: "1.0",
  };

  const allParams = { ...oauthParams, ...params };
  const paramStr = Object.keys(allParams).sort()
    .map(key => `${pctEncode(key)}=${pctEncode(allParams[key])}`)
    .join("&");
  const baseStr = `${method.toUpperCase()}&${pctEncode(url)}&${pctEncode(paramStr)}`;
  const signingKey = `${pctEncode(consumerSecret)}&${pctEncode(tokenSecret)}`;
  oauthParams.oauth_signature = crypto.createHmac("sha1", signingKey).update(baseStr).digest("base64");

  return "OAuth " + Object.entries(oauthParams)
    .map(([key, value]) => `${pctEncode(key)}="${pctEncode(value)}"`)
    .join(", ");
}

function tumblrConfig(prefix = "VOA") {
  const p = prefix ? `${prefix}_` : "";
  return {
    label: prefix || "default",
    consumerKey: process.env[`${p}TUMBLR_CONSUMER_KEY`] || process.env.TUMBLR_CONSUMER_KEY,
    consumerSecret: process.env[`${p}TUMBLR_CONSUMER_SECRET`] || process.env.TUMBLR_CONSUMER_SECRET,
    token: process.env[`${p}TUMBLR_TOKEN`] || process.env.TUMBLR_TOKEN,
    tokenSecret: process.env[`${p}TUMBLR_TOKEN_SECRET`] || process.env.TUMBLR_TOKEN_SECRET,
    blogName: process.env[`${p}TUMBLR_BLOG_NAME`] || process.env.TUMBLR_BLOG_NAME,
  };
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function postIdFromUrl(url) {
  return String(url || "").match(/\/post\/(\d+)/)?.[1] || null;
}

function sourceUrlPattern(sourceUrl) {
  return sourceUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasGoodLinkedSource(body, sourceUrl) {
  const url = sourceUrlPattern(sourceUrl);
  const match = String(body || "").match(new RegExp(`<a\\s+[^>]*href=["']${url}["'][^>]*>([\\s\\S]*?)<\\/a>`, "i"));
  if (!match) return false;
  const anchorText = match[1].replace(/<[^>]+>/g, "").trim();
  return anchorText && anchorText !== sourceUrl;
}

function repairBody(body, sourceUrl, title) {
  const url = sourceUrlPattern(sourceUrl);
  let next = String(body || "")
    .replace(new RegExp(`<p>\\s*<a\\s+[^>]*href=["']${url}["'][^>]*>[\\s\\S]*?<\\/a>\\s*<\\/p>`, "gi"), "")
    .replace(new RegExp(`<a\\s+[^>]*href=["']${url}["'][^>]*>[\\s\\S]*?<\\/a>`, "gi"), "")
    .replace(new RegExp(url, "g"), "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const link = `<p><a href="${escapeHtml(sourceUrl)}">Read the full piece: ${escapeHtml(title)}</a></p>`;
  return `${next}\n\n${link}`.trim();
}

async function tumblrFetchPost(config, postId) {
  const url = `https://api.tumblr.com/v2/blog/${config.blogName}/posts/text`;
  const params = { id: postId };
  const auth = buildOAuthHeader({ method: "GET", url, params, ...config });
  const resp = await fetch(`${url}?${new URLSearchParams(params)}`, {
    headers: { Authorization: auth },
  });
  const data = await resp.json();
  if (!resp.ok || data.meta?.status >= 400) {
    throw new Error(data.errors?.[0]?.detail || data.meta?.msg || `HTTP ${resp.status}`);
  }
  return data.response?.posts?.[0] || null;
}

async function tumblrFetchRecent(config, limit = 20) {
  const url = `https://api.tumblr.com/v2/blog/${config.blogName}/posts/text`;
  const params = { limit };
  const auth = buildOAuthHeader({ method: "GET", url, params, ...config });
  const resp = await fetch(`${url}?${new URLSearchParams(params)}`, {
    headers: { Authorization: auth },
  });
  const data = await resp.json();
  if (!resp.ok || data.meta?.status >= 400) {
    throw new Error(data.errors?.[0]?.detail || data.meta?.msg || `HTTP ${resp.status}`);
  }
  return data.response?.posts || [];
}

async function tumblrEditPost(config, postId, body, tags) {
  const url = `https://api.tumblr.com/v2/blog/${config.blogName}/post/edit`;
  const params = {
    id: postId,
    type: "text",
    body,
    tags: (tags || []).join(","),
  };
  const auth = buildOAuthHeader({ method: "POST", url, params, ...config });
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: auth },
    body: new URLSearchParams(params).toString(),
  });
  const data = await resp.json();
  if (!resp.ok || data.meta?.status >= 400) {
    throw new Error(data.errors?.[0]?.detail || data.meta?.msg || `HTTP ${resp.status}`);
  }
}

async function main() {
  const results = JSON.parse(fs.readFileSync(RESULTS_FILE, "utf8"));
  const configs = ["VOA", "ESR"]
    .map(prefix => tumblrConfig(prefix))
    .filter(config => config.consumerKey && config.consumerSecret && config.token && config.tokenSecret && config.blogName);

  if (configs.length === 0) throw new Error("Missing Tumblr config for VOA/ESR");

  const allTargets = [];

  for (const config of configs) {
    const host = String(config.blogName).replace(/^https?:\/\//, "").replace(/\/$/, "");
    const knownPostIds = new Set();
    const resultTargets = results
      .map(row => ({ row, tumblr: row.syndication?.tumblr_voa || row.syndication?.tumblr }))
      .filter(({ row }) => !argv.slug || row.slug === argv.slug)
      .filter(({ row, tumblr }) => row.voa_url && tumblr?.status === "success" && tumblr.url?.includes(host));

    for (const target of resultTargets) {
      target.config = config;
      allTargets.push(target);
      const postId = target.tumblr.postId || postIdFromUrl(target.tumblr.url);
      if (postId) knownPostIds.add(postId);
    }

    const recentPosts = argv.slug ? [] : await tumblrFetchRecent(config, 20);
    for (const post of recentPosts) {
      const postId = String(post.id_string || post.id || "");
      if (!postId || knownPostIds.has(postId)) continue;
      const body = post.body || "";
      const sourceUrl = body.match(/https:\/\/vibrationofawesome\.com\/blog\/[^\s<"]+/)?.[0];
      if (!sourceUrl || hasGoodLinkedSource(body, sourceUrl)) continue;
      const slug = sourceUrl.match(/\/posts\/([^/.]+)(?:\.html|\/)/)?.[1] || `tumblr-${postId}`;
      allTargets.push({
        config,
        row: {
          slug,
          title: post.title || "Vibration of Awesome",
          voa_url: sourceUrl,
        },
        tumblr: {
          status: "success",
          url: `https://${host}/post/${postId}`,
          postId,
        },
      });
      knownPostIds.add(postId);
    }
  }

  let checked = 0;
  let repaired = 0;
  let skipped = 0;

  for (const { config, row, tumblr } of allTargets) {
    const postId = tumblr.postId || postIdFromUrl(tumblr.url);
    if (!postId) {
      console.warn(`skip ${config.label}:${row.slug}: no Tumblr post id`);
      skipped++;
      continue;
    }

    checked++;
    const post = await tumblrFetchPost(config, postId);
    const body = post?.body || "";
    if (!body) {
      console.warn(`skip ${config.label}:${row.slug}: empty Tumblr body from API`);
      skipped++;
      continue;
    }
    if (hasGoodLinkedSource(body, row.voa_url)) {
      console.log(`ok   ${config.label}:${row.slug}: linked source already present`);
      skipped++;
      continue;
    }

    const nextBody = repairBody(body, row.voa_url, row.title || "Vibration of Awesome");
    if (!argv.execute) {
      console.log(`dry  ${config.label}:${row.slug}: would replace raw source URL with HTML anchor`);
      repaired++;
      continue;
    }

    await tumblrEditPost(config, postId, nextBody, post.tags || []);
    console.log(`fix  ${config.label}:${row.slug}: Tumblr backlink repaired`);
    repaired++;
  }

  console.log(`\nChecked: ${checked}`);
  console.log(argv.execute ? `Repaired: ${repaired}` : `Would repair: ${repaired}`);
  console.log(`Skipped: ${skipped}`);
  if (!argv.execute) console.log("\nDry run only. Add --execute to edit Tumblr posts.");
}

// CLI-only guard: without this, merely `import`-ing this module (from a test,
// another script, or a syntax/load check) executes a real run with real side
// effects. See CLAUDE.md ~ every script with a top-level main() needs this.
const __voaIsCli = process.argv[1] && import.meta.url === __voaPathToFileURL(process.argv[1]).href;
if (__voaIsCli) {
  main().catch(err => {
    console.error(err.message);
    process.exit(1);
  });
}
