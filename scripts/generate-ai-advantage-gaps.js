#!/usr/bin/env node
/**
 * generate-ai-advantage-gaps.js
 *
 * Generates the next wave of AI Advantage gap posts targeting:
 * - Discount/coupon commercial intent
 * - Trust/scam queries
 * - Post-purchase / member searches
 * - Affiliate program angle
 * - Professional niche verticals
 * - Cross-competitor comparisons
 *
 * All posts are saved as drafts and added to drip-queue.json with
 * niche "ai-advantage-campaign" so Slots B+C pick them up automatically.
 *
 * Usage:
 *   node scripts/generate-ai-advantage-gaps.js          # generate all
 *   node scripts/generate-ai-advantage-gaps.js --dry-run # list only, no API calls
 *   node scripts/generate-ai-advantage-gaps.js --start 5 # start from index 5 (resume)
 */

import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { slugify } from "./lib/utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = path.resolve(__dirname, "..");

const DRY_RUN    = process.argv.includes("--dry-run");
const START_IDX  = Number(process.argv.find(a => a.startsWith("--start="))?.split("=")[1] ?? 0);
const DRAFTS_DIR = path.join(ROOT, "static", "blog", "boom", "drafts");
const QUEUE_FILE = path.join(ROOT, "static", "_data", "drip-queue.json");
const RANT_FILE  = path.join(ROOT, "tmp", "ai-advantage-hub.txt");

