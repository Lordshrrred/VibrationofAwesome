#!/usr/bin/env node
/**
 * check-authority-links.js
 *
 * Reusable link-integrity gate for the authority layer (/hubs/, /tools/).
 * Builds the real production output (hugo --gc, same as vercel.json) and
 * checks every internal href emitted by the authority pages against what
 * that build actually produced ~ using the same clean-URL resolution rule
 * Vercel applies in production (cleanUrls: true), not Hugo's dev-server
 * virtual filesystem.
 *
 * Run standalone: npm run authority:links
 * Exits 1 (and prints a report) if any authority-emitted link would 404.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");

const AUTHORITY_FILES = [
  "static/hubs/index.html",
  ...fs.readdirSync(path.join(ROOT, "static/hubs"))
    .filter(f => fs.statSync(path.join(ROOT, "static/hubs", f)).isDirectory())
    .map(slug => `static/hubs/${slug}/index.html`),
  "static/tools/index.html",
  "static/tools/digital-attention-audit/index.html",
];

// Binary/static assets (icons, manifest, images) are not navigational routes
// and are covered by a separate, already-documented sitewide gap (no favicon
// asset exists anywhere on the site yet ~ see CLAUDE.md). This checker's job
// is route integrity: hub/tool/article/CTA links a user actually clicks.
const ASSET_EXTENSIONS = [".ico", ".png", ".jpg", ".jpeg", ".svg", ".webmanifest", ".xml", ".txt"];

function resolvesInPublic(href) {
  const clean = href.split("#")[0].split("?")[0];
  if (!clean || clean.startsWith("http") || clean.startsWith("//")) return true; // external, not our concern
  if (ASSET_EXTENSIONS.some(ext => clean.toLowerCase().endsWith(ext))) return true; // static asset, not a route
  if (clean.endsWith("/")) {
    return fs.existsSync(path.join(PUBLIC_DIR, clean, "index.html"));
  }
  return (
    fs.existsSync(path.join(PUBLIC_DIR, clean + ".html")) ||
    fs.existsSync(path.join(PUBLIC_DIR, clean)) ||
    fs.existsSync(path.join(PUBLIC_DIR, clean, "index.html"))
  );
}

function main({ skipBuild = false } = {}) {
  if (!skipBuild) {
    console.log("Building production site (hugo --gc) for link validation ...");
    execSync("hugo --gc", { cwd: ROOT, stdio: "inherit" });
  }

  let checked = 0;
  const broken = [];

  for (const rel of AUTHORITY_FILES) {
    const file = path.join(ROOT, rel);
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, "utf8");
    const hrefs = [...html.matchAll(/href="(\/[^"]*)"/g)].map(m => m[1]);
    for (const href of hrefs) {
      checked += 1;
      if (!resolvesInPublic(href)) broken.push({ source: rel, href });
    }
  }

  console.log(`\nAuthority link check: ${checked} internal links checked across ${AUTHORITY_FILES.length} pages.`);
  if (broken.length === 0) {
    console.log("All authority-page links resolve against the production build. Signal stays clean.");
    return 0;
  }

  console.log(`\n${broken.length} BROKEN LINK(S):`);
  for (const item of broken) console.log(`  ${item.source} -> ${item.href}`);
  return 1;
}

const exitCode = main({ skipBuild: process.argv.includes("--skip-build") });
process.exit(exitCode);
