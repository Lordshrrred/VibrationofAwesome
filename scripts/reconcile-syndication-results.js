#!/usr/bin/env node
/**
 * reconcile-syndication-results.js
 *
 * Keeps syndication-results.json in sync with syndication-log.json.
 * Run after every syndication pass to prevent the matrix from drifting.
 *
 * For each log entry, if the matching results entry has fewer platform keys
 * than the log (allowing for skipped/ESR entries), the results entry gets
 * backfilled from the log. Feeder-specific fields (backlink_confirmed, etc.)
 * are preserved from the existing results entry.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RESULTS_FILE = path.join(ROOT, "static/_data/syndication-results.json");
const LOG_FILE     = path.join(ROOT, "static/_data/syndication-log.json");

function load(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (_) { return fallback; }
}

const log     = load(LOG_FILE, {});
const entries = Array.isArray(log?.entries) ? log.entries : [];
const rawResults = load(RESULTS_FILE, []);
const results = Array.isArray(rawResults) ? rawResults : [];

// Build per-slug newest log entry map
const bySlug = new Map();
for (const entry of entries) {
  const slug = entry.postSlug || entry.slug;
  if (!slug || !entry.platforms || typeof entry.platforms !== "object") continue;
  const existing = bySlug.get(slug);
  if (!existing || new Date(entry.timestamp) > new Date(existing.timestamp)) {
    bySlug.set(slug, entry);
  }
}

let patched = 0;
for (const [slug, logEntry] of bySlug) {
  const idx = results.findIndex(r => r.slug === slug);
  const existing = idx >= 0 ? results[idx] : null;

  // Build syndication map from log entry
  const logSyndication = {};
  for (const [key, p] of Object.entries(logEntry.platforms)) {
    logSyndication[key] = {
      status:    p.success ? "success" : (p.skipped ? "skipped" : "failed"),
      url:       p.postUrl || null,
      timestamp: logEntry.timestamp,
      ...(p.error   ? { error:   p.error   } : {}),
      ...(p.skipped ? { skipped: p.skipped } : {}),
    };
  }

  const existingCount = Object.keys(existing?.syndication || {}).length;
  const logCount      = Object.keys(logSyndication).length;

  // Skip if results already has as many or more platforms (feeder additions are fine)
  // Only patch when results is missing substantial platform data (>2 missing)
  if (existingCount >= logCount - 2) continue;

  const merged = {
    ...logSyndication,
    ...(existing?.syndication || {}),  // preserves feeder backlink_confirmed etc.
  };

  if (idx >= 0) {
    results[idx] = { ...results[idx], syndication: merged };
  } else {
    results.unshift({
      slug,
      title:   logEntry.postTitle || slug,
      lane:    logEntry.lane || "boom",
      date:    logEntry.timestamp.slice(0, 10),
      voa_url: logEntry.postUrl || null,
      syndication: merged,
    });
  }
  patched++;
}

if (patched > 0) {
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2), "utf8");
  console.log(`reconcile-syndication-results: patched ${patched} entries`);
} else {
  console.log("reconcile-syndication-results: already in sync");
}
