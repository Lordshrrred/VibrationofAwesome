#!/usr/bin/env node
/**
 * backfill-cluster-metadata.js
 *
 * Zero-API-cost fix for the "80 unclustered posts" gap surfaced by the SEO
 * Intelligence dashboard panel. Runs the existing local inferCluster() keyword
 * heuristic (scripts/lib/internal-linking.js ~ already used at generation/publish
 * time, no Claude API calls) against every published Boom post missing a
 * `cluster` field, and writes the result back to static/_data/boom-posts.json.
 *
 * Posts inferCluster() can't confidently match stay unclustered (null) rather
 * than being force-assigned ~ those are genuine content gaps, not a labeling bug.
 *
 * Usage:
 *   node scripts/backfill-cluster-metadata.js              # dry run, prints a report
 *   node scripts/backfill-cluster-metadata.js --execute     # writes boom-posts.json
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import minimist from "minimist";
import { inferCluster, loadTopicClusters } from "./lib/internal-linking.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, "..");

const BOOM_FILE = path.join(ROOT, "static", "_data", "boom-posts.json");

const argv    = minimist(process.argv.slice(2), { boolean: ["execute"] });
const execute = argv.execute;

function main() {
  if (!fs.existsSync(BOOM_FILE)) {
    console.error(`Error: ${BOOM_FILE} not found.`);
    process.exit(1);
  }

  const posts = JSON.parse(fs.readFileSync(BOOM_FILE, "utf8"));
  if (!Array.isArray(posts)) {
    console.error("Error: boom-posts.json is not an array.");
    process.exit(1);
  }

  const clusterData = loadTopicClusters();
  const clusterName = (key) => clusterData.byKey[key]?.displayName || key;

  let alreadyClustered = 0;
  let newlyClustered = 0;
  let stillUnmatched = 0;
  const assignments = []; // { slug, title, cluster }
  const unmatched = [];   // { slug, title }

  for (const post of posts) {
    if (post.cluster && clusterData.byKey[post.cluster]) {
      alreadyClustered++;
      continue;
    }

    const inferred = inferCluster(post, clusterData);
    if (inferred) {
      newlyClustered++;
      assignments.push({ slug: post.slug, title: post.title, cluster: inferred });
      if (execute) post.cluster = inferred;
    } else {
      stillUnmatched++;
      unmatched.push({ slug: post.slug, title: post.title });
    }
  }

  console.log(`[backfill-cluster] ${posts.length} total posts`);
  console.log(`[backfill-cluster] ${alreadyClustered} already had a valid cluster`);
  console.log(`[backfill-cluster] ${newlyClustered} matched a cluster via inferCluster() ${execute ? "(written)" : "(dry run ~ not written)"}`);
  console.log(`[backfill-cluster] ${stillUnmatched} still unmatched (genuine content gap, not a labeling bug)\n`);

  if (assignments.length) {
    console.log("New assignments:");
    const byCluster = new Map();
    for (const a of assignments) {
      if (!byCluster.has(a.cluster)) byCluster.set(a.cluster, []);
      byCluster.get(a.cluster).push(a);
    }
    for (const [cluster, items] of [...byCluster.entries()].sort((a, b) => b[1].length - a[1].length)) {
      console.log(`  ${clusterName(cluster)} (+${items.length})`);
      items.slice(0, 5).forEach((a) => console.log(`    - ${a.title}`));
      if (items.length > 5) console.log(`    ... and ${items.length - 5} more`);
    }
    console.log("");
  }

  if (unmatched.length) {
    console.log(`Still unmatched (${unmatched.length}) ~ titles too generic for the keyword rules to place:`);
    unmatched.slice(0, 15).forEach((u) => console.log(`  - ${u.title}`));
    if (unmatched.length > 15) console.log(`  ... and ${unmatched.length - 15} more`);
    console.log("");
  }

  // Post-backfill distribution
  const counts = new Map(clusterData.clusters.map((c) => [c.key, 0]));
  let unclustered = 0;
  for (const post of posts) {
    const effectiveCluster = execute ? post.cluster : (post.cluster && clusterData.byKey[post.cluster] ? post.cluster : inferCluster(post, clusterData));
    if (effectiveCluster && counts.has(effectiveCluster)) counts.set(effectiveCluster, counts.get(effectiveCluster) + 1);
    else unclustered++;
  }
  console.log(`Projected distribution ${execute ? "(applied)" : "(if --execute were passed)"}:`);
  for (const c of clusterData.clusters) {
    console.log(`  ${clusterName(c.key).padEnd(38)} ${counts.get(c.key)}`);
  }
  console.log(`  ${"(unclustered)".padEnd(38)} ${unclustered}`);

  if (execute) {
    fs.writeFileSync(BOOM_FILE, JSON.stringify(posts, null, 2), "utf8");
    console.log(`\n[backfill-cluster] Wrote ${newlyClustered} cluster assignment(s) to ${path.relative(ROOT, BOOM_FILE)}`);
  } else {
    console.log("\n[backfill-cluster] Dry run only. Re-run with --execute to write changes.");
  }
}

main();
