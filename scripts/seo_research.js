#!/usr/bin/env node
/**
 * Explicit opt-in model-assisted SEO research wrapper.
 *
 * This is not a rank tracker and is never scheduled. It exists for occasional
 * pre-publication or competitor/title-pattern research when the user explicitly
 * accepts model/API cost.
 */

import { spawnSync } from "child_process";
import minimist from "minimist";

const argv = minimist(process.argv.slice(2), {
  string: ["query", "topic", "niche"],
  boolean: ["confirm-cost", "all-niches"],
});

if (!argv["confirm-cost"]) {
  console.error("This command uses Claude through scripts/seo-research.js and may spend API credits.");
  console.error("Re-run with --confirm-cost and --topic/--query when you explicitly want model-assisted research.");
  process.exit(1);
}

const args = ["scripts/seo-research.js"];
if (argv.topic || argv.query) args.push("--topic", argv.topic || argv.query);
if (argv.niche) args.push("--niche", argv.niche);
if (argv["all-niches"]) args.push("--all-niches");

console.log("Provider: Anthropic Claude via scripts/seo-research.js");
console.log("Use case: explicit manual keyword/topic research, not scheduled rank tracking.");
console.log("Cost control: one requested research run only; no Search Console/GA4 routine reporting uses this path.");

const result = spawnSync(process.execPath, args, { stdio: "inherit" });
process.exit(result.status ?? 1);
