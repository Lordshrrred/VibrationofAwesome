#!/usr/bin/env node
/**
 * retry-failed-syndication.js
 *
 * Finds recent syndication failures and retries just the failed platforms.
 * Called automatically at the end of the drip workflow after publish.
 *
 * Safety:
 *   - Only retries platforms with status "failed" (never "success" or "skipped")
 *   - Uses --platforms flag so only failed platforms are attempted
 *   - The existing dedup logic in syndicate.js prevents duplicate posts
 *   - Only looks back RETRY_WINDOW_DAYS days to avoid retrying ancient failures
 *
 * Usage:
 *   node scripts/retry-failed-syndication.js
 *   node scripts/retry-failed-syndication.js --dry-run   (preview only)
 */

import fs          from "fs";
import path        from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import dotenv      from "dotenv";

dotenv.config({ override: true });

const __dirname      = path.dirname(fileURLToPath(import.meta.url));
const ROOT           = path.resolve(__dirname, "..");
const RESULTS_FILE   = path.join(ROOT, "static", "_data", "syndication-results.json");
const RETRY_WINDOW_DAYS = 7;   // only retry failures within this window
const MAX_RETRIES_PER_RUN = 5; // cap so a bad day doesn't spam APIs

const isDryRun = process.argv.includes("--dry-run");

// Platforms that can safely be retried without creating duplicates.
// Dev.to is excluded because it rejects posts with duplicate canonical URLs
// even when the first post actually succeeded — we handle that case separately.
const RETRYABLE_PLATFORMS = new Set([
  "pinterest",
  "tumblr_voa",
  "blogger",
  "wordpress_earthstar",
  "bluesky_voa",
  "mastodon_voa",
  "facebook_voa",
  "threads",
  "instagram",
]);

function loadResults() {
  try {
    if (!fs.existsSync(RESULTS_FILE)) return [];
    const raw = JSON.parse(fs.readFileSync(RESULTS_FILE, "utf8"));
    return Array.isArray(raw) ? raw : [];
  } catch (_) { return []; }
}

function recentCutoff() {
  const d = new Date();
  d.setDate(d.getDate() - RETRY_WINDOW_DAYS);
  return d;
}

function getFailedPlatforms(syndication) {
  return Object.entries(syndication || {})
    .filter(([platform, v]) =>
      RETRYABLE_PLATFORMS.has(platform) &&
      v.status === "failed" &&
      !v.skipped
    )
    .map(([platform]) => platform);
}

async function main() {
  const results  = loadResults();
  const cutoff   = recentCutoff();

  // Find entries with failures in the retry window
  const toRetry = [];
  for (const entry of results) {
    const synd      = entry.syndication || {};
    const failed    = getFailedPlatforms(synd);
    if (failed.length === 0) continue;

    // Check if this entry has a recent failure timestamp
    const timestamps = Object.values(synd)
      .filter(v => v.timestamp)
      .map(v => new Date(v.timestamp));
    const mostRecent = timestamps.length ? new Date(Math.max(...timestamps)) : null;
    if (!mostRecent || mostRecent < cutoff) continue;

    // Check which lane this slug belongs to
    let lane = entry.lane || "boom";
    if (!entry.lane) {
      const mattFile = path.join(ROOT, "static", "blog", "matt", "posts", entry.slug + ".html");
      if (fs.existsSync(mattFile)) lane = "matt";
    }

    toRetry.push({ slug: entry.slug, lane, failed, mostRecent });
  }

  if (toRetry.length === 0) {
    console.log("[retry] No recent syndication failures found.");
    return;
  }

  console.log(`[retry] Found ${toRetry.length} slug(s) with recent failures:`);
  toRetry.forEach(r => console.log(`  ${r.slug}: ${r.failed.join(", ")}`));

  if (isDryRun) {
    console.log("[retry] --dry-run: no action taken.");
    return;
  }

  let retried = 0;
  for (const { slug, lane, failed } of toRetry) {
    if (retried >= MAX_RETRIES_PER_RUN) {
      console.log(`[retry] Hit MAX_RETRIES_PER_RUN (${MAX_RETRIES_PER_RUN}), stopping.`);
      break;
    }

    console.log(`\n[retry] Retrying ${slug} → platforms: ${failed.join(", ")}`);
    const args = [
      "scripts/syndicate.js",
      "--lane", lane,
      "--slug", slug,
      "--platforms", failed.join(","),
      "--force",
    ];

    const result = spawnSync("node", args, { stdio: "inherit", cwd: ROOT });
    if (result.error) {
      console.error(`[retry] Error running syndicate.js for ${slug}:`, result.error.message);
    } else if (result.status !== 0) {
      console.warn(`[retry] syndicate.js exited ${result.status} for ${slug}`);
    } else {
      console.log(`[retry] ✓ ${slug} retry complete`);
    }
    retried++;
  }

  console.log(`\n[retry] Done. Retried ${retried} slug(s).`);
}

main().catch(err => { console.error(err); process.exit(1); });
