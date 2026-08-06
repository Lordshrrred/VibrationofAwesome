#!/usr/bin/env node
/**
 * audit-faq.js
 *
 * Read-only audit of FAQ consistency across published Boom Frequency posts.
 * Never generates or modifies FAQ content ~ it only reports what already
 * exists, cross-checks visible FAQ markup against FAQPage schema, and flags
 * likely-qualifying posts without an FAQ for editorial review only.
 *
 * Usage: node scripts/audit-faq.js
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { assessFaqEligibility } from "./lib/faq-eligibility.js";

import { pathToFileURL as __voaPathToFileURL } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const POSTS_DIR = path.join(ROOT, "static", "blog", "boom", "posts");
const REPORT_FILE = path.join(ROOT, "reports", "faq-audit-latest.md");

function readJson(rel, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8")); }
  catch (_) { return fallback; }
}

function extractVisibleFaqQuestions(html) {
  const headingMatch = html.match(/<h2[^>]*>\s*FAQ\s*<\/h2>/i);
  if (!headingMatch) return [];
  const rest = html.slice(headingMatch.index + headingMatch[0].length);
  const nextHeading = rest.match(/<h2[^>]*>/i);
  const section = nextHeading ? rest.slice(0, nextHeading.index) : rest;
  // Visible FAQ questions are rendered as <strong>Q: ...?</strong> (from the
  // markdown **Q: ...?** convention) inside <p> tags.
  const matches = [...section.matchAll(/<strong>\s*Q:\s*(.+?)\?\s*<\/strong>/gi)];
  return matches.map((m) => m[1].replace(/<[^>]+>/g, "").trim() + "?");
}

function extractFaqSchema(html) {
  const scripts = [...html.matchAll(/<script type="application\/ld\+json">\n([\s\S]*?)\n\s*<\/script>/g)];
  for (const [, json] of scripts) {
    try {
      const parsed = JSON.parse(json);
      if (parsed["@type"] === "FAQPage" && Array.isArray(parsed.mainEntity)) {
        return parsed.mainEntity.map((q) => q.name);
      }
    } catch (_) { /* not this schema block */ }
  }
  return null;
}

function main() {
  const posts = readJson("static/_data/boom-posts.json", []);
  const bySlug = Object.fromEntries(posts.map((p) => [p.slug, p]));
  const files = fs.existsSync(POSTS_DIR) ? fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith(".html")) : [];

  const rows = [];
  for (const file of files) {
    const slug = file.replace(/\.html$/, "");
    const html = fs.readFileSync(path.join(POSTS_DIR, file), "utf8");
    const post = bySlug[slug] || {};
    const visibleQuestions = extractVisibleFaqQuestions(html);
    const schemaQuestions = extractFaqSchema(html);
    rows.push({
      slug,
      title: post.title || slug,
      url: post.url || `/blog/boom/posts/${slug}`,
      hasVisible: visibleQuestions.length > 0,
      visibleCount: visibleQuestions.length,
      visibleQuestions,
      hasSchema: schemaQuestions !== null,
      schemaCount: schemaQuestions ? schemaQuestions.length : 0,
      schemaQuestions: schemaQuestions || [],
      post,
    });
  }

  const withVisible = rows.filter((r) => r.hasVisible);
  const withSchema = rows.filter((r) => r.hasSchema);
  const schemaNoVisible = rows.filter((r) => r.hasSchema && !r.hasVisible);
  const visibleNoSchema = rows.filter((r) => r.hasVisible && !r.hasSchema);
  const mismatchedCounts = rows.filter((r) => r.hasVisible && r.hasSchema && r.visibleCount !== r.schemaCount);

  const withoutFaq = rows.filter((r) => !r.hasVisible && !r.hasSchema);
  const qualifyingWithoutFaq = withoutFaq
    .map((r) => ({ ...r, assessment: assessFaqEligibility({ title: r.post.title, keyword: r.post.niche, cluster: r.post.cluster }) }))
    .filter((r) => r.assessment.eligible);

  const lines = [];
  lines.push(`# FAQ Audit ~ ${new Date().toISOString().slice(0, 10)}`);
  lines.push("");
  lines.push("Read-only report. No FAQs are generated or modified by this audit.");
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Total published Boom posts: ${rows.length}`);
  lines.push(`- Posts with visible FAQ section: ${withVisible.length}`);
  lines.push(`- Posts with FAQPage schema: ${withSchema.length}`);
  lines.push(`- Schema present but no visible FAQ (should not happen): ${schemaNoVisible.length}`);
  lines.push(`- Visible FAQ but no schema (below 2-question schema minimum, or pre-dates the schema feature): ${visibleNoSchema.length}`);
  lines.push(`- Visible/schema question count mismatch: ${mismatchedCounts.length}`);
  lines.push(`- Likely-qualifying posts with no FAQ at all (editorial review only, not auto-generated): ${qualifyingWithoutFaq.length}`);
  lines.push("");

  if (schemaNoVisible.length) {
    lines.push("## Schema Present, No Visible FAQ (investigate)");
    lines.push("");
    for (const r of schemaNoVisible) lines.push(`- ${r.title} (${r.url})`);
    lines.push("");
  }

  if (mismatchedCounts.length) {
    lines.push("## Visible/Schema Count Mismatch (investigate)");
    lines.push("");
    for (const r of mismatchedCounts) lines.push(`- ${r.title}: visible=${r.visibleCount} schema=${r.schemaCount} (${r.url})`);
    lines.push("");
  }

  lines.push("## Existing FAQ-Enabled Articles");
  lines.push("");
  lines.push("| Title | URL | Questions | Source | Qualification |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const r of withVisible) {
    const assessment = assessFaqEligibility({ title: r.post.title, keyword: r.post.niche, cluster: r.post.cluster });
    lines.push(`| ${r.title} | ${r.url} | ${r.visibleCount} | generated (Claude, same call as article body) | ${assessment.reason} |`);
  }
  lines.push("");

  lines.push("## Likely-Qualifying Posts Without FAQ (editorial review only)");
  lines.push("");
  if (!qualifyingWithoutFaq.length) {
    lines.push("_None flagged this run._");
  } else {
    for (const r of qualifyingWithoutFaq.slice(0, 30)) {
      lines.push(`- ${r.title} (${r.url}) ~ ${r.assessment.reason}`);
    }
    if (qualifyingWithoutFaq.length > 30) lines.push(`- ...and ${qualifyingWithoutFaq.length - 30} more`);
  }
  lines.push("");
  lines.push("These posts pre-date the FAQ feature (added 2026-07-10) and are listed for optional, manual, one-at-a-time editorial review ~ not for bulk retroactive generation.");
  lines.push("");

  const report = lines.join("\n");
  fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
  fs.writeFileSync(REPORT_FILE, report, "utf8");
  console.log(report);
  console.log(`\nReport written to ${path.relative(ROOT, REPORT_FILE)}`);
}

// CLI-only guard: without this, merely `import`-ing this module (from a test,
// another script, or a syntax/load check) executes a real run with real side
// effects. See CLAUDE.md ~ every script with a top-level main() needs this.
const __voaIsCli = process.argv[1] && import.meta.url === __voaPathToFileURL(process.argv[1]).href;
if (__voaIsCli) {
  main();
}
