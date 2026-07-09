#!/usr/bin/env node
/**
 * serp_intelligence.js ~ Weekly SERP + AI Search Visibility checker for vibrationofawesome.com
 *
 * For the 10 most recently published Boom Frequency posts, searches the live web
 * for each post's target keyword (its title, which is already keyword-optimized
 * at generation time ~ see BOOMBOT_SYSTEM in generate-post.js) and asks Claude to
 * report the top 3 organic results, what they cover that we might be missing, and
 * whether vibrationofawesome.com shows up anywhere in the results or an AI Overview.
 *
 * NOTE ON KEYWORD SOURCE: there is no keywords.txt / priority-scored keyword file
 * in this repo. static/_data/topic-queue.json holds pre-publish candidate keywords
 * (not tied to what's live); static/_data/boom-posts.json holds published posts but
 * has no dedicated `keyword` field. Post title is the closest existing proxy for
 * "the keyword this post targets" ~ if a real keyword-tracking file gets added later,
 * swap out loadTopKeywords() below.
 *
 * Usage:
 *   node scripts/serp_intelligence.js
 *   node scripts/serp_intelligence.js --count 5   (fewer keywords, cheaper test run)
 */

import { createAnthropicClient } from "./lib/anthropic-client.js";
import minimist from "minimist";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = path.resolve(__dirname, "..");

const argv = minimist(process.argv.slice(2), {
  string: ["count"],
});
const KEYWORD_COUNT = Math.max(1, parseInt(argv.count, 10) || 10);

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Error: ANTHROPIC_API_KEY not set. Copy .env.example to .env and add your key.");
  process.exit(1);
}

const MODEL = "claude-sonnet-5";

// ── Keyword source ───────────────────────────────────────────────────────────

/**
 * Top N highest-priority keywords with live posts, derived from published
 * Boom Frequency posts. "Priority" = most recently published (freshest posts
 * are the ones most likely to still be climbing/settling in rank and most
 * worth checking). Returns [{ keyword, slug, url }].
 */
function loadTopKeywords(count) {
  const file = path.join(ROOT, "static", "_data", "boom-posts.json");
  if (!fs.existsSync(file)) {
    throw new Error(`Cannot find ${file} ~ no published Boom posts to check yet.`);
  }
  const posts = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(posts) || posts.length === 0) {
    throw new Error("boom-posts.json is empty ~ nothing to check.");
  }

  const sorted = [...posts]
    .filter((p) => p && p.title && p.slug)
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  return sorted.slice(0, count).map((p) => ({
    keyword: p.title,
    slug: p.slug,
    url: p.url && p.url.startsWith("http") ? p.url : `https://vibrationofawesome.com${p.url || "/blog/boom/posts/" + p.slug}`,
  }));
}

// ── Claude call ───────────────────────────────────────────────────────────────

// Byte-identical across every keyword in a run ~ split out so it can sit behind
// a cache_control breakpoint instead of being re-sent (and re-priced) per call.
// Note: at ~110 tokens this sits below Sonnet-tier's ~2048-token minimum
// cacheable-prefix floor (see shared prompt-caching docs), so cache_control
// here is structurally correct but likely won't produce real cache_read hits
// until this instruction block grows ~ same caveat as api/chat.js's AURA prompt.
const SYSTEM_INSTRUCTIONS = `Identify the top 3 organic results for the search query you're given. For each: summarize what angle/structure they use, approximate word count, and what they cover that a competing post might be missing. Then note whether vibrationofawesome.com or any Boom Frequency content appears anywhere in the search results or in an AI Overview if one is shown. Return structured JSON:
{ "keyword": string, "top3": [{"url": string, "angle": string, "gaps": string}], "voa_present": boolean, "voa_position": number or null, "ai_overview_mentions_voa": boolean }

Return ONLY the JSON object. No markdown fences, no commentary before or after it.`;

function buildPrompt(keyword) {
  return `Search for "${keyword}".`;
}

/**
 * Join all text blocks (a web-search response often has commentary text before
 * the JSON fence, sometimes across more than one text block interleaved with
 * tool-use/tool-result blocks) so parseJsonLoose can find the JSON regardless
 * of which block or position it landed in.
 */
