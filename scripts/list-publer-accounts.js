#!/usr/bin/env node
/**
 * Safe read-only Publer account audit.
 *
 * Lists connected accounts with non-sensitive fields only:
 *   platform (provider), display name, username/handle, account ID.
 *
 * Never prints API keys, tokens, or authorization headers.
 * Never posts, schedules, or mutates anything.
 *
 * Usage:
 *   npm run check:publer-accounts
 *   node scripts/list-publer-accounts.js [--platform facebook] [--json]
 */

import dotenv from "dotenv";
import minimist from "minimist";

import { pathToFileURL as __voaPathToFileURL } from "node:url";
dotenv.config({ override: true });

const argv = minimist(process.argv.slice(2), {
  string: ["platform"],
  boolean: ["json"],
});

const PUBLER_API_KEY      = process.env.PUBLER_API_KEY;
const PUBLER_WORKSPACE_ID = process.env.PUBLER_WORKSPACE_ID;

if (!PUBLER_API_KEY || !PUBLER_WORKSPACE_ID) {
  console.error("Missing PUBLER_API_KEY or PUBLER_WORKSPACE_ID in .env");
  process.exit(1);
}

// Known pinned VOA account IDs (non-secret identifiers)
const KNOWN_VOA_IDS = {
  "6a0698ee1f0e47d9f3f18a43": "VOA Instagram @vibrationofawesome",
  "6a069b7979cc0b32f3235166": "VOA Threads @vibrationofawesome",
  "6a052b620ce3c7cac0c7ebac": "VOA Pinterest @awesomevibe",
};

// Env vars that pin account IDs for each platform
const PINNED_ENV = {
  instagram: process.env.PUBLER_INSTAGRAM_ACCOUNT_ID,
  threads:   process.env.PUBLER_THREADS_ACCOUNT_ID,
  pinterest: process.env.PUBLER_PINTEREST_ACCOUNT_ID,
  facebook:  process.env.PUBLER_FACEBOOK_ACCOUNT_ID,
};

async function fetchAccounts() {
  const resp = await fetch("https://app.publer.com/api/v1/accounts", {
    headers: {
      Authorization: `Bearer-API ${PUBLER_API_KEY}`,
      "Publer-Workspace-Id": PUBLER_WORKSPACE_ID,
      Accept: "application/json",
    },
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`Publer /accounts HTTP ${resp.status}: ${body.slice(0, 200)}`);
  }
  const data = await resp.json().catch(() => null);
  return Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
}

function safeFields(account) {
  // Only expose non-sensitive identification fields
  return {
    id:       account.id      || account.account_id || "(no id)",
    platform: account.provider || account.platform  || "(unknown)",
    name:     account.name    || account.display_name || "",
    username: account.username || account.handle     || "",
    type:     account.type    || account.account_type || "",
    page_id:  account.page_id || account.fb_page_id  || "",
  };
}

function label(safe) {
  const known = KNOWN_VOA_IDS[safe.id];
  if (known) return `[VOA pinned] ${known}`;

  const pinnedFor = Object.entries(PINNED_ENV).find(([, v]) => v === safe.id);
  if (pinnedFor) return `[pinned as ${pinnedFor[0]}]`;

  return "";
}

async function main() {
  const accounts = await fetchAccounts();

  const filterPlatform = argv.platform?.toLowerCase();
  const displayed = filterPlatform
    ? accounts.filter(a => (a.provider || a.platform || "").toLowerCase() === filterPlatform)
    : accounts;

  const safe = displayed.map(safeFields);

  if (argv.json) {
    console.log(JSON.stringify(safe, null, 2));
    return;
  }

  // Group by platform for readable output
  const byPlatform = {};
  for (const s of safe) {
    (byPlatform[s.platform] = byPlatform[s.platform] || []).push(s);
  }

  console.log("\nPubler connected accounts (safe fields only)\n");

  const platforms = Object.keys(byPlatform).sort();
  for (const platform of platforms) {
    const list = byPlatform[platform];
    console.log(`  ${platform.toUpperCase()} (${list.length})`);
    for (const s of list) {
      const lbl = label(s);
      const display = [s.name, s.username].filter(Boolean).join(" / ") || "(no name)";
      const pageNote = s.page_id ? ` [page_id:${s.page_id}]` : "";
      const typeNote = s.type ? ` [type:${s.type}]` : "";
      const voaNote  = lbl ? `  <-- ${lbl}` : "";
      console.log(`    id:${s.id}  ${display}${typeNote}${pageNote}${voaNote}`);
    }
    console.log();
  }

  const facebookAccounts = safe.filter(s => s.platform === "facebook");
  if (facebookAccounts.length > 0) {
    const envPinned = PINNED_ENV.facebook;
    console.log("── Facebook VOA candidate summary ──────────────────────────────");
    if (envPinned) {
      const pinned = facebookAccounts.find(s => s.id === envPinned);
      if (pinned) {
        console.log(`  PUBLER_FACEBOOK_ACCOUNT_ID is set and resolves to:`);
        console.log(`    id:${pinned.id}  ${[pinned.name, pinned.username].filter(Boolean).join(" / ")}`);
        console.log(`  This is the account that will be used for Facebook VOA posting.`);
      } else {
        console.log(`  PUBLER_FACEBOOK_ACCOUNT_ID is set but NOT found in Publer account list.`);
        console.log(`  Check that the account is still connected in Publer workspace.`);
      }
    } else {
      console.log(`  PUBLER_FACEBOOK_ACCOUNT_ID is NOT set.`);
      console.log(`  ${facebookAccounts.length} Facebook account(s) connected:`);
      for (const s of facebookAccounts) {
        console.log(`    id:${s.id}  ${[s.name, s.username].filter(Boolean).join(" / ")}`);
      }
      console.log(`  To pin the VOA account, add to .env:`);
      console.log(`    PUBLER_FACEBOOK_ACCOUNT_ID=<id from above>`);
    }
    console.log();
  }
}

// CLI-only guard: without this, merely `import`-ing this module (from a test,
// another script, or a syntax/load check) executes a real run with real side
// effects. See CLAUDE.md ~ every script with a top-level main() needs this.
const __voaIsCli = process.argv[1] && import.meta.url === __voaPathToFileURL(process.argv[1]).href;
if (__voaIsCli) {
  main().catch(e => {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  });
}
