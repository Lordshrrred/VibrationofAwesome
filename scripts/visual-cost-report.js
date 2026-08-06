/**
 * visual-cost-report.js
 *
 * 7-day Ideogram usage ledger: how many images were generated, how many were
 * reused from cache, which platforms were served, and estimated cost.
 *
 * Usage:
 *   node scripts/visual-cost-report.js           # last 7 days (default)
 *   node scripts/visual-cost-report.js --days 30 # custom window
 */

import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { pathToFileURL as __voaPathToFileURL } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY  = path.join(__dirname, "../static/_data/image-registry.json");

// Approx cost per image by model (USD)
const MODEL_COST = {
  V_2_TURBO: 0.02,
  V_2:       0.08,
};

function parseDays() {
  const idx = process.argv.indexOf("--days");
  if (idx !== -1 && process.argv[idx + 1]) return parseInt(process.argv[idx + 1], 10);
  return 7;
}

function main() {
  const days   = parseDays();
  const cutoff = Date.now() - days * 86_400_000;

  if (!fs.existsSync(REGISTRY)) {
    console.log("No image-registry.json found ~ nothing to report.");
    return;
  }

  const all     = JSON.parse(fs.readFileSync(REGISTRY, "utf8"));
  const window  = all.filter(e => new Date(e.timestamp || 0).getTime() > cutoff);
  const ideogram = window.filter(e => e.source?.startsWith("ideogram"));
  const pexels   = window.filter(e => !e.source?.startsWith("ideogram"));

  // Fresh vs reused
  const fresh   = ideogram.filter(e => !e.reused);
  const reused  = ideogram.filter(e => e.reused);
  const shared  = fresh.filter(e => e.is_shared_asset);

  // Platform breakdown
  const byPlatform = {};
  for (const entry of window) {
    for (const p of (entry.platforms_used || [])) {
      byPlatform[p] = (byPlatform[p] || 0) + 1;
    }
  }

  // Model breakdown + cost
  const byModel = {};
  let estimatedCost = 0;
  for (const entry of fresh) {
    const model = entry.model || "V_2_TURBO";
    byModel[model] = (byModel[model] || 0) + 1;
    estimatedCost += MODEL_COST[model] ?? MODEL_COST.V_2_TURBO;
  }

  // Savings from shared assets and reuse
  const savedFromShared = shared.length * (MODEL_COST.V_2_TURBO);
  const savedFromReuse  = reused.length  * (MODEL_COST.V_2_TURBO);

  console.log(`\n╔═ VOA Visual Cost Report (last ${days} days) ════════════════`);
  console.log(`║  Registry window:  ${window.length} total entries`);
  console.log(`║  Ideogram total:   ${ideogram.length}  (fresh: ${fresh.length}  reused: ${reused.length})`);
  console.log(`║  Pexels/fallback:  ${pexels.length}`);
  console.log("║");

  if (Object.keys(byModel).length) {
    console.log("║  Model breakdown:");
    for (const [model, count] of Object.entries(byModel)) {
      const unitCost = MODEL_COST[model] ?? MODEL_COST.V_2_TURBO;
      console.log(`║    ${model.padEnd(12)} × ${count}  @ $${unitCost.toFixed(2)} = $${(count * unitCost).toFixed(2)}`);
    }
  }

  console.log("║");
  console.log(`║  Estimated spend:  $${estimatedCost.toFixed(2)}`);
  console.log(`║  Shared assets:    ${shared.length}  (saved ~$${savedFromShared.toFixed(2)} vs two separate calls)`);
  console.log(`║  Reused from cache:${reused.length}  (saved ~$${savedFromReuse.toFixed(2)})`);
  console.log(`║  Total saved:      ~$${(savedFromShared + savedFromReuse).toFixed(2)}`);
  console.log("║");

  if (Object.keys(byPlatform).length) {
    console.log("║  Images served by platform:");
    const sorted = Object.entries(byPlatform).sort((a, b) => b[1] - a[1]);
    for (const [platform, count] of sorted) {
      console.log(`║    ${platform.padEnd(22)} ${count}`);
    }
  }

  // Archetype distribution (Instagram)
  const archetypes = {};
  for (const entry of ideogram) {
    const label = entry.instagram_archetype_label;
    if (label) archetypes[label] = (archetypes[label] || 0) + 1;
  }
  if (Object.keys(archetypes).length) {
    console.log("║");
    console.log("║  Instagram archetype distribution:");
    const sorted = Object.entries(archetypes).sort((a, b) => b[1] - a[1]);
    for (const [label, count] of sorted) {
      console.log(`║    ${label.padEnd(30)} × ${count}`);
    }
  }

  console.log("╚═══════════════════════════════════════════════════════\n");
}

// CLI-only guard: without this, merely `import`-ing this module (from a test,
// another script, or a syntax/load check) executes a real run with real side
// effects. See CLAUDE.md ~ every script with a top-level main() needs this.
const __voaIsCli = process.argv[1] && import.meta.url === __voaPathToFileURL(process.argv[1]).href;
if (__voaIsCli) {
  main();
}
