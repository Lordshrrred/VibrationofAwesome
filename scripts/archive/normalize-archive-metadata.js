#!/usr/bin/env node
/**
 * normalize-archive-metadata.js
 *
 * Keeps legacy archive canonical paths intact while normalizing their
 * metadata URLs to HTTPS for canonical, og:url, JSON-LD, and any legacy
 * widget hrefs embedded in the page.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const ARCHIVE_ROOT = path.join(ROOT, "static", "blog", "matt", "posts");
const LEGACY_HTTP = "http://vibrationofawesome.com";
const LEGACY_HTTPS = "https://vibrationofawesome.com";

let updated = 0;

for (const entry of fs.readdirSync(ARCHIVE_ROOT, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const file = path.join(ARCHIVE_ROOT, entry.name, "index.html");
  if (!fs.existsSync(file)) continue;

  const original = fs.readFileSync(file, "utf8");
  if (!original.includes(LEGACY_HTTP)) continue;

  const next = original.replaceAll(LEGACY_HTTP, LEGACY_HTTPS);
  if (next !== original) {
    fs.writeFileSync(file, next, "utf8");
    updated += 1;
  }
}

console.log(`Normalized archive metadata in ${updated} files.`);
