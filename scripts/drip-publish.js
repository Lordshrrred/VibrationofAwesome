#!/usr/bin/env node
/**
 * drip-publish.js ~ Publish next N posts from the Boom Frequency drip queue
 *
 * Called automatically by .github/workflows/drip-posts.yml on the daily schedule.
 * Can also be called manually to publish a specific slug right now.
 *
 * What it does:
 *   1. Reads drip-queue.json ~ exits immediately if status is "paused"
 *   2. Takes the next drip_rate slugs from the queue
 *   3. Copies each draft from static/blog/boom/drafts/ to static/blog/boom/posts/
 *   4. Adds each to boom-posts.json with the publish timestamp
 *   5. Regenerates sitemap.xml
 *   6. If trigger_feeder_on_publish: fires GitHub repository_dispatch to feeder repo
 *   7. If syndicate_on_publish: runs syndicate.js for each post
 *   8. Updates drip-queue.json (moves slugs from queue → published)
 *
 * Usage:
 *   node scripts/drip-publish.js                  ~ publish next drip_rate posts
 *   node scripts/drip-publish.js --slug <slug>    ~ publish one specific draft
 *   node scripts/drip-publish.js --dry-run        ~ preview only, no changes
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import minimist from "minimist";
import dotenv from "dotenv";
import { updateSitemap } from "./update-sitemap.js";

dotenv.config({ override: true });
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = path.resolve(__dirname, "..");

const argv = minimist(process.argv.slice(2), {
  string:  ["slug"],
  boolean: ["dry-run"],
});

// ── PUBLISH RATE CONFIG ────────────────────────────────────────────────────────
// Phase One: 2 posts/day via cron in drip-posts.yml (9am ET + 6pm ET UTC)
// Each cron run publishes drip_rate posts (currently 1, set in drip-queue.json)
//
// To scale to 3/day: add a 3rd cron '0 18 * * *' to drip-posts.yml
// To scale to 4/day: add a 4th cron '0 2  * * *' to drip-posts.yml
// To publish more per run: increase drip_rate in static/_data/drip-queue.json
// ──────────────────────────────────────────────────────────────────────────────

const QUEUE_FILE  = path.join(ROOT, "static", "_data", "drip-queue.json");
const DRAFTS_DIR  = path.join(ROOT, "static", "blog", "boom", "drafts");
const POSTS_DIR   = path.join(ROOT, "static", "blog", "boom", "posts");
const DATA_FILE   = path.join(ROOT, "static", "_data", "boom-posts.json");
const LOCK_FILE   = path.join(ROOT, "static", "_data", "drip-publish.lock");
const HEALTH_FILE = path.join(ROOT, "static", "_data", "syndication-health.json");
const LOCK_TTL_MS = 10 * 60 * 1000; // 10 minutes
const QUEUE_WARN_THRESHOLD = 30;     // warn when fewer than this many drafts remain

// Extract first paragraph text from rendered HTML for the excerpt
function extractExcerptFromHtml(html) {
  const match = html.match(/<p[^>]*>([\s\S]*?)<\/p>/);
  if (!match) return "";
  return match[1].replace(/<[^>]+>/g, "").trim().slice(0, 150);
}

function extractSourceTextFromHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 700)
    .join(" ");
}

async function main() {
  // ── Lock file ~ prevent concurrent execution ─────────────────────────────
  // GitHub Actions concurrency group handles workflow-level protection.
  // This lock handles the rare case of local multi-invocation.
  if (fs.existsSync(LOCK_FILE)) {
    const lockAge = Date.now() - new Date(fs.readFileSync(LOCK_FILE, "utf8").trim()).getTime();
    if (lockAge < LOCK_TTL_MS) {
      console.log(`[lock] Another drip-publish is running (lock age: ${Math.round(lockAge / 1000)}s). Exiting safely.`);
      process.exit(0);
    }
    console.log(`[lock] Stale lock found (${Math.round(lockAge / 1000)}s old). Proceeding.`);
  }
  fs.mkdirSync(path.dirname(LOCK_FILE), { recursive: true });
  fs.writeFileSync(LOCK_FILE, new Date().toISOString(), "utf8");
  const releaseLock = () => { try { fs.unlinkSync(LOCK_FILE); } catch (_) {} };
  process.on("exit",   releaseLock);
  process.on("SIGINT", () => { releaseLock(); process.exit(1); });

  // ── Read queue ──────────────────────────────────────────────────────────
  if (!fs.existsSync(QUEUE_FILE)) {
    console.error("Error: drip-queue.json not found.");
    console.error("Run: node scripts/generate-all-drafts.js first.");
    process.exit(1);
  }

  let queue;
  try {
    queue = JSON.parse(fs.readFileSync(QUEUE_FILE, "utf8"));
  } catch (err) {
    console.error("Error reading drip-queue.json:", err.message);
    process.exit(1);
  }

  // ── Startup visibility log ───────────────────────────────────────────────
  const queueRemaining = queue.queue.length;
  const dripsPerDay = 2; // two cron runs per day (9am + 6pm ET)
  const daysRemaining = Math.floor(queueRemaining / dripsPerDay);

  console.log("\n╔═ [drip] Drip Publish ~ Phase One ══════════════════");
  console.log(`║  Status:       ${queue.status}`);
  console.log(`║  Queue:        ${queueRemaining} post(s) remaining (~${daysRemaining} day(s) of runway)`);
  console.log(`║  Published:    ${(queue.published || []).length} post(s) total`);
  console.log(`║  Rate:         ${queue.drip_rate || 2} post(s) per run`);
  console.log(`║  Syndicate:    ${queue.syndicate_on_publish}`);
  console.log(`║  Feeder:       ${queue.trigger_feeder_on_publish}`);
  console.log("╚════════════════════════════════════════════════════\n");

  // ── Queue depletion warning ──────────────────────────────────────────────
  if (queueRemaining < QUEUE_WARN_THRESHOLD) {
    console.warn(`\n⚠  [queue] WARNING: Only ${queueRemaining} draft(s) remain in the drip queue.`);
    console.warn(`   At ~${dripsPerDay} posts/day that is roughly ${daysRemaining} day(s) of runway.`);
    console.warn(`   Run: node scripts/generate-all-drafts.js to replenish the queue.\n`);

    // Write depletion warning into health file so dashboard/monitoring can surface it
    try {
      let health = {};
      if (fs.existsSync(HEALTH_FILE)) {
        health = JSON.parse(fs.readFileSync(HEALTH_FILE, "utf8"));
      }
      health.queue_warning = {
        level:        queueRemaining === 0 ? "critical" : "warning",
        queue_remaining: queueRemaining,
        days_remaining:  daysRemaining,
        checked_at:   new Date().toISOString(),
        message:      `Queue has ${queueRemaining} post(s) left (~${daysRemaining} days). Replenish with generate-all-drafts.js.`,
      };
      fs.writeFileSync(HEALTH_FILE, JSON.stringify(health, null, 2), "utf8");
    } catch (_) { /* health file write is best-effort */ }
  }

  // ── Pause check ─────────────────────────────────────────────────────────
  if (queue.status === "paused") {
    console.log("Drip queue is paused ~ exiting.");
    console.log("Run: node scripts/activate-drip.js to start publishing.");
    process.exit(0);
  }

  // ── Determine which posts to publish ────────────────────────────────────
  let toPublish = [];
  if (argv.slug) {
    const item = queue.queue.find(q => q.slug === argv.slug);
    if (!item) {
      console.error(`Slug "${argv.slug}" not found in queue.`);
      console.error("Available slugs:", queue.queue.map(q => q.slug).join(", "));
      process.exit(1);
    }
    toPublish = [item];
  } else {
    const rate = queue.drip_rate || 2;
    toPublish = queue.queue.slice(0, rate);
  }

  if (toPublish.length === 0) {
    console.log("Queue is empty ~ all posts have been published!");
    process.exit(0);
  }

  console.log(`\nDrip publish${argv["dry-run"] ? " [DRY RUN]" : ""} ~ ${toPublish.length} post(s):`);
  toPublish.forEach(p => console.log("  ~ " + p.title));

  if (argv["dry-run"]) {
    console.log("\n[dry-run] No files modified.");
    process.exit(0);
  }

  // ── Publish each post ────────────────────────────────────────────────────
  fs.mkdirSync(POSTS_DIR, { recursive: true });

  let boomPosts = [];
  if (fs.existsSync(DATA_FILE)) {
    try {
      boomPosts = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
      if (!Array.isArray(boomPosts)) boomPosts = [];
    } catch (_) { boomPosts = []; }
  }

  const publishedSlugs = [];

  for (const item of toPublish) {
    const draftFile = path.join(DRAFTS_DIR, item.slug + ".html");
    const postFile  = path.join(POSTS_DIR,  item.slug + ".html");

    if (!fs.existsSync(draftFile)) {
      console.error(`  ✗ Draft not found: ${item.slug}.html ~ skipping`);
      continue;
    }

    // Collision guard ~ never overwrite an already-published post
    if (fs.existsSync(postFile)) {
      console.warn(`  ~ Collision guard: ${item.slug} already exists in posts/. Removing from queue without re-publishing.`);
      publishedSlugs.push(item.slug);
      continue;
    }

    // Copy draft → posts
    const html = fs.readFileSync(draftFile, "utf8");
    fs.writeFileSync(postFile, html, "utf8");
    console.log(`  ✓ Published: /blog/boom/posts/${item.slug}.html`);

    // Add to boom-posts index
    boomPosts.unshift({
      title:   item.title,
      slug:    item.slug,
      date:    new Date().toISOString(),
      excerpt: extractExcerptFromHtml(html),
      url:     "/blog/boom/posts/" + item.slug + ".html",
      tags:    [],
    });

    publishedSlugs.push(item.slug);
  }

  if (publishedSlugs.length === 0) {
    console.error("No posts published (are the drafts missing?).");
    process.exit(1);
  }

  // ── Update boom-posts.json ───────────────────────────────────────────────
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(boomPosts, null, 2), "utf8");
  console.log(`  ✓ boom-posts.json updated (${publishedSlugs.length} added)`);

  // ── Regenerate sitemap ──────────────────────────────────────────────────
  updateSitemap();
  console.log("  ✓ Sitemap regenerated");

  // ── Update drip-queue.json ───────────────────────────────────────────────
  const justPublished = queue.queue
    .filter(q => publishedSlugs.includes(q.slug))
    .map(q => ({ ...q, published_at: new Date().toISOString() }));

  queue.queue     = queue.queue.filter(q => !publishedSlugs.includes(q.slug));
  queue.published = [...(queue.published || []), ...justPublished];

  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2), "utf8");
  console.log(`  ✓ Queue updated: ${queue.queue.length} remaining, ${queue.published.length} published`);

  // ── Feeder trigger ───────────────────────────────────────────────────────
  if (queue.trigger_feeder_on_publish) {
    const token = process.env.VOA_FEEDER_TRIGGER_TOKEN;
    if (!token) {
      console.log("  [feeder] VOA_FEEDER_TRIGGER_TOKEN not set ~ skipping");
    } else {
      for (const item of justPublished) {
        const postUrl = "https://vibrationofawesome.com/blog/boom/posts/" + item.slug + ".html";
        const postHtmlPath = path.join(POSTS_DIR, item.slug + ".html");
        const postHtml = fs.existsSync(postHtmlPath) ? fs.readFileSync(postHtmlPath, "utf8") : "";
        try {
          const resp = await fetch(
            "https://api.github.com/repos/Lordshrrred/VOA_Feeder/dispatches",
            {
              method:  "POST",
              headers: {
                Authorization:  `token ${token}`,
                Accept:         "application/vnd.github.v3+json",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                event_type:     "voa-post-published",
                client_payload: {
                  voa_post_url:     postUrl,
                  voa_post_title:   item.title,
                  voa_post_keyword: item.keyword || "",
                  voa_post_slug:    item.slug,
                  voa_post_lane:    "boom",
                  voa_post_excerpt: extractExcerptFromHtml(postHtml),
                  voa_post_tags:    Array.isArray(item.tags) ? item.tags.join(", ") : "",
                  voa_post_category: item.topic || item.category || "",
                  voa_post_source_text: extractSourceTextFromHtml(postHtml),
                },
              }),
            }
          );
          if (resp.status === 204) {
            console.log(`  [feeder] ✓ Triggered: ${item.slug}`);
          } else {
            console.warn(`  [feeder] ✗ HTTP ${resp.status} for: ${item.slug}`);
          }
        } catch (err) {
          console.warn(`  [feeder] ✗ ${err.message}`);
        }
      }
    }
  }

  // ── Syndication ──────────────────────────────────────────────────────────
  if (queue.syndicate_on_publish) {
    for (const item of justPublished) {
      console.log(`\n  Syndicating: ${item.slug}...`);
      const args = ["scripts/syndicate.js", "--lane", "boom", "--slug", item.slug];
      if (item.keyword) args.push("--keyword", item.keyword);
      const r = spawnSync("node", args, { stdio: "inherit", cwd: ROOT });
      if (r.error) console.error("  Syndication error:", r.error.message);
      else if (r.status !== 0) console.warn(`  Syndication exited ${r.status}`);
    }
  }

  console.log(`\n✓ Drip publish complete. ${queue.queue.length} post(s) remaining.\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
