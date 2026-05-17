#!/usr/bin/env node
/**
 * generate-all-drafts.js ~ Batch-generate all 30 Boom Frequency draft posts
 *
 * Saves every post to static/blog/boom/drafts/
 * Does NOT publish, syndicate, update boom-posts.json, update sitemap,
 * or trigger the feeder. Everything stays in a holding pattern.
 *
 * After generation completes, writes static/_data/drip-queue.json
 * with status "paused" so nothing publishes until Matt flips the switch.
 *
 * Usage:
 *   node scripts/generate-all-drafts.js
 *
 * Resumable: already-generated drafts are skipped automatically.
 */
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getDraftPlan } from "./content-niches.js";
import { slugify } from "./lib/utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = path.resolve(__dirname, "..");

// Draft rotation is sourced from scripts/content-niches.js.
const POSTS = getDraftPlan();

async function main() {
  const draftsDir = path.join(ROOT, "static", "blog", "boom", "drafts");
  const dataDir   = path.join(ROOT, "static", "_data");
  fs.mkdirSync(draftsDir, { recursive: true });
  fs.mkdirSync(dataDir,   { recursive: true });

  const total   = POSTS.length;
  const results = { ok: [], failed: [], skipped: [] };

  console.log(`\n╔═══════════════════════════════════════════════════════╗`);
  console.log(`║  Generating ${total} Boom Frequency drafts ~ paused queue  ║`);
  console.log(`║  No posts will publish until activate-drip.js is run  ║`);
  console.log(`╚═══════════════════════════════════════════════════════╝\n`);

  for (let i = 0; i < POSTS.length; i++) {
    const post     = POSTS[i];
    const slug     = slugify(post.title);
    const outFile  = path.join(draftsDir, slug + ".html");
    const progress = `[${String(i + 1).padStart(2, " ")} / ${total}]`;

    // Skip if draft already exists (resumable)
    if (fs.existsSync(outFile)) {
      console.log(`${progress} ⏭  SKIP (exists): ${slug}`);
      results.skipped.push({ ...post, slug });
      continue;
    }

    console.log(`${progress} ⚙  "${post.title}"`);
    console.log(`        keyword: "${post.keyword}" | pillar: ${post.pillar}`);

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
      timeout: 180_000, // 3 min per post
    });

    if (result.error) {
      console.error(`${progress} ✗ FAILED (spawn): ${result.error.message}\n`);
      results.failed.push({ ...post, slug, error: result.error.message });
    } else if (result.status !== 0) {
      console.error(`${progress} ✗ FAILED (exit ${result.status}): ${slug}\n`);
      results.failed.push({ ...post, slug, error: `exit code ${result.status}` });
    } else {
      console.log(`${progress} ✓ Done: ${slug}\n`);
      results.ok.push({ ...post, slug });
    }

    // Brief pause between Claude API calls to avoid rate-limit bursts
    if (i < POSTS.length - 1) {
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  // ── Write drip-queue.json ─────────────────────────────────────────────────
  const queue = POSTS.map(post => ({
    slug:    slugify(post.title),
    title:   post.title,
    keyword: post.keyword,
    niche:   post.niche,
    pillar:  post.pillar,
  }));

  const dripQueue = {
    status:                    "paused",
    drip_rate:                 2,
    drip_time:                 "10:00 UTC",
    syndicate_on_publish:      false,
    trigger_feeder_on_publish: false,
    queue,
    published: [],
  };

  const queuePath = path.join(dataDir, "drip-queue.json");
  fs.writeFileSync(queuePath, JSON.stringify(dripQueue, null, 2), "utf8");
  console.log(`\ndrip-queue.json written → status: paused, ${queue.length} posts queued`);

  // ── Summary ───────────────────────────────────────────────────────────────
  const totalDone = results.ok.length + results.skipped.length;
  console.log(`\n╔═══════════════════════════════════════════════════════╗`);
  console.log(`║  BATCH COMPLETE                                       ║`);
  console.log(`╚═══════════════════════════════════════════════════════╝`);
  console.log(`  ✓ Generated: ${results.ok.length}`);
  console.log(`  ⏭  Skipped:  ${results.skipped.length}  (already existed)`);
  console.log(`  ✗ Failed:   ${results.failed.length}`);
  if (results.failed.length > 0) {
    console.log(`\n  Failed slugs:`);
    results.failed.forEach(f => console.log(`    - ${f.slug}: ${f.error}`));
    console.log(`\n  Re-run to retry failed posts (existing drafts are skipped).`);
  }
  console.log(`\n  Drafts: static/blog/boom/drafts/     (${totalDone} files)`);
  console.log(`  Queue:  static/_data/drip-queue.json  (status: paused)`);
  console.log(`\n  Nothing is published. To start the drip:`);
  console.log(`    node scripts/activate-drip.js`);
  console.log(`    node scripts/activate-drip.js --syndicate --feeder\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
