#!/usr/bin/env node
/**
 * Builds an accurate VOA syndication/backlink backlog report.
 *
 * The backlink backlog is intentionally narrow: only backlink-capable
 * destinations count as backlink units. Feeder canonical/source pages and
 * social distribution are reported separately.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import minimist from "minimist";
import {
  buildSyndicationBacklogStatus,
  readJson,
} from "./lib/syndication-backlog.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const RESULTS_FILE = path.join(ROOT, "static", "_data", "syndication-results.json");
const OUT_FILE = path.join(ROOT, "static", "_data", "syndication-backlog-status.json");

const argv = minimist(process.argv.slice(2), {
  boolean: ["write", "json"],
});

const results = readJson(RESULTS_FILE, []);
const status = buildSyndicationBacklogStatus(results);

if (argv.write) {
  fs.writeFileSync(OUT_FILE, JSON.stringify(status, null, 2) + "\n", "utf8");
  console.log(`Wrote ${path.relative(ROOT, OUT_FILE)}`);
}

if (argv.json) {
  console.log(JSON.stringify(status, null, 2));
} else {
  const s = status.summary;
  console.log("\n=== VOA Syndication Backlog Status ===");
  console.log(`Mode: ${status.mode}`);
  console.log(`Tracked posts: ${s.totalTrackedPosts}`);
  console.log(`Backlink backlog: ${s.backlogPosts} posts / ${s.backlinkCapableMissingUnits} backlink-capable platform units`);
  console.log(`Verification-only gaps: ${s.backlinkVerificationGaps}`);
  console.log(`Feeder missing units: ${s.feederMissingUnits}`);
  console.log(`Distribution incomplete units: ${s.distributionIncompleteUnits}`);
  console.log(`Fresh-post backlink delay: ${s.freshPostsAwaitingBacklinks} posts / ${s.freshMissingBacklinkUnits} units`);
  console.log(`Completed/day: ${s.completedBacklinkUnitsPerDay}`);
  console.log(`New/day: ${s.newBacklinkUnitsPerDay}`);
  console.log(`Net backlog change/day: ${s.netBacklogChangePerDay}`);
  console.log(`Estimated catch-up days: ${s.estimatedCatchUpDays ?? "not catching up yet"}`);
  console.log(`Largest delay: ${s.largestDelayPlatform || "none"} (${s.largestDelayMissingUnits})`);

  console.log("\nPlatform table:");
  console.table(status.platformTable.backlinkCapable.map(row => ({
    Platform: row.platform,
    Eligible: row.eligiblePosts,
    Complete: row.complete,
    Missing: row.missing,
    "Success %": row.successRate,
    "Avg/day": row.averagePerDay,
    "Main blocker": row.mainBlocker || "",
  })));

  if (status.blockers.length) {
    console.log("\nTop blockers:");
    status.blockers.forEach(row => console.log(`  ${row.count}x ${row.reason}`));
  }
}