function extractFinalText(message) {
  const textBlocks = message.content.filter((b) => b.type === "text");
  if (textBlocks.length === 0) return null;
  return textBlocks.map((b) => b.text).join("\n");
}

function parseJsonLoose(raw) {
  if (!raw) return null;
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch (_) {
    return null;
  }
}

async function checkKeyword(client, item) {
  const message = await client.messages.create({
    model: MODEL,
    // 2048 was too tight: adaptive thinking (on by default for Sonnet 5) plus
    // 1-3 rounds of web_search tool use can burn the whole budget before any
    // text block is emitted, leaving extractFinalText() with nothing. 4096
    // confirmed sufficient in live testing on 2026-07-09.
    max_tokens: 4096,
    tools: [{ type: "web_search_20260209", name: "web_search" }],
    system: [{ type: "text", text: SYSTEM_INSTRUCTIONS, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: buildPrompt(item.keyword) }],
  });

  const raw = extractFinalText(message);
  const parsed = parseJsonLoose(raw);
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.top3)) {
    throw new Error(`Malformed response for "${item.keyword}" (stop_reason: ${message.stop_reason}) ~ could not parse JSON from: ${(raw || "(empty ~ no text block in response)").slice(0, 200)}`);
  }

  // Normalize/defend against missing fields so the report builder never crashes
  return {
    keyword: parsed.keyword || item.keyword,
    ourUrl: item.url,
    top3: parsed.top3.slice(0, 3).map((r) => ({
      url: r?.url || "(no url returned)",
      angle: r?.angle || "(not provided)",
      wordCount: r?.word_count || r?.wordCount || null,
      gaps: r?.gaps || "(not provided)",
    })),
    voaPresent: Boolean(parsed.voa_present),
    voaPosition: typeof parsed.voa_position === "number" ? parsed.voa_position : null,
    aiOverviewMentionsVoa: Boolean(parsed.ai_overview_mentions_voa),
  };
}

// ── Report ────────────────────────────────────────────────────────────────────

function visibilityFlag(result) {
  if (result.aiOverviewMentionsVoa) return "🤖 AI Overview mention";
  if (result.voaPresent) return "✅ ranking";
  return "❌ not found";
}

function buildMarkdownReport(date, results, errors) {
  const lines = [];
  lines.push(`# SERP Intelligence + AI Search Visibility Report ~ ${date}`);
  lines.push("");
  lines.push(`Checked ${results.length} keyword(s) from the most recently published Boom Frequency posts.`);
  if (errors.length > 0) {
    lines.push(`${errors.length} keyword(s) failed and were skipped (see bottom of report).`);
  }
  lines.push("");

  const rankingCount = results.filter((r) => r.voaPresent).length;
  const aiOverviewCount = results.filter((r) => r.aiOverviewMentionsVoa).length;
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Ranking (found in organic results): **${rankingCount}/${results.length}**`);
  lines.push(`- AI Overview mentions: **${aiOverviewCount}/${results.length}**`);
  lines.push(`- Not found anywhere: **${results.length - rankingCount}/${results.length}**`);
  lines.push("");

  const allGaps = [];

  for (const r of results) {
    lines.push(`## ${r.keyword}`);
    lines.push("");
    lines.push(`**Visibility:** ${visibilityFlag(r)}${r.voaPosition ? ` (position ~${r.voaPosition})` : ""}`);
    lines.push(`**Our post:** ${r.ourUrl}`);
    lines.push("");
    lines.push("### Top 3 organic results");
    lines.push("");
    r.top3.forEach((res, i) => {
      lines.push(`${i + 1}. **${res.url}**`);
      lines.push(`   - Angle/structure: ${res.angle}`);
      if (res.wordCount) lines.push(`   - Approx. word count: ${res.wordCount}`);
      lines.push(`   - Gaps a competing post might exploit: ${res.gaps}`);
      if (res.gaps && res.gaps !== "(not provided)") {
        allGaps.push(`**${r.keyword}** (vs. ${res.url}): ${res.gaps}`);
      }
    });
    lines.push("");
  }

  lines.push("## Gap opportunities");
  lines.push("");
  if (allGaps.length === 0) {
    lines.push("- No specific gaps surfaced this run.");
  } else {
    for (const g of allGaps) lines.push(`- ${g}`);
  }
  lines.push("");

  if (errors.length > 0) {
    lines.push("## Skipped / errored keywords");
    lines.push("");
    for (const e of errors) lines.push(`- **${e.keyword}**: ${e.message}`);
    lines.push("");
  }

  return lines.join("\n");
}

