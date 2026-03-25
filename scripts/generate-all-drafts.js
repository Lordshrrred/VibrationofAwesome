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

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = path.resolve(__dirname, "..");

// Same slugify logic as generate-post.js — keep in sync
function slugify(str) {
  return str.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// ── 30 posts across 5 pillars (pillar order = drip rotation order) ─────────
const POSTS = [
  // ── PILLAR 1 ~ Identity + Awakening ──────────────────────────────────────
  {
    keyword: "why I feel stuck in life",
    topic:   "Identity + Awakening",
    title:   "Why You Feel Stuck in Life (And What's Actually Going On)",
    pillar:  "Identity + Awakening",
  },
  {
    keyword: "how to unlock your potential",
    topic:   "Identity + Awakening",
    title:   "How to Unlock Your Potential When Nothing Seems to Work",
    pillar:  "Identity + Awakening",
  },
  {
    keyword: "how to become your true self",
    topic:   "Identity + Awakening",
    title:   "How to Become Your True Self When the World Wants You Generic",
    pillar:  "Identity + Awakening",
  },
  {
    keyword: "identity shift mindset",
    topic:   "Identity + Awakening",
    title:   "The Identity Shift That Changes Everything",
    pillar:  "Identity + Awakening",
  },
  {
    keyword: "how to find your purpose in life",
    topic:   "Identity + Awakening",
    title:   "How to Find Your Purpose When You Have No Idea What It Is",
    pillar:  "Identity + Awakening",
  },
  {
    keyword: "how to stop living in survival mode",
    topic:   "Identity + Awakening",
    title:   "How to Stop Living in Survival Mode for Good",
    pillar:  "Identity + Awakening",
  },

  // ── PILLAR 2 ~ Survival Mode + Freedom ───────────────────────────────────
  {
    keyword: "how to get out of survival mode",
    topic:   "Survival Mode + Freedom",
    title:   "How to Get Out of Survival Mode and Actually Start Living",
    pillar:  "Survival Mode + Freedom",
  },
  {
    keyword: "how to stop feeling lost in life",
    topic:   "Survival Mode + Freedom",
    title:   "How to Stop Feeling Lost and Start Moving Forward",
    pillar:  "Survival Mode + Freedom",
  },
  {
    keyword: "how to escape the 9 to 5 mindset",
    topic:   "Survival Mode + Freedom",
    title:   "How to Escape the 9 to 5 Mindset Even If You Still Have a Job",
    pillar:  "Survival Mode + Freedom",
  },
  {
    keyword: "burnout and purpose",
    topic:   "Survival Mode + Freedom",
    title:   "Burnout Isn't the Problem ~ It's the Signal",
    pillar:  "Survival Mode + Freedom",
  },
  {
    keyword: "how to change your life completely",
    topic:   "Survival Mode + Freedom",
    title:   "How to Change Your Life Completely When You Don't Know Where to Begin",
    pillar:  "Survival Mode + Freedom",
  },
  {
    keyword: "how to break out of the system",
    topic:   "Survival Mode + Freedom",
    title:   "How to Break Out of the System Without Losing Everything",
    pillar:  "Survival Mode + Freedom",
  },

  // ── PILLAR 3 ~ Creative Freedom + Life Design ─────────────────────────────
  {
    keyword: "how to build a life you actually want",
    topic:   "Creative Freedom + Life Design",
    title:   "How to Build a Life You Actually Want (Not the One You Settled For)",
    pillar:  "Creative Freedom + Life Design",
  },
  {
    keyword: "how to monetize creativity",
    topic:   "Creative Freedom + Life Design",
    title:   "How to Monetize Your Creativity Without Selling Your Soul",
    pillar:  "Creative Freedom + Life Design",
  },
  {
    keyword: "how to make money doing what you love",
    topic:   "Creative Freedom + Life Design",
    title:   "How to Make Money Doing What You Love ~ The Real Version",
    pillar:  "Creative Freedom + Life Design",
  },
  {
    keyword: "multiple streams of income beginner",
    topic:   "Creative Freedom + Life Design",
    title:   "Multiple Streams of Income for Beginners ~ Where to Actually Start",
    pillar:  "Creative Freedom + Life Design",
  },
  {
    keyword: "how to create a freedom lifestyle",
    topic:   "Creative Freedom + Life Design",
    title:   "How to Create a Freedom Lifestyle From Scratch",
    pillar:  "Creative Freedom + Life Design",
  },
  {
    keyword: "passive income ideas for beginners",
    topic:   "Creative Freedom + Life Design",
    title:   "Passive Income Ideas for Beginners That Don't Require Being Fake",
    pillar:  "Creative Freedom + Life Design",
  },

  // ── PILLAR 4 ~ Inner Work + Energy ───────────────────────────────────────
  {
    keyword: "shadow work for beginners",
    topic:   "Inner Work + Energy",
    title:   "Shadow Work for Beginners ~ What It Actually Is and Why It Matters",
    pillar:  "Inner Work + Energy",
  },
  {
    keyword: "how to regulate your nervous system",
    topic:   "Inner Work + Energy",
    title:   "How to Regulate Your Nervous System When Life Feels Like Too Much",
    pillar:  "Inner Work + Energy",
  },
  {
    keyword: "how to heal emotionally",
    topic:   "Inner Work + Energy",
    title:   "How to Heal Emotionally When You Don't Know Where to Start",
    pillar:  "Inner Work + Energy",
  },
  {
    keyword: "nervous system regulation anxiety",
    topic:   "Inner Work + Energy",
    title:   "Nervous System Regulation for Anxiety ~ What Actually Helps",
    pillar:  "Inner Work + Energy",
  },
  {
    keyword: "how to feel safe in your body",
    topic:   "Inner Work + Energy",
    title:   "How to Feel Safe in Your Body Again",
    pillar:  "Inner Work + Energy",
  },
  {
    keyword: "why am I always anxious for no reason",
    topic:   "Inner Work + Energy",
    title:   "Why You're Always Anxious for No Reason (There's Always a Reason)",
    pillar:  "Inner Work + Energy",
  },

  // ── PILLAR 5 ~ AI + Music + Creator Tools ─────────────────────────────────
  {
    keyword: "AI tools for musicians",
    topic:   "AI + Music + Creator Tools",
    title:   "The Best AI Tools for Musicians in 2026 (That Actually Work)",
    pillar:  "AI + Music + Creator Tools",
  },
  {
    keyword: "how to use AI to make music",
    topic:   "AI + Music + Creator Tools",
    title:   "How to Use AI to Make Music Without Losing Your Sound",
    pillar:  "AI + Music + Creator Tools",
  },
  {
    keyword: "music production for beginners",
    topic:   "AI + Music + Creator Tools",
    title:   "Music Production for Beginners ~ Where to Start Without Getting Lost",
    pillar:  "AI + Music + Creator Tools",
  },
  {
    keyword: "how to grow as an independent artist",
    topic:   "AI + Music + Creator Tools",
    title:   "How to Grow as an Independent Artist in a Noisy World",
    pillar:  "AI + Music + Creator Tools",
  },
  {
    keyword: "AI content creation tools",
    topic:   "AI + Music + Creator Tools",
    title:   "AI Content Creation Tools That Actually Save Time",
    pillar:  "AI + Music + Creator Tools",
  },
  {
    keyword: "how to make money as a musician",
    topic:   "AI + Music + Creator Tools",
    title:   "How to Make Money as a Musician Without Compromising Your Art",
    pillar:  "AI + Music + Creator Tools",
  },
];

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
