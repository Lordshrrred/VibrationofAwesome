#!/usr/bin/env node
/**
 * preview-threads.js ~ VOA Threads variety system preview tool
 *
 * Shows format selection, cadence profiles, density scores, and monotony analysis
 * for VOA Threads posts. Generates real samples from queued or published posts.
 *
 * Does NOT publish anything. Does NOT modify any live files.
 *
 * Usage:
 *   node scripts/preview-threads.js                          # show format library + recent history
 *   node scripts/preview-threads.js --slug <slug>            # generate one format (auto-selected) for a post
 *   node scripts/preview-threads.js --slug <slug> --all     # generate ALL 8 formats for a post (8 API calls)
 *   node scripts/preview-threads.js --slug <slug> --format <id>  # generate one specific format
 *   node scripts/preview-threads.js --formats               # just list all 8 formats with descriptions
 *   node scripts/preview-threads.js --history               # show recent format history + monotony analysis
 */

import Anthropic from "@anthropic-ai/sdk";
import dotenv    from "dotenv";
import fs        from "fs";
import path      from "path";
import minimist  from "minimist";
import { fileURLToPath } from "url";

import {
  THREADS_FORMATS,
  getThreadsFormat,
  buildThreadsInstruction,
  selectThreadsFormat,
  analyzeFormatMonotony,
} from "./lib/threads-formats.js";
import { getRecentThreadsFormats } from "./lib/generation-memory.js";
import { generateCaptions, analyzeThreadsCaption } from "./generate-captions.js";

dotenv.config({ override: true });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, "..");

// ── Terminal helpers ──────────────────────────────────────────────────────────

const C = {
  reset:  "\x1b[0m",
  bold:   "\x1b[1m",
  dim:    "\x1b[2m",
  cyan:   "\x1b[36m",
  green:  "\x1b[32m",
  yellow: "\x1b[33m",
  red:    "\x1b[31m",
  blue:   "\x1b[34m",
  magenta:"\x1b[35m",
};
const b  = s => `${C.bold}${s}${C.reset}`;
const dim = s => `${C.dim}${s}${C.reset}`;
const cy = s => `${C.cyan}${s}${C.reset}`;
const gr = s => `${C.green}${s}${C.reset}`;
const yw = s => `${C.yellow}${s}${C.reset}`;
const rd = s => `${C.red}${s}${C.reset}`;

function hr(char = "─", width = 70) { return char.repeat(width); }

// ── Format library display ────────────────────────────────────────────────────

function showFormatLibrary() {
  console.log("\n" + b(cy("VOA THREADS FORMAT LIBRARY")) + "\n" + hr());
  for (const fmt of THREADS_FORMATS) {
    const sections = fmt.mode === "single"
      ? "standalone post"
      : `${fmt.sectionRange[0]}–${fmt.sectionRange[1]} sections`;
    console.log(`\n${b(fmt.label)} ${dim(`[${fmt.id}]`)}`);
    console.log(`  Cadence: ${cy(fmt.cadenceProfile)}   Density: ${yw(fmt.density)}   Sections: ${sections}`);
    console.log(`  Opener: ${fmt.openerStyle}   Closer: ${fmt.closerStyle}`);
    console.log(`  ${dim(fmt.description)}`);
    console.log(`  ${dim("─ " + fmt.structuralNote)}`);
  }
  console.log("\n" + hr() + "\n");
}

// ── History + monotony display ────────────────────────────────────────────────

