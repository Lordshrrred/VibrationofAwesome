#!/usr/bin/env node
/**
 * backfill-feeder.js
 *
 * Dispatches feeder post generation for all VOA posts missing a Feeder backlink.
 * Each dispatch passes the original VOA publish date so the feeder post is
 * backdated to match — no batch of posts all appearing on the same day.
 *
 * The VOA_Feeder workflow has concurrency: feeder-publish / cancel-in-progress: false,
 * so dispatches queue up and run one at a time. Safe to fire them all at once.
 *
 * Usage:
 *   node scripts/backfill-feeder.js              # dry run
 *   node scripts/backfill-feeder.js --execute    # dispatch all missing
 *   node scripts/backfill-feeder.js --execute --batch 5   # dispatch up to N
 */

import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import minimist from "minimist";

dotenv.config({ override: true });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, "..");

const RESULTS_FILE = path.join(ROOT, "static/_data/syndication-results.json");
const POSTS_DIR    = path.join(ROOT, "static/blog/boom/posts");

const argv     = minimist(process.argv.slice(2), { boolean: ["execute"], string: ["batch"] });
const execute  = argv.execute;
const batchMax = parseInt(argv.batch || "999", 10);

// ── Helpers ────────────────────────────────────────────────────────────────────

function loadResults() {
  try { return JSON.parse(fs.readFileSync(RESULTS_FILE, "utf8")); }
  catch (_) { return []; }
}

function extractText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
}

function extractExcerpt(html) {
  const m = html.match(/<p[^>]*>([\s\S]{80,}?)<\/p>/i);
  if (!m) return "";
  return m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function dispatch(post) {
  const token = process.env.VOA_FEEDER_TRIGGER_TOKEN;
  if (!token) throw new Error("VOA_FEEDER_TRIGGER_TOKEN not set in .env");

  const postUrl  = post.voa_url || `https://vibrationofawesome.com/blog/boom/posts/${post.slug}/`;
  const htmlPath = path.join(POSTS_DIR, post.slug + ".html");
  const html     = fs.existsSync(htmlPath) ? fs.readFileSync(htmlPath, "utf8") : "";

  const payload = {
    event_type: "voa-post-published",
    client_payload: {
      voa_post_url:         postUrl,
      voa_post_title:       post.title || post.slug,
      voa_post_keyword:     post.keyword || "",
      voa_post_slug:        post.slug,
      voa_post_lane:        "boom",
      voa_post_excerpt:     extractExcerpt(html),
      voa_post_tags:        (post.tags || []).join(", "),
      voa_post_category:    post.niche || post.cluster || "Breaking Out",
      voa_post_source_text: extractText(html),
      // Backdate the feeder post to the original VOA publish date
      voa_post_date:        (post.date || "").slice(0, 10),
    },
  };

  const resp = await fetch(
    "https://api.github.com/repos/Lordshrrred/VOA_Feeder/dispatches",
    {
      method: "POST",
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (resp.status === 204) return;
  const body = await resp.text();
  throw new Error(`GitHub dispatch HTTP ${resp.status}: ${body}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const results = loadResults();

  // All posts missing feeder — both full-drip and art-extra (user explicitly wants these)
  const missing = results
    .filter(r => r.syndication?.feeder?.status !== "success")
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  console.log("\n=== Feeder Backfill ===");
  console.log(`Mode:    ${execute ? "EXECUTE" : "dry run"}`);
  console.log(`Missing: ${missing.length} posts without feeder companion\n`);

  if (missing.length === 0) {
    console.log("✅ All posts have feeder companions. Nothing to do.");
    return;
  }

  const batch = missing.slice(0, batchMax);
  for (const r of batch) {
    const date = (r.date || "?").slice(0, 10);
    const isArt = !!(r.syndication?.devto2) && !(r.syndication?.bluesky_voa);
    console.log(`  ${date}  [${isArt ? "ART" : "FULL"}]  ${r.slug}`);
    console.log(`            → feeder post will be dated: ${date}`);
  }

  if (!execute) {
    console.log(`\nDry run — add --execute to dispatch ${batch.length} feeder job(s).`);
    console.log("VOA_Feeder queue serializes them automatically (concurrency: feeder-publish).");
    return;
  }

  console.log(`\nDispatching ${batch.length} feeder jobs to VOA_Feeder...`);
  let ok = 0, fail = 0;
  for (let i = 0; i < batch.length; i++) {
    const r = batch[i];
    process.stdout.write(`  [${i + 1}/${batch.length}] ${r.slug.slice(0, 55)} ... `);
    try {
      await dispatch(r);
      console.log("✓ queued");
      ok++;
    } catch (err) {
      console.log(`✗ ${err.message}`);
      fail++;
    }
    // Small delay between API calls to avoid GitHub rate limits (not needed for correctness)
    if (i < batch.length - 1) await sleep(1500);
  }

  console.log(`\n=== Done ===`);
  console.log(`  Queued: ${ok}  Failed: ${fail}`);
  console.log(`  VOA_Feeder will process them one at a time via feeder-publish concurrency group.`);
  console.log(`  Each feeder post will be backdated to the original VOA publish date.`);
  if (fail > 0) console.log(`  Re-run --execute to retry failed dispatches.`);
}

main().catch(err => { console.error(err); process.exit(1); });
