#!/usr/bin/env node
/**
 * activate-drip.js ~ Flip the Boom Frequency drip queue from paused to active
 *
 * Usage:
 *   node scripts/activate-drip.js                      ~ active, no syndication, no feeder
 *   node scripts/activate-drip.js --syndicate           ~ active + syndicate each post on publish
 *   node scripts/activate-drip.js --feeder              ~ active + trigger feeder on publish
 *   node scripts/activate-drip.js --syndicate --feeder  ~ active + everything on
 *   node scripts/activate-drip.js --pause               ~ pause the drip (stop publishing)
 *
 * After updating drip-queue.json, this script commits and pushes.
 * The drip cron (drip-posts.yml) will pick it up on the next scheduled run.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import minimist from "minimist";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = path.resolve(__dirname, "..");

const argv = minimist(process.argv.slice(2), {
  boolean: ["syndicate", "feeder", "pause"],
});

const QUEUE_FILE = path.join(ROOT, "static", "_data", "drip-queue.json");

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

// ── Pause ────────────────────────────────────────────────────────────────────
if (argv.pause) {
  queue.status = "paused";
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2), "utf8");
  console.log("✓ Drip queue PAUSED — no posts will publish until re-activated.");
  commitAndPush("Pause drip queue");
  process.exit(0);
}

// ── Activate ─────────────────────────────────────────────────────────────────
queue.status                    = "active";
queue.syndicate_on_publish      = !!argv.syndicate;
queue.trigger_feeder_on_publish = !!argv.feeder;

fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2), "utf8");

console.log("\n✓ Drip queue ACTIVATED");
console.log("  Status:                    active");
console.log("  Syndicate on publish:      " + queue.syndicate_on_publish);
console.log("  Trigger feeder on publish: " + queue.trigger_feeder_on_publish);
console.log("  Posts remaining in queue:  " + queue.queue.length);
console.log("  Drip rate:                 " + (queue.drip_rate || 2) + " post(s) per day");
console.log("  Schedule:                  " + (queue.drip_time || "10:00 UTC") + " daily");

commitAndPush("Activate drip queue ~ " + queue.queue.length + " posts scheduled");

console.log("\n✓ Pushed. Drip starts on the next cron run at " + (queue.drip_time || "10:00 UTC") + ".");
console.log("  To publish immediately: node scripts/drip-publish.js\n");

// ── Git helpers ──────────────────────────────────────────────────────────────
function commitAndPush(message) {
  console.log("\nCommitting and pushing...");

  const add = spawnSync("git", ["add", "static/_data/drip-queue.json"], { cwd: ROOT, stdio: "inherit" });
  if (add.error || add.status !== 0) {
    console.error("git add failed."); process.exit(1);
  }

  const commit = spawnSync("git", ["commit", "-m", message + " [automated]"], { cwd: ROOT, stdio: "inherit" });
  if (commit.error) {
    console.error("git commit error:", commit.error.message); process.exit(1);
  }
  if (commit.status !== 0) {
    console.log("(nothing new to commit — drip-queue.json was already up to date)");
    return;
  }

  const push = spawnSync("git", ["push"], { cwd: ROOT, stdio: "inherit" });
  if (push.error || push.status !== 0) {
    console.error("git push failed. Push manually: git push"); process.exit(1);
  }
}
