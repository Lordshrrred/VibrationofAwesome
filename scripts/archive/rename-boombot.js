#!/usr/bin/env node
// rename-boombot.js
// Replaces all "boombot" references with "boom" across site content
// (URLs, canonical links, fetch paths, class names, IDs, script strings)

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// Files that need content updates (paths relative to ROOT)
const FILES = [
  // Moved boom files
  "static/blog/boom/index.html",
  "static/blog/boom/posts/ai-tools-for-independent-artists.html",
  "static/blog/boom/posts/how-to-use-claude-api-for-musicians.html",
  // Blog index
  "static/blog/index.html",
  // Homepage template
  "layouts/index.html",
  // Matt posts with cross-links
  "static/blog/matt/posts/twenty-years-internet-marketing.html",
  "static/blog/matt/posts/why-i-built-forest-temple.html",
  // Scripts
  "scripts/generate-post.js",
  "scripts/generate-captions.js",
  "scripts/syndicate.js",
  "scripts/select-image.js",
  "scripts/fix-share-widgets.js",
  "scripts/update-matt-post-images.js",
];

// Ordered replacements: more specific first
const REPLACEMENTS = [
  // URL paths
  ["/blog/boombot/posts/", "/blog/boom/posts/"],
  ["/blog/boombot/", "/blog/boom/"],
  // Data file
  ["/_data/boombot-posts.json", "/_data/boom-posts.json"],
  ["boombot-posts.json", "boom-posts.json"],
  // canonical / og URLs
  ["vibrationofawesome.com/blog/boombot/", "vibrationofawesome.com/blog/boom/"],
  // CSS/JS ids and class names
  ["feed-boombot", "feed-boom"],
  ["lane-badge--boombot", "lane-badge--boom"],
  ['id="boombot-feed"', 'id="boom-feed"'],
  ["boombot-feed", "boom-feed"],
  // Script directory paths
  ['"boombot"', '"boom"'],
  ["'boombot'", "'boom'"],
  // Static path strings in scripts
  ['"blog", "boombot"', '"blog", "boom"'],
  ["blog/boombot", "blog/boom"],
  // Lane comparisons
  ['=== "boombot"', '=== "boom"'],
  ["=== 'boombot'", "=== 'boom'"],
  // Comment/doc strings
  ["boombot", "boom"],   // catch-all last
];

let totalChanged = 0;

for (const relPath of FILES) {
  const fullPath = path.join(ROOT, relPath);
  if (!fs.existsSync(fullPath)) {
    console.log(`  · skip (not found): ${relPath}`);
    continue;
  }
  let content = fs.readFileSync(fullPath, "utf8");
  const original = content;
  for (const [from, to] of REPLACEMENTS) {
    content = content.split(from).join(to);
  }
  if (content !== original) {
    fs.writeFileSync(fullPath, content, "utf8");
    totalChanged++;
    console.log(`  ✓ updated: ${relPath}`);
  } else {
    console.log(`  · no change: ${relPath}`);
  }
}

console.log(`\nDone. ${totalChanged} files updated.`);
