#!/usr/bin/env node
/**
 * preview-instagram.js — VOA Instagram visual ecosystem audit + preview
 *
 * Simulates and audits the VOA Instagram feed — no API calls required for
 * the audit modes. Shows archetype selection, visual variety analysis, palette
 * distribution, emotional tone cadence, and content-type mapping.
 *
 * Also supports generating actual sample Ideogram images for specific posts
 * (requires IDEOGRAM_API_KEY and ANTHROPIC_API_KEY).
 *
 * Usage:
 *   node scripts/preview-instagram.js                       # 30-post feed audit (simulation)
 *   node scripts/preview-instagram.js --archetypes          # list all 8 archetypes
 *   node scripts/preview-instagram.js --history             # recent archetype history + monotony
 *   node scripts/preview-instagram.js --slug <slug>         # simulate + optionally generate for one post
 *   node scripts/preview-instagram.js --slug <slug> --generate  # actually call Ideogram (API)
 *   node scripts/preview-instagram.js --slug <slug> --archetype <id>  # force a specific archetype
 *   node scripts/preview-instagram.js --feed-audit          # simulate 30-post feed + full analysis
 *
 * npm aliases:
 *   npm run instagram:preview
 *   npm run instagram:audit
 *   npm run instagram:archetypes
 */

import Anthropic  from "@anthropic-ai/sdk";
import dotenv     from "dotenv";
import fs         from "fs";
import path       from "path";
import minimist   from "minimist";
import { fileURLToPath } from "url";

import {
  INSTAGRAM_ARCHETYPES,
  PALETTE_GROUPS,
  EMOTIONAL_CLUSTERS,
  getInstagramArchetype,
  selectInstagramArchetype,
  analyzeInstagramMonotony,
} from "./lib/instagram-archetypes.js";
import { getRecentInstagramArchetypes } from "./lib/generation-memory.js";
import { generateInstagramVisual } from "./generate-instagram-visual.js";
import { detectContentType } from "./lib/policy.js";

dotenv.config({ override: true });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, "..");

// ── Terminal helpers ──────────────────────────────────────────────────────────

const C = { reset:"\x1b[0m", bold:"\x1b[1m", dim:"\x1b[2m", cyan:"\x1b[36m",
            green:"\x1b[32m", yellow:"\x1b[33m", red:"\x1b[31m", magenta:"\x1b[35m", blue:"\x1b[34m" };
const b   = s => `${C.bold}${s}${C.reset}`;
const dim = s => `${C.dim}${s}${C.reset}`;
const cy  = s => `${C.cyan}${s}${C.reset}`;
const gr  = s => `${C.green}${s}${C.reset}`;
const yw  = s => `${C.yellow}${s}${C.reset}`;
const rd  = s => `${C.red}${s}${C.reset}`;
const mg  = s => `${C.magenta}${s}${C.reset}`;
function hr(char = "─", w = 72) { return char.repeat(w); }

// ── Data loading ──────────────────────────────────────────────────────────────

function loadPosts(count = 30) {
  const boomFile = path.join(ROOT, "static", "_data", "boom-posts.json");
  const mattFile = path.join(ROOT, "static", "_data", "matt-posts.json");
  let posts = [];
  if (fs.existsSync(boomFile)) {
    const b = JSON.parse(fs.readFileSync(boomFile, "utf8"));
    posts = posts.concat((b || []).map(p => ({ ...p, lane: "boom" })));
  }
  if (fs.existsSync(mattFile)) {
    const m = JSON.parse(fs.readFileSync(mattFile, "utf8"));
    posts = posts.concat((m || []).map(p => ({ ...p, lane: "matt" })));
  }
  // Sort by date descending
  posts.sort((a, b) => new Date(b.date) - new Date(a.date));
  return posts.slice(0, count);
}

