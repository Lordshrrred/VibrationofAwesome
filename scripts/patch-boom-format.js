#!/usr/bin/env node
/**
 * Normalize existing Boom live posts and queued drafts to the current Boom
 * visual/CTA shell without changing publish order, slugs, or source articles.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeBoomHtml } from "./lib/boom-format.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TARGETS = [
  { label: "live", dir: path.join(ROOT, "static/blog/boom/posts") },
  { label: "queued", dir: path.join(ROOT, "static/blog/boom/drafts") },
];

function readTitle(html) {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return h1[1].replace(/<[^>]+>/g, "").trim();
  const title = html.match(/<title>([\s\S]*?)<\/title>/i);
  return title ? title[1].replace(/\s+\|[\s\S]*$/, "").trim() : "";
}

const stats = { live: 0, queued: 0, unchanged: 0 };

for (const target of TARGETS) {
  if (!fs.existsSync(target.dir)) continue;
  const files = fs.readdirSync(target.dir)
    .filter((file) => file.endsWith(".html"))
    .sort();

  for (const file of files) {
    const filePath = path.join(target.dir, file);
    const before = fs.readFileSync(filePath, "utf8");
    const slug = file.replace(/\.html$/, "");
    const after = normalizeBoomHtml(before, { slug, title: readTitle(before), keyword: slug });
    if (after !== before) {
      fs.writeFileSync(filePath, after, "utf8");
      stats[target.label]++;
      console.log(`[${target.label}] normalized ${file}`);
    } else {
      stats.unchanged++;
    }
  }
}

console.log(`\nBoom format normalization complete: ${stats.live} live, ${stats.queued} queued, ${stats.unchanged} unchanged.`);
