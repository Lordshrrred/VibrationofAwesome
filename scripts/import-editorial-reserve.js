#!/usr/bin/env node
// Import reviewed local writing without calling a generation or image API.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { marked } from "marked";
import { buildHtml } from "./generate-post.js";
import { contentIdentity, ensureDeterministicInternalLinks } from "./lib/internal-linking.js";
import { articleText, findRepeatedContent } from "./lib/editorial.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rows = [
  { file: "attention-audit-one-change", keyword: "how to use a digital attention audit", cluster: "dopamine-attention", niche: "dopamine-addiction-numbing" },
  { file: "focus-card-finish-line", keyword: "how to plan a focus session with a clear finish line", cluster: "spiritual-productivity", niche: "direction-purpose-drift" },
  { file: "creative-signal-next-move", keyword: "how to use the creative signal finder", cluster: "authentic-self-expression", niche: "self-betrayal-avoidance" },
  { file: "compass-point-small-experiment", keyword: "how to turn a direction reflection into a small experiment", cluster: "purpose-direction", niche: "direction-purpose-drift" },
];

function main() {
  const execute = process.argv.includes("--execute"), now = new Date().toISOString();
  const queueFile = path.join(ROOT, "static/_data/drip-queue.json");
  const queue = JSON.parse(fs.readFileSync(queueFile, "utf8"));
  const posts = JSON.parse(fs.readFileSync(path.join(ROOT, "static/_data/boom-posts.json"), "utf8"));
  const history = [...posts, ...(queue.published || []), ...queue.queue];
  const articles = [...posts, ...queue.queue].map(row => {
    const file = ["posts", "drafts"].map(folder => path.join(ROOT, "static/blog/boom", folder, row.slug + ".html")).find(file => fs.existsSync(file));
    return file ? { slug: row.slug, html: fs.readFileSync(file, "utf8") } : null;
  }).filter(Boolean);
  for (const row of rows) {
    const markdown = fs.readFileSync(path.join(ROOT, "content-strategy/editorial-reserve", row.file + ".md"), "utf8");
    const title = markdown.match(/^# (.+)$/m)?.[1];
    if (!title) throw new Error("Missing title: " + row.file);
    const existing = history.find(post => contentIdentity(post.title) === contentIdentity(title) || post.keyword === row.keyword);
    if (existing && !queue.queue.some(post => post.slug === existing.slug && post.draft_source === "editorial-recovery")) continue;
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    let body = marked.parse(markdown.replace(/^# .+\n/, ""));
    if (findRepeatedContent(body, articles.filter(article => article.slug !== slug))) throw new Error("Overlapping editorial draft: " + title);
    const item = { slug, title, keyword: row.keyword, niche: row.niche, cluster: row.cluster, replenished_at: now, draft_source: "editorial-recovery" };
    const page = buildHtml("boom", title, now, body, slug, markdown.split("\n\n")[1].slice(0, 155), "https://vibrationofawesome.com/images/boom/Tarantula_Nebula_by_JWST.jpg", { primary: "field-guide", url: "/field-guide/", text: "Explore the Field Guide" });
    const html = ensureDeterministicInternalLinks(page, item, posts).html;
    if (articleText(html).split(" ").length < 400 || html.includes("[object Object]")) throw new Error("Incomplete local draft: " + title);
    console.log(`${execute ? "Import" : "Preview"}: ${title}`);
    if (execute) {
      fs.writeFileSync(path.join(ROOT, "static/blog/boom/drafts", slug + ".html"), html);
      const index = queue.queue.findIndex(post => post.slug === slug);
      if (index < 0) queue.queue.push(item);
      else queue.queue[index] = item;
    }
    history.push(item); articles.push({ slug, html });
  }
  if (execute) fs.writeFileSync(queueFile, JSON.stringify(queue, null, 2) + "\n");
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
