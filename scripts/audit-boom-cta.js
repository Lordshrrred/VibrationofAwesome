#!/usr/bin/env node
/**
 * Audit Boom post CTA structure and content hygiene.
 *
 * Checks:
 *  - data-ebook-cta (Field Guide) present in every post (universal bottom)
 *  - AI posts additionally have data-ai-engine-cta (conclusion, before signature)
 *  - No duplicate data-ai-engine-cta widgets
 *  - data-ai-engine-cta does NOT appear after the signature in self-help posts
 *  - No legacy nasa-img-wrap, post-cta, or old free-ebook links
 *  - No unsupported first-person authority phrases
 *
 * Usage:
 *   node scripts/audit-boom-cta.js
 *   node scripts/audit-boom-cta.js --fix   (re-runs patch-boom-format.js on failures)
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { getBoomConversionTarget } from "./lib/boom-format.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const DIRS = [
  { label: "live", dir: path.join(ROOT, "static/blog/boom/posts") },
  { label: "queued", dir: path.join(ROOT, "static/blog/boom/drafts") },
];

const FIX_MODE = process.argv.includes("--fix");

function readTitle(html) {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return h1[1].replace(/<[^>]+>/g, "").trim();
  const title = html.match(/<title>([\s\S]*?)<\/title>/i);
  return title ? title[1].replace(/\s+\|[\s\S]*$/, "").trim() : "";
}

const FAKE_CLAIM_PATTERNS = [
  /I tested\b/i,
  /I.ve tested/i,
  /tested dozens/i,
  /I use (?:it|these|this) daily/i,
  /my streamlined stack/i,
  /I have personally (?:tried|done|used)/i,
  /I personally tried/i,
  /after years of (?:testing|using)/i,
];

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
    const isAI = target.primary === "ai-engine";

    const fileIssues = [];

    // 1. Universal bottom Field Guide form must be present
    if (!html.includes("data-ebook-cta")) {
      fileIssues.push("MISSING: data-ebook-cta (Field Guide universal bottom)");
    }

    // 2. Count AI Engine CTA occurrences
    const aiCtaCount = (html.match(/data-ai-engine-cta/g) || []).length;
    if (aiCtaCount > 1) {
      fileIssues.push(`DUPLICATE: data-ai-engine-cta appears ${aiCtaCount} times`);
    }
    if (!isAI && aiCtaCount > 0) {
      fileIssues.push("WRONG: data-ai-engine-cta in a self-help post (should not be present)");
    }
    if (isAI && aiCtaCount === 0) {
      fileIssues.push("MISSING: data-ai-engine-cta in AI post (should appear before signature)");
    }

    // 3. Legacy patterns
    if (html.includes("nasa-img-wrap")) fileIssues.push("LEGACY: nasa-img-wrap found");
    if (html.includes('class="post-cta"')) fileIssues.push("LEGACY: post-cta div found");
    if (/free.ebook/i.test(html)) fileIssues.push("LEGACY: free-ebook reference found");

    // 4. Fake first-person claims
    for (const pattern of FAKE_CLAIM_PATTERNS) {
      if (pattern.test(html)) {
        fileIssues.push(`TRUTHFULNESS: "${pattern}" found — rewrite as "worth testing" / "a practical starting point"`);
        break;
      }
    }

    if (fileIssues.length > 0) {
      issues.push({ label, file, issues: fileIssues });
      counts.fail++;
    } else {
      counts.ok++;
    }
  }
}

if (issues.length === 0) {
  console.log(`\nAll ${counts.ok} posts passed the CTA + hygiene audit.\n`);
} else {
  console.log(`\nAudit found issues in ${issues.length} post(s):\n`);
  for (const { label, file, issues: fileIssues } of issues) {
    console.log(`  [${label}] ${file}`);
    for (const msg of fileIssues) console.log(`    ~ ${msg}`);
  }
  if (FIX_MODE) {
    console.log("\nRunning patch-boom-format.js to fix structural issues...\n");
    execSync("node scripts/patch-boom-format.js", { stdio: "inherit", cwd: ROOT });
  } else {
    console.log("\nRun: node scripts/audit-boom-cta.js --fix  to auto-fix structural issues.\n");
    console.log("Truthfulness issues require manual review.\n");
  }
  process.exit(1);
}