function showHistory() {
  const recent = getRecentThreadsFormats(10);
  console.log("\n" + b(cy("VOA THREADS FORMAT HISTORY")) + "\n" + hr());

  if (recent.length === 0) {
    console.log(dim("  No Threads format history yet. Generate some posts first."));
    console.log("\n" + hr() + "\n");
    return;
  }

  console.log(`\n  Last ${recent.length} format(s) used:\n`);
  for (let i = 0; i < recent.length; i++) {
    const e = recent[i];
    const fmt = getThreadsFormat(e.format);
    const label = fmt ? fmt.label : e.format;
    const ts = e.timestamp ? new Date(e.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "?";
    console.log(`  ${dim(String(i + 1).padStart(2, " "))}. ${b(label)} ${dim(`(${e.cadenceProfile} / ${e.density})`)}   ${dim(ts)} ~ ${dim(e.slug || "")}`);
  }

  const { warnings, summary, recentSnapshot } = analyzeFormatMonotony(recent);
  console.log("\n  " + hr("·", 66));
  console.log(`\n  Monotony analysis: ${warnings.length === 0 ? gr(summary) : yw(summary)}`);
  if (warnings.length > 0) {
    warnings.forEach(w => console.log("  " + rd("⚠ ") + w));
  }

  if (recent.length >= 2) {
    console.log(`\n  Recent cadences:  ${recentSnapshot.cadences.join(" → ")}`);
    console.log(`  Recent densities: ${recentSnapshot.densities.join(" → ")}`);
    console.log(`  Recent openers:   ${recentSnapshot.openerStyles.join(" → ")}`);
  }

  // Show what format would be auto-selected next
  const next = selectThreadsFormat(recent);
  console.log(`\n  Next auto-selection: ${b(cy(next.label))} ${dim(`[${next.id}]`)}`);
  console.log("\n" + hr() + "\n");
}

// ── Post loader ────────────────────────────────────────────────────────────────

function loadPost(slug, lane = "boom") {
  // Try published posts first
  for (const l of [lane, "boom", "matt"]) {
    const dataFile = path.join(ROOT, "static", "_data", `${l}-posts.json`);
    if (!fs.existsSync(dataFile)) continue;
    const posts = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    const post = posts.find(p => p.slug === slug);
    if (post) return { ...post, lane: l };
  }

  // Try drip queue (queued drafts)
  const queueFile = path.join(ROOT, "static", "_data", "drip-queue.json");
  if (fs.existsSync(queueFile)) {
    const queue = JSON.parse(fs.readFileSync(queueFile, "utf8"));
    const queued = (queue.queue || []).find(item => item.slug === slug);
    if (queued) {
      const draftFile = path.join(ROOT, "static", "blog", "boom", "drafts", `${slug}.html`);
      const html = fs.existsSync(draftFile) ? fs.readFileSync(draftFile, "utf8") : "";
      const para = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] || "";
      return {
        title:   queued.title,
        slug:    queued.slug,
        excerpt: para.replace(/<[^>]+>/g, "").trim().slice(0, 300),
        url:     `/blog/boom/posts/${queued.slug}.html`,
        tags:    [],
        lane:    "boom",
      };
    }
  }

  return null;
}

function pickSamplePosts(count = 3) {
  const boomFile = path.join(ROOT, "static", "_data", "boom-posts.json");
  if (fs.existsSync(boomFile)) {
    const posts = JSON.parse(fs.readFileSync(boomFile, "utf8"));
    if (posts.length > 0) return posts.slice(0, count).map(p => ({ ...p, lane: "boom" }));
  }
  // Fall back to queued
  const queueFile = path.join(ROOT, "static", "_data", "drip-queue.json");
  if (fs.existsSync(queueFile)) {
    const queue = JSON.parse(fs.readFileSync(queueFile, "utf8"));
    return (queue.queue || []).slice(0, count).map(item => ({
      title: item.title, slug: item.slug,
      excerpt: "", url: `/blog/boom/posts/${item.slug}.html`, tags: [], lane: "boom",
    }));
  }
  return [];
}

// ── Sample generation ─────────────────────────────────────────────────────────

async function generateSample(post, formatId, anthropic) {
  const options = formatId ? { threadsFormat: formatId } : {};
  const captions = await generateCaptions({ ...post }, anthropic, options);
  return { captions, meta: captions._threads };
}

