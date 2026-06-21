#!/usr/bin/env node
/**
 * Deterministic internal linking for Boom Frequency posts.
 *
 * Audit:
 *   node scripts/internal-linking.js --audit
 *
 * Apply to drafts and published posts:
 *   node scripts/internal-linking.js --apply --scope all
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import minimist from "minimist";
import {
  countContextualInternalLinks,
  ensureDeterministicInternalLinks,
  inferCluster,
  loadTopicClusters,
} from "./lib/internal-linking.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const argv = minimist(process.argv.slice(2), {
  boolean: ["audit", "apply"],
  string: ["scope", "slug"],
  default: { scope: "posts" },
});

function readJson(rel, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
  } catch (_) {
    return fallback;
  }
}

function titleFromHtml(html) {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return h1[1].replace(/<[^>]+>/g, "").trim();
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return title ? title[1].replace(/\s*\|[\s\S]*$/, "").trim() : "";
}

function excerptFromHtml(html) {
  const p = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  return p ? p[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180) : "";
}

function listHtmlFiles(scope) {
  const dirs = [];
  if (scope === "posts" || scope === "all") dirs.push(path.join(ROOT, "static", "blog", "boom", "posts"));
  if (scope === "drafts" || scope === "all") dirs.push(path.join(ROOT, "static", "blog", "boom", "drafts"));
  const files = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (name.endsWith(".html")) files.push(path.join(dir, name));
    }
  }
  return files;
}

function buildPostUniverse(files) {
  const published = readJson("static/_data/boom-posts.json", []);
  const queue = readJson("static/_data/drip-queue.json", { queue: [], published: [] });
  const metaBySlug = new Map();
  for (const post of published) metaBySlug.set(post.slug, post);
  for (const item of [...(queue.queue || []), ...(queue.published || [])]) {
    metaBySlug.set(item.slug, { ...(metaBySlug.get(item.slug) || {}), ...item, url: `/blog/boom/posts/${item.slug}` });
  }

  const posts = files.map(file => {
    const slug = path.basename(file, ".html");
    const html = fs.readFileSync(file, "utf8");
    const meta = metaBySlug.get(slug) || {};
    return {
      title: meta.title || titleFromHtml(html),
      slug,
      date: meta.date || meta.published_at || "",
      excerpt: meta.excerpt || excerptFromHtml(html),
      url: meta.url || `/blog/boom/posts/${slug}`,
      tags: meta.tags || [],
      niche: meta.niche,
      cluster: meta.cluster,
      keyword: meta.keyword,
      file,
    };
  });
  const seen = new Set();
  return posts.filter(post => {
    if (seen.has(post.slug)) return false;
    seen.add(post.slug);
    return true;
  });
}

function main() {
  if (!argv.audit && !argv.apply) {
    console.error("Use --audit or --apply.");
    process.exit(1);
  }

  const files = listHtmlFiles(argv.scope);
  const posts = buildPostUniverse(files);
  const clusterData = loadTopicClusters();
  const selected = argv.slug ? posts.filter(post => post.slug === argv.slug) : posts;

  const report = [];
  let changed = 0;

  for (const post of selected) {
    const html = fs.readFileSync(post.file, "utf8");
    const cluster = inferCluster(post, clusterData);
    const contextualLinks = countContextualInternalLinks(html);
    const generatedLinks = (html.match(/<section\s+data-internal-related[\s\S]*?<\/section>/i)?.[0].match(/<a\s+href="/g) || []).length;
    const totalInternalLinks = contextualLinks + generatedLinks;
    let inserted = false;
    let related = [];

    if (argv.apply) {
      const result = ensureDeterministicInternalLinks(html, post, posts, { minRelated: 1, limit: 3, refresh: true });
      inserted = result.inserted;
      related = result.related;
      if (inserted && result.html !== html) {
        fs.writeFileSync(post.file, result.html, "utf8");
        changed++;
      }
    }

    report.push({
      slug: post.slug,
      cluster: cluster || "unassigned",
      contextualLinks,
      generatedLinks,
      totalInternalLinks,
      inserted,
      related: related.map(item => item.slug),
    });
  }

  console.log(`\nInternal linking ${argv.apply ? "apply" : "audit"} (${argv.scope})`);
  console.log(`Posts checked: ${selected.length}`);
  if (argv.apply) console.log(`Files changed: ${changed}`);
  const weak = report.filter(item => item.totalInternalLinks < 2 && !item.inserted);
  console.log(`Weak pages after pass: ${weak.length}`);

  for (const item of report.filter(r => r.inserted || r.totalInternalLinks < 2 || r.contextualLinks < 2).slice(0, 40)) {
    const action = item.inserted ? "linked" : item.totalInternalLinks < 2 ? "weak" : "covered";
    console.log(`- ${action}: ${item.slug} [${item.cluster}] links=${item.totalInternalLinks} body=${item.contextualLinks} related=${item.generatedLinks}${item.related.length ? " -> " + item.related.join(", ") : ""}`);
  }
}

main();
