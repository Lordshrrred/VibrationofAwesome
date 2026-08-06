#!/usr/bin/env node
/**
 * Replenish the Boom drip queue from unused, pre-approved niche research.
 *
 * This is the no-surprises fallback for queue depletion. It never invents a
 * new niche and deliberately excludes time-sensitive campaign niches such as
 * AI Advantage. Those require fresh editorial/search validation.
 *
 * Preview:
 *   node scripts/replenish-drip-queue.js
 * Execute when at/below the threshold:
 *   node scripts/replenish-drip-queue.js --execute
 */
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import minimist from "minimist";
import { EARTHSTAR_NICHES } from "./content-niches.js";
import { inferCluster, loadTopicClusters } from "./lib/internal-linking.js";
import { slugify } from "./lib/utils.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const QUEUE_FILE = path.join(ROOT, "static/_data/drip-queue.json");
const POSTS_FILE = path.join(ROOT, "static/_data/boom-posts.json");
const DRAFTS_DIR = path.join(ROOT, "static/blog/boom/drafts");
const argv = minimist(process.argv.slice(2), {
  boolean: ["execute", "force"],
  string: ["threshold", "target", "max", "niche"],
});

const threshold = Math.max(0, Number(argv.threshold || process.env.QUEUE_REPLENISH_THRESHOLD || 14));
const target = Math.max(threshold + 1, Number(argv.target || process.env.QUEUE_REPLENISH_TARGET || 28));
const maxGenerate = Math.max(1, Number(argv.max || process.env.QUEUE_REPLENISH_MAX || 14));

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (_) { return fallback; }
}

