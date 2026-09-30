#!/usr/bin/env node
/**
 * repair-dry-backlinks.js
 *
 * Replaces visible raw VOA URLs on backlink platforms with labeled, clickable
 * links. This edits existing syndicated posts in place; it never creates new
 * posts or re-syndicates content.
 *
 * Dry run:
 *   node scripts/repair-dry-backlinks.js
 *
 * Execute:
 *   node scripts/repair-dry-backlinks.js --execute
 */

import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import minimist from "minimist";

import { pathToFileURL as __voaPathToFileURL } from "node:url";
dotenv.config({ override: true });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const RESULTS_FILE = path.join(ROOT, "static", "_data", "syndication-results.json");
const argv = minimist(process.argv.slice(2), { boolean: ["execute"], string: ["slug"] });
const execute = Boolean(argv.execute);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, options = {}, attempts = 4) {
  for (let i = 0; i < attempts; i += 1) {
    const resp = await fetch(url, options);
    if (resp.status !== 429 || i === attempts - 1) return resp;
    const retryAfter = Number(resp.headers.get("retry-after") || 0);
    await sleep(retryAfter > 0 ? retryAfter * 1000 : 1500 * (i + 1));
  }
  throw new Error("unreachable");
}

function escapeRegExp(text) {
  return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sourceVariants(sourceUrl) {
  const clean = String(sourceUrl || "").trim();
  return [clean, clean.replace(/^https?:\/\//i, "")].filter(Boolean);
}

function markdownWetLink(sourceUrl) {
  return `[Read the full piece on Vibration of Awesome](${sourceUrl})`;
}

function htmlWetLink(sourceUrl) {
  return `<a href="${sourceUrl}">the original Vibration of Awesome piece</a>`;
}

function replaceDryMarkdown(text, sourceUrl) {
  let next = String(text || "");
  for (const variant of sourceVariants(sourceUrl)) {
    next = next.replace(
      new RegExp(`(?<!\\]\\()${escapeRegExp(variant)}(?!\\))`, "g"),
      markdownWetLink(sourceUrl)
    );
  }
  return next;
}

function replaceDryHtml(html, sourceUrl) {
  let next = String(html || "");
  for (const variant of sourceVariants(sourceUrl)) {
    next = next.replace(
      new RegExp(`<a\\s+href=["']${escapeRegExp(sourceUrl)}["']\\s*>\\s*${escapeRegExp(variant)}\\s*<\\/a>`, "gi"),
      htmlWetLink(sourceUrl)
    );
  }
  // Older WordPress posts can contain a labeled backlink whose destination is
  // a stale/near-match VOA slug. If the expected canonical URL is still absent,
  // correct that existing VOA blog link without altering its anchor text.
  if (!next.includes(sourceUrl)) {
    next = next.replace(
      /(<a\s+[^>]*href=["'])https:\/\/vibrationofawesome\.com\/blog\/boom\/posts\/[^"']+(["'][^>]*>)/i,
      `$1${sourceUrl}$2`
    );
  }
  return next;
}

async function repairWordPress(entry, platform) {
  if (!process.env.WORDPRESS_OAUTH2_TOKEN || !process.env.WORDPRESS_BLOG || !platform.url) return "skip";
  const slug = wordpressSlug(platform.url);
  if (!slug) return "skip";

  const base = "https://public-api.wordpress.com/rest/v1.1";
  const blog = encodeURIComponent(process.env.WORDPRESS_BLOG);
  const getResp = await fetchWithRetry(`${base}/sites/${blog}/posts/slug:${encodeURIComponent(slug)}`, {
    headers: { Authorization: `Bearer ${process.env.WORDPRESS_OAUTH2_TOKEN}` },
  });
  const post = await getResp.json().catch(() => ({}));
  if (!getResp.ok || !post.ID) throw new Error(`WordPress fetch failed for ${entry.slug}: ${post.message || post.error || getResp.status}`);

  const current = post.content || "";
  const next = replaceDryHtml(current, entry.voa_url);
  if (next === current) return "clean";
  if (!execute) return "would-fix";

  const body = new URLSearchParams({ content: next });
  const editResp = await fetchWithRetry(`${base}/sites/${blog}/posts/${post.ID}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WORDPRESS_OAUTH2_TOKEN}`,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = await editResp.json().catch(() => ({}));
  if (!editResp.ok) throw new Error(`WordPress update failed for ${entry.slug}: ${data.message || data.error || editResp.status}`);
  return "fixed";
}

async function main() {
  const results = JSON.parse(fs.readFileSync(RESULTS_FILE, "utf8"));
  const targets = [];

  for (const entry of results) {
    if (argv.slug && entry.slug !== argv.slug) continue;
    const wordpress = entry.syndication?.wordpress_earthstar;
    if (wordpress?.status === "success" && wordpress.url) {
      targets.push({ entry, key: "wordpress_earthstar", platform: wordpress, repair: repairWordPress });
    }
  }

  let fixed = 0;
  let wouldFix = 0;
  let clean = 0;
  let skipped = 0;

  for (const target of targets) {
    const status = await target.repair(target.entry, target.platform);
    if (status === "fixed") fixed += 1;
    else if (status === "would-fix") wouldFix += 1;
    else if (status === "clean") clean += 1;
    else skipped += 1;
    console.log(`${status.padEnd(10)} ${target.key} ${target.entry.slug}`);
    await sleep(500);
  }

  console.log(`\n${execute ? "Executed" : "Dry run"}: fixed=${fixed}, wouldFix=${wouldFix}, clean=${clean}, skipped=${skipped}`);
}

// CLI-only guard: without this, merely `import`-ing this module (from a test,
// another script, or a syntax/load check) executes a real run with real side
// effects. See AGENTS.md (CLI guard) ~ every script with a top-level main() needs this.
const __voaIsCli = process.argv[1] && import.meta.url === __voaPathToFileURL(process.argv[1]).href;
if (__voaIsCli) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
