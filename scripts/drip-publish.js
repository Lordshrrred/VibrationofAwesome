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
 *   6. Updates drip-queue.json (moves slugs from queue → published)
 *   7. Writes drip-last-published.json for the post-live syndication gate
 *
 * IMPORTANT: this script does not syndicate. Money site first, always.
 * .github/workflows/drip-posts.yml deploys the post, verifies the live URL,
 * then runs scripts/post-live-syndicate.js.
 *
 * Usage:
 *   node scripts/drip-publish.js                                      ~ publish next drip_rate posts
 *   node scripts/drip-publish.js --slug <slug>                        ~ publish one specific draft
 *   node scripts/drip-publish.js --niche art-buyer-intent --limit 1    ~ publish next matching niche post
 *   node scripts/drip-publish.js --dry-run                            ~ preview only, no changes
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import minimist from "minimist";
import dotenv from "dotenv";
import {
  ensureDeterministicInternalLinks,
  inferCluster,
  loadTopicClusters,
} from "./lib/internal-linking.js";
import { refreshOrchestration } from "./lib/refresh-orchestration.js";
import { updateSitemap } from "./update-sitemap.js";

dotenv.config({ override: true });
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = path.resolve(__dirname, "..");

const argv = minimist(process.argv.slice(2), {
  string:  ["slug", "niche", "niches", "limit", "syndication-profile"],
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
const LAST_PUBLISHED_FILE = path.join(ROOT, "static", "_data", "drip-last-published.json");
const LOCK_TTL_MS = 10 * 60 * 1000; // 10 minutes
const QUEUE_WARN_THRESHOLD = 30;     // warn when fewer than this many drafts remain

// marked.parse() correctly HTML-escapes the rendered <p> text (so &, <, >, ",
// ' are valid entities in that HTML) ~ but this function's job is to produce
// a *plain-text* excerpt for the JSON data index, not a snippet of HTML. Any
// consumer that later HTML-escapes post.excerpt to embed it in a *different*
// page (hub cards, related-reading previews, tool descriptions) needs the
// literal character, not the entity, or it double-escapes into don&amp;#39;t.
const HTML_ENTITY_MAP = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">",
  "&quot;": '"', "&#39;": "'", "&#x27;": "'", "&apos;": "'",
};
function decodeHtmlEntities(text) {
  return String(text || "").replace(/&amp;|&lt;|&gt;|&quot;|&#39;|&#x27;|&apos;/g, (m) => HTML_ENTITY_MAP[m]);
}

// Extract first paragraph text from rendered HTML for the excerpt
function extractExcerptFromHtml(html) {
  const match = html.match(/<p[^>]*>([\s\S]*?)<\/p>/);
  if (!match) return "";
  return decodeHtmlEntities(match[1].replace(/<[^>]+>/g, "").trim()).slice(0, 150);
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
  const dripsPerDay = 4; // two evergreen, one practical AI, and one art slot
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
  } else if (argv.niche || argv.niches) {
    const limit = Math.max(1, Number(argv.limit || 1));
    const allowedNiches = new Set(String(argv.niches || argv.niche).split(",").map(value => value.trim()).filter(Boolean));
    toPublish = queue.queue
      .filter(q => allowedNiches.has(q.niche))
      .slice(0, limit);
  } else {
    const rate = queue.drip_rate || 2;
    toPublish = queue.queue.slice(0, rate);
  }

  if (toPublish.length === 0) {
    if (argv.niche || argv.niches) {
      console.log(`No queued posts found for niche selection "${argv.niches || argv.niche}" ~ nothing to publish.`);
    } else {
      console.log("Queue is empty ~ all posts have been published!");
    }
    process.exit(0);
  }

  toPublish = toPublish.map(item => {
    if (!argv["syndication-profile"]) return item;
    return {
      ...item,
      syndication_profile: argv["syndication-profile"],
      syndicate_on_publish: true,
      trigger_feeder_on_publish: false,
    };
  });

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
  const clusterData = loadTopicClusters();

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
      fs.unlinkSync(draftFile);
      publishedSlugs.push(item.slug);
      continue;
    }

    // Copy draft → posts
    let html = fs.readFileSync(draftFile, "utf8");
    const itemCluster = item.cluster || inferCluster(item, clusterData) || undefined;
    const sourcePost = {
      ...item,
      cluster: itemCluster,
      url: "/blog/boom/posts/" + item.slug,
      tags: item.niche ? [item.niche] : [],
    };
    const linkUniverse = [
      sourcePost,
      ...boomPosts,
      ...(queue.published || []).map(q => ({
        ...q,
        url: "/blog/boom/posts/" + q.slug,
        tags: q.niche ? [q.niche] : [],
      })),
    ];
    const linkResult = ensureDeterministicInternalLinks(html, sourcePost, linkUniverse, { minRelated: 1, limit: 3 });
    html = linkResult.html;
    if (linkResult.inserted) {
      console.log(`  ✓ Internal links: ${item.slug} → ${linkResult.related.map(r => r.slug).join(", ")}`);
    }
    fs.writeFileSync(postFile, html, "utf8");
    fs.unlinkSync(draftFile);
    console.log(`  ✓ Published: /blog/boom/posts/${item.slug}`);

    // Add to boom-posts index
    boomPosts.unshift({
      title:   item.title,
      slug:    item.slug,
      date:    new Date().toISOString(),
      excerpt: extractExcerptFromHtml(html),
      url:     "/blog/boom/posts/" + item.slug,
      tags:    item.niche ? [item.niche] : [],
      niche:   item.niche || undefined,
      cluster: itemCluster,
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
  const justPublished = toPublish
    .filter(q => publishedSlugs.includes(q.slug))
    .map(q => ({ ...q, published_at: new Date().toISOString() }));

  queue.queue     = queue.queue.filter(q => !publishedSlugs.includes(q.slug));
  queue.published = [...(queue.published || []), ...justPublished];

  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2), "utf8");
  console.log(`  ✓ Queue updated: ${queue.queue.length} remaining, ${queue.published.length} published`);

  const postLiveManifest = {
    created_at: new Date().toISOString(),
    lane: "boom",
    syndicate_on_publish: !!queue.syndicate_on_publish,
    trigger_feeder_on_publish: !!queue.trigger_feeder_on_publish,
    items: justPublished.map(item => ({
      ...item,
      url: "https://vibrationofawesome.com/blog/boom/posts/" + item.slug,
    })),
  };
  fs.writeFileSync(LAST_PUBLISHED_FILE, JSON.stringify(postLiveManifest, null, 2), "utf8");
  console.log(`  ✓ Post-live manifest written: static/_data/drip-last-published.json`);
  console.log("  ✓ Money site first gate armed: syndication waits for live URL verification.");

  console.log(`\n✓ Drip publish complete. ${queue.queue.length} post(s) remaining.\n`);

  // Refresh orchestration state — fire-and-forget, never blocks publish
  await refreshOrchestration("drip_publish");
}

main().catch(err => { console.error(err); process.exit(1); });
