#!/usr/bin/env node
/**
 * select-image.js ~ Image selector for blog posts
 *
 * Lane routing:
 *   lane "matt"    → alternates forest/ and matt/ personal photos
 *                    fallback: static/personal-photos/
 *   lane "boom"    → NASA APOD API
 *                    fallback: static/personal-photos/
 *   (default)      → NASA APOD API
 *   tag specified  → filter personal photos by tag (any lane)
 *
 * Exports:
 *   selectImage(query, lane, tag?) ~ picks one image for a post's hero
 *   fetchNasaImages(count)    ~ returns array of NASA APOD image objects
 *   fetchForestImages(count)  ~ returns array of forest image objects
 */

import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import sharp from "sharp";

dotenv.config({ override: true });

const __filename  = fileURLToPath(import.meta.url);
const __dirname   = path.dirname(__filename);
const ROOT        = path.resolve(__dirname, "..");
const PHOTOS_DIR  = path.join(ROOT, "static", "personal-photos");
const FOREST_DIR  = path.join(ROOT, "static", "personal-photos", "forest");
const BOOM_DIR    = path.join(ROOT, "static", "images", "boom");
const NASA_CACHE_DIR = path.join(ROOT, "static", "images", "nasa-cache");
const IMAGE_EXTS  = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);
const APOD_BASE   = "https://api.nasa.gov/planetary/apod";
const MAX_DIMENSION = 1600;
const JPEG_QUALITY  = 80;

/**
 * NASA APOD hotlinks are not permanently stable ~ URLs that are valid at
 * generation time have been observed going 404 later (NASA doesn't guarantee
 * long-term hosting at a given APOD image path). Downloading and re-hosting
 * the image locally at generation time means the post never depends on an
 * external URL staying alive.
 *
 * Returns the local public path (e.g. "/images/nasa-cache/2026-07-13-abc.jpg")
 * on success, or null on any failure (caller should fall back to fetchBoomImages).
 */
export async function cacheNasaImageLocally(sourceUrl, slug) {
  try {
    const resp = await fetch(sourceUrl);
    if (!resp.ok) {
      console.warn("[select-image] NASA image download " + resp.status + " for " + sourceUrl);
      return null;
    }
    const buffer = Buffer.from(await resp.arrayBuffer());
    if (!fs.existsSync(NASA_CACHE_DIR)) fs.mkdirSync(NASA_CACHE_DIR, { recursive: true });
    const filename = slug + "-hero.jpg";
    const destPath = path.join(NASA_CACHE_DIR, filename);
    await sharp(buffer)
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY })
      .toFile(destPath);
    return "/images/nasa-cache/" + filename;
  } catch (err) {
    console.warn("[select-image] NASA image cache error: " + err.message);
    return null;
  }
}

// ── Personal photos fallback ──────────────────────────────────────────────────

function pickPersonalPhoto() {
  if (!fs.existsSync(PHOTOS_DIR)) return null;
  const files = fs.readdirSync(PHOTOS_DIR).filter(f => {
    const ext = path.extname(f).toLowerCase();
    return IMAGE_EXTS.has(ext) && !f.startsWith(".");
  });
  if (files.length === 0) return null;
  const file = files[Math.floor(Math.random() * files.length)];
  return {
    url:          "https://vibrationofawesome.com/personal-photos/" + file,
    thumbUrl:     "https://vibrationofawesome.com/personal-photos/" + file,
    localPath:    path.join(PHOTOS_DIR, file),
    source:       "personal",
    attribution:  null,
    photographer: null,
  };
}

// ── Forest photos (Matt / Forest Temple lane) ─────────────────────────────────

/**
 * Pick one random forest image from static/personal-photos/forest/.
 */
function pickForestPhoto() {
  const dir = fs.existsSync(FOREST_DIR) ? FOREST_DIR : PHOTOS_DIR;
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter(f => {
    const ext = path.extname(f).toLowerCase();
    return IMAGE_EXTS.has(ext) && !f.startsWith(".") && f !== "manifest.json";
  });
  if (files.length === 0) return pickPersonalPhoto();
  const file = files[Math.floor(Math.random() * files.length)];
  const subpath = dir === FOREST_DIR ? "personal-photos/forest/" : "personal-photos/";
  return {
    url:          "https://vibrationofawesome.com/" + subpath + file,
    thumbUrl:     "https://vibrationofawesome.com/" + subpath + file,
    localPath:    path.join(dir, file),
    source:       "forest",
    attribution:  null,
    photographer: null,
  };
}

/**
 * Return an array of `count` randomly chosen forest images.
 * Used for injecting inline images into Forest Temple posts.
 */
