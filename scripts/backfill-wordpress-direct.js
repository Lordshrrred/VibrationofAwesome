#!/usr/bin/env node

import dotenv from "dotenv";
import fs from "fs";
import minimist from "minimist";
import path from "path";
import { fileURLToPath } from "url";

import { syndicatePost } from "./syndicate.js";

import { pathToFileURL as __voaPathToFileURL } from "node:url";
dotenv.config({ override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const RESULTS_FILE = path.join(ROOT, "static", "_data", "syndication-results.json");
const MATT_FILE = path.join(ROOT, "static", "_data", "matt-posts.json");
const BOOM_FILE = path.join(ROOT, "static", "_data", "boom-posts.json");

function loadResults() {
  try {
    const raw = JSON.parse(fs.readFileSync(RESULTS_FILE, "utf8"));
    return Array.isArray(raw) ? raw : [];
  } catch (_) {
    return [];
  }
}

function loadPosts(file, lane) {
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!Array.isArray(raw)) return [];
    return raw
      .map(post => ({
        lane,
        slug: post.slug,
        title: post.title,
      }))
      .filter(post => post.slug && post.title);
  } catch (_) {
    return [];
  }
}

function toQueueEntries(results, options) {
  const resultMap = new Map(results.map(entry => [`${entry.lane}:${entry.slug}`, entry]));
  const allPosts = [
    ...loadPosts(MATT_FILE, "matt"),
    ...loadPosts(BOOM_FILE, "boom"),
  ];

  return allPosts
    .filter(entry => !options.lane || entry.lane === options.lane)
    .filter(entry => !options.slug || entry.slug === options.slug)
    .filter(entry => {
      if (options.force) return true;
      return resultMap.get(`${entry.lane}:${entry.slug}`)?.syndication?.wordpress_earthstar?.status !== "success";
    })
    .slice(0, options.limit || Number.MAX_SAFE_INTEGER)
    .map(entry => ({ lane: entry.lane, slug: entry.slug, title: entry.title }));
}

async function main() {
  const argv = minimist(process.argv.slice(2), {
    string: ["lane", "slug"],
    boolean: ["force"],
    default: { limit: 0 },
  });

  const limit = Number(argv.limit || 0);
  const queue = toQueueEntries(loadResults(), {
    lane: argv.lane || null,
    slug: argv.slug || null,
    force: Boolean(argv.force),
    limit: Number.isFinite(limit) && limit > 0 ? limit : null,
  });

  if (queue.length === 0) {
    console.log("No direct WordPress backlog items found.");
    return;
  }

  console.log(`Backfilling direct WordPress syndication for ${queue.length} post(s)...`);
  for (const item of queue) {
    console.log(`\n→ ${item.lane}/${item.slug} :: ${item.title}`);
    await syndicatePost(item.lane, item.slug, {
      platforms: ["wordpress_earthstar"],
    });
  }

  console.log("\nDirect WordPress backlog complete.");
}

// CLI-only guard: without this, merely `import`-ing this module (from a test,
// another script, or a syntax/load check) executes a real run with real side
// effects. See CLAUDE.md ~ every script with a top-level main() needs this.
const __voaIsCli = process.argv[1] && import.meta.url === __voaPathToFileURL(process.argv[1]).href;
if (__voaIsCli) {
  main().catch(err => {
    console.error("Fatal:", err.message);
    process.exit(1);
  });
}
