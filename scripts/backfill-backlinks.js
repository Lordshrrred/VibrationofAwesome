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
import { pathToFileURL as __voaPathToFileURL } from "node:url";
import {
  buildSyndicationBacklogStatus,
  missingBacklinkPlatforms,
  selectBackfillBatch,
} from "./lib/syndication-backlog.js";

dotenv.config({ override: true });

const __dirname    = path.dirname(fileURLToPath(import.meta.url));
const ROOT         = path.resolve(__dirname, "..");
const RESULTS_FILE = path.join(ROOT, "static/_data/syndication-results.json");
const LOG_FILE     = path.join(ROOT, "static/_data/syndication-log.json");

const BACKLINK_PLATFORMS = ["devto", "devto2", "tumblr_voa", "blogger", "wordpress_earthstar"];
const MAINTENANCE_BATCH  = Number(process.env.BACKLINK_MAINTENANCE_BATCH || 3);
const CATCHUP_BATCH      = Number(process.env.BACKLINK_CATCHUP_BATCH || 8);
const INTER_POST_DELAY   = Number(process.env.BACKLINK_INTER_POST_DELAY_SECONDS || 10);

const argv    = minimist(process.argv.slice(2), { boolean: ["execute", "force"], string: ["platforms", "batch"] });
const execute = argv.execute;
const force   = argv.force;
const targetPlatforms = argv.platforms
  ? argv.platforms.split(",").map(s => s.trim())
  : BACKLINK_PLATFORMS;

function loadResults() {
  try {
    const d = JSON.parse(fs.readFileSync(RESULTS_FILE, "utf8"));
    return Array.isArray(d) ? d : [];
  } catch (_) { return []; }
}

function loadLog() {
  try {
    const d = JSON.parse(fs.readFileSync(LOG_FILE, "utf8"));
    return Array.isArray(d.entries) ? d.entries : [];
  } catch (_) { return []; }
}

function cachedCaptionsForSlug(logEntries, slug) {
  const match = logEntries
    .filter(entry => entry.postSlug === slug && entry.captions && typeof entry.captions === "object")
    .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))[0];
  return match?.captions || null;
}

function filterTargetPlatforms(platforms) {
  const allowed = new Set(targetPlatforms);
  return platforms.filter(key => allowed.has(key));
}

function sleep(s) { return new Promise(r => setTimeout(r, s * 1000)); }