const DASHBOARD_HISTORY_CAP = 12; // ~ a quarter's worth of weekly checks

/**
 * Writes a machine-readable snapshot for the dashboard (static/dashboard/index.html)
 * to consume via fetch ~ no extra API calls, this is the same data as the markdown
 * report, just structured for the browser instead of prose for a human.
 */
function writeDashboardSnapshot(today, keywordTotal, results, errors) {
  const dataDir = path.join(ROOT, "static", "_data");
  const file = path.join(dataDir, "serp-intelligence.json");
  fs.mkdirSync(dataDir, { recursive: true });

  let existing = { history: [], latest: null };
  if (fs.existsSync(file)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      if (parsed && Array.isArray(parsed.history)) existing = parsed;
    } catch (_) {
      // corrupt/missing ~ start fresh rather than fail the whole run
    }
  }

  const rankingCount = results.filter((r) => r.voaPresent).length;
  const aiOverviewCount = results.filter((r) => r.aiOverviewMentionsVoa).length;

  const history = [
    ...existing.history.filter((h) => h.date !== today),
    { date: today, ranking: rankingCount, total: keywordTotal, aiOverview: aiOverviewCount },
  ].slice(-DASHBOARD_HISTORY_CAP);

  const latest = {
    date: today,
    results: results.map((r) => ({
      keyword: r.keyword,
      ourUrl: r.ourUrl,
      visibility: r.aiOverviewMentionsVoa ? "ai_overview" : r.voaPresent ? "ranking" : "not_found",
      voaPosition: r.voaPosition,
      topGap: r.top3[0]?.gaps || null,
    })),
    errors,
  };

  fs.writeFileSync(file, JSON.stringify({ history, latest }, null, 2), "utf8");
  return file;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  console.log(`[serp-intelligence] Loading top ${KEYWORD_COUNT} keyword(s) from live Boom posts...`);

  const keywords = loadTopKeywords(KEYWORD_COUNT);
  console.log(`[serp-intelligence] ${keywords.length} keyword(s) loaded:`);
  keywords.forEach((k, i) => console.log(`  ${i + 1}. ${k.keyword}`));

  const client = createAnthropicClient({ label: "serp-intelligence" });

  const results = [];
  const errors = [];

  for (const item of keywords) {
    console.log(`\n[serp-intelligence] Checking: "${item.keyword}"`);
    try {
      const result = await checkKeyword(client, item);
      results.push(result);
      console.log(`  -> ${visibilityFlag(result)}`);
    } catch (err) {
      console.error(`  -> ERROR: ${err.message}`);
      errors.push({ keyword: item.keyword, message: err.message });
    }
  }

  const reportDir = path.join(ROOT, "reports");
  fs.mkdirSync(reportDir, { recursive: true });
  const reportFile = path.join(reportDir, `serp-intelligence-${today}.md`);
  const markdown = buildMarkdownReport(today, results, errors);
  fs.writeFileSync(reportFile, markdown, "utf8");

  console.log(`\n[serp-intelligence] Report written to ${path.relative(ROOT, reportFile)}`);

  const snapshotFile = writeDashboardSnapshot(today, keywords.length, results, errors);
  console.log(`[serp-intelligence] Dashboard snapshot written to ${path.relative(ROOT, snapshotFile)}`);

  const rankingCount = results.filter((r) => r.voaPresent).length;
  const aiOverviewCount = results.filter((r) => r.aiOverviewMentionsVoa).length;

  // Machine-readable summary line for the GitHub Actions workflow to pick up.
  console.log(`SERP_SUMMARY ranking=${rankingCount} total=${keywords.length} ai_overview=${aiOverviewCount}`);

  if (errors.length === keywords.length && keywords.length > 0) {
    console.error("[serp-intelligence] All keyword checks failed.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[serp-intelligence] Fatal error:", err.message);
  process.exit(1);
});