export function fetchForestImages(count) {
  count = count || 1;
  const dir = fs.existsSync(FOREST_DIR) ? FOREST_DIR : PHOTOS_DIR;
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir).filter(f => {
    const ext = path.extname(f).toLowerCase();
    return IMAGE_EXTS.has(ext) && !f.startsWith(".") && f !== "manifest.json";
  });
  if (files.length === 0) return [];

  // Fisher-Yates shuffle, then take first `count`
  const shuffled = [...files];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const subpath = dir === FOREST_DIR ? "personal-photos/forest/" : "personal-photos/";
  return shuffled.slice(0, count).map(file => ({
    url:          "https://vibrationofawesome.com/" + subpath + file,
    thumbUrl:     "https://vibrationofawesome.com/" + subpath + file,
    localPath:    path.join(dir, file),
    source:       "forest",
    title:        path.basename(file, path.extname(file)).replace(/[-_]/g, " "),
    attribution:  null,
    photographer: null,
  }));
}

// ── Boom local images (static/images/boom/) ───────────────────────────────────

/**
 * Pick one random space/astronomy image from static/images/boom/.
 */
function pickBoomPhoto() {
  if (!fs.existsSync(BOOM_DIR)) return null;
  const files = fs.readdirSync(BOOM_DIR).filter(f => {
    const ext = path.extname(f).toLowerCase();
    return IMAGE_EXTS.has(ext) && !f.startsWith(".");
  });
  if (files.length === 0) return null;
  const file = files[Math.floor(Math.random() * files.length)];
  return {
    url:          "/images/boom/" + file,
    thumbUrl:     "/images/boom/" + file,
    localPath:    path.join(BOOM_DIR, file),
    source:       "boom",
    title:        path.basename(file, path.extname(file)).replace(/[-_]/g, " "),
    attribution:  null,
    photographer: null,
  };
}

/**
 * Return an array of `count` randomly chosen boom space images.
 * Used for injecting inline images into Boom Frequency posts.
 * Mirrors fetchForestImages() ~ reads static/images/boom/ locally.
 */
export function fetchBoomImages(count) {
  count = count || 1;
  if (!fs.existsSync(BOOM_DIR)) return [];

  const files = fs.readdirSync(BOOM_DIR).filter(f => {
    const ext = path.extname(f).toLowerCase();
    return IMAGE_EXTS.has(ext) && !f.startsWith(".");
  });
  if (files.length === 0) return [];

  // Fisher-Yates shuffle, then take first `count`
  const shuffled = [...files];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, count).map(file => ({
    url:          "/images/boom/" + file,
    thumbUrl:     "/images/boom/" + file,
    localPath:    path.join(BOOM_DIR, file),
    source:       "boom",
    title:        path.basename(file, path.extname(file)).replace(/[-_]/g, " "),
    attribution:  null,
    photographer: null,
  }));
}

// ── NASA APOD API ─────────────────────────────────────────────────────────────

/**
 * Fetch `count` random APOD images from NASA.
 * Filters to media_type === "image" only (skips video APODs).
 * Uses NASA_API_KEY from env; falls back to DEMO_KEY (30 req/hr, 50/day).
 */
