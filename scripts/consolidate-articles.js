#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { contentIdentity } from "./lib/internal-linking.js";
import { applyEditorial, articleText, shingles, overlap } from "./lib/editorial.js";
import { updateSitemap } from "./update-sitemap.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
const write = (file, data) => fs.writeFileSync(path.join(ROOT, file), JSON.stringify(data, null, 2) + "\n");

export function planConsolidation(posts, htmlFor) {
  const groups = new Map();
  for (const post of posts) {
    const key = contentIdentity(post.title);
    const rows = groups.get(key) || [];
    rows.push(post); groups.set(key, rows);
  }
  const redirects = {}, retained = [];
  for (const rows of groups.values()) {
    // Preserve the established URL when it contains a complete article.
    rows.sort((a, b) => a.date.localeCompare(b.date) || a.slug.localeCompare(b.slug));
    const keep = rows.find(row => articleText(htmlFor(row)).split(" ").length >= 500) || rows[0];
    retained.push(keep);
    for (const row of rows) if (row.slug !== keep.slug) redirects[row.slug] = keep.slug;
  }
  // Different titles can still conceal an identical article.
  const exact = new Map();
  for (const row of retained.sort((a, b) => a.date.localeCompare(b.date))) {
    const text = articleText(htmlFor(row));
    if (text.length > 500 && exact.has(text)) redirects[row.slug] = exact.get(text);
    else exact.set(text, row.slug);
  }
  const survivors = retained.filter(row => !redirects[row.slug]);
  for (const slug of Object.keys(redirects)) while (redirects[redirects[slug]]) redirects[slug] = redirects[redirects[slug]];
  const fingerprints = survivors.map(row => ({ slug: row.slug, tokens: shingles(articleText(htmlFor(row))) }));
  const near = [];
  for (let i = 0; i < fingerprints.length; i++) for (let j = i + 1; j < fingerprints.length; j++) {
    const similarity = overlap(fingerprints[i].tokens, fingerprints[j].tokens);
    if (similarity >= 0.5) near.push({ a: fingerprints[i].slug, b: fingerprints[j].slug, similarity });
  }
  return { redirects, survivors: survivors.sort((a, b) => b.date.localeCompare(a.date)), near };
}

function filesUnder(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(file) : [file];
  });
}

function main() {
  const execute = process.argv.includes("--execute");
  const posts = read("static/_data/boom-posts.json");
  const htmlFor = row => fs.readFileSync(path.join(ROOT, "static/blog/boom/posts", row.slug + ".html"), "utf8");
  const plan = planConsolidation(posts, htmlFor);
  if (plan.near.length) throw new Error("Different-title overlap requires editorial review: " + JSON.stringify(plan.near));
  const prior = fs.existsSync(path.join(ROOT, "static/_data/article-redirects.json")) ? read("static/_data/article-redirects.json") : {};
  const redirects = { ...prior, ...plan.redirects };
  const queue = read("static/_data/drip-queue.json");
  console.log(JSON.stringify({ execute, original: posts.length, retained: plan.survivors.length, redirected: Object.keys(plan.redirects).length, heldDrafts: queue.duplicate_holds?.length || 0, nearDuplicatePairs: plan.near.length }));
  if (!execute) return;

  const archive = path.join(ROOT, "private/article-consolidation", new Date().toISOString().replace(/[:.]/g, "-"));
  fs.mkdirSync(archive, { recursive: true });
  fs.writeFileSync(path.join(archive, "plan.json"), JSON.stringify({ ...plan, queue }, null, 2));
  for (const slug of Object.keys(plan.redirects)) {
    const source = path.join(ROOT, "static/blog/boom/posts", slug + ".html");
    fs.renameSync(source, path.join(archive, slug + ".html"));
  }
  for (const row of queue.duplicate_holds || []) {
    const source = path.join(ROOT, "static/blog/boom/drafts", row.slug + ".html");
    if (fs.existsSync(source)) fs.renameSync(source, path.join(archive, "draft-" + row.slug + ".html"));
  }
  queue.retired_duplicates = [...(queue.retired_duplicates || []), ...(queue.duplicate_holds || []).map(row => ({ ...row, retired_at: new Date().toISOString() }))];
  queue.duplicate_holds = [];
  write("static/_data/drip-queue.json", queue);
  write("static/_data/boom-posts.json", plan.survivors);
  write("static/_data/article-redirects.json", redirects);
  const config = read("vercel.json");
  const newRules = Object.entries(redirects).flatMap(([old, target]) => ["", ".html", "/"].map(suffix => ({ source: "/blog/boom/posts/" + old + suffix, destination: "/blog/boom/posts/" + target, permanent: true })));
  const sources = new Set(newRules.map(rule => rule.source));
  config.redirects = [...newRules, ...config.redirects.filter(rule => !sources.has(rule.source))];
  write("vercel.json", config);

  let changed = 0;
  const rewriteLinks = text => text.replace(/((?:https:\/\/vibrationofawesome\.com)?\/blog\/boom\/posts\/)([a-z0-9-]+)(\.html)?(?=[\s"'#?<)\\/]|$)/g, (all, prefix, slug) => redirects[slug] ? prefix + redirects[slug] : all);
  for (const file of filesUnder(path.join(ROOT, "static")).filter(file => file.endsWith(".html"))) {
    let html = fs.readFileSync(file, "utf8"), next = rewriteLinks(html);
    if (file.includes("/blog/boom/")) next = applyEditorial(next);
    else if (file.includes("/blog/matt/")) next = applyEditorial(next, "matt");
    if (next !== html) { fs.writeFileSync(file, next); changed++; }
  }
  for (const name of ["authority-assets", "authority-hubs"]) {
    const file = path.join(ROOT, "static/_data", name + ".json");
    fs.writeFileSync(file, rewriteLinks(fs.readFileSync(file, "utf8")));
  }
  updateSitemap();
  console.log(`Updated ${changed} pages; originals preserved privately and in Git history.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
