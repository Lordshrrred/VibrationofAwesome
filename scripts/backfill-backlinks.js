#!/usr/bin/env node
/**
 * backfill-backlinks.js
 *
 * Finds all live boom posts missing backlink-tier syndication and catches them
 * up in a rate-limited batch. Safe to run repeatedly — skips any that already
 * have a success recorded.
 *
 * Usage:
 *   node scripts/backfill-backlinks.js              # dry run — shows what would run
 *   node scripts/backfill-backlinks.js --execute    # publish up to BATCH_SIZE posts
 *   node scripts/backfill-backlinks.js --execute --batch 5   # override batch size
 *   node scripts/backfill-backlinks.js --execute --platforms blogger  # one platform only
 *
 * Called by .github/workflows/backlink-backfill.yml every 4 hours until clear.
 */

import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import minimist from "minimist";
import { syndicatePost } from "./syndicate.js";

dotenv.config({ override: true });

const __dirname    = path.dirname(fileURLToPath(import.meta.url));
const ROOT         = path.resolve(__dirname, "..");
const RESULTS_FILE = path.join(ROOT, "static/_data/syndication-results.json");

const BACKLINK_PLATFORMS = ["devto", "tumblr_voa", "blogger", "wordpress_earthstar"];
// Art-buyer extra posts use devto2 instead of devto — don't backfill devto acct1 for those
const ART_BACKLINK_PLATFORMS = ["tumblr_voa", "blogger", "wordpress_earthstar"];
const DEFAULT_BATCH      = 3;   // posts per run — conservative to avoid API rate limits
const INTER_POST_DELAY   = 15;  // seconds between posts

const argv    = minimist(process.argv.slice(2), { boolean: ["execute", "force"], string: ["platforms", "batch"] });
const execute = argv.execute;
const force   = argv.force;
const batchSize = parseInt(argv.batch || DEFAULT_BATCH, 10);
const targetPlatforms = argv.platforms
  ? argv.platforms.split(",").map(s => s.trim())
  : BACKLINK_PLATFORMS;

function loadResults() {
  try {
    const d = JSON.parse(fs.readFileSync(RESULTS_FILE, "utf8"));
    return Array.isArray(d) ? d : [];
  } catch (_) { return []; }
}

function missingPlatforms(result) {
  const syn = result.syndication || {};
  const isArtBuyer = !!syn["devto2"];  // art-buyer posts have devto2, not devto
  const platforms = isArtBuyer ? ART_BACKLINK_PLATFORMS : targetPlatforms;
  return platforms.filter(k => syn[k]?.status !== "success");
}

function sleep(s) { return new Promise(r => setTimeout(r, s * 1000)); }

async function main() {
  const results = loadResults();

  // Find posts with at least one missing backlink platform, oldest first
  const backlog = results
    .map(r => ({ ...r, missing: missingPlatforms(r) }))
    .filter(r => r.missing.length > 0)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  console.log("\n=== Backlink Backfill ===");
  console.log(`Mode:     ${execute ? "EXECUTE" : "dry run"}${force ? " + force" : ""}`);
  console.log(`Batch:    ${batchSize} posts per run`);
  console.log(`Platforms: ${targetPlatforms.join(", ")}`);
  console.log(`Backlog:  ${backlog.length} posts need work\n`);

  if (backlog.length === 0) {
    console.log("✅ All posts fully syndicated. Nothing to do.");
    process.exit(0);
  }

  // Print full backlog
  for (const r of backlog) {
    console.log(`  ${(r.date||"?").slice(0,10)}  ${r.slug.slice(0,60).padEnd(60)}  needs: ${r.missing.join(", ")}`);
  }

  const batch = backlog.slice(0, batchSize);
  console.log(`\nThis run will process: ${batch.length} of ${backlog.length} posts`);

  if (!execute) {
    console.log("\nDry run. Add --execute to publish.");
    // Exit 2 = backlog exists but not executed (used by CI to detect remaining work)
    process.exit(backlog.length > 0 ? 2 : 0);
  }

  let succeeded = 0;
  let failed    = 0;

  for (let i = 0; i < batch.length; i++) {
    const r = batch[i];
    console.log(`\n[${i + 1}/${batch.length}] ${r.slug}`);
    console.log(`  Missing: ${r.missing.join(", ")}`);

    try {
      await syndicatePost("boom", r.slug, {
        platforms: r.missing,
        force,
        skipLock: false,
      });
      succeeded++;
      console.log(`  ✅ Done`);
    } catch (err) {
      failed++;
      console.error(`  ❌ Failed: ${err.message}`);
    }

    if (i < batch.length - 1) {
      console.log(`  Waiting ${INTER_POST_DELAY}s before next post...`);
      await sleep(INTER_POST_DELAY);
    }
  }

  const remaining = backlog.length - batch.length;
  console.log(`\n=== Run complete ===`);
  console.log(`  Processed: ${batch.length} | Succeeded: ${succeeded} | Failed: ${failed}`);
  console.log(`  Remaining in backlog: ${remaining}`);

  if (remaining > 0) {
    console.log(`  Run again to continue. (~${Math.ceil(remaining / batchSize)} more runs needed)`);
    process.exit(2); // exit 2 = more work remains (workflow uses this to decide whether to continue)
  }
  process.exit(0); // exit 0 = all clear
}

main().catch(err => { console.error(err); process.exit(1); });
