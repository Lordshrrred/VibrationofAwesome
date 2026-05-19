#!/usr/bin/env node
/**
 * Audit Boom post CTA routing.
 * Prints any posts where the CTA widget doesn't match the expected type
 * based on getBoomConversionTarget classification.
 *
 * Usage:
 *   node scripts/audit-boom-cta.js
 *   node scripts/audit-boom-cta.js --fix   (re-runs patch-boom-format.js on failures)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getBoomConversionTarget } from "./lib/boom-format.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const DIRS = [
  { label: "live", dir: path.join(ROOT, "static/blog/boom/posts") },
  { label: "queued", dir: path.join(ROOT, "static/blog/boom/drafts") },
];

function readTitle(html) {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return h1[1].replace(/<[^>]+>/g, "").trim();
  const title = html.match(/<title>([\s\S]*?)<\/title>/i);
  return title ? title[1].replace(/\s+\|[\s\S]*$/, "").trim() : "";
}

const issues = [];
const counts = { ok: 0, fail: 0 };

for (const { label, dir } of DIRS) {
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".html")).sort();

  for (const file of files) {
    const filePath = path.join(dir, file);
    const html = fs.readFileSync(filePath, "utf8");
    const slug = file.replace(/\.html$/, "");
    const title = readTitle(html);
    const target = getBoomConversionTarget({ title, slug, keyword: slug });

    const hasAiCta = html.includes("data-ai-engine-cta");
    const hasEbookCta = html.includes("data-ebook-cta");
    const isAI = target.primary === "ai-engine";

    const expectedCta = isAI ? "data-ai-engine-cta" : "data-ebook-cta";
    const hasCta = isAI ? hasAiCta : hasEbookCta;
    const wrongCta = isAI ? hasEbookCta : hasAiCta;

    if (!hasCta || wrongCta) {
      const detected = hasAiCta ? "ai-engine" : hasEbookCta ? "ebook" : "none";
      issues.push({ label, file, expected: expectedCta, detected });
      counts.fail++;
    } else {
      counts.ok++;
    }
  }
}

if (issues.length === 0) {
  console.log(`\nAll ${counts.ok} posts have correct CTA routing. Nothing to fix.\n`);
} else {
  console.log(`\nCTA routing issues found: ${issues.length} post(s)\n`);
  for (const { label, file, expected, detected } of issues) {
    console.log(`  [${label}] ${file}`);
    console.log(`    expected: ${expected}   found: ${detected}`);
  }
  console.log(`\nRun: node scripts/patch-boom-format.js  to fix all issues.\n`);
  process.exit(1);
}