const POSTS = [
  // ── High commercial intent ─────────────────────────────────────────────
  {
    keyword: "ai advantage discount coupon code 2026",
    title:   "AI Advantage Discount and Coupon Codes: What Deals Actually Exist",
    topic:   "Does an AI Advantage coupon or discount code exist in 2026, and is waiting for a deal actually worth it?",
  },
  {
    keyword: "ai advantage bootcamp bonuses what comes with it",
    title:   "AI Advantage Bootcamp Bonuses: What's Actually Included Beyond the Core Program",
    topic:   "Honest breakdown of every bonus included with the AI Advantage Bootcamp purchase in 2026.",
  },
  {
    keyword: "ai advantage webinar replay 2026 free",
    title:   "AI Advantage Webinar Replay 2026: Where to Watch It and What You're Really Getting Into",
    topic:   "Where to find the AI Advantage webinar replay, what it covers, and what the replay is actually designed to do.",
  },

  // ── Trust / scam queries ───────────────────────────────────────────────
  {
    keyword: "dean graziosi scam or legit",
    title:   "Dean Graziosi Scam: Looking at the Evidence Honestly",
    topic:   "The dean graziosi scam question answered with actual evidence — complaints, legal history, and what critics get right vs wrong.",
  },
  {
    keyword: "tony robbins scam 2026",
    title:   "Tony Robbins Scam Accusations in 2026: What's Actually Being Said",
    topic:   "Tony Robbins has faced scam accusations for years. Here's what the 2026 version looks like with the AI Advantage program in the mix.",
  },
  {
    keyword: "is dean graziosi legit",
    title:   "Is Dean Graziosi Legit? A Clear-Eyed Look at His Track Record",
    topic:   "Answering the is dean graziosi legit question without hype or hate — just looking at his actual business history and what past customers say.",
  },
  {
    keyword: "dean graziosi controversy what critics say",
    title:   "Dean Graziosi Controversy: What the Critics Actually Say and What to Make of It",
    topic:   "The real controversy around Dean Graziosi — complaints, lawsuits, marketing tactics — analyzed without tribalism.",
  },

  // ── Post-purchase / member searches ───────────────────────────────────
  {
    keyword: "ai advantage bootcamp week by week curriculum breakdown",
    title:   "AI Advantage Bootcamp Week by Week: What Actually Happens in Each of the 6 Weeks",
    topic:   "A complete week-by-week breakdown of the AI Advantage Bootcamp curriculum — what each module covers and what you actually walk away with.",
  },
  {
    keyword: "ai advantage members area login portal access",
    title:   "AI Advantage Login and Members Area: What You're Getting Access To",
    topic:   "How the AI Advantage members area works, what you can access after purchase, and what the portal experience is actually like.",
  },
  {
    keyword: "ai advantage bootcamp completion certificate",
    title:   "AI Advantage Certificate: What You Actually Get When You Finish the Bootcamp",
    topic:   "Does the AI Advantage Bootcamp give you a certificate, and is it worth anything? Honest take on what completion means.",
  },

  // ── Affiliate angle ────────────────────────────────────────────────────
  {
    keyword: "ai advantage affiliate program commission rate",
    title:   "AI Advantage Affiliate Program: How It Works and What You'd Actually Earn",
    topic:   "Everything about the AI Advantage affiliate program — commission structure, how to join, and whether it's worth promoting.",
  },
  {
    keyword: "how to promote ai advantage bootcamp as affiliate",
    title:   "How to Promote the AI Advantage Bootcamp as an Affiliate (And Whether You Should)",
    topic:   "Practical guide for affiliates considering the AI Advantage program — strategy, compliance, and the ethical questions worth asking.",
  },

  // ── Professional niche verticals ───────────────────────────────────────
  {
    keyword: "ai advantage bootcamp for realtors real estate agents",
    title:   "AI Advantage for Realtors: Is the Bootcamp Worth It for Real Estate Professionals",
    topic:   "What real estate agents and realtors would actually get from the AI Advantage Bootcamp — the relevant parts, the gaps, and whether it's worth $995.",
  },
  {
    keyword: "ai advantage bootcamp for coaches consultants",
    title:   "AI Advantage for Coaches: What Business Coaches Actually Get from the Bootcamp",
    topic:   "Honest take on whether the AI Advantage Bootcamp delivers for business coaches and consultants specifically.",
  },
  {
    keyword: "ai advantage bootcamp for freelancers independent contractors",
    title:   "AI Advantage for Freelancers: Does the Bootcamp Actually Help You Get More Clients",
    topic:   "What freelancers specifically would use from the AI Advantage Bootcamp — and what tools they could get free instead.",
  },
  {
    keyword: "ai advantage for course creators online educators",
    title:   "AI Advantage for Course Creators: A Practical Look at What You'd Actually Learn",
    topic:   "For course creators and online educators already building digital products — does the AI Advantage Bootcamp add anything new?",
  },
  {
    keyword: "ai advantage bootcamp for authors writers content creators",
    title:   "AI Advantage for Authors and Writers: What the Bootcamp Teaches That's Actually Useful",
    topic:   "A writer's perspective on the AI Advantage Bootcamp — which parts apply to authors and content creators, which parts are fluff.",
  },

  // ── Cross-competitor comparisons ───────────────────────────────────────
  {
    keyword: "ai advantage vs brendon burchard high performance academy",
    title:   "AI Advantage vs Brendon Burchard: Two Very Different Bets on Self-Improvement",
    topic:   "Comparing the AI Advantage Bootcamp to Brendon Burchard's programs — audience, promise, price, and what you actually get from each.",
  },
  {
    keyword: "ai advantage vs russell brunson expert secrets clickfunnels",
    title:   "AI Advantage vs Russell Brunson's Programs: Different Worlds, Different Promises",
    topic:   "How the AI Advantage Bootcamp compares to Russell Brunson's Expert Secrets and ClickFunnels ecosystem for online business builders.",
  },
  {
    keyword: "ai advantage vs amy porterfield digital course academy",
    title:   "AI Advantage vs Amy Porterfield: Which Course Investment Makes More Sense Right Now",
    topic:   "Comparing the AI Advantage Bootcamp to Amy Porterfield's Digital Course Academy — who each is for and which represents a better use of $995.",
  },
  {
    keyword: "ai advantage vs mindvalley quests",
    title:   "AI Advantage vs Mindvalley: Two Philosophies of Personal Development in 2026",
    topic:   "The AI Advantage Bootcamp and Mindvalley appeal to similar audiences with very different approaches — here's what separates them.",
  },
  {
    keyword: "ai advantage vs udemy ai courses free alternatives",
    title:   "AI Advantage vs Udemy AI Courses: Is $995 Actually Better Than Free",
    topic:   "A direct comparison of the AI Advantage Bootcamp vs what you can learn on Udemy for free or cheap — where the value difference actually lives.",
  },
  {
    keyword: "ai advantage bootcamp scam reddit what people say",
    title:   "AI Advantage Bootcamp Scam Reddit: What the No-Filter Crowd Actually Thinks",
    topic:   "What Reddit communities say about the AI Advantage Bootcamp scam question — the real unfiltered takes from people who bought it and people who didn't.",
  },
];

