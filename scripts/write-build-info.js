#!/usr/bin/env node
/**
 * write-build-info.js ~ stamps the commit being deployed into static/build-info.json
 * so the live site can report exactly which commit it is serving.
 *
 * Runs as part of vercel.json's buildCommand (before Hugo). Vercel exposes the
 * VERCEL_GIT_* system env vars at build time. Output is gitignored; it only
 * exists in deployed builds. Read by scripts/deployment-health.js, which no
 * longer needs the authenticated `vercel` CLI to know what is live.
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL as __voaPathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_FILE = path.join(ROOT, "static", "build-info.json");

function localSha() {
  try {
    return execFileSync("git", ["-C", ROOT, "rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

function main() {
  const info = {
    commit: process.env.VERCEL_GIT_COMMIT_SHA || localSha(),
    ref: process.env.VERCEL_GIT_COMMIT_REF || null,
    environment: process.env.VERCEL_ENV || "local",
    projectId: process.env.VERCEL_PROJECT_ID || null,
    builtAt: new Date().toISOString(),
  };
  fs.writeFileSync(OUT_FILE, `${JSON.stringify(info, null, 2)}\n`);
  console.log(`build-info: ${info.commit ? info.commit.slice(0, 7) : "unknown"} (${info.environment})`);
}

const __voaIsCli = process.argv[1] && import.meta.url === __voaPathToFileURL(process.argv[1]).href;
if (__voaIsCli) {
  try {
    main();
  } catch (err) {
    // Never fail a deploy over a status stamp.
    console.warn(`build-info: skipped (${err.message})`);
  }
}
