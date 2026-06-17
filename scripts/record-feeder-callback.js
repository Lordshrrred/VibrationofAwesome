#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const RESULTS_FILE = path.join(ROOT, "static", "_data", "syndication-results.json");
const LOG_FILE = path.join(ROOT, "static", "_data", "syndication-log.json");
const POST_INDEX_FILES = [
  { lane: "boom", file: path.join(ROOT, "static", "_data", "boom-posts.json") },
  { lane: "matt", file: path.join(ROOT, "static", "_data", "matt-posts.json") },
];

const sourceSlug = String(process.env.SOURCE_SLUG || "").trim();
if (!sourceSlug) {
  console.error("Error: SOURCE_SLUG is required.");
  process.exit(1);
}

const feederStatus = String(process.env.FEEDER_STATUS || "success").trim() || "success";
const feederUrl = String(process.env.FEEDER_POST_URL || "").trim() || null;
const sourceUrl = String(process.env.SOURCE_URL || "").trim() || null;
const sourceTitle = String(process.env.SOURCE_TITLE || "").trim() || null;
const sourceLane = String(process.env.SOURCE_LANE || "").trim() || null;
const timestamp = String(process.env.FEEDER_TIMESTAMP || new Date().toISOString()).trim();
const backlinkSourceUrl = String(process.env.BACKLINK_SOURCE_URL || "").trim() || sourceUrl;
const callbackError = String(process.env.FEEDER_ERROR || "").trim() || null;
const backlinkConfirmed = /^(1|true|yes)$/i.test(String(process.env.BACKLINK_CONFIRMED || "").trim());

function loadJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return parsed;
  } catch (_) {
    return fallback;
  }
}

function findSourcePost(slug) {
  for (const entry of POST_INDEX_FILES) {
    const posts = loadJson(entry.file, []);
    if (!Array.isArray(posts)) continue;
    const match = posts.find(post => post.slug === slug);
    if (match) return { ...match, lane: entry.lane };
  }
  return null;
}

function latestLoggedSyndication(slug) {
  const log = loadJson(LOG_FILE, null);
  const entries = Array.isArray(log?.entries) ? log.entries : [];
  const sorted = entries.filter(entry => entry.postSlug === slug && entry.platforms && typeof entry.platforms === "object").sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
  const match = sorted[0];
  if (!match) return {};

  const timestamp = match.timestamp || new Date().toISOString();
  const out = {};
  for (const [key, platform] of Object.entries(match.platforms)) {
    if (!platform || typeof platform !== "object") continue;
    const next = {
      status: platform.success ? "success" : (platform.skipped ? "skipped" : "failed"),
      url: platform.postUrl || null,
      timestamp,
    };
    if (platform.error) next.error = platform.error;
    if (platform.skipped) next.skipped = true;
    out[key] = next;
  }
  return out;
}

const results = loadJson(RESULTS_FILE, []);
const safeResults = Array.isArray(results) ? results : [];
const sourcePost = findSourcePost(sourceSlug);
const idx = safeResults.findIndex(entry => entry.slug === sourceSlug);
const existing = idx >= 0 ? safeResults[idx] : null;
const loggedSyndication = latestLoggedSyndication(sourceSlug);

const feederEntry = {
  ...(existing?.syndication?.feeder || {}),
  status: feederStatus,
  url: feederUrl || existing?.syndication?.feeder?.url || null,
  timestamp,
};

if (backlinkConfirmed) feederEntry.backlink_confirmed = true;
if (backlinkSourceUrl) feederEntry.backlink_source_url = backlinkSourceUrl;
if (callbackError) feederEntry.error = callbackError;
else delete feederEntry.error;

const nextEntry = {
  slug: sourceSlug,
  title: existing?.title || sourceTitle || sourcePost?.title || sourceSlug,
  lane: existing?.lane || sourceLane || sourcePost?.lane || "matt",
  date: existing?.date || (timestamp ? timestamp.slice(0, 10) : new Date().toISOString().slice(0, 10)),
  voa_url: existing?.voa_url || sourceUrl || (sourcePost?.url ? `https://vibrationofawesome.com${sourcePost.url}` : null),
  syndication: {
    ...loggedSyndication,
    ...(existing?.syndication || {}),
    feeder: feederEntry,
  },
};

if (idx >= 0) safeResults[idx] = nextEntry;
else safeResults.unshift(nextEntry);

fs.mkdirSync(path.dirname(RESULTS_FILE), { recursive: true });
fs.writeFileSync(RESULTS_FILE, JSON.stringify(safeResults, null, 2), "utf8");

console.log(`Recorded feeder callback for ${sourceSlug}`);
