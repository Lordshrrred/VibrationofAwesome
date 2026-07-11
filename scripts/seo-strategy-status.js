#!/usr/bin/env node
/**
 * SEO strategy status for VOA: publish runway, curated expansion need, and
 * backlink throughput. No API calls.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildSyndicationBacklogStatus } from "./lib/syndication-backlog.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const DRIP_QUEUE = path.join(ROOT, "static/_data/drip-queue.json");
const RESULTS_FILE = path.join(ROOT, "static/_data/syndication-results.json");
const OUT_FILE = path.join(ROOT, "static/_data/seo-strategy.json");

function envNumber(key, fallback) {
  const value = Number(process.env[key] || fallback);
  return Number.isFinite(value) ? value : fallback;
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (_) {
    return fallback;
  }
}

function keywordGenerationStatus() {
  const queue = readJson(DRIP_QUEUE, { queue: [], published: [], status: "missing" });
  const pending = Array.isArray(queue.queue) ? queue.queue.length : 0;
  const published = Array.isArray(queue.published) ? queue.published.length : 0;
  const cadence = envNumber("SEO_PUBLISHING_POSTS_PER_DAY", 5);
  const pauseDays = envNumber("KEYWORD_RUNWAY_PAUSE_DAYS", 60);
  const resumeDays = envNumber("KEYWORD_RUNWAY_RESUME_DAYS", 21);
  const days = cadence > 0 ? pending / cadence : 0;
  const rounded = Math.round(days * 10) / 10;

  let status = "running";
  let reason = `${rounded} publishing days of queue inventory remain. Curated expansion should continue.`;
  if (days >= pauseDays) {
    status = "paused";
    reason = `${rounded} publishing days of queue inventory remain, above the ${pauseDays} day pause threshold.`;
  } else if (days > resumeDays) {
    status = "paused";
    reason = `${rounded} publishing days remain, above the ${resumeDays} day resume threshold. Hold broad expansion and use curated additions only.`;
  }

  return {
    currentInventory: pending,
    publishedInventory: published,
    estimatedDaysRemaining: rounded,
    publishingCadencePerDay: cadence,
    pauseThresholdDays: pauseDays,
    resumeThresholdDays: resumeDays,
    status,
    reason,
  };
}

function backlinkThroughput() {
  const results = readJson(RESULTS_FILE, []);
  const status = buildSyndicationBacklogStatus(results);
  const s = status.summary;
  const net = s.netBacklogChangePerDay;
  let reason = `Backlink-capable backlog is growing by ${Math.abs(net)} platform units/day at the current rate.`;
  if (s.backlinkCapableMissingUnits === 0) {
    reason = "Backlink-capable backlog is clear; new posts can move through publish, syndicate, verify, complete.";
  } else if (net < 0) {
    reason = `Backlinks are catching up by ${Math.abs(net)} backlink-capable platform units/day.`;
  } else if (net === 0) {
    reason = "Backlinks are keeping pace, but not reducing the historical backlog.";
  }

  return {
    mode: status.mode,
    backlogPosts: s.backlogPosts,
    backlogUnits: s.backlinkCapableMissingUnits,
    completedPerDay: s.completedBacklinkUnitsPerDay,
    newPostsPerDay: s.newPostsPerDay,
    newBacklinkUnitsPerDay: s.newBacklinkUnitsPerDay,
    netBacklinkUnitsPerDay: net,
    estimatedCatchUpDays: s.estimatedCatchUpDays ?? "not-catching-up",
    feederMissingUnits: s.feederMissingUnits,
    distributionIncompleteUnits: s.distributionIncompleteUnits,
    verificationGaps: s.backlinkVerificationGaps,
    freshPostsAwaitingBacklinks: s.freshPostsAwaitingBacklinks,
    freshMissingBacklinkUnits: s.freshMissingBacklinkUnits,
    largestDelayPlatform: s.largestDelayPlatform,
    largestDelayMissingUnits: s.largestDelayMissingUnits,
    platformTable: status.platformTable,
    blockers: status.blockers,
    definitions: status.definitions,
    reason,
    windowDays: status.thresholds.windowDays,
  };
}

const payload = {
  generatedAt: new Date().toISOString(),
  keywordGeneration: keywordGenerationStatus(),
  backlinks: backlinkThroughput(),
  curatedExpansion: {
    supported: true,
    script: "scripts/import-curated-keywords.js",
    reason: "Use curated queue additions for new niche clusters, tools, products, AI products, competitor reviews, and intentional trend discoveries.",
  },
};

fs.writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2), "utf8");
console.log(`SEO strategy status written to ${path.relative(ROOT, OUT_FILE)}`);
console.log(`Keyword generation: ${payload.keywordGeneration.status} | ${payload.keywordGeneration.currentInventory} queued | ${payload.keywordGeneration.estimatedDaysRemaining} days`);
console.log(`Backlinks: backlog_posts=${payload.backlinks.backlogPosts} backlog_units=${payload.backlinks.backlogUnits} completed/day=${payload.backlinks.completedPerDay} net=${payload.backlinks.netBacklinkUnitsPerDay}`);