export async function fetchNasaImages(count) {
  count = count || 1;
  const key        = process.env.NASA_API_KEY || "DEMO_KEY";
  const fetchCount = Math.min(count * 4, 100);

  try {
    const resp = await fetch(APOD_BASE + "?api_key=" + key + "&count=" + fetchCount);
    if (!resp.ok) {
      const body = await resp.text().catch(function(){ return ""; });
      console.warn("[select-image] NASA APOD " + resp.status + ": " + body.slice(0, 120));
      return [];
    }
    const items = await resp.json();
    const all   = Array.isArray(items) ? items : [items];
    const images = all.filter(function(item) {
      return item.media_type === "image" && (item.hdurl || item.url);
    });

    if (images.length === 0) {
      console.warn("[select-image] NASA APOD returned no image-type results");
      return [];
    }

    // Fisher-Yates shuffle
    for (let i = images.length - 1; i > 0; i--) {
      const j   = Math.floor(Math.random() * (i + 1));
      const tmp = images[i]; images[i] = images[j]; images[j] = tmp;
    }

    return images.slice(0, count).map(function(item) {
      return {
        url:          item.hdurl || item.url,
        thumbUrl:     item.url,
        source:       "nasa",
        title:        item.title  || "",
        date:         item.date   || "",
        attribution:  null,
        photographer: null,
      };
    });
  } catch (err) {
    console.warn("[select-image] NASA APOD fetch error: " + err.message);
    return [];
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

// ── Tag-filtered personal photo picker ───────────────────────────────────────

/**
 * Pick a random photo from any personal-photos subfolder, optionally filtered
 * by tag using photo-metadata.json.
 *
 * @param {string} tag  - tag string to filter by (e.g. "outdoors")
 */
function pickPhotoByTag(tag) {
  const metaPath = path.join(PHOTOS_DIR, "photo-metadata.json");
  if (!fs.existsSync(metaPath)) return null;
  let meta;
  try { meta = JSON.parse(fs.readFileSync(metaPath, "utf8")); } catch { return null; }

  const matches = [];
  for (const [folder, entries] of Object.entries(meta)) {
    for (const [filename, data] of Object.entries(entries)) {
      if (!data.tags || !data.tags.includes(tag)) continue;
      const subdir = folder === "forest" ? "forest" : folder;
      const filePath = path.join(PHOTOS_DIR, subdir, filename);
      if (!fs.existsSync(filePath)) continue;
      matches.push({
        url:          "https://vibrationofawesome.com/personal-photos/" + subdir + "/" + filename,
        thumbUrl:     "https://vibrationofawesome.com/personal-photos/" + subdir + "/" + filename,
        localPath:    filePath,
        source:       "personal",
        caption:      data.caption || "",
        attribution:  null,
        photographer: null,
      });
    }
  }
  if (matches.length === 0) return null;
  return matches[Math.floor(Math.random() * matches.length)];
}

/**
 * Select one image for a post's hero.
 *
 * @param {string} _query  - search hint (unused for both sources)
 * @param {string} lane    - "matt" | "boom" | undefined
 * @param {string} [tag]   - optional tag to filter personal photos
 *
 * lane "matt"    → alternates forest / matt personal photos; fallback CSS gradient
 * lane "boom"    → NASA APOD first, personal-photos fallback
 * (default)      → NASA APOD first, personal-photos fallback
 * tag specified  → filter personal photos by tag (any lane)
 */
export async function selectImage(_query, lane, tag) {
  // Tag-filtered override for any lane
  if (tag) {
    const tagged = pickPhotoByTag(tag);
    if (tagged) {
      console.log("[select-image] Tag-filtered photo (" + tag + "): " + path.basename(tagged.localPath));
      return tagged;
    }
  }

  if (lane === "matt") {
    // Alternate between forest/ and matt/ personal folder on each call
    const useMatt = Math.random() < 0.5 && fs.existsSync(path.join(PHOTOS_DIR, "matt"));
    const dir = useMatt ? path.join(PHOTOS_DIR, "matt") : FOREST_DIR;
    const subpath = useMatt ? "personal-photos/matt/" : "personal-photos/forest/";

    const files = fs.existsSync(dir)
      ? fs.readdirSync(dir).filter(f => IMAGE_EXTS.has(path.extname(f).toLowerCase()) && !f.startsWith("."))
      : [];

    if (files.length > 0) {
      const file = files[Math.floor(Math.random() * files.length)];
      const photo = {
        url:          "https://vibrationofawesome.com/" + subpath + file,
        thumbUrl:     "https://vibrationofawesome.com/" + subpath + file,
        localPath:    path.join(dir, file),
        source:       useMatt ? "matt" : "forest",
        attribution:  null,
        photographer: null,
      };
      console.log("[select-image] " + photo.source + " photo: " + file);
      return photo;
    }

    // Fallback: personal-photos root
    const personal = pickPersonalPhoto();
    if (personal) {
      console.log("[select-image] Personal photo fallback: " + path.basename(personal.localPath));
      return personal;
    }
  } else {
    // BoomBot / default: use local boom images from static/images/boom/
    const results = fetchBoomImages(1);
    if (results.length > 0) {
      const img = results[0];
      console.log("[select-image] Boom local: \"" + img.title + "\"");
      return img;
    }
    // Fallback to personal photos
    const personal = pickPersonalPhoto();
    if (personal) {
      console.log("[select-image] Personal photo fallback: " + path.basename(personal.localPath));
      return personal;
    }
  }

  console.warn("[select-image] No image available.");
  return null;
}

// ── CLI entry point ───────────────────────────────────────────────────────────

const isCli = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isCli) {
  const lane = process.argv[2] || "boom";
  console.log("Testing image selection for lane:", lane, "\n");
  const image = await selectImage("", lane);
  console.log(image ? JSON.stringify(image, null, 2) : "No image found.");

  if (lane === "matt") {
    console.log("\nForest images batch (3):");
    const batch = fetchForestImages(3);
    batch.forEach((img, i) => console.log("  " + (i + 1) + ".", img.url));
  }
}
