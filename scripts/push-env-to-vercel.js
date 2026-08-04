#!/usr/bin/env node
/**
 * push-env-to-vercel.js
 *
 * Reads your .env file and pushes the required environment variables
 * to your Vercel project using the Vercel API.
 *
 * Required in .env before running:
 *   VERCEL_TOKEN      ~ create at https://vercel.com/account/tokens
 *   VERCEL_PROJECT_ID ~ find in Vercel project Settings → General
 *
 * Usage:
 *   node scripts/push-env-to-vercel.js              ~ push all required vars
 *   node scripts/push-env-to-vercel.js --dry-run    ~ preview what would be pushed
 *   node scripts/push-env-to-vercel.js --list       ~ show current Vercel env vars
 */

import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";
import minimist from "minimist";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, "..");
const ENV_PATH  = path.join(ROOT, ".env");

const argv = minimist(process.argv.slice(2), { boolean: ["dry-run", "list", "force"] });

// ── Load .env ─────────────────────────────────────────────────────────────────
function loadEnv(envPath) {
  if (!fs.existsSync(envPath)) return {};
  const vars = {};
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (val) vars[key] = val;
  }
  return vars;
}

// ── Vercel API helpers ────────────────────────────────────────────────────────
async function vercelFetch(path, options = {}, token) {
  const resp = await fetch(`https://api.vercel.com${path}`, {
    ...options,
    headers: {
      Authorization:  `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(`Vercel API ${resp.status}: ${data.error?.message || JSON.stringify(data)}`);
  return data;
}

async function listEnvVars(projectId, token) {
  const data = await vercelFetch(`/v9/projects/${encodeURIComponent(projectId)}/env`, {}, token);
  return Array.isArray(data.envs) ? data.envs : [];
}

async function upsertEnvVar(projectId, token, key, value, targets, dryRun) {
  const existing = (await listEnvVars(projectId, token)).find(e => e.key === key);

  if (dryRun) {
    console.log(`  [dry-run] ${existing ? "UPDATE" : "CREATE"} ${key} (${targets.join(",")})`);
    return;
  }

  if (existing) {
    await vercelFetch(`/v9/projects/${encodeURIComponent(projectId)}/env/${existing.id}`, {
      method: "PATCH",
      body: JSON.stringify({ value, target: targets, type: "encrypted" }),
    }, token);
    console.log(`  ✓ Updated ${key}`);
  } else {
    await vercelFetch(`/v9/projects/${encodeURIComponent(projectId)}/env`, {
      method: "POST",
      body: JSON.stringify({ key, value, target: targets, type: "encrypted" }),
    }, token);
    console.log(`  ✓ Created ${key}`);
  }
}

// ── Which keys to push ────────────────────────────────────────────────────────
// Keys are grouped by priority. Edit this list to add/remove vars.
const REQUIRED_KEYS = [
  // Core AI
  "ANTHROPIC_API_KEY",
  // Stripe ~ AURA Premium
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_ID_AURA_PREMIUM",
  "STRIPE_PRICE_ID_USER_MANUAL",
  // Site
  "SITE_URL",
  "DASHBOARD_PASSWORD",
  "EDITOR_API_BASE",
  "EDITOR_SESSION_SECRET",
  // Editor GitHub backend
  "GITHUB_EDITOR_TOKEN",
  "GITHUB_EDITOR_REPO",
  "GITHUB_EDITOR_BRANCH",
];

const OPTIONAL_KEYS = [
  // Ebook delivery
  "VALID_EBOOK_TOKENS",
  "FIELD_GUIDE_DOWNLOAD_PATH",
  // Email providers
  "MAILERLITE_API_KEY",
  "MAILERLITE_FIELD_GUIDE_GROUP_ID",
  "MAILERLITE_USER_MANUAL_WAITLIST_GROUP_ID",
  "PROVIDER",
  // GA4
  "GA_CREDENTIALS_JSON",
  "GA_PROPERTY_ID",
  // Stripe optional
  "STRIPE_ENABLE_AUTOMATIC_TAX",
  "STRIPE_PUBLIC_KEY",
];

async function main() {
  const env = loadEnv(ENV_PATH);

  const token     = env.VERCEL_TOKEN;
  const projectId = env.VERCEL_PROJECT_ID;

  if (!token || token.startsWith("your_")) {
    console.error("\nERROR: VERCEL_TOKEN not set in .env");
    console.error("Create one at: https://vercel.com/account/tokens");
    console.error('Then add to .env: VERCEL_TOKEN=your_token_here\n');
    process.exit(1);
  }

  if (!projectId || projectId.startsWith("your_")) {
    console.error("\nERROR: VERCEL_PROJECT_ID not set in .env");
    console.error("Find it in: Vercel Dashboard → your project → Settings → General → Project ID");
    console.error('Then add to .env: VERCEL_PROJECT_ID=prj_xxxxxxxxxxxx\n');
    process.exit(1);
  }

  // List mode
  if (argv.list) {
    const vars = await listEnvVars(projectId, token);
    console.log(`\nVercel env vars for project ${projectId} (${vars.length} total):\n`);
    for (const v of vars.sort((a, b) => a.key.localeCompare(b.key))) {
      console.log(`  ${v.key}  [${v.target?.join(",") || "?"}]`);
    }
    return;
  }

  const targets = ["production", "preview"];
  const dryRun  = argv["dry-run"];

  console.log(`\nPushing env vars to Vercel project ${projectId}${dryRun ? " [DRY RUN]" : ""}...`);

  let pushed = 0, skipped = 0;

  for (const key of REQUIRED_KEYS) {
    const value = env[key];
    if (!value || value.startsWith("your_") || value.endsWith("...")) {
      console.log(`  ~ SKIP ${key} (not set in .env)`);
      skipped++;
      continue;
    }
    await upsertEnvVar(projectId, token, key, value, targets, dryRun);
    pushed++;
  }

  console.log("\nOptional keys:");
  for (const key of OPTIONAL_KEYS) {
    const value = env[key];
    if (!value) continue;
    await upsertEnvVar(projectId, token, key, value, targets, dryRun);
    pushed++;
  }

  console.log(`\n${dryRun ? "[dry-run] Would push" : "Pushed"} ${pushed} vars, skipped ${skipped} unset.\n`);

  if (!dryRun) {
    console.log("Next: trigger a Vercel redeploy so the new env vars take effect.");
    console.log("  vercel redeploy --prod   (if you have Vercel CLI installed)");
    console.log("  or push a commit to main\n");
  }
}

main().catch(err => { console.error("Fatal:", err.message); process.exit(1); });
