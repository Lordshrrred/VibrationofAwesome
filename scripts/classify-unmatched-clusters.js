#!/usr/bin/env node
/**
 * classify-unmatched-clusters.js
 *
 * One-shot Haiku classification pass for posts the free inferCluster() keyword
 * heuristic (scripts/lib/internal-linking.js) couldn't place ~ titles too generic
 * for regex matching (e.g. "Why You Feel Stuck in Life"). Single batched Haiku
 * call, ~cents total. This is a lighter classification task, not full generation,
 * so it stays on Haiku per this repo's model-tier policy (see CLAUDE.md).
 *
 * Usage:
 *   node scripts/classify-unmatched-clusters.js              # dry run, prints proposed assignments
 *   node scripts/classify-unmatched-clusters.js --execute    # writes boom-posts.json
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import minimist from "minimist";
import dotenv from "dotenv";
import { createAnthropicClient } from "./lib/anthropic-client.js";
import { inferCluster, loadTopicClusters } from "./lib/internal-linking.js";

import { pathToFileURL as __voaPathToFileURL } from "node:url";
dotenv.config({ override: true });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, "..");
const BOOM_FILE = path.join(ROOT, "static", "_data", "boom-posts.json");

const argv    = minimist(process.argv.slice(2), { boolean: ["execute"] });
const execute = argv.execute;

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Error: ANTHROPIC_API_KEY not set. Copy .env.example to .env and add your key.");
  process.exit(1);
}

function buildPrompt(clusterData, posts) {
  const clusterList = clusterData.clusters
    .map((c) => `- ${c.key}: ${c.displayName} ~ ${c.pillar}`)
    .join("\n");
  const postList = posts
    .map((p, i) => `${i + 1}. [${p.slug}] "${p.title}" ~ ${(p.excerpt || "").slice(0, 150)}`)
    .join("\n");

  return `Here are the content clusters for a blog:
${clusterList}

Classify each post below into the single best-fitting cluster key. If a post genuinely doesn't fit any cluster well, use null instead of forcing a bad fit.

Posts:
${postList}

Return ONLY a JSON array, one object per post, in the same order:
[{"slug": string, "cluster": string or null}]
No markdown fences, no commentary.`;
}

function parseJsonLoose(raw) {
  if (!raw) return null;
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch (_) {
    return null;
  }
}

async function main() {
  const posts = JSON.parse(fs.readFileSync(BOOM_FILE, "utf8"));
  const clusterData = loadTopicClusters();
  const unmatched = posts.filter((p) => !(p.cluster && clusterData.byKey[p.cluster]));

  if (unmatched.length === 0) {
    console.log("[classify-unmatched] Nothing to classify ~ every post already has a valid cluster.");
    return;
  }

  console.log(`[classify-unmatched] ${unmatched.length} post(s) need classification. Calling Claude (Haiku, one batched call)...`);

  const client = createAnthropicClient({ label: "classify-unmatched-clusters" });
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [{ role: "user", content: buildPrompt(clusterData, unmatched) }],
  });

  const raw = message.content.find((b) => b.type === "text")?.text;
  const parsed = parseJsonLoose(raw);
  if (!parsed || !Array.isArray(parsed)) {
    console.error("[classify-unmatched] Could not parse a JSON array from the response:");
    console.error(raw);
    process.exit(1);
  }

  const bySlug = new Map(parsed.map((r) => [r.slug, r.cluster]));
  let applied = 0;
  let stillNull = 0;

  for (const p of unmatched) {
    const cluster = bySlug.get(p.slug);
    if (cluster && clusterData.byKey[cluster]) {
      console.log(`  ${p.title}\n    -> ${clusterData.byKey[cluster].displayName}`);
      if (execute) p.cluster = cluster;
      applied++;
    } else {
      console.log(`  ${p.title}\n    -> no good fit (left unclustered)`);
      stillNull++;
    }
  }

  console.log(`\n[classify-unmatched] ${applied} classified, ${stillNull} left unclustered (genuinely don't fit any cluster).`);
  console.log(`[classify-unmatched] Usage: input=${message.usage.input_tokens} output=${message.usage.output_tokens}`);

  if (execute) {
    fs.writeFileSync(BOOM_FILE, JSON.stringify(posts, null, 2), "utf8");
    console.log(`[classify-unmatched] Wrote ${applied} cluster assignment(s) to ${path.relative(ROOT, BOOM_FILE)}`);
  } else {
    console.log("[classify-unmatched] Dry run only. Re-run with --execute to write changes.");
  }
}

// CLI-only guard: without this, merely `import`-ing this module (from a test,
// another script, or a syntax/load check) executes a real run with real side
// effects. See CLAUDE.md ~ every script with a top-level main() needs this.
const __voaIsCli = process.argv[1] && import.meta.url === __voaPathToFileURL(process.argv[1]).href;
if (__voaIsCli) {
  main().catch((err) => {
    console.error("[classify-unmatched] Fatal error:", err.message);
    process.exit(1);
  });
}
