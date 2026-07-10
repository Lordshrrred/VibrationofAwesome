#!/usr/bin/env node
/**
 * update-sitemap.js ~ Regenerates static/sitemap.xml from post JSON indexes.
 *
 * Called automatically by generate-post.js after every new post.
 * Run manually any time:  node scripts/update-sitemap.js
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { cleanPublicPath } from "./lib/clean-url.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = path.resolve(__dirname, "..");
const BASE       = "https://vibrationofawesome.com";

// Static pages that are always included regardless of JSON indexes.
// Update lastmod here when a page design changes significantly.
const STATIC_PAGES = [
  { loc: "/",                          lastmod: "2026-03-04", changefreq: "weekly",  priority: "1.0" },
  { loc: "/blog/",                     lastmod: "2026-03-04", changefreq: "weekly",  priority: "0.9" },
  { loc: "/blog/matt/",                lastmod: "2026-03-04", changefreq: "weekly",  priority: "0.8" },
  { loc: "/blog/boom/",             lastmod: "2026-03-04", changefreq: "weekly",  priority: "0.8" },
  { loc: "/hubs/",                     lastmod: "2026-07-10", changefreq: "weekly",  priority: "0.9" },
  { loc: "/tools/",                    lastmod: "2026-07-10", changefreq: "weekly",  priority: "0.8" },
  { loc: "/aura/",                     lastmod: "2026-03-03", changefreq: "monthly", priority: "0.6" },
  { loc: "/art-store/",                lastmod: "2026-03-03", changefreq: "monthly", priority: "0.6" },
  { loc: "/privacy/",                  lastmod: "2026-06-06", changefreq: "yearly",  priority: "0.3" },
  { loc: "/data-deletion/",            lastmod: "2026-06-06", changefreq: "yearly",  priority: "0.3" },
  { loc: "/terms/",                    lastmod: "2026-04-27", changefreq: "yearly",  priority: "0.3" },
  { loc: "/posts/",                    lastmod: "2026-03-03", changefreq: "monthly", priority: "0.5" },
  { loc: "/posts/first-transmission/", lastmod: "2026-03-03", changefreq: "monthly", priority: "0.5" },
];

function toDateStr(val) {
  if (!val) return new Date().toISOString().slice(0, 10);
  return new Date(val).toISOString().slice(0, 10);
}

function readPosts(jsonPath) {
  try {
    const raw   = fs.readFileSync(jsonPath, "utf8");
    const posts = JSON.parse(raw);
    return Array.isArray(posts) ? posts : [];
  } catch (_) { return []; }
}

function readJson(jsonPath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  } catch (_) {
    return fallback;
  }
}

function urlBlock({ loc, lastmod, changefreq, priority }) {
  const cleanLoc = cleanPublicPath(loc);
  return [
    "  <url>",
    `    <loc>${BASE}${cleanLoc}</loc>`,
    `    <lastmod>${toDateStr(lastmod)}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    "  </url>",
  ].join("\n");
}

export function updateSitemap() {
  const mattPosts    = readPosts(path.join(ROOT, "static/_data/matt-posts.json"));
  const boomPosts = readPosts(path.join(ROOT, "static/_data/boom-posts.json"));
  const hubs = readJson(path.join(ROOT, "static/_data/authority-hubs.json"), { hubs: [] }).hubs || [];
  const assets = readJson(path.join(ROOT, "static/_data/authority-assets.json"), { assets: [] }).assets || [];

  const authorityPages = [
    ...hubs
      .filter(hub => hub.status !== "retired")
      .map(hub => ({
        loc: `/hubs/${hub.slug}/`,
        lastmod: "2026-07-10",
        changefreq: "weekly",
        priority: "0.8",
      })),
    ...assets
      .filter(asset => ["published", "ready"].includes(asset.status) && asset.canonical)
      .map(asset => ({
        loc: cleanPublicPath(asset.canonical),
        lastmod: "2026-07-10",
        changefreq: asset.type === "glossary" || asset.type === "reference" ? "weekly" : "monthly",
        priority: asset.type === "assessment" ? "0.8" : "0.7",
      })),
  ];

  const byLoc = new Map();
  for (const page of [...STATIC_PAGES, ...authorityPages]) {
    if (!page.loc || /(?:\/admin\/|\/dashboard\/|\/drafts\/)/.test(page.loc)) continue;
    const loc = cleanPublicPath(page.loc);
    byLoc.set(loc, { ...page, loc });
  }

  const staticBlocks = [...byLoc.values()].map(urlBlock);
  const postBlocks   = [...mattPosts, ...boomPosts].map((p) =>
    urlBlock({ loc: cleanPublicPath(p.url), lastmod: p.date, changefreq: "monthly", priority: "0.7" })
  );

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    "",
    "  <!-- Static Pages -->",
    staticBlocks.join("\n\n"),
    "",
    "  <!-- Blog Posts -->",
    postBlocks.join("\n\n"),
    "",
    "</urlset>",
    "",
  ].join("\n");

  const outFile = path.join(ROOT, "static/sitemap.xml");
  fs.writeFileSync(outFile, xml, "utf8");
  console.log(
    `Sitemap updated: static/sitemap.xml (${mattPosts.length + boomPosts.length} posts, ${authorityPages.length} authority URLs indexed)`
  );
}

// Run directly: node scripts/update-sitemap.js
if (process.argv[1] === __filename) {
  updateSitemap();
}