function loadPost(slug) {
  for (const lane of ["boom", "matt"]) {
    const f = path.join(ROOT, "static", "_data", `${lane}-posts.json`);
    if (!fs.existsSync(f)) continue;
    const posts = JSON.parse(fs.readFileSync(f, "utf8"));
    const post = posts.find(p => p.slug === slug);
    if (post) return { ...post, lane };
  }
  // Try drip queue
  const qf = path.join(ROOT, "static", "_data", "drip-queue.json");
  if (fs.existsSync(qf)) {
    const q = JSON.parse(fs.readFileSync(qf, "utf8"));
    const item = (q.queue || []).find(p => p.slug === slug);
    if (item) {
      const df = path.join(ROOT, "static", "blog", "boom", "drafts", `${slug}.html`);
      const html = fs.existsSync(df) ? fs.readFileSync(df, "utf8") : "";
      const para = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] || "";
      return { title: item.title, slug: item.slug, excerpt: para.replace(/<[^>]+>/g, "").trim().slice(0, 250), url: `/blog/boom/posts/${slug}.html`, tags: [], lane: "boom", niche: item.niche };
    }
  }
  return null;
}

// ── Archetype library display ─────────────────────────────────────────────────

function showArchetypeLibrary() {
  console.log("\n" + b(cy("VOA INSTAGRAM VISUAL ARCHETYPE LIBRARY")) + "\n" + hr("═"));
  console.log(dim(`  A living consciousness magazine — not a quote-card machine.\n`));

  for (const arch of INSTAGRAM_ARCHETYPES) {
    const paletteGroup = Object.entries(PALETTE_GROUPS).find(([, ids]) => ids.includes(arch.id))?.[0] || "—";
    const emoGroup     = Object.entries(EMOTIONAL_CLUSTERS).find(([, ids]) => ids.includes(arch.id))?.[0] || "—";
    console.log(`\n${b(arch.label)} ${dim(`[${arch.id}]`)}`);
    console.log(`  Style: ${cy(arch.ideogramStyle)}   Palette: ${yw(arch.palette)}   Tone: ${mg(arch.emotionalTone)}`);
    console.log(`  Palette group: ${dim(paletteGroup)}   Emotional cluster: ${dim(emoGroup)}`);
    console.log(`  Affinity: ${arch.contentTypeAffinity.join(", ")}`);
    console.log(`  ${dim(arch.description)}`);
    if (arch.avoidWith.length > 0) {
      console.log(`  ${yw("Avoid pairing with:")} ${arch.avoidWith.join(", ")}`);
    }
  }
  console.log("\n" + hr("═") + "\n");
}

// ── History + monotony ────────────────────────────────────────────────────────

