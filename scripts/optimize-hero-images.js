#!/usr/bin/env node
/**
 * optimize-hero-images.js
 *
 * One-time fix for oversized NASA/Hubble hero images used as CSS-background
 * post headers. Some were being served at up to 18000x18000px / 37MB, with
 * fetchpriority="high" preload ~ directly hurting LCP (Core Web Vitals) and,
 * since they're CSS backgrounds not <img> tags, invisible to Google Image
 * Search / screen readers regardless of size.
 *
 * - JPEGs are resized in place (same filename ~ no HTML reference changes needed)
 * - The 2 PNGs are converted to JPEG (photographic space imagery compresses far
 *   better as JPEG than PNG) ~ this DOES require updating the handful of post
 *   HTML files that reference them, done below
 *
 * Usage:
 *   node scripts/optimize-hero-images.js              # dry run, reports before/after
 *   node scripts/optimize-hero-images.js --execute     # writes resized files + HTML updates
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import minimist from "minimist";
import sharp from "sharp";

import { pathToFileURL as __voaPathToFileURL } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const IMAGES_DIR = path.join(ROOT, "static", "images", "boom");
const POSTS_DIR = path.join(ROOT, "static", "blog", "boom", "posts");

const argv = minimist(process.argv.slice(2), { boolean: ["execute"] });
const execute = argv.execute;

const MAX_DIMENSION = 1600; // long edge; these render as full-bleed `background-size: cover`
const JPEG_QUALITY = 80;

// Resized in place ~ same filename/extension, so no HTML references need updating.
const RESIZE_IN_PLACE = [
  "A_New_View_of_the_Tarantula_Nebula.jpg",
  "Aurora_borealis_above_Storfjorden_and_the_Lyngen_Alps_in_moonlight__2012_March.j.jpg",
  "Bontecou_Lake_Milky_Way_panorama.jpg",
  "CMB_Timeline300_no_WMAP.jpg",
  "Crab_Nebula.jpg",
  "Good_Morning_From_the_International_Space_Station.jpg",
  "Hubble_ultra_deep_field_high_rez_edit1.jpg",
  "Laser_Towards_Milky_Ways_Centre.jpg",
  "Milky_way_in_Elbrus.jpg",
  "Orion_Nebula_-_Hubble_2006_mosaic_18000.jpg",
];

// Converted PNG -> JPEG (photographic content compresses much better as JPEG).
// Requires updating the post HTML files that reference the old .png path.
const CONVERT_PNG_TO_JPG = [
  "Extended_universe_logarithmic_illustration__English_annotated_.png",
  "Hubble_Extreme_Deep_Field__full_resolution_.png",
];

function fmtKB(bytes) {
  return (bytes / 1024).toFixed(0) + " KB";
}

async function resizeInPlace(filename) {
  const filePath = path.join(IMAGES_DIR, filename);
  const before = fs.statSync(filePath).size;
  const buffer = await sharp(filePath, { limitInputPixels: false })
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
  if (execute) fs.writeFileSync(filePath, buffer);
  return { filename, before, after: buffer.length };
}

async function convertPngToJpg(filename) {
  const filePath = path.join(IMAGES_DIR, filename);
  const newFilename = filename.replace(/\.png$/i, ".jpg");
  const newPath = path.join(IMAGES_DIR, newFilename);
  const before = fs.statSync(filePath).size;
  const buffer = await sharp(filePath, { limitInputPixels: false })
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#020a0a" }) // in case of alpha channel; matches the site's dark bg
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();

  let postsUpdated = [];
  if (execute) {
    fs.writeFileSync(newPath, buffer);
    fs.unlinkSync(filePath);
    // Update every post referencing the old .png path
    for (const post of fs.readdirSync(POSTS_DIR)) {
      if (!post.endsWith(".html")) continue;
      const postPath = path.join(POSTS_DIR, post);
      const html = fs.readFileSync(postPath, "utf8");
      if (html.includes(`images/boom/${filename}`)) {
        const updated = html.split(`images/boom/${filename}`).join(`images/boom/${newFilename}`);
        fs.writeFileSync(postPath, updated, "utf8");
        postsUpdated.push(post);
      }
    }
  } else {
    for (const post of fs.readdirSync(POSTS_DIR)) {
      if (!post.endsWith(".html")) continue;
      const html = fs.readFileSync(path.join(POSTS_DIR, post), "utf8");
      if (html.includes(`images/boom/${filename}`)) postsUpdated.push(post);
    }
  }

  return { filename, newFilename, before, after: buffer.length, postsUpdated };
}

async function main() {
  console.log(`[optimize-hero-images] ${execute ? "EXECUTING" : "DRY RUN"} ~ max ${MAX_DIMENSION}px, JPEG quality ${JPEG_QUALITY}\n`);

  let totalBefore = 0;
  let totalAfter = 0;

  console.log("── Resized in place (JPEG -> JPEG, same filename) ──");
  for (const filename of RESIZE_IN_PLACE) {
    const r = await resizeInPlace(filename);
    totalBefore += r.before;
    totalAfter += r.after;
    console.log(`  ${fmtKB(r.before).padStart(10)} -> ${fmtKB(r.after).padStart(9)}  ${filename}`);
  }

  console.log("\n── Converted PNG -> JPEG (references updated) ──");
  for (const filename of CONVERT_PNG_TO_JPG) {
    const r = await convertPngToJpg(filename);
    totalBefore += r.before;
    totalAfter += r.after;
    console.log(`  ${fmtKB(r.before).padStart(10)} -> ${fmtKB(r.after).padStart(9)}  ${filename} -> ${r.newFilename}`);
    console.log(`    posts ${execute ? "updated" : "to update"}: ${r.postsUpdated.join(", ") || "(none found)"}`);
  }

  console.log(`\nTotal: ${fmtKB(totalBefore)} -> ${fmtKB(totalAfter)} (${(100 - (totalAfter / totalBefore) * 100).toFixed(1)}% reduction)`);

  if (!execute) {
    console.log("\nDry run only. Re-run with --execute to write changes.");
  }
}

// CLI-only guard: without this, merely `import`-ing this module (from a test,
// another script, or a syntax/load check) executes a real run with real side
// effects. See CLAUDE.md ~ every script with a top-level main() needs this.
const __voaIsCli = process.argv[1] && import.meta.url === __voaPathToFileURL(process.argv[1]).href;
if (__voaIsCli) {
  main().catch((err) => {
    console.error("[optimize-hero-images] Fatal error:", err.message);
    process.exit(1);
  });
}