async function addToQueue(slug, title, keyword) {
  let queue;
  try {
    queue = JSON.parse(fs.readFileSync(QUEUE_FILE, "utf8"));
  } catch {
    console.error("Cannot read drip-queue.json");
    return;
  }

  const alreadyQueued = queue.queue.some(q => q.slug === slug);
  const alreadyPublished = (queue.published || []).some(p => (p.slug || p) === slug);
  if (alreadyQueued || alreadyPublished) return;

  queue.queue.push({
    slug,
    title,
    keyword,
    pillar: "AI Advantage Bootcamp ~ Tony Robbins & Dean Graziosi",
    niche:  "ai-advantage-campaign",
    syndication_profile: "campaign-seo",
    syndicate_on_publish: true,
    trigger_feeder_on_publish: true,
  });

  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2), "utf8");
}

async function main() {
  fs.mkdirSync(DRAFTS_DIR, { recursive: true });

  console.log(`\n╔═══════════════════════════════════════════════════════════════╗`);
  console.log(`║  AI Advantage Gap Posts — ${DRY_RUN ? "DRY RUN" : "GENERATING"}                         ║`);
  console.log(`║  ${POSTS.length} posts | niche: ai-advantage-campaign              ║`);
  console.log(`║  Pillar: ai-advantage-bootcamp-review-what-nobody-is-actually  ║`);
  console.log(`║  CTA: /ai-engine/ (AI Exoskeleton)                            ║`);
  console.log(`╚═══════════════════════════════════════════════════════════════╝\n`);

  const results = { ok: [], skipped: [], failed: [] };

  for (let i = START_IDX; i < POSTS.length; i++) {
    const post     = POSTS[i];
    const slug     = slugify(post.title);
    const outFile  = path.join(DRAFTS_DIR, slug + ".html");
    const progress = `[${String(i + 1).padStart(2, "0")} / ${POSTS.length}]`;

    if (fs.existsSync(outFile)) {
      console.log(`${progress} ⏭  SKIP (exists): ${slug}`);
      await addToQueue(slug, post.title, post.keyword);
      results.skipped.push(slug);
      continue;
    }

    console.log(`${progress} ⚙  "${post.title}"`);
    console.log(`        keyword: "${post.keyword}"`);

    if (DRY_RUN) {
      console.log(`        [DRY RUN — would call generate-post.js]\n`);
      results.ok.push(slug);
      continue;
    }

    const args = [
      "scripts/generate-post.js",
      "--lane", "boom",
      "--keyword", post.keyword,
      "--topic", post.topic,
      "--title", post.title,
      "--niche", "ai-advantage-campaign",
      "--draft",
    ];

    if (fs.existsSync(RANT_FILE)) {
      args.push("--rant", RANT_FILE);
    }

    const result = spawnSync("node", args, {
      stdio: "inherit",
      cwd:   ROOT,
      env:   { ...process.env },
    });

    if (result.error || result.status !== 0) {
      console.error(`${progress} ✗  FAILED: ${slug} (exit ${result.status})`);
      results.failed.push(slug);
    } else {
      console.log(`${progress} ✓  Done: ${slug}`);
      await addToQueue(slug, post.title, post.keyword);
      results.ok.push(slug);
    }

    console.log("");
  }

  console.log(`\n${"═".repeat(65)}`);
  console.log(`Generated: ${results.ok.length} | Skipped: ${results.skipped.length} | Failed: ${results.failed.length}`);
  if (results.failed.length) {
    console.log(`Failed slugs:`);
    results.failed.forEach(s => console.log(`  - ${s}`));
  }
  console.log(`\nNext steps:`);
  console.log(`  • Drip slots B+C (noon + 3pm ET) will publish these at 2/day`);
  console.log(`  • Run: node scripts/backfill-ai-advantage-pillar.js to add pillar links to published posts`);
  console.log(`${"═".repeat(65)}\n`);
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
