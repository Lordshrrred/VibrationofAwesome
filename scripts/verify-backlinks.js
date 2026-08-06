#!/usr/bin/env node
/**
 * verify-backlinks.js ~ Confirm syndicated VOA backlinks without serverless calls.
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
const LOG_FILE = path.join(ROOT, "static", "_data", "syndication-log.json");
const PUBLER_BASE = "https://app.publer.com/api/v1";
const PUBLER_NETWORKS = new Set(["pinterest", "instagram", "threads"]);
const NON_CLICKABLE_BACKLINKS = new Set(["instagram"]);

function sourceNeedles(sourceUrl) {
  const url = new URL(sourceUrl);
  return [...new Set([
    sourceUrl,
    sourceUrl.replace(/^https?:\/\//, ""),
    url.pathname.replace(/\/$/, ""),
  ].filter(Boolean))];
}

function containsSource(text, sourceUrl) {
  const haystack = String(text || "").toLowerCase();
  return sourceNeedles(sourceUrl).some(needle => haystack.includes(needle.toLowerCase()));
}

function mark(platform, status, details = {}) {
  const next = {
    ...platform,
    backlink_checked_at: new Date().toISOString(),
    backlink_confirmed: status === "confirmed",
    backlink_status: status,
    ...details,
  };
  if (status === "confirmed") delete next.backlink_error;
  return next;
}

function firstNonEmpty(...values) {
  return values.find(v => typeof v === "string" && v.trim()) || null;
}

function getTumblrConfig(prefix = "ESR") {
  const p = `${prefix}_`;
  return {
    consumerKey: firstNonEmpty(process.env[`${p}TUMBLR_CONSUMER_KEY`], prefix === "ESR" ? process.env.TUMBLR_CONSUMER_KEY : null),
    blogName:    firstNonEmpty(process.env[`${p}TUMBLR_BLOG_NAME`], prefix === "ESR" ? process.env.TUMBLR_BLOG_NAME : null),
  };
}

async function fetchText(url) {
  const resp = await fetch(url, {
    headers: { "User-Agent": "VOA backlink verifier (+https://vibrationofawesome.com)" },
    redirect: "follow",
  });
  return { ok: resp.ok, status: resp.status, text: await resp.text() };
}

function publerHeaders() {
  if (!process.env.PUBLER_API_KEY || !process.env.PUBLER_WORKSPACE_ID) return null;
  return {
    Authorization: `Bearer-API ${process.env.PUBLER_API_KEY}`,
    "Publer-Workspace-Id": process.env.PUBLER_WORKSPACE_ID,
    Accept: "application/json",
  };
}

async function getPublerAccounts() {
  const headers = publerHeaders();
  if (!headers) return {};
  const resp = await fetch(`${PUBLER_BASE}/accounts`, { headers });
  const data = await resp.json().catch(() => ({}));
  const accounts = Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : [];
  return Object.fromEntries(accounts.map(account => [account.provider, account.id]).filter(([, id]) => id));
}

async function findPublerPost(entry, key, accountId, caption = "") {
  const headers = publerHeaders();
  if (!headers || !accountId) return null;
  const from = new Date(Date.parse(entry.date || new Date()) - 24 * 60 * 60 * 1000).toISOString();
  const to = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const url = new URL(`${PUBLER_BASE}/posts`);
  url.searchParams.set("from", from);
  url.searchParams.set("to", to);
  const resp = await fetch(url, { headers });
  const data = await resp.json().catch(() => ({}));
  const posts = data.posts || data.data || [];
  const snippets = [
    caption.split(/\s+/).slice(0, 8).join(" "),
    caption.split(/\s+/).slice(0, 5).join(" "),
    entry.title.split(/\s+/).slice(0, 4).join(" "),
    new URL(entry.voa_url).pathname,
  ].filter(s => s && s.length > 12).map(s => s.toLowerCase());

  return posts.find(post => {
    if (String(post.account_id) !== String(accountId)) return false;
    const blob = `${post.text || ""} ${post.url || ""} ${post.post_link || ""}`;
    if (containsSource(blob, entry.voa_url)) return true;
    const text = String(post.text || "").toLowerCase();
    return snippets.some(snippet => text.includes(snippet));
  }) || null;
}

async function verifyFacebook(key, platform, sourceUrl) {
  const token = key === "facebook_voa" ? process.env.META_PAGE_TOKEN_VOA : process.env.META_PAGE_TOKEN_EARTHSTAR;
  const postId = platform.url?.match(/facebook\.com\/([^/?#]+)$/)?.[1] || "";
  if (!token || !postId) return null;
  const qs = new URLSearchParams({ fields: "message,attachments{url,unshimmed_url,title}", access_token: token });
  const resp = await fetch(`https://graph.facebook.com/v19.0/${postId}?${qs}`);
  const data = await resp.json().catch(() => ({}));
  return containsSource(JSON.stringify(data), sourceUrl);
}

async function verifyMastodon(platform, sourceUrl) {
  const statusId = platform.url?.split("/").pop();
  if (!platform.url || !statusId) return null;
  const origin = new URL(platform.url).origin;
  const resp = await fetch(`${origin}/api/v1/statuses/${statusId}`);
  const data = await resp.json().catch(() => ({}));
  return containsSource(JSON.stringify(data), sourceUrl);
}

async function verifyTumblr(platform, sourceUrl, prefix = "ESR") {
  const postId = platform.url?.match(/\/post\/(\d+)/)?.[1];
  const cfg = getTumblrConfig(prefix);
  const blogName = platform.url
    ? new URL(platform.url).hostname.replace(/\.tumblr\.com$/i, "")
    : cfg.blogName;
  if (!postId || !cfg.consumerKey || !blogName) return null;
  const apiUrl = `https://api.tumblr.com/v2/blog/${blogName}/posts?id=${postId}&api_key=${cfg.consumerKey}`;
  const resp = await fetch(apiUrl);
  const data = await resp.json().catch(() => ({}));
  return containsSource(JSON.stringify(data), sourceUrl);
}

async function verifyPlatform(entry, key, platform, logEntry, publerAccounts) {
  if (platform.status !== "success") return platform;
  const sourceUrl = entry.voa_url;

  if (NON_CLICKABLE_BACKLINKS.has(key)) {
    return mark(platform, "not_applicable", { backlink_error: "Instagram captions are not clickable backlinks." });
  }

  if (PUBLER_NETWORKS.has(key)) {
    const publerPost = await findPublerPost(entry, key, publerAccounts[key], logEntry?.captions?.[key] || "");
    if (publerPost) {
      platform = {
        ...platform,
        url: publerPost.post_link || platform.url || null,
        publer_post_id: String(publerPost.id),
        publer_state: publerPost.state || null,
      };
      if (containsSource(`${publerPost.text || ""} ${publerPost.url || ""} ${publerPost.post_link || ""}`, sourceUrl)) {
        return mark(platform, "confirmed", { backlink_method: "publer_posts_api" });
      }
    } else {
      platform = { ...platform, url: null };
    }
  }

  let confirmed = null;
  if (key === "facebook_voa" || key === "facebook_earthstar") confirmed = await verifyFacebook(key, platform, sourceUrl);
  if (key === "mastodon" || key === "mastodon_esr" || key === "mastodon_voa") confirmed = await verifyMastodon(platform, sourceUrl);
  if (key === "tumblr" || key === "tumblr_esr") confirmed = await verifyTumblr(platform, sourceUrl, "ESR");
  if (key === "tumblr_voa") confirmed = await verifyTumblr(platform, sourceUrl, "VOA");
  if (confirmed === true) return mark(platform, "confirmed", { backlink_method: `${key}_api` });

  if (platform.url) {
    try {
      const { ok, status, text } = await fetchText(platform.url);
      if (ok && containsSource(text, sourceUrl)) return mark(platform, "confirmed", { backlink_method: "page_fetch" });
      return mark(platform, "missing", { backlink_error: `Fetched ${status}, source link not found.` });
    } catch (err) {
      return mark(platform, "unknown", { backlink_error: err.message });
    }
  }

  return mark(platform, "unknown", { backlink_error: "No public URL available for backlink verification." });
}

async function main() {
  const argv = minimist(process.argv.slice(2), { string: ["slug"] });
  const slugs = argv.slug ? new Set(argv.slug.split(",").map(s => s.trim()).filter(Boolean)) : null;
  const results = JSON.parse(fs.readFileSync(RESULTS_FILE, "utf8"));
  const log = JSON.parse(fs.readFileSync(LOG_FILE, "utf8"));
  const publerAccounts = await getPublerAccounts();
  let touched = 0;

  for (const entry of results) {
    if (slugs && !slugs.has(entry.slug)) continue;
    const logEntry = log.entries.find(item => item.postSlug === entry.slug);
    for (const [key, platform] of Object.entries(entry.syndication || {})) {
      const next = await verifyPlatform(entry, key, platform, logEntry, publerAccounts);
      entry.syndication[key] = next;
      touched++;
      console.log(`${entry.slug} ${key}: ${next.backlink_status || "skipped"}${next.url ? ` ${next.url}` : ""}`);
    }
  }

  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2), "utf8");
  console.log(`\nVerified ${touched} platform entries.`);
}

// CLI-only guard: without this, merely `import`-ing this module (from a test,
// another script, or a syntax/load check) executes a real run with real side
// effects. See CLAUDE.md ~ every script with a top-level main() needs this.
const __voaIsCli = process.argv[1] && import.meta.url === __voaPathToFileURL(process.argv[1]).href;
if (__voaIsCli) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
