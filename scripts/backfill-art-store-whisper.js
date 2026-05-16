#!/usr/bin/env node
/**
 * backfill-art-store-whisper.js
 *
 * Injects the art store whisper widget into existing boom + matt post HTML
 * files that were generated before the widget was added to generate-post.js.
 *
 * Safe to run multiple times ~ skips files that already have the widget.
 *
 * Usage: node scripts/backfill-art-store-whisper.js
 */

import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, "..");

const WIDGET = `        <div data-art-store-whisper data-blog-slug="SLUG_PLACEHOLDER"></div>
        <script src="/js/art-store-whisper.js"><\/script>`;

// Insertion anchors (tried in order) ~ new posts use </article>, older use ebook-cta script
const ANCHORS = [
  { find: "</article>",               before: true  },
  { find: 'src="/js/ebook-cta.js',   before: false }, // insert AFTER the whole script tag line
];

let updated = 0;
let skipped = 0;

for (const lane of ["boom", "matt"]) {
  const dir = path.join(ROOT, "static", "blog", lane, "posts");
  if (!fs.existsSync(dir)) continue;

  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".html")) continue;
    const slug    = file.replace(/\.html$/, "");
    const fpath   = path.join(dir, file);
    const content = fs.readFileSync(fpath, "utf8");

    if (content.includes("data-art-store-whisper")) {
      skipped++;
      continue;
    }

    const widget = WIDGET.replace("SLUG_PLACEHOLDER", slug);
    let updated_content = content;
    let matched = false;

    for (const { find, before } of ANCHORS) {
      const idx = content.indexOf(find);
      if (idx === -1) continue;
      if (before) {
        updated_content = content.slice(0, idx) + widget + "\n      " + content.slice(idx);
      } else {
        // find end of the line containing `find`, insert after it
        const lineEnd = content.indexOf("\n", idx);
        const insertAt = lineEnd === -1 ? content.length : lineEnd + 1;
        updated_content = content.slice(0, insertAt) + widget + "\n" + content.slice(insertAt);
      }
      matched = true;
      break;
    }

    if (!matched) {
      console.warn(`[skip] No anchor found in ${file}`);
      skipped++;
      continue;
    }

    fs.writeFileSync(fpath, updated_content, "utf8");
    console.log(`[ok]   ${lane}/${file}`);
    updated++;
  }
}

console.log(`\nDone. ${updated} updated, ${skipped} skipped.`);
