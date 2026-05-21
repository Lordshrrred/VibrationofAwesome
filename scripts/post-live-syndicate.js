#!/usr/bin/env node
/**
 * post-live-syndicate.js
 *
 * Money site first gate for drip publishing.
 * Reads static/_data/drip-last-published.json, verifies each VOA canonical URL
 * is live, then triggers Feeder and syndication. If the live URL is not
 * reachable, this script exits before any off-site syndication can happen.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import dotenv from "dotenv";

dotenv.config({ override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const MANIFEST_FILE = path.join(ROOT, "static", "_data", "drip-last-published.json");
const POSTS_DIR = path.join(ROOT, "static", "blog", "boom", "posts");

const LIVE_CHECK_ATTEMPTS = Number(process.env.LIVE_CHECK_ATTEMPTS || 30);
const LIVE_CHECK_INTERVAL_MS = Number(process.env.LIVE_CHECK_INTERVAL_MS || 20_000);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractExcerptFromHtml(html) {
  const match = html.match(/<p[^>]*>([\s\S]*?)<\/p>/);
  if (!match) return "";
  return match[1].replace(/<[^>]+>/g, "").trim().slice(0, 150);
}

function extractSourceTextFromHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 700)
    .join(" ");
}

async function verifyLivePost(item) {
  const url = item.url || `https://vibrationofawesome.com/blog/boom/posts/${item.slug}.html`;
  const titleNeedle = String(item.title || "").slice(0, 80);

  for (let attempt = 1; attempt <= LIVE_CHECK_ATTEMPTS; attempt++) {
    try {
      const bust = url.includes("?") ? `&live_check=${Date.now()}` : `?live_check=${Date.now()}`;
      const resp = await fetch(url + bust, { redirect: "follow" });
      const text = await resp.text();
      const titleOk = titleNeedle ? text.includes(titleNeedle) : text.includes(item.slug);
      if (resp.ok && titleOk) {
        console.log(`  [live] ✓ ${item.slug} is live (${resp.status})`);
        return true;
      }
      console.log(`  [live] waiting for ${item.slug}: HTTP ${resp.status}, titleOk=${titleOk} (${attempt}/${LIVE_CHECK_ATTEMPTS})`);
    } catch (err) {
      console.log(`  [live] waiting for ${item.slug}: ${err.message} (${attempt}/${LIVE_CHECK_ATTEMPTS})`);
    }
    if (attempt < LIVE_CHECK_ATTEMPTS) await sleep(LIVE_CHECK_INTERVAL_MS);
  }

  throw new Error(`Money site gate failed: ${url} is not live. Refusing feeder/syndication.`);
}

async function triggerFeeder(item) {
  const token = process.env.VOA_FEEDER_TRIGGER_TOKEN;
  if (!token) {
    console.log("  [feeder] VOA_FEEDER_TRIGGER_TOKEN not set ~ skipping");
    return;
  }

  const postUrl = item.url || `https://vibrationofawesome.com/blog/boom/posts/${item.slug}.html`;
  const postHtmlPath = path.join(POSTS_DIR, item.slug + ".html");
  const postHtml = fs.existsSync(postHtmlPath) ? fs.readFileSync(postHtmlPath, "utf8") : "";

  const resp = await fetch(
    "https://api.github.com/repos/Lordshrrred/VOA_Feeder/dispatches",
    {
      method: "POST",
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event_type: "voa-post-published",
        client_payload: {
          voa_post_url: postUrl,
          voa_post_title: item.title,
          voa_post_keyword: item.keyword || "",
          voa_post_slug: item.slug,
          voa_post_lane: "boom",
          voa_post_excerpt: extractExcerptFromHtml(postHtml),
          voa_post_tags: Array.isArray(item.tags) ? item.tags.join(", ") : "",
          voa_post_category: item.topic || item.category || "",
          voa_post_source_text: extractSourceTextFromHtml(postHtml),
        },
      }),
    }
  );

  if (resp.status === 204) {
    console.log(`  [feeder] ✓ Triggered: ${item.slug}`);
    return;
  }
  throw new Error(`[feeder] HTTP ${resp.status} for ${item.slug}`);
}

function syndicate(item) {
  const args = ["scripts/syndicate.js", "--lane", "boom", "--slug", item.slug];
  if (item.keyword) args.push("--keyword", item.keyword);
  const result = spawnSync("node", args, { stdio: "inherit", cwd: ROOT });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    console.warn(`  [syndicate] ${item.slug} exited ${result.status}`);
  }
}

async function main() {
  if (!fs.existsSync(MANIFEST_FILE)) {
    console.log("No drip-last-published.json found ~ nothing to syndicate.");
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, "utf8"));
  const items = Array.isArray(manifest.items) ? manifest.items : [];
  if (items.length === 0) {
    console.log("Post-live manifest has no items ~ nothing to syndicate.");
    return;
  }

  console.log("\n╔═ [post-live] Money Site First Gate ════════════════");
  console.log(`║  Items:        ${items.length}`);
  console.log(`║  Syndicate:    ${!!manifest.syndicate_on_publish}`);
  console.log(`║  Feeder:       ${!!manifest.trigger_feeder_on_publish}`);
  console.log("╚════════════════════════════════════════════════════\n");

  for (const item of items) {
    await verifyLivePost(item);
  }

  for (const item of items) {
    if (manifest.trigger_feeder_on_publish) await triggerFeeder(item);
    if (manifest.syndicate_on_publish) {
      console.log(`\n  Syndicating after live verification: ${item.slug}...`);
      syndicate(item);
    }
  }
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
