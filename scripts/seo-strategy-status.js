#!/usr/bin/env node
/**
 * SEO strategy status for VOA: publish runway, curated expansion need, and
 * backlink throughput. No API calls.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const DRIP_QUEUE = path.join(ROOT, "static/_data/drip-queue.json");
const RESULTS_FILE = path.join(ROOT, "static/_data/syndication-results.json");
const OUT_FILE = path.join(ROOT, "static/_data/seo-strategy.json");

const REQUIRED_DEFAULT = ["feeder", "devto", "tumblr_voa", "blogger", "wordpress_earthstar"];
const REQUIRED_ART = ["devto2", "tumblr_voa", "blogger", "wordpress_earthstar"];

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

function daysBetween(a, b) {
  return Math.max(1, (b.getTime() - a.getTime()) / 86400000);
}

function requiredPlatforms(row) {
  const syn = row.syndication || {};
  return syn.devto2 || row.niche === "art-buyer-intent" ? REQUIRED_ART : REQUIRED_DEFAULT;
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
  const now = new Date();
  const windowDays = envNumber("BACKLINK_THROUGHPUT_WINDOW_DAYS", 14);
  const cutoff = new Date(now.getTime() - windowDays * 86400000);
  let backlogPosts = 0;
  let backlogUnits = 0;
  let completedUnits = 0;

  for (const row of Array.isArray(results) ? results : []) {
    const syn = row.syndication || {};
    const required = requiredPlatforms(row);
    let missing = 0;
    for (const key of required) {
      const item = syn[key] || {};
      const ok = item.status === "success" && item.backlink_confirmed === true;
      if (!ok) missing++;
      const ts = item.timestamp ? new Date(item.timestamp) : null;
      if (ok && ts && ts >= cutoff) completedUnits++;
    }
    if (missing > 0) {
      backlogPosts++;
      backlogUnits += missing;
    }
  }

  const completedPerDay = Math.round((completedUnits / Math.max(windowDays, 1)) * 10) / 10;
  const postsPerDay = envNumber("SEO_PUBLISHING_POSTS_PER_DAY", 5);
  const averageRequired = results.length
    ? results.reduce((sum, row) => sum + requiredPlatforms(row).length, 0) / results.length
    : REQUIRED_DEFAULT.length;
  const newUnitsPerDay = Math.round(postsPerDay * averageRequired * 10) / 10;
  const net = Math.round((newUnitsPerDay - completedPerDay) * 10) / 10;

  let estimatedCatchUpDays = null;
  let reason = `Backlog is growing by ${Math.abs(net)} platform links/day at the current rate.`;
  if (backlogUnits === 0) {
    estimatedCatchUpDays = "maintenance";
    reason = "Backlink backlog is clear; new posts can move through publish, syndicate, verify, complete.";
  } else if (completedPerDay > newUnitsPerDay) {
    estimatedCatchUpDays = Math.round((backlogUnits / (completedPerDay - newUnitsPerDay)) * 10) / 10;
    reason = `Backlinks are catching up by ${Math.round((completedPerDay - newUnitsPerDay) * 10) / 10} platform links/day.`;
  } else if (completedPerDay === newUnitsPerDay) {
    reason = "Backlinks are keeping pace, but not reducing the historical backlog.";
  }

  return {
    backlogPosts,
    backlogUnits,
    completedPerDay,
    newPostsPerDay: postsPerDay,
    newBacklinkUnitsPerDay: newUnitsPerDay,
    netBacklinkUnitsPerDay: net,
    estimatedCatchUpDays,
    reason,
    windowDays,
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