function renderSample(post, result, index = null) {
  const { captions, meta } = result;
  const prefix = index !== null ? `[${index + 1}] ` : "";
  const analysis = meta?.mode !== "single" ? analyzeThreadsCaption(captions.threads || "") : null;
  const fmt = meta ? getThreadsFormat(meta.format) : null;

  console.log("\n" + hr("═"));
  console.log(`${prefix}${b(meta?.label || "Unknown format")} ${dim(`[${meta?.format || "?"}]`)}`);
  console.log(`Cadence: ${cy(meta?.cadenceProfile || "?")}   Density: ${yw(meta?.density || "?")}   Sections: ${meta?.sectionRange?.join("–") || "?"} ${meta?.mode === "single" ? dim("(standalone)") : ""}`);
  if (fmt) console.log(dim(`"${fmt.structuralNote}"`));
  console.log(hr("─"));

  if (captions.threads) {
    console.log("\n" + (captions.threads || dim("(no content)")));
  }

  if (analysis) {
    const statusIcon = analysis.ok ? gr("✓") : yw("⚠");
    console.log(`\n${statusIcon} Quality: chars=${analysis.totalChars} parts=${analysis.partCount} avgLen=${analysis.averageSectionLength} density=${analysis.conversationalDensityScore} rhythmVar=${analysis.sentenceRhythmVariance}`);
    if (!analysis.ok) {
      console.log(yw("  Issues: ") + analysis.issues.join(", "));
    }
    if (analysis.antiPatterns.length > 0) {
      console.log(rd("  Anti-patterns: ") + analysis.antiPatterns.join(", "));
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const argv = minimist(process.argv.slice(2), {
    string:  ["slug", "format"],
    boolean: ["all", "formats", "history", "help"],
    alias:   { h: "help", f: "format", a: "all" },
  });

  if (argv.help) {
    console.log(`
${b("preview-threads.js")} ~ VOA Threads variety system preview

${b("Usage:")}
  node scripts/preview-threads.js                          Show format library + recent history
  node scripts/preview-threads.js --formats                List all 8 formats with descriptions
  node scripts/preview-threads.js --history                Show recent format history + monotony
  node scripts/preview-threads.js --slug <slug>            Auto-select format, generate sample
  node scripts/preview-threads.js --slug <slug> --all      Generate ALL 8 formats (8 API calls)
  node scripts/preview-threads.js --slug <slug> --format <id>  Generate one specific format

${b("Format IDs:")}
${THREADS_FORMATS.map(f => `  ${f.id.padEnd(30)} ${dim(f.label)}`).join("\n")}
    `);
    return;
  }

  // ── Format library only ────────────────────────────────────────────────────
  if (argv.formats) {
    showFormatLibrary();
    return;
  }

  // ── History + monotony only ────────────────────────────────────────────────
  if (argv.history) {
    showHistory();
    return;
  }

  // ── Default: library + history + next-selection preview ───────────────────
  if (!argv.slug) {
    showFormatLibrary();
    showHistory();

    // Show what would happen for a sample of posts without API calls
    const samples = pickSamplePosts(3);
    if (samples.length > 0) {
      const recent = getRecentThreadsFormats(15);
      console.log(b(cy("WHAT WOULD BE AUTO-SELECTED FOR UPCOMING POSTS")) + "\n" + hr());
      // Simulate sequential selection (each selection updates recency)
      let simulatedRecent = [...recent];
      for (const post of samples) {
        const fmt = selectThreadsFormat(simulatedRecent);
        console.log(`\n  "${post.title?.slice(0, 55) || post.slug}"`);
        console.log(`    → ${b(fmt.label)} ${dim(`(${fmt.cadenceProfile} / ${fmt.density})`)}`);
        // Add to simulated recent for next iteration
        simulatedRecent = [{ format: fmt.id, cadenceProfile: fmt.cadenceProfile, density: fmt.density, openerStyle: fmt.openerStyle, closerStyle: fmt.closerStyle }, ...simulatedRecent].slice(0, 15);
      }
      console.log("\n" + hr() + "\n");
    }
    return;
  }

  // ── Generation modes (require API key) ────────────────────────────────────
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(rd("Error: ANTHROPIC_API_KEY not set ~ required for generation modes."));
    process.exit(1);
  }

  const post = loadPost(argv.slug);
  if (!post) {
    console.error(rd(`Error: post "${argv.slug}" not found in boom-posts.json, matt-posts.json, or drip-queue.json`));
    process.exit(1);
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  console.log(`\n${b("Post:")} ${post.title}`);
  console.log(`${b("Slug:")} ${post.slug}   ${b("Lane:")} ${post.lane}\n`);

  if (argv.all) {
    // Generate all 8 formats
    console.log(b(cy(`GENERATING ALL ${THREADS_FORMATS.length} FORMAT VARIANTS`)) + dim(" (this makes multiple API calls)\n"));
    for (let i = 0; i < THREADS_FORMATS.length; i++) {
      const fmt = THREADS_FORMATS[i];
      process.stdout.write(`  Generating [${i + 1}/${THREADS_FORMATS.length}] ${fmt.label}... `);
      try {
        const result = await generateSample(post, fmt.id, anthropic);
        console.log(gr("done"));
        renderSample(post, result, i);
      } catch (err) {
        console.log(rd(`error: ${err.message}`));
      }
    }
  } else if (argv.format) {
    // Generate one specific format
    const fmt = getThreadsFormat(argv.format);
    if (!fmt) {
      console.error(rd(`Unknown format ID: "${argv.format}"`));
      console.error("Valid IDs:\n" + THREADS_FORMATS.map(f => `  ${f.id}`).join("\n"));
      process.exit(1);
    }
    process.stdout.write(`Generating "${fmt.label}"... `);
    const result = await generateSample(post, fmt.id, anthropic);
    console.log(gr("done"));
    renderSample(post, result);
  } else {
    // Auto-select format and generate one sample
    const recent = getRecentThreadsFormats(15);
    const { warnings, summary } = analyzeFormatMonotony(recent);
    if (warnings.length > 0) {
      console.log(yw("Monotony check: " + summary));
      warnings.forEach(w => console.log("  " + rd("⚠ ") + w));
      console.log();
    }
    process.stdout.write("Auto-selecting format and generating... ");
    const result = await generateSample(post, null, anthropic);
    console.log(gr("done"));
    renderSample(post, result);
  }

  console.log("\n" + hr("═") + "\n");
}

main().catch(err => { console.error(err); process.exit(1); });
