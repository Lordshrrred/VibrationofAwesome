#!/usr/bin/env node
/**
 * patch-draft-posts.js
 *
 * Batch-patches all boom draft AND published posts to fix three issues
 * introduced by pre-generation before the current template:
 *
 *   1. NASA external image URLs → local /images/boom/ files
 *   2. free-ebook CTA references → field-guide
 *   3. Missing art store whisper widget → inject it
 *
 * Also fixes the already-published "why-you-feel-stuck" post and any
 * other published boom posts that have the same issues.
 *
 * Safe to re-run: skips files that are already clean.
 *
 * Usage: node scripts/patch-draft-posts.js
 */

import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, "..");

// Local boom images pool ~ cycled deterministically per file
const BOOM_IMAGES = [
  "Tarantula_Nebula_by_JWST.jpg",
  "Pillars_of_creation_2014_HST_WFC3-UVIS_full-res_denoised.jpg",
  "Crab_Nebula.jpg",
  "A_New_View_of_the_Tarantula_Nebula.jpg",
  "Hubble_ultra_deep_field.jpg",
  "Center_of_the_Milky_Way_Galaxy_IV___Composite.jpg",
  "Orion_Nebula_-_Hubble_2006_mosaic_18000.jpg",
  "Aurora_and_perseids.jpg",
  "Laser_Towards_Milky_Ways_Centre.jpg",
  "Bontecou_Lake_Milky_Way_panorama.jpg",
  "036_Milky_Way_during_Perseids_seen_from_Oeschinensee_with_water_reflections_Phot.jpg",
  "Good_Morning_From_the_International_Space_Station.jpg",
  "Milky_way_in_Elbrus.jpg",
].map(f => `/images/boom/${f}`);

// Art store whisper widget to inject
const WHISPER_WIDGET = (slug) =>
  `        <div data-art-store-whisper data-blog-slug="${slug}"></div>\n` +
  `        <script src="/js/art-store-whisper.js"><\/script>`;

// Insertion anchors for whisper widget (tried in order)
const WHISPER_ANCHORS = [
  { find: "</article>",             before: true  },
  { find: 'src="/js/ebook-cta.js', before: false },
];

let stats = { images: 0, cta: 0, whisper: 0, skipped: 0 };

function patchFile(fpath, fileIndex) {
  const slug    = path.basename(fpath, ".html");
  let content   = fs.readFileSync(fpath, "utf8");
  let changed   = false;

  // ── 1. Replace NASA external image URLs with local boom images ──────────────
  // Pattern: src="https://apod.nasa.gov/apod/image/..."
  let imgCounter = 0;
  const patched = content.replace(
    /src="https:\/\/apod\.nasa\.gov\/apod\/image\/[^"]*"/g,
    () => {
      const idx = (fileIndex * 3 + imgCounter++) % BOOM_IMAGES.length;
      return `src="${BOOM_IMAGES[idx]}"`;
    }
  );
  if (patched !== content) {
    content = patched;
    changed = true;
    stats.images++;
  }

  // ── 2. Fix free-ebook → field-guide in body text ────────────────────────────
  // Covers both the href and the visible URL text
  const ctaPatched = content
    .replace(/https:\/\/vibrationofawesome\.com\/free-ebook\//g,
             "https://vibrationofawesome.com/field-guide/")
    .replace(/vibrationofawesome\.com\/free-ebook\//g,
             "vibrationofawesome.com/field-guide/")
    .replace(/free[- ]ebook/gi, "Field Guide")
    .replace(/free ebook/gi, "Field Guide")
    .replace(/grab the Field Guide/gi, "Start with the Field Guide");
  if (ctaPatched !== content) {
    content = ctaPatched;
    changed = true;
    stats.cta++;
  }

  // ── 3. Add art store whisper if missing ────────────────────────────────────
  if (!content.includes("data-art-store-whisper")) {
    const widget  = WHISPER_WIDGET(slug);
    let injected  = false;

    for (const { find, before } of WHISPER_ANCHORS) {
      const idx = content.indexOf(find);
      if (idx === -1) continue;
      if (before) {
        content = content.slice(0, idx) + widget + "\n      " + content.slice(idx);
      } else {
        const lineEnd  = content.indexOf("\n", idx);
        const insertAt = lineEnd === -1 ? content.length : lineEnd + 1;
        content = content.slice(0, insertAt) + widget + "\n" + content.slice(insertAt);
      }
      injected = true;
      changed  = true;
      stats.whisper++;
      break;
    }

    if (!injected) {
      console.warn(`  [warn] No anchor for whisper widget in ${path.basename(fpath)}`);
    }
  }

  if (changed) {
    fs.writeFileSync(fpath, content, "utf8");
    return true;
  }
  stats.skipped++;
  return false;
}

// Process drafts + published posts for boom lane
let fileIndex = 0;
for (const subdir of ["drafts", "posts"]) {
  const dir = path.join(ROOT, "static", "blog", "boom", subdir);
  if (!fs.existsSync(dir)) continue;

  const files = fs.readdirSync(dir).filter(f => f.endsWith(".html")).sort();
  for (const file of files) {
    const fpath   = path.join(dir, file);
    const updated = patchFile(fpath, fileIndex++);
    if (updated) console.log(`[fixed] boom/${subdir}/${file}`);
  }
}

console.log(`
Done.
  Image URLs fixed:       ${stats.images} files
  CTA fixed (→field-guide): ${stats.cta} files
  Whisper widget added:   ${stats.whisper} files
  Already clean (skipped): ${stats.skipped} files
`);
