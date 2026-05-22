/**
 * orchestration-export.js
 *
 * Read-only state compiler for VOA → EarthStar Command orchestration compatibility.
 *
 * PURPOSE:
 *   Compile machine-readable orchestration state from VOA static data files
 *   and write it to static/_data/orchestration-state.json.
 *
 *   This script ONLY reads existing data files and writes one output file.
 *   It does NOT import from syndicate.js, drip-publish.js, or any runtime path.
 *   It does NOT mutate any source data file.
 *   It does NOT alter publishing cadence, routing, or syndication behavior.
 *
 * CONSUMERS:
 *   - EarthStar Command orchestration layer (future ingest)
 *   - /api/orchestration-state (Vercel read-only endpoint)
 *   - Dashboard visibility (optional future use)
 *
 * RUN:
 *   node scripts/lib/orchestration-export.js
 *   npm run orchestration:export
 */

import { readFileSync, readdirSync, existsSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
const DATA_DIR  = join(REPO_ROOT, "static", "_data");

const SCHEMA_VERSION  = "1.0";
const CADENCE_PER_DAY = 2;   // drip runs: 9am + 6pm ET
const QUEUE_WARN_AT   = 30;  // CLAUDE.md threshold

// ── Safe JSON reader ──────────────────────────────────────────────────────────

function readJSON(relPath, fallback = null) {
  const full = join(REPO_ROOT, relPath);
  if (!existsSync(full)) return fallback;
  try {
    return JSON.parse(readFileSync(full, "utf8"));
  } catch {
    return fallback;
  }
}

function readDir(relPath) {
  const full = join(REPO_ROOT, relPath);
  if (!existsSync(full)) return [];
  try { return readdirSync(full); } catch { return []; }
}

// ── Section compilers ─────────────────────────────────────────────────────────

function compilePublishing() {
  const boomPosts = readJSON("static/_data/boom-posts.json", []);
  const mattPosts = readJSON("static/_data/matt-posts.json", []);
  const drafts    = readDir("static/blog/boom/drafts").filter(f => f.endsWith(".html"));

  const allPublished = [
    ...boomPosts.map(p => ({ ...p, lane: "boom" })),
    ...mattPosts.map(p => ({ ...p, lane: "matt" })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  const occupiedDates = [...new Set(allPublished.map(p => p.date?.slice(0, 10)).filter(Boolean))];

  const runwayDays   = Math.floor(drafts.length / CADENCE_PER_DAY);
  const runwayStatus = drafts.length <= 0 ? "empty"
    : drafts.length <= QUEUE_WARN_AT      ? "warning"
    : "healthy";

  // Estimate next publish window from last boom post date
  const lastBoomDate = boomPosts[0]?.date ? new Date(boomPosts[0].date) : new Date();
  const nextWindow   = new Date(lastBoomDate);
  nextWindow.setDate(nextWindow.getDate() + 1);

  return {
    queue: {
      lane:                "boom",
      draft_count:         drafts.length,
      draft_slugs:         drafts.map(f => f.replace(/\.html$/, "")),
      runway_days:         runwayDays,
      runway_status:       runwayStatus,
      warning_threshold:   QUEUE_WARN_AT,
      cadence_posts_per_day: CADENCE_PER_DAY,
      schedule_windows:    ["09:00 ET", "18:00 ET"],
    },
    recent_publishes:      allPublished.slice(0, 20).map(p => ({
      slug:   p.slug,
      title:  p.title,
      lane:   p.lane,
      date:   p.date,
      url:    p.url,
      tags:   p.tags ?? [],
      cluster: p.cluster ?? null,
      content_type: p.content_type ?? null,
    })),
    occupied_dates:        occupiedDates,
    next_estimated_window: nextWindow.toISOString().slice(0, 10),
    published_counts:      { boom: boomPosts.length, matt: mattPosts.length, total: allPublished.length },
  };
}

function compileSyndication() {
  const results = readJSON("static/_data/syndication-results.json", []);
  const entries = Array.isArray(results) ? results : Object.values(results);

  const PLATFORMS = [
    "feeder", "bluesky_voa", "mastodon_voa", "facebook_voa",
    "pinterest", "threads", "instagram", "devto",
    "tumblr_voa", "blogger", "wordpress_earthstar",
  ];

  const retryBacklog = [];
  const platformSuccessCounts = Object.fromEntries(PLATFORMS.map(p => [p, 0]));
  const platformFailCounts    = Object.fromEntries(PLATFORMS.map(p => [p, 0]));

  const perPost = entries.map(entry => {
    const syndication = entry.syndication ?? {};
    const platformStatuses = {};

    for (const platform of PLATFORMS) {
      const rec = syndication[platform];
      const status = rec?.status ?? "not_attempted";
      platformStatuses[platform] = {
        status,
        timestamp: rec?.timestamp ?? null,
        url:       rec?.url ?? null,
      };

      if (status === "success") platformSuccessCounts[platform]++;
      if (status === "failed")  {
        platformFailCounts[platform]++;
        retryBacklog.push({ slug: entry.slug, platform, timestamp: rec?.timestamp ?? null });
      }
    }

    const allPlatforms  = Object.values(platformStatuses);
    const successCount  = allPlatforms.filter(p => p.status === "success").length;
    const failedCount   = allPlatforms.filter(p => p.status === "failed").length;
    const pendingCount  = allPlatforms.filter(p => p.status === "not_attempted").length;

    return {
      slug:             entry.slug,
      title:            entry.title,
      lane:             entry.lane,
      date:             entry.date,
      publish_status:   failedCount > 0 ? "partial" : pendingCount === PLATFORMS.length ? "pending" : "complete",
      platform_statuses: platformStatuses,
      success_count:    successCount,
      failed_count:     failedCount,
    };
  });

  const platformCoverage = Object.fromEntries(
    PLATFORMS.map(p => [p, {
      successes: platformSuccessCounts[p],
      failures:  platformFailCounts[p],
      total:     entries.length,
    }])
  );

  return {
    platforms:        PLATFORMS,
    per_post:         perPost,
    retry_backlog:    retryBacklog,
    platform_coverage: platformCoverage,
    summary: {
      total_posts:       entries.length,
      fully_syndicated:  perPost.filter(p => p.publish_status === "complete").length,
      partial:           perPost.filter(p => p.publish_status === "partial").length,
      pending:           perPost.filter(p => p.publish_status === "pending").length,
      retry_backlog_count: retryBacklog.length,
    },
  };
}

function compileVisuals() {
  const registry = readJSON("static/_data/image-registry.json", []);

  const sourceBreakdown = {};
  const platformUsage   = {};
  let reuseCount = 0;
  let ideogramCount = 0;

  for (const rec of registry) {
    const src = rec.source ?? "unknown";
    sourceBreakdown[src] = (sourceBreakdown[src] ?? 0) + 1;
    if (rec.reused) reuseCount++;
    if (src === "ideogram") ideogramCount++;
    for (const p of (rec.platforms_used ?? [])) {
      platformUsage[p] = (platformUsage[p] ?? 0) + 1;
    }
  }

  return {
    registry_count:    registry.length,
    registry_entries:  registry.map(r => ({
      post_slug:           r.post_slug,
      source:              r.source,
      asset_type:          r.instagram_asset_type ?? null,
      platforms_used:      r.platforms_used ?? [],
      pinterest_board:     r.pinterest_board ?? null,
      reused:              r.reused ?? false,
      reused_from:         r.reused_from ?? null,
      timestamp:           r.timestamp,
    })),
    reuse_stats: {
      total_entries:   registry.length,
      reused_count:    reuseCount,
      reuse_rate:      registry.length > 0 ? +(reuseCount / registry.length).toFixed(3) : 0,
    },
    source_breakdown:  sourceBreakdown,
    generation_counts: { ideogram: ideogramCount },
    platform_usage:    platformUsage,
  };
}

function compileClusters() {
  const raw      = readJSON("static/_data/topic-clusters.json", {});
  const clusters = raw.clusters ?? {};
  const boomPosts = readJSON("static/_data/boom-posts.json", []);
  const mattPosts = readJSON("static/_data/matt-posts.json", []);

  const allPosts = [
    ...boomPosts.map(p => ({ ...p, lane: "boom" })),
    ...mattPosts.map(p => ({ ...p, lane: "matt" })),
  ];

  // Build slug → cluster map from posts that carry a cluster field
  const postToCluster = {};
  const clusterPostCounts = {};
  for (const p of allPosts) {
    if (p.cluster) {
      postToCluster[p.slug] = p.cluster;
      clusterPostCounts[p.cluster] = (clusterPostCounts[p.cluster] ?? 0) + 1;
    }
  }

  // Clean cluster definitions for export
  const definitions = {};
  for (const [idx, c] of Object.entries(clusters)) {
    definitions[c.key] = {
      key:             c.key,
      display_name:    c.displayName,
      content_type:    c.contentType,
      pillar:          c.pillar,
      supporting_angles: c.supportingAngles ?? [],
      related_clusters:  c.relatedClusters ?? [],
      pinterest_boards:  c.pinterestBoards ?? [],
    };
  }

  // Saturation = how many published posts belong to each cluster
  const saturation = Object.fromEntries(
    Object.keys(definitions).map(key => [key, clusterPostCounts[key] ?? 0])
  );

  return {
    cluster_count:   Object.keys(definitions).length,
    definitions,
    post_to_cluster: postToCluster,
    saturation,
    unassigned_post_count: allPosts.filter(p => !p.cluster).length,
  };
}

function compileGenerationMemory() {
  const mem = readJSON("static/_data/generation-memory.json", {});

  return {
    last_updated:          mem.lastUpdated ?? null,
    recent_hooks:          mem.recentHooks ?? [],
    recent_titles:         mem.recentTitles ?? [],
    recent_structures:     mem.recentNarrativeStructures ?? [],
    recent_arcs:           mem.recentEmotionalArcs ?? [],
    recent_opening_styles: mem.recentOpeningStyles ?? [],
    recent_cta_patterns:   mem.recentCTAPatterns ?? [],
    recent_threads_formats:    mem.recentThreadsFormats ?? [],
    recent_instagram_archetypes: mem.recentInstagramArchetypes ?? [],
    window_size: 30,
  };
}

function compileTimeline(publishing, syndication) {
  const now = new Date();

  // Cadence density: posts published in last 7 / 14 / 30 days
  const counts = { d7: 0, d14: 0, d30: 0 };
  for (const p of publishing.recent_publishes) {
    const age = (now - new Date(p.date)) / (1000 * 60 * 60 * 24);
    if (age <= 7)  counts.d7++;
    if (age <= 14) counts.d14++;
    if (age <= 30) counts.d30++;
  }

  return {
    as_of:                  now.toISOString(),
    next_estimated_window:  publishing.next_estimated_window,
    queue_runway_days:      publishing.queue.runway_days,
    queue_runway_status:    publishing.queue.runway_status,
    occupied_dates:         publishing.occupied_dates,
    retry_backlog_count:    syndication.summary.retry_backlog_count,
    cadence_density: {
      posts_last_7_days:  counts.d7,
      posts_last_14_days: counts.d14,
      posts_last_30_days: counts.d30,
    },
    recent_publish_history: publishing.recent_publishes.slice(0, 10).map(p => ({
      slug: p.slug, lane: p.lane, date: p.date,
    })),
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function buildOrchestrationState() {
  const publishing       = compilePublishing();
  const syndication      = compileSyndication();
  const visuals          = compileVisuals();
  const clusters         = compileClusters();
  const generation       = compileGenerationMemory();
  const timeline         = compileTimeline(publishing, syndication);

  return {
    schema_version: SCHEMA_VERSION,
    generated_at:   new Date().toISOString(),
    source:         "vibrationofawesome.com",
    publishing,
    syndication,
    visuals,
    clusters,
    generation,
    timeline,
  };
}

// ── CLI entry ─────────────────────────────────────────────────────────────────

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const t0       = Date.now();
  const exportAt = new Date().toISOString();
  const state    = buildOrchestrationState();
  const duration = Date.now() - t0;

  // Freshness metadata — written by CLI; refresh-orchestration.js writes its own
  state._freshness = {
    last_export_at:      exportAt,
    source_event:        "manual",
    export_duration_ms:  duration,
    schema_version:      state.schema_version,
    stale_after_minutes: 60,
  };

  const outPath  = join(DATA_DIR, "orchestration-state.json");
  const json     = JSON.stringify(state, null, 2);

  writeFileSync(outPath, json, "utf8");

  const kb = (Buffer.byteLength(json, "utf8") / 1024).toFixed(1);
  console.log(`[orchestration-export] Written to static/_data/orchestration-state.json (${kb}KB, ${duration}ms)`);
  console.log(`  published posts:   ${state.publishing.published_counts.total}`);
  console.log(`  drafts in queue:   ${state.publishing.queue.draft_count} (~${state.publishing.queue.runway_days}d runway)`);
  console.log(`  syndication rows:  ${state.syndication.summary.total_posts}`);
  console.log(`  retry backlog:     ${state.syndication.summary.retry_backlog_count}`);
  console.log(`  visual registry:   ${state.visuals.registry_count}`);
  console.log(`  clusters defined:  ${state.clusters.cluster_count}`);
}
