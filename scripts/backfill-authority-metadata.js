#!/usr/bin/env node
/**
 * Backfills VOA post metadata needed by the authority engine.
 *
 * Dry run:
 *   node scripts/backfill-authority-metadata.js
 *
 * Write changes:
 *   node scripts/backfill-authority-metadata.js --execute
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import minimist from "minimist";
import { inferCluster, loadTopicClusters } from "./lib/internal-linking.js";

import { pathToFileURL as __voaPathToFileURL } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const argv = minimist(process.argv.slice(2), { boolean: ["execute"] });

const FILES = [
  { rel: "static/_data/boom-posts.json", lane: "boom", author: "Matty BoomBoom", label: "Boom Frequency" },
  { rel: "static/_data/matt-posts.json", lane: "matt", author: "Matt EarthStar", label: "Forest Temple" },
];

const TAG_RULES = [
  { tag: "ai-creator-workflows", patterns: [/\bai\b/i, /chatgpt/i, /claude/i, /gemini/i, /prompt/i, /automation/i] },
  { tag: "focus", patterns: [/focus/i, /attention/i, /scattered/i, /overthinking/i] },
  { tag: "nervous-system-regulation", patterns: [/nervous system/i, /anxiety/i, /overwhelm/i, /burnout/i, /safe in your body/i] },
  { tag: "dopamine", patterns: [/dopamine/i, /scroll/i, /numbing/i, /digital detox/i] },
  { tag: "creativity", patterns: [/creative/i, /artist/i, /music/i, /creator/i] },
  { tag: "purpose", patterns: [/purpose/i, /direction/i, /lost/i, /stuck/i, /path/i] },
  { tag: "self-trust", patterns: [/self.trust/i, /self.betray/i, /authentic/i, /true self/i] },
  { tag: "personal-growth", patterns: [/heal/i, /growth/i, /change your life/i, /survival mode/i, /alignment/i] },
  { tag: "meditation", patterns: [/meditation/i, /breathwork/i, /mindfulness/i, /presence/i] },
  { tag: "art-buying", patterns: [/original art/i, /buy.*art/i, /prints?/i, /wall art/i] },
];

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

function writeJson(rel, value) {
  fs.writeFileSync(path.join(ROOT, rel), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function unique(values) {
  return [...new Set(values.filter(Boolean).map(slugify))];
}

function inferTags(post, cluster, clusterData) {
  const existing = Array.isArray(post.tags) ? post.tags : [];
  const haystack = [post.title, post.slug, post.excerpt, post.keyword, post.niche].filter(Boolean).join(" ");
  const clusterDef = cluster ? clusterData.byKey[cluster] : null;
  const fromRules = TAG_RULES
    .filter(rule => rule.patterns.some(pattern => pattern.test(haystack)))
    .map(rule => rule.tag);
  const fromCluster = clusterDef ? [clusterDef.contentType, ...(clusterDef.relatedNiches || []).slice(0, 1)] : [];
  return unique([...existing, ...fromRules, ...fromCluster]).slice(0, 4);
}

function normalizePost(post, fileMeta, clusterData) {
  const next = { ...post };
  const cluster = inferCluster(next, clusterData);
  let changed = false;

  if (cluster && next.cluster !== cluster) {
    next.cluster = cluster;
    changed = true;
  }
  if (!next.lane) {
    next.lane = fileMeta.lane;
    changed = true;
  }
  if (!next.author) {
    next.author = fileMeta.author;
    changed = true;
  }
  if (!next.contentLane) {
    next.contentLane = fileMeta.label;
    changed = true;
  }

  const tags = inferTags(next, next.cluster, clusterData);
  if (JSON.stringify(next.tags || []) !== JSON.stringify(tags)) {
    next.tags = tags;
    changed = true;
  }

  if (!next.description && next.excerpt) {
    next.description = String(next.excerpt).replace(/\s+/g, " ").trim().slice(0, 155);
    changed = true;
  }

  return { post: next, changed };
}

function main() {
  const clusterData = loadTopicClusters();
  let totalChanged = 0;

  for (const fileMeta of FILES) {
    const posts = readJson(fileMeta.rel);
    const normalized = posts.map(post => normalizePost(post, fileMeta, clusterData));
    const changed = normalized.filter(item => item.changed).length;
    totalChanged += changed;
    console.log(`${fileMeta.rel}: ${changed} of ${posts.length} posts need metadata normalization`);
    if (argv.execute && changed) writeJson(fileMeta.rel, normalized.map(item => item.post));
  }

  if (argv.execute) {
    console.log(`Wrote authority metadata updates (${totalChanged} posts changed).`);
  } else {
    console.log("Dry run only. Add --execute to write changes.");
  }
}

// CLI-only guard: without this, merely `import`-ing this module (from a test,
// another script, or a syntax/load check) executes a real run with real side
// effects. See CLAUDE.md ~ every script with a top-level main() needs this.
const __voaIsCli = process.argv[1] && import.meta.url === __voaPathToFileURL(process.argv[1]).href;
if (__voaIsCli) {
  main();
}