async function main() {
  const results = loadResults();
  const logEntries = loadLog();
  const status = buildSyndicationBacklogStatus(results);
  const batchSize = parseInt(argv.batch || (status.mode === "catch-up" ? CATCHUP_BATCH : MAINTENANCE_BATCH), 10);

  const bySlug = new Map(results.map(row => [row.slug, row]));
  const today = new Date().toISOString().slice(0, 10);
  const attemptedBloggerToday = results.filter(r => r.syndication?.blogger?.backfill_attempted_at?.startsWith(today)).length;
  let bloggerAllowance = Math.max(0, 4 - attemptedBloggerToday);
  let bloggerAvailable = true;
  if (execute && targetPlatforms.includes("blogger") && bloggerAllowance > 0) {
    try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", signal: AbortSignal.timeout(15000), headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: process.env.BLOGGER_CLIENT_ID || "", client_secret: process.env.BLOGGER_CLIENT_SECRET || "", refresh_token: process.env.BLOGGER_REFRESH_TOKEN || "", grant_type: "refresh_token" }),
    });
    const token = await response.json();
    bloggerAvailable = response.ok && Boolean(token.access_token);
    if (!bloggerAvailable) console.error(`[blogger] Auth preflight failed: ${token.error || response.status}. No Blogger generation/spend this run; other platforms continue.`);
    } catch (error) { bloggerAvailable = false; console.error(`[blogger] Auth preflight unavailable: ${error.message}; other platforms continue.`); }
  }
  const backlog = status.prioritizedBacklog
    .map(item => {
      const source = bySlug.get(item.slug) || item;
      const missing = filterTargetPlatforms(missingBacklinkPlatforms(source)).filter(key => {
        if (key !== "blogger") return true;
        return bloggerAvailable && bloggerAllowance > 0 && !source.syndication?.blogger?.backfill_attempted_at?.startsWith(today);
      });
      return { ...source, missing };
    })
    .filter(row => row.missing.length > 0);

  console.log("\n=== Backlink Backfill ===");
  console.log(`Mode:     ${execute ? "EXECUTE" : "dry run"}${force ? " + force" : ""}`);
  console.log(`Strategy: ${status.mode}`);
  console.log(`Batch:    ${batchSize} posts per run`);
  console.log(`Platforms: ${targetPlatforms.join(", ")}`);
  console.log(`Backlog:  ${status.summary.backlogPosts} posts / ${status.summary.backlinkCapableMissingUnits} backlink-capable platform units`);
  console.log(`Fresh delay: ${status.summary.freshPostsAwaitingBacklinks} posts / ${status.summary.freshMissingBacklinkUnits} units`);
  console.log(`Net/day: ${status.summary.netBacklogChangePerDay} | ETA: ${status.summary.estimatedCatchUpDays ?? "not catching up"}\n`);

  if (backlog.length === 0) {
    console.log("No eligible backlog work within today's platform budgets.");
    process.exit(bloggerAvailable ? 0 : 1);
  }

  // Print full backlog
  for (const r of backlog) {
    console.log(`  ${(r.date||"?").slice(0,10)}  ${r.slug.slice(0,60).padEnd(60)}  needs: ${r.missing.join(", ")}`);
  }

  const batch = selectBackfillBatch(backlog, batchSize, bloggerAllowance);
  console.log(`[blogger] At most four extra catch-up attempts/day; already attempted today: ${attemptedBloggerToday}. New-post syndication is separate.`);
  console.log(`\nThis run will process: ${batch.length} of ${backlog.length} posts`);

  if (!execute) {
    console.log("\nDry run. Add --execute to publish.");
    // Exit 2 = backlog exists but not executed (used by CI to detect remaining work)
    process.exit(backlog.length > 0 ? 2 : 0);
  }

  let succeeded = 0;
  let failed    = bloggerAvailable ? 0 : 1;

  for (let i = 0; i < batch.length; i++) {
    const r = batch[i];
    const cachedCaptions = cachedCaptionsForSlug(logEntries, r.slug);
    console.log(`\n[${i + 1}/${batch.length}] ${r.slug}`);
    console.log(`  Missing: ${r.missing.join(", ")}`);
    console.log(`  Captions: ${cachedCaptions ? "reusing cached log captions (no caption Claude call)" : "no cache found; syndicate.js will generate captions"}`);

    try {
      if (r.missing.includes("blogger")) {
        // Persist before external side effects; saveResults preserves platform metadata.
        const current = loadResults();
        const saved = current.find(row => row.slug === r.slug);
        if (!saved) throw new Error("Missing tracked result; refusing uncheckpointed Blogger backfill");
        saved.syndication ||= {};
        saved.syndication.blogger = { ...saved.syndication.blogger, backfill_attempted_at: new Date().toISOString() };
        fs.writeFileSync(RESULTS_FILE, JSON.stringify(current, null, 2));
      }
      const entry = await syndicatePost(r.lane || "boom", r.slug, {
        platforms: r.missing,
        force,
        skipLock: false,
        ...(cachedCaptions ? { captions: cachedCaptions } : {}),
      });
      const attempted = r.missing.length;
      const ok = r.missing.filter(key => entry.platforms?.[key]?.success).length;
      succeeded += ok;
      failed += attempted - ok;
      console.log(`  ✅ Platform tasks complete: ${ok}/${attempted}`);
    } catch (err) {
      failed += r.missing.length;
      console.error(`  ❌ Failed: ${err.message}`);
    }

    if (i < batch.length - 1) {
      console.log(`  Waiting ${INTER_POST_DELAY}s before next post...`);
      await sleep(INTER_POST_DELAY);
    }
  }

  const remaining = backlog.length - batch.length;
  console.log(`\n=== Run complete ===`);
  console.log(`  Processed posts: ${batch.length} | Platform tasks succeeded: ${succeeded} | failed: ${failed}`);
  console.log(`  Remaining in backlog: ${remaining}`);

  if (failed > 0) {
    console.error(`  ${failed} platform task(s) failed; leaving them in the backlog.`);
    process.exit(1);
  }
  if (remaining > 0) {
    console.log(`  Run again to continue. (~${Math.ceil(remaining / batchSize)} more runs needed)`);
    process.exit(2); // exit 2 = more work remains (workflow uses this to decide whether to continue)
  }
  process.exit(0); // exit 0 = all clear
}

// CLI-only guard: without this, merely `import`-ing this module (from a test,
// another script, or a syntax/load check) executes a real run with real side
// effects. See CLAUDE.md ~ every script with a top-level main() needs this.
const __voaIsCli = process.argv[1] && import.meta.url === __voaPathToFileURL(process.argv[1]).href;
if (__voaIsCli) {
  main().catch(err => { console.error(err); process.exit(1); });
}
