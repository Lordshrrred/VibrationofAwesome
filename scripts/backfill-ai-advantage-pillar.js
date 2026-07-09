#!/usr/bin/env node
/**
 * backfill-ai-advantage-pillar.js
 *
 * Adds a natural pillar link to every published AI Advantage post that doesn't
 * already link to the hub review. Inserts the link in the generated
 * data-internal-related section (Related Reading block) so it's non-invasive.
 *
 * Dry run (default): shows which posts need the link, no writes.
 * Execute: node scripts/backfill-ai-advantage-pillar.js --execute
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = path.resolve(__dirname, "..");

const EXECUTE    = process.argv.includes("--execute");
const POSTS_DIR  = path.join(ROOT, "static", "blog", "boom", "posts");
const POSTS_JSON = path.join(ROOT, "static", "_data", "boom-posts.json");

const PILLAR_SLUG  = "ai-advantage-bootcamp-review-what-nobody-is-actually-saying-about-it";
const PILLAR_URL   = `/blog/boom/posts/${PILLAR_SLUG}`;
const PILLAR_TITLE = "AI Advantage Bootcamp Review: What Nobody Is Actually Saying About It";

// All AI Advantage keywords that identify posts in this campaign
const AI_ADV_PATTERN = /ai[- ]advantage/i;

function isAiAdvantagePost(slug, post) {
  return AI_ADV_PATTERN.test(slug) ||
    AI_ADV_PATTERN.test(post?.title || "") ||
    post?.niche === "ai-advantage-campaign";
}

function alreadyHasPillarLink(html) {
  return html.includes(PILLAR_SLUG) || html.includes(PILLAR_URL);
}

function buildPillarLink() {
  return `<li><a href="${PILLAR_URL}">${PILLAR_TITLE}</a></li>`;
}

function injectPillarLink(html) {
  // Try to inject into existing data-internal-related section
  const sectionMatch = html.match(/<section[^>]*data-internal-related[^>]*>([\s\S]*?)<\/section>/);
  if (sectionMatch) {
    const ulMatch = sectionMatch[0].match(/<ul>([\s\S]*?)<\/ul>/);
    if (ulMatch) {
      const newUl = ulMatch[0].replace("</ul>", `  ${buildPillarLink()}\n</ul>`);
      return html.replace(ulMatch[0], newUl);
    }
    // Section exists but no ul — add one
    const newSection = sectionMatch[0].replace(
      "</section>",
      `<ul>${buildPillarLink()}</ul>\n</section>`
    );
    return html.replace(sectionMatch[0], newSection);
  }

  // No related section — inject one before the signature/CTA area
  const ctaInsertPoint = html.match(/<div[^>]*data-ai-engine-cta[^>]*>/);
  if (ctaInsertPoint) {
    const relatedBlock = `
<section data-internal-related data-generated="pillar-backfill" style="margin:2rem 0;padding:1.5rem;border-left:2px solid rgba(201,168,76,0.3);background:rgba(0,0,0,0.1);">
  <p style="font-size:0.8rem;letter-spacing:0.2em;text-transform:uppercase;color:rgba(201,168,76,0.7);margin-bottom:0.75rem;">Related Reading</p>
  <ul style="list-style:none;padding:0;margin:0;">
    ${buildPillarLink()}
  </ul>
</section>

`;
    return html.replace(ctaInsertPoint[0], relatedBlock + ctaInsertPoint[0]);
  }

  // Last resort — inject before closing body
  const pillarBlock = `
<!-- pillar-backfill -->
<div style="margin:2rem 0;font-size:0.95rem;">
  <strong>Our full breakdown:</strong> <a href="${PILLAR_URL}">${PILLAR_TITLE}</a>
</div>
`;
  return html.replace("</body>", pillarBlock + "</body>");
}

async function main() {
  const posts = JSON.parse(fs.readFileSync(POSTS_JSON, "utf8"));
  const aiAdvPosts = posts.filter(p => isAiAdvantagePost(p.slug, p));

  console.log(`\n${"═".repeat(65)}`);
  console.log(`AI Advantage Pillar Backfill — ${EXECUTE ? "EXECUTE" : "DRY RUN"}`);
  console.log(`Pillar: ${PILLAR_URL}`);
  console.log(`Found ${aiAdvPosts.length} AI Advantage published posts`);
  console.log(`${"═".repeat(65)}\n`);

  let needsLink = 0, alreadyLinked = 0, modified = 0, notFound = 0;

  for (const post of aiAdvPosts) {
    if (post.slug === PILLAR_SLUG) continue; // skip the pillar itself

    const htmlPath = path.join(POSTS_DIR, post.slug + ".html");
    if (!fs.existsSync(htmlPath)) {
      console.log(`  MISSING: ${post.slug}`);
      notFound++;
      continue;
    }

    const html = fs.readFileSync(htmlPath, "utf8");
    if (alreadyHasPillarLink(html)) {
      alreadyLinked++;
      continue;
    }

    needsLink++;
    console.log(`  NEEDS LINK: ${post.slug}`);

    if (EXECUTE) {
      const newHtml = injectPillarLink(html);
      if (newHtml !== html) {
        fs.writeFileSync(htmlPath, newHtml, "utf8");
        console.log(`    ✓ injected pillar link`);
        modified++;
      } else {
        console.log(`    ⚠ injection produced no change — check HTML structure`);
      }
    }
  }

  console.log(`\n${"═".repeat(65)}`);
  console.log(`Pillar: ${PILLAR_SLUG}`);
  console.log(`Already linked: ${alreadyLinked} | Needs link: ${needsLink} | Missing file: ${notFound}`);
  if (EXECUTE) {
    console.log(`Modified: ${modified}`);
  } else {
    console.log(`Run with --execute to inject pillar links into ${needsLink} posts.`);
  }
  console.log(`${"═".repeat(65)}\n`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
