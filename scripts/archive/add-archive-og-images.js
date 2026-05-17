#!/usr/bin/env node
/**
 * add-archive-og-images.js
 *
 * Reuses each archive post's hero background image for Open Graph and Twitter
 * metadata so old posts share with a proper image.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const POSTS_ROOT = path.join(ROOT, "static", "blog", "matt", "posts");
const SITE_ORIGIN = "https://vibrationofawesome.com";

let updated = 0;

for (const entry of fs.readdirSync(POSTS_ROOT, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const file = path.join(POSTS_ROOT, entry.name, "index.html");
  if (!fs.existsSync(file)) continue;

  const original = fs.readFileSync(file, "utf8");
  if (original.includes('property="og:image"')) continue;

  const heroMatch = original.match(/url\('([^']+)'\)\s+center\/cover no-repeat/);
  if (!heroMatch) continue;

  const heroPath = heroMatch[1];
  const heroUrl = heroPath.startsWith("http") ? heroPath : `${SITE_ORIGIN}${heroPath}`;

  let next = original.replace(
    /(<meta property="og:url" content="[^"]+">\n)/,
    `$1<meta property="og:image" content="${heroUrl}">\n`
  );
  next = next.replace(
    /(<meta name="twitter:description" content="[^"]*">\n)/,
    `$1<meta name="twitter:image" content="${heroUrl}">\n`
  );

  if (next !== original) {
    fs.writeFileSync(file, next, "utf8");
    updated += 1;
  }
}

console.log(`Added archive social images to ${updated} files.`);
