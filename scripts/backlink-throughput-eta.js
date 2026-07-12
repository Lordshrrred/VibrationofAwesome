#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import minimist from "minimist";
import {
  buildSyndicationBacklogStatus,
  expectedBacklinkPlatforms,
  platformStatus,
  readJson,
} from "./lib/syndication-backlog.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const RESULTS_FILE = path.join(ROOT, "static/_data/syndication-results.json");
const OUT_FILE = path.join(ROOT, "static/_data/backlink-throughput-eta.json");
const BASELINE_COMMIT = "e99f5ce";

const argv = minimist(process.argv.slice(2), {
  boolean: ["write", "json"],
});

function round(n, digits = 1) {
  if (!Number.isFinite(Number(n))) return null;
  const p = 10 ** digits;
  return Math.round(Number(n) * p) / p;
}

function countCompletions(results, hours, now) {
  const cutoff = now.getTime() - hours * 60 * 60 * 1000;
  const slugs = new Set();
  let units = 0;
  for (const row of results) {
    let progressed = false;
    for (const key of expectedBacklinkPlatforms(row)) {
      const item = platformStatus(row, key);
      const ts = Date.parse(item?.timestamp || "");
      if (item?.status === "success" && Number.isFinite(ts) && ts >= cutoff && ts <= now.getTime()) {
        units++;
        progressed = true;
      }
    }
    if (progressed) slugs.add(row.slug);
  }
  return {
    hours,
    successfulBacklinkUnits: units,
    postsProgressed: slugs.size,
    unitsPerDay: round(units / Math.max(hours / 24, 1 / 24), 1),
    postsPerRunProxy: slugs.size,
  };
}

function etaDays(backlogUnits, completedPerDay, newUnitsPerDay) {
  if (backlogUnits <= 0) return 0;
  const netCatchup = completedPerDay - newUnitsPerDay;
  if (netCatchup <= 0) return null;
  return round(backlogUnits / netCatchup, 1);
}

function buildPayload(now = new Date()) {
  const results = readJson(RESULTS_FILE, []);
  const status = buildSyndicationBacklogStatus(results, { now });
  const windows = [6, 12, 24].map(hours => countCompletions(results, hours, now));
  const s = status.summary;
  const measured = windows.find(w => w.hours === 24)?.unitsPerDay || 0;
  const optimistic = Math.max(measured, windows.find(w => w.hours === 6)?.unitsPerDay || 0, s.completedBacklinkUnitsPerDay || 0);
  const conservative = Math.min(...[measured, s.completedBacklinkUnitsPerDay || 0].filter(n => Number.isFinite(n) && n > 0));

  const estimates = {
    optimisticDays: etaDays(s.backlinkCapableMissingUnits, optimistic, s.newBacklinkUnitsPerDay),
    measuredDays: etaDays(s.backlinkCapableMissingUnits, measured, s.newBacklinkUnitsPerDay),
    conservativeDays: etaDays(s.backlinkCapableMissingUnits, conservative || 0, s.newBacklinkUnitsPerDay),
  };

  return {
    generatedAt: now.toISOString(),
    baselineCommit: BASELINE_COMMIT,
    backlog: {
      eligiblePosts: s.totalTrackedPosts,
      postsWithMeaningfulBacklinkDebt: s.backlogPosts,
      backlinkCapableMissingUnits: s.backlinkCapableMissingUnits,
      distributionOnlyGaps: s.distributionIncompleteUnits,
      verificationOnlyGaps: s.backlinkVerificationGaps,
      feederBacklog: s.feederMissingUnits,
      mode: status.mode,
    },
    throughput: {
      windows,
      averageSuccessfulUnitsPerScheduledRun: round((windows.find(w => w.hours === 24)?.successfulBacklinkUnits || 0) / 12, 2),
      averagePostsProgressedPerScheduledRun: round((windows.find(w => w.hours === 24)?.postsProgressed || 0) / 12, 2),
      currentNewBacklinkDemandPerDay: s.newBacklinkUnitsPerDay,
      currentMeasuredSuccessfulUnitsPerDay: measured,
      currentNetBacklogChangePerDay: round(s.newBacklinkUnitsPerDay - measured, 1),
      existingFourteenDaySuccessfulUnitsPerDay: s.completedBacklinkUnitsPerDay,
    },
    estimates,
    platformTable: status.platformTable,
    definitions: {
      scheduledRunProxy: "Backlink backfill runs every two hours, so 24h/12 is used for average scheduled-run estimates.",
      meaningfulBacklinkDebt: "Only Dev.to/Dev.to2, Tumblr, Blogger, and WordPress missing success records count as SEO backlink debt.",
      excluded: "Pinterest, Instagram, social-only distribution, feeder canonical pages, and verification-only gaps are excluded from meaningful backlink debt.",
    },
  };
}

const payload = buildPayload();

if (argv.write) {
  fs.writeFileSync(OUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Wrote ${path.relative(ROOT, OUT_FILE)}`);
}

if (argv.json || !argv.write) {
  console.log(JSON.stringify(payload, null, 2));
}

