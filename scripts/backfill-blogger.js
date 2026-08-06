#!/usr/bin/env node
/**
 * Backfill a focused set of VOA posts to Blogger.
 *
 * Dry run:
 *   node scripts/backfill-blogger.js
 *
 * Publish missing Blogger entries:
 *   node scripts/backfill-blogger.js --execute
 *
 * Repost even when Blogger already has success recorded:
 *   node scripts/backfill-blogger.js --execute --force
 */

import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import minimist from "minimist";
import { syndicatePost } from "./syndicate.js";

import { pathToFileURL as __voaPathToFileURL } from "node:url";
dotenv.config({ override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const RESULTS_FILE = path.join(ROOT, "static", "_data", "syndication-results.json");

const TARGETS = [
  { lane: "boom", slug: "ai-advantage-summit-review" },
  { lane: "boom", slug: "how-to-reinvent-yourself-the-radical-truth-about-identity-shifts-nobody-talks-about" },
  { lane: "boom", slug: "why-i-feel-stuck-in-life-the-truth-nobody-tells-you-about-being-lost" },
  { lane: "boom", slug: "how-to-use-claude-api-for-musicians" },
  { lane: "matt", slug: "paradigm-of-abundance" },
];

function loadResults() {
  try {
    const data = JSON.parse(fs.readFileSync(RESULTS_FILE, "utf8"));
    return Array.isArray(data) ? data : [];
  } catch (_) {
    return [];
  }
}

function bloggerStatus(results, slug) {
  return results.find(row => row.slug === slug)?.syndication?.blogger || null;
}

async function main() {
  const argv = minimist(process.argv.slice(2), {
    boolean: ["execute", "force"],
  });
  const execute = Boolean(argv.execute);
  const force = Boolean(argv.force);
  const results = loadResults();

  console.log("\nBlogger backfill plan");
  console.log("====================");
  console.log(`Mode: ${execute ? "execute" : "dry run"}${force ? " + force" : ""}`);
  console.log();

  const queue = [];
  for (const target of TARGETS) {
    const current = bloggerStatus(results, target.slug);
    const hasSuccess = current?.status === "success" && current?.url;
    const action = hasSuccess && !force ? "skip" : "publish";
    console.log(`${action.toUpperCase().padEnd(7)} ${target.lane}/${target.slug}${current?.url ? ` -> ${current.url}` : ""}`);
    if (action === "publish") queue.push(target);
  }

  if (!execute) {
    console.log("\nDry run only. Add --execute to publish missing Blogger posts.");
    console.log("Add --force only if you intentionally want fresh duplicate Blogger companion posts.");
    return;
  }

  for (const target of queue) {
    console.log(`\nPublishing Blogger backfill: ${target.lane}/${target.slug}`);
    await syndicatePost(target.lane, target.slug, {
      platforms: ["blogger"],
    });
  }

  console.log("\nBlogger backfill complete.");
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