function showHistory() {
  const recent = getRecentInstagramArchetypes(15);
  console.log("\n" + b(cy("VOA INSTAGRAM ARCHETYPE HISTORY")) + "\n" + hr("═"));

  if (recent.length === 0) {
    console.log(dim("  No Instagram archetype history yet.\n"));
    console.log("\n" + hr("═") + "\n");
    return;
  }

  console.log(`\n  Last ${recent.length} post(s):\n`);
  for (let i = 0; i < recent.length; i++) {
    const e   = recent[i];
    const arch = getInstagramArchetype(e.archetype);
    const ts  = e.timestamp ? new Date(e.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "?";
    console.log(`  ${dim(String(i + 1).padStart(2))}. ${b(arch?.label || e.archetype)} ${dim(`— ${e.palette} / ${e.emotionalTone}`)}   ${dim(ts)} ${dim(e.slug ? `— ${e.slug.slice(0, 40)}` : "")}`);
  }

  const { warnings, summary, diversity } = analyzeInstagramMonotony(recent);
  console.log("\n  " + hr("·", 68));
  console.log(`\n  Monotony: ${warnings.length === 0 ? gr(summary) : yw(summary)}`);
  if (warnings.length > 0) warnings.forEach(w => console.log("  " + rd("⚠ ") + w));

  console.log(`\n  Coverage: ${diversity.archetypeCoverage} archetypes used in last ${diversity.totalPosts} posts`);
  console.log(`  Unique palettes: ${diversity.uniquePalettes}   Unique emotional clusters: ${diversity.uniqueEmoClusters}`);

  const next = selectInstagramArchetype(recent);
  console.log(`\n  Next auto-selection: ${b(cy(next.label))} ${dim(`(${next.palette} / ${next.emotionalTone})`)}`);
  console.log("\n" + hr("═") + "\n");
}

// ── Feed simulation ───────────────────────────────────────────────────────────

/**
 * Simulate archetype selection for a list of posts without making API calls.
 * Applies the same recency-penalized selection as the live system but sequentially
 * so each selection affects the next (realistic simulation of the live feed).
 */
function simulateFeed(posts, startingHistory = []) {
  let simulatedHistory = [...startingHistory];
  return posts.map(post => {
    const contentType = detectContentType({ ...post });
    const archetype   = selectInstagramArchetype(simulatedHistory, contentType);
    const paletteGroup = Object.entries(PALETTE_GROUPS).find(([, ids]) => ids.includes(archetype.id))?.[0] || "other";
    const emoCluster   = archetype.emotionalCluster;

    // Advance simulated history
    simulatedHistory = [
      { archetype: archetype.id, palette: archetype.palette, emotionalTone: archetype.emotionalTone, emotionalCluster: emoCluster },
      ...simulatedHistory,
    ].slice(0, 15);

    return {
      post,
      contentType,
      archetype,
      paletteGroup,
      emoCluster,
    };
  });
}

// ── Feed audit display ────────────────────────────────────────────────────────

function showFeedAudit(count = 30) {
  const posts = loadPosts(count);
  if (posts.length === 0) {
    console.log(rd("No posts found — run the drip publish first to build boom-posts.json."));
    return;
  }

  const liveHistory = getRecentInstagramArchetypes(15);
  const feed        = simulateFeed(posts, liveHistory);

  console.log("\n" + b(cy(`VOA INSTAGRAM FEED AUDIT — ${posts.length} POSTS`)) + "\n" + hr("═"));
  console.log(dim("  Simulation of archetype selection for recent and upcoming posts.\n"));

  // Per-post breakdown
  for (let i = 0; i < feed.length; i++) {
    const { post, contentType, archetype, paletteGroup, emoCluster } = feed[i];
    const n = String(i + 1).padStart(2, " ");
    const title = (post.title || post.slug || "").slice(0, 48).padEnd(48);
    const ct   = contentType.padEnd(14);
    console.log(`  ${dim(n)}. ${title} ${dim(ct)} ${cy(archetype.id.padEnd(30))} ${dim(paletteGroup)}`);
  }

  // ── Diversity analysis ──────────────────────────────────────────────────────
  const archetypeCounts = {};
  const paletteCounts   = {};
  const emoCounts       = {};
  const ctCounts        = {};

  for (const { archetype, paletteGroup, emoCluster, contentType } of feed) {
    archetypeCounts[archetype.id]  = (archetypeCounts[archetype.id] || 0) + 1;
    paletteCounts[paletteGroup]    = (paletteCounts[paletteGroup] || 0) + 1;
    emoCounts[emoCluster]          = (emoCounts[emoCluster] || 0) + 1;
    ctCounts[contentType]          = (ctCounts[contentType] || 0) + 1;
  }

  const total = feed.length;
  const pct   = (n) => `${Math.round((n / total) * 100)}%`;

  console.log("\n" + hr("─"));
  console.log(b("\n  ARCHETYPE DISTRIBUTION\n"));
  for (const arch of INSTAGRAM_ARCHETYPES) {
    const count = archetypeCounts[arch.id] || 0;
    const bar   = "█".repeat(Math.round((count / total) * 20));
    const empty = "░".repeat(20 - bar.length);
    const health = count === 0 ? rd("unused") : count <= 2 ? yw("sparse") : gr("healthy");
    console.log(`  ${arch.label.padEnd(32)} ${bar}${empty}  ${String(count).padStart(2)}/${total} ${pct(count).padStart(4)}  ${health}`);
  }

  console.log(b("\n  PALETTE GROUP DISTRIBUTION\n"));
  for (const [group, ids] of Object.entries(PALETTE_GROUPS)) {
    const count = paletteCounts[group] || 0;
    const bar   = "█".repeat(Math.round((count / total) * 20));
    const empty = "░".repeat(20 - bar.length);
    console.log(`  ${group.padEnd(22)} ${bar}${empty}  ${String(count).padStart(2)}/${total} ${pct(count).padStart(4)}`);
  }

  console.log(b("\n  EMOTIONAL CLUSTER DISTRIBUTION\n"));
  const allClusters = ["intellectual", "atmospheric", "mystical", "grounded"];
  for (const cluster of allClusters) {
    const count = emoCounts[cluster] || 0;
    const bar   = "█".repeat(Math.round((count / total) * 20));
    const empty = "░".repeat(20 - bar.length);
    console.log(`  ${cluster.padEnd(16)} ${bar}${empty}  ${String(count).padStart(2)}/${total} ${pct(count).padStart(4)}`);
  }

  console.log(b("\n  CONTENT TYPE DISTRIBUTION\n"));
  for (const [ct, count] of Object.entries(ctCounts).sort((a, b) => b[1] - a[1])) {
    const bar   = "█".repeat(Math.round((count / total) * 20));
    const empty = "░".repeat(20 - bar.length);
    console.log(`  ${ct.padEnd(16)} ${bar}${empty}  ${String(count).padStart(2)}/${total}`);
  }

  // ── Cadence health ──────────────────────────────────────────────────────────
  console.log(b("\n  CADENCE HEALTH — PALETTE SEQUENCE\n"));
  const paletteSeq = feed.slice(0, 12).map(f => f.paletteGroup.slice(0, 12).padEnd(14));
  console.log("  " + paletteSeq.join(" "));

  const emoSeq = feed.slice(0, 12).map(f => f.emoCluster.slice(0, 12).padEnd(14));
  console.log(b("\n  CADENCE HEALTH — EMOTIONAL SEQUENCE\n"));
  console.log("  " + emoSeq.join(" "));

  // ── Monotony warnings ──────────────────────────────────────────────────────
  const simulatedRecent = feed.slice(0, 10).map(f => ({
    archetype: f.archetype.id, palette: f.archetype.palette,
    emotionalTone: f.archetype.emotionalTone, emotionalCluster: f.emoCluster,
  }));
  const { warnings, summary } = analyzeInstagramMonotony(simulatedRecent);
  console.log("\n  " + hr("·", 68));
  console.log(`\n  Feed monotony: ${warnings.length === 0 ? gr(summary) : yw(summary)}`);
  if (warnings.length > 0) warnings.forEach(w => console.log("  " + rd("⚠ ") + w));

  // ── Coverage assessment ─────────────────────────────────────────────────────
  const uniqueArchCount = Object.keys(archetypeCounts).length;
  const coveragePct     = Math.round((uniqueArchCount / INSTAGRAM_ARCHETYPES.length) * 100);
  const coverageHealth  = coveragePct >= 75 ? gr("Excellent") : coveragePct >= 50 ? yw("Good") : rd("Needs variety");

  console.log(b(`\n  SUMMARY — ${total} POSTS\n`));
  console.log(`  Archetype coverage:    ${uniqueArchCount}/${INSTAGRAM_ARCHETYPES.length} used (${coveragePct}%) — ${coverageHealth}`);
  console.log(`  Palette variety:       ${Object.keys(paletteCounts).length}/4 groups`);
  console.log(`  Emotional variety:     ${Object.keys(emoCounts).length}/4 clusters`);
  console.log(`  Monotony warnings:     ${warnings.length === 0 ? gr("none") : yw(warnings.length)}`);
  console.log(`\n  Feed concept: ${b("Modern consciousness magazine.")} ${dim("Not repost automation.")}\n`);
  console.log(hr("═") + "\n");
}

// ── Single post preview ───────────────────────────────────────────────────────

async function previewPost(slug, forceArchetypeId = null, generate = false) {
  const post = loadPost(slug);
  if (!post) {
    console.error(rd(`Post "${slug}" not found.`));
    process.exit(1);
  }

  const recent = getRecentInstagramArchetypes(10);
  const contentType = detectContentType({ ...post });

  const archetype = forceArchetypeId
    ? (getInstagramArchetype(forceArchetypeId) || selectInstagramArchetype(recent, contentType))
    : selectInstagramArchetype(recent, contentType);

  const { warnings, summary } = analyzeInstagramMonotony(recent);

  console.log("\n" + hr("═"));
  console.log(b("POST:") + " " + post.title);
  console.log(b("Slug:") + " " + slug + "   " + b("Content type:") + " " + cy(contentType));
  console.log(hr("─"));
  console.log(`\n  Auto-selected archetype: ${b(archetype.label)} ${dim(`[${archetype.id}]`)}`);
  console.log(`  Palette: ${yw(archetype.palette)}   Style: ${cy(archetype.ideogramStyle)}   Tone: ${mg(archetype.emotionalTone)}`);
  console.log(`  ${dim(archetype.description)}`);
  console.log(`  ${dim("Visual DNA: " + archetype.visualDNA.slice(0, 100) + "...")}`);
  if (warnings.length > 0) {
    console.log(`\n  ${yw("Feed monotony warnings:")} ${warnings.join("; ")}`);
  }

  if (generate) {
    if (!process.env.ANTHROPIC_API_KEY || !process.env.IDEOGRAM_API_KEY) {
      console.log(rd("\n  Requires ANTHROPIC_API_KEY and IDEOGRAM_API_KEY for actual generation."));
      console.log(hr("═") + "\n");
      return;
    }
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    process.stdout.write("\n  Generating Instagram visual... ");
    const result = await generateInstagramVisual({ ...post }, anthropic, contentType);
    if (result) {
      console.log(gr("done"));
      console.log(`\n  Archetype:  ${b(result.archetypeLabel)}`);
      console.log(`  Image URL:  ${cy(result.url)}`);
      console.log(`  Prompt:     ${dim(result.prompt)}`);
    } else {
      console.log(yw("fallback to Pinterest image (Ideogram unavailable or failed)"));
    }
  }

  console.log("\n" + hr("═") + "\n");
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const argv = minimist(process.argv.slice(2), {
    string:  ["slug", "archetype"],
    boolean: ["archetypes", "history", "generate", "feed-audit", "help"],
    alias:   { h: "help", a: "archetype" },
  });

  if (argv.help) {
    console.log(`
${b("preview-instagram.js")} — VOA Instagram visual ecosystem audit

${b("Modes (no API calls):")}
  --archetypes           List all 8 visual archetypes with descriptions
  --history              Recent archetype history + monotony analysis
  --feed-audit           Simulate 30-post feed + full visual diversity analysis
  (default)              All of the above in sequence

${b("Generation modes (requires API keys):")}
  --slug <slug>          Simulate archetype for one post
  --slug <slug> --generate   Generate actual Ideogram image
  --slug <slug> --archetype <id>  Force a specific archetype

${b("Archetype IDs:")}
${INSTAGRAM_ARCHETYPES.map(a => `  ${a.id.padEnd(34)} ${dim(a.label)}`).join("\n")}

npm run instagram:audit         → full feed audit
npm run instagram:archetypes    → just the archetype library
    `);
    return;
  }

  if (argv.archetypes) { showArchetypeLibrary(); return; }
  if (argv.history)    { showHistory(); return; }
  if (argv["feed-audit"]) { showFeedAudit(30); return; }

  if (argv.slug) {
    await previewPost(argv.slug, argv.archetype || null, argv.generate);
    return;
  }

  // Default: full overview
  showArchetypeLibrary();
  showHistory();
  showFeedAudit(30);
}

main().catch(err => { console.error(err); process.exit(1); });
