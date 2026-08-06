#!/usr/bin/env node
/**
 * generate-campaign-batch.js ~ Generate posts for a single niche and append to live queue
 *
 * Unlike generate-all-drafts.js, this script:
 *   - Only generates posts for the specified --niche
 *   - APPENDS to the existing drip-queue.json (does not overwrite or pause it)
 *   - Preserves existing queue items and published history
 *   - Skips posts whose draft HTML already exists
 *
 * Usage:
 *   node scripts/generate-campaign-batch.js --niche ai-advantage-campaign
 *   node scripts/generate-campaign-batch.js --niche art-buyer-intent
 *   node scripts/generate-campaign-batch.js --niche ai-advantage-campaign --dry-run
 */
import { spawnSync } from "child_process";
import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";
import minimist from "minimist";
import { EARTHSTAR_NICHES } from "./content-niches.js";
import { slugify } from "./lib/utils.js";

import { pathToFileURL as __voaPathToFileURL } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = path.resolve(__dirname, "..");

const argv = minimist(process.argv.slice(2), {
  string:  ["niche"],
  boolean: ["dry-run"],
});

if (!argv.niche) {
  console.error("Usage: node scripts/generate-campaign-batch.js --niche <slug>");
  console.error("Available niches:", EARTHSTAR_NICHES.map(n => n.slug).join(", "));
  process.exit(1);
}

const niche = EARTHSTAR_NICHES.find(n => n.slug === argv.niche);
if (!niche) {
  console.error(`Unknown niche: "${argv.niche}"`);
  console.error("Available:", EARTHSTAR_NICHES.map(n => n.slug).join(", "));
  process.exit(1);
}

const DRAFTS_DIR  = path.join(ROOT, "static", "blog", "boom", "drafts");
const QUEUE_FILE  = path.join(ROOT, "static", "_data", "drip-queue.json");

async function main() {
  const posts = niche.exampleArticleTopics.map((title, i) => ({
    niche:   niche.slug,
    pillar:  niche.displayName,
    title,
    keyword: niche.keywordSeedPhrases[i] || niche.keywordSeedPhrases[0],
    topic:   niche.displayName,
  }));

  console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
  console.log(`║  Campaign batch: ${niche.displayName.padEnd(44)}║`);
  console.log(`║  Posts to generate: ${String(posts.length).padEnd(41)}║`);
  if (argv["dry-run"]) {
  console.log(`║  DRY RUN ~ no files will be written                          ║`);
  }
  console.log(`╚══════════════════════════════════════════════════════════════╝\n`);

  const results = { ok: [], failed: [], skipped: [] };

  for (let i = 0; i < posts.length; i++) {
    const post     = posts[i];
    const slug     = slugify(post.title);
    const outFile  = path.join(DRAFTS_DIR, slug + ".html");
    const progress = `[${String(i + 1).padStart(2, " ")} / ${posts.length}]`;

    if (fs.existsSync(outFile)) {
      console.log(`${progress} ⏭  Skipped (exists): ${slug}`);
      results.skipped.push({ ...post, slug });
      continue;
    }

    console.log(`${progress} ⚙  "${post.title}"`);
    console.log(`        keyword: "${post.keyword}"`);

    if (argv["dry-run"]) {
      console.log(`${progress} [dry-run] would generate: ${slug}`);
      results.ok.push({ ...post, slug });
      continue;
    }

    const result = spawnSync("node", [
      "scripts/generate-post.js",
      "--lane",    "boom",
      "--niche",   post.niche,
      "--keyword", post.keyword,
      "--topic",   post.topic,
      "--title",   post.title,
      "--draft",
      "--skip-syndicate",
    ], {
      stdio:   "inherit",
      cwd:     ROOT,
      timeout: 180_000,
    });

    if (result.error) {
      console.error(`${progress} ✗ FAILED: ${result.error.message}`);
      results.failed.push({ ...post, slug, error: result.error.message });
    } else if (result.status !== 0) {
      console.error(`${progress} ✗ FAILED (exit ${result.status})`);
      results.failed.push({ ...post, slug, error: `exit code ${result.status}` });
    } else {
      console.log(`${progress} ✓ Done: ${slug}\n`);
      results.ok.push({ ...post, slug });
    }

    if (i < posts.length - 1) {
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  // ── Append new posts to the live drip queue ──────────────────────────────
  if (!argv["dry-run"]) {
    let queue = { status: "active", drip_rate: 1, queue: [], published: [] };
    if (fs.existsSync(QUEUE_FILE)) {
      try { queue = JSON.parse(fs.readFileSync(QUEUE_FILE, "utf8")); } catch (_) {}
    }

    const existingSlugs = new Set([
      ...(queue.queue     || []).map(p => p.slug),
      ...(queue.published || []).map(p => p.slug),
    ]);

    const newEntries = [...results.ok, ...results.skipped]
      .filter(p => !existingSlugs.has(p.slug))
      .map(p => ({
        slug:    p.slug,
        title:   p.title,
        keyword: p.keyword,
        niche:   p.niche,
        pillar:  p.pillar,
      }));

    if (newEntries.length > 0) {
      queue.queue = [...(queue.queue || []), ...newEntries];
      fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2), "utf8");
      console.log(`\n✓ Appended ${newEntries.length} post(s) to drip queue (status: ${queue.status})`);
    } else {
      console.log(`\n~ All posts already in queue, nothing appended.`);
    }
  }

  console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
  console.log(`║  BATCH COMPLETE                                              ║`);
  console.log(`╚══════════════════════════════════════════════════════════════╝`);
  console.log(`  ✓ Generated: ${results.ok.length}`);
  console.log(`  ⏭  Skipped:  ${results.skipped.length}  (already existed)`);
  console.log(`  ✗ Failed:   ${results.failed.length}`);
  if (results.failed.length > 0) {
    console.log(`\n  Failed slugs:`);
    results.failed.forEach(f => console.log(`    ~ ${f.slug}: ${f.error}`));
    console.log(`\n  Re-run to retry (existing drafts are skipped).`);
  }
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