function normalize(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function semanticTokens(value) {
  const stop = new Set(["a", "an", "and", "are", "for", "from", "how", "i", "in", "is", "it", "of", "on", "the", "to", "what", "when", "why", "with", "you", "your"]);
  return new Set(normalize(value).split(" ").filter(Boolean).filter(token => !stop.has(token)).map(token => {
    if (token.length > 5 && token.endsWith("ing")) return token.slice(0, -3);
    if (token.length > 4 && token.endsWith("ed")) return token.slice(0, -2);
    if (token.length > 4 && token.endsWith("s")) return token.slice(0, -1);
    return token;
  }));
}

function isNearDuplicate(candidate, rows) {
  const a = semanticTokens(candidate);
  if (a.size < 2) return false;
  return rows.some(row => {
    const b = semanticTokens(`${row.title || ""} ${row.keyword || ""}`);
    if (b.size < 2) return false;
    let overlap = 0;
    for (const token of a) if (b.has(token)) overlap += 1;
    return overlap / Math.min(a.size, b.size) >= 0.6;
  });
}

function titleCase(keyword) {
  const preserve = new Map([
    ["ai", "AI"], ["chatgpt", "ChatGPT"], ["claude", "Claude"],
    ["adhd", "ADHD"], ["diy", "DIY"], ["vs", "vs"],
  ]);
  return String(keyword).split(/\s+/).map((word, index) => {
    const clean = word.toLowerCase();
    if (preserve.has(clean)) return preserve.get(clean);
    if (index > 0 && ["a", "an", "and", "for", "in", "of", "on", "the", "to", "with"].includes(clean)) return clean;
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  }).join(" ");
}

function buildCandidates(existingRows, onlyNiche = "") {
  const used = new Set();
  for (const row of existingRows) {
    used.add(normalize(row.keyword));
    used.add(normalize(row.title));
    used.add(normalize(String(row.slug || "").replace(/-/g, " ")));
  }

  // Campaigns remain editorially curated. The evergreen reserve follows the
  // live four-slot mix: two core evergreen, one practical AI, and one art.
  const niches = EARTHSTAR_NICHES.filter(niche =>
    (!onlyNiche && niche.slug !== "ai-advantage-campaign") || (onlyNiche && niche.slug === onlyNiche)
  );
  if (onlyNiche && niches.length === 0) throw new Error(`Unknown niche: ${onlyNiche}`);
  const perNiche = niches.map(niche => {
    const rows = [];
    for (const [intent, keywords] of Object.entries(niche.keywordResearch || {})) {
      for (const keyword of keywords || []) {
        if (!used.has(normalize(keyword)) && !isNearDuplicate(keyword, existingRows)) rows.push({ niche, intent, keyword });
      }
    }
    return rows;
  });

  const candidates = [];
  const append = row => {
    if (!row || used.has(normalize(row.keyword))) return;
    used.add(normalize(row.keyword));
    candidates.push(row);
  };
  if (onlyNiche) {
    perNiche[0].forEach(append);
    return candidates;
  }

  const aiIndex = niches.findIndex(niche => niche.slug === "ai-creator-tools");
  const artIndex = niches.findIndex(niche => niche.slug === "art-buyer-intent");
  const coreRows = perNiche.filter((_, index) => index !== aiIndex && index !== artIndex);
  const aiRows = perNiche[aiIndex] || [];
  const artRows = perNiche[artIndex] || [];
  let coreNiche = 0;
  let coreItem = 0;
  let aiItem = 0;
  let artItem = 0;
  while (coreRows.some(rows => coreItem < rows.length) || aiItem < aiRows.length || artItem < artRows.length) {
    append(coreRows[coreNiche % Math.max(1, coreRows.length)]?.[coreItem]);
    append(aiRows[aiItem++]);
    coreNiche += 1;
    append(coreRows[coreNiche % Math.max(1, coreRows.length)]?.[coreItem]);
    append(artRows[artItem++]);
    coreNiche += 1;
    if (coreRows.length && coreNiche % coreRows.length === 0) coreItem += 1;
  }
  return candidates;
}

function main() {
  const queue = readJson(QUEUE_FILE, null);
  if (!queue || !Array.isArray(queue.queue)) throw new Error("drip-queue.json is missing or invalid");
  const published = readJson(POSTS_FILE, []);
  const remaining = queue.queue.length;
  const needed = Math.min(maxGenerate, Math.max(0, target - remaining));

  console.log(`[replenish] queue=${remaining} threshold=${threshold} target=${target} max=${maxGenerate}`);
  if (!argv.force && remaining > threshold) {
    console.log(`[replenish] No action: inventory is above the ${threshold}-post trigger.`);
    return;
  }
  if (needed === 0) {
    console.log("[replenish] No action: target inventory is already satisfied.");
    return;
  }

  const candidates = buildCandidates([...published, ...queue.queue], argv.niche || "");
  const plan = candidates.slice(0, needed);
  if (plan.length < needed) {
    throw new Error(`Only ${plan.length} unused approved keyword(s) remain; ${needed} are needed. Add curated research before the reserve is exhausted.`);
  }

  console.log(`[replenish] Planned ${plan.length} evergreen draft(s):`);
  plan.forEach(row => console.log(`- ${row.niche.slug}: ${row.keyword}`));
  if (!argv.execute) {
    console.log("[replenish] Preview only. Add --execute to generate and queue these drafts.");
    return;
  }

  fs.mkdirSync(DRAFTS_DIR, { recursive: true });
  const clusterData = loadTopicClusters();
  const added = [];
  const failures = [];

  for (const row of plan) {
    const title = titleCase(row.keyword);
    const before = new Set(fs.readdirSync(DRAFTS_DIR).filter(name => name.endsWith(".html")));
    const result = spawnSync("node", [
      "scripts/generate-post.js",
      "--lane", "boom",
      "--niche", row.niche.slug,
      "--keyword", row.keyword,
      "--topic", row.niche.displayName,
      "--title", title,
      "--draft",
      "--skip-syndicate",
    ], { cwd: ROOT, stdio: "inherit", timeout: 240_000 });

    if (result.error || result.status !== 0) {
      failures.push(`${row.keyword}: ${result.error?.message || `exit ${result.status}`}`);
      continue;
    }

    const created = fs.readdirSync(DRAFTS_DIR)
      .filter(name => name.endsWith(".html") && !before.has(name));
    const slug = created.length === 1 ? created[0].replace(/\.html$/, "") : slugify(title);
    const cluster = inferCluster({ title, keyword: row.keyword, niche: row.niche.slug, pillar: row.niche.displayName }, clusterData);
    const item = {
      slug,
      title,
      keyword: row.keyword,
      niche: row.niche.slug,
      cluster,
      pillar: row.niche.displayName,
      replenished_at: new Date().toISOString(),
    };
    if (row.niche.slug === "art-buyer-intent") {
      item.syndication_profile = "art-devto2-only";
      item.syndicate_on_publish = true;
      item.trigger_feeder_on_publish = false;
    }
    queue.queue.push(item);
    added.push(item);
  }

  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2), "utf8");
  console.log(`[replenish] Added ${added.length}; queue now has ${queue.queue.length} post(s).`);
  if (failures.length) {
    console.error(`[replenish] ${failures.length} generation failure(s):\n- ${failures.join("\n- ")}`);
    process.exitCode = 1;
  }
  if (added.length === 0) throw new Error("No drafts were generated; the queue was not replenished.");
}

try { main(); } catch (error) { console.error(`[replenish] ${error.message}`); process.exit(1); }
