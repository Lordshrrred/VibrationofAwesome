#!/usr/bin/env node
/**
 * inject-ai-engine-nudge.js
 *
 * Injects the AI Engine nudge widget into AI-related blog posts.
 * Runs once; safe to re-run (idempotent ~ skips files that already have it).
 *
 * Usage:
 *   node scripts/inject-ai-engine-nudge.js            # dry run (preview only)
 *   node scripts/inject-ai-engine-nudge.js --write    # actually write files
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');
const WRITE     = process.argv.includes('--write');

// ---------------------------------------------------------------------------
// Slug classifiers
// ---------------------------------------------------------------------------

// Strong AI signal: direct AI tool usage, automation, AI workflows
const AI_CORE_PATTERNS = [
  /^ai-/,
  /^best-ai-/,
  /^best-llm-/,
  /^the-best-ai-/,
  /^chatgpt-/,
  /^claude-ai-/,
  /^automation-audit/,
  /^markdown-formatting-for-ai/,
  /how-to-use-(chatgpt|claude|elevenlabs|gemini|notebooklm|openai|perplexity|gamma|pictory|canva-ai|ai)/,
  /how-to-(write|create|build|get|set-up|organize|rescue|stop|export|check|generate|turn|repurpose|clone|restyle|manage-multiple-chatgpt|make-presentations-faster-with-chatgpt|make-faceless|make-.*-with-chatgpt|find-untapped-markets.*ai|get-ai-feedback|copy-ai-responses|build-your-first-gemini|create-your-first-claude|create-a-custom-gpt|create-social-media-ads-with-chatgpt|create-instagram-stories-with-canva-ai|stop-ai-hallucinations|turn-my-creative-process-into-an-sop|find-untapped-markets-for-music-using-ai|generate-consistent-ai-images)/,
];

// Medium signal: creator systems, content workflows, adjacent to AI
const CREATOR_SYSTEM_PATTERNS = [
  /^7-day-content-plan/,
  /^burnout-isnt-the-problem/,
  /^daily-news-brief-for-creators/,
  /^one-habit-per-month-system/,
  /^what-worked-playbook/,
  /^how-to-build-a-personal-reply-template/,
  /^how-to-convert-blog-posts/,
  /^how-to-generate-fresh-ideas/,
  /^how-to-repurpose-messy-notes/,
  /^how-to-turn-blog-posts-into-podcast/,
  /^how-to-turn-google-docs/,
  /^how-to-turn-youtube-videos/,
  /^how-to-write-engaging-newsletters/,
  /^how-to-write-linkedin-headlines/,
  /^how-to-build-a-landing-page-with-replit/,
];

// Posts that should NOT get the nudge even if patterns match
const EXCLUDE = new Set([
  'how-to-build-a-life-you-actually-want-not-the-one-you-settled-for',
  'how-to-build-an-authentic-personal-brand-as-a-creator',
  'how-to-create-a-freedom-lifestyle-from-scratch',
  'how-to-get-a-professional-headshot-for-free',
  'how-to-get-out-of-survival-mode-and-actually-start-living',
  'how-to-get-responses-to-cold-dms-as-a-creator',
  'how-to-monetize-your-creativity-without-selling-your-soul',
  'how-to-organize-coworking-receipts-in-a-spreadsheet-for-taxes',
  'how-to-organize-scattered-thoughts-for-creative-projects',
  'how-to-manage-mental-overload-as-a-creative',
  'how-to-stop-feeling-lost-and-start-moving-forward',
  'how-to-stop-living-in-survival-mode-for-good',
  'how-to-stop-overthinking-and-make-decisions-fast',
  'how-to-turn-google-docs-into-a-website',
  'how-to-write-linkedin-headlines-that-get-engagement',
]);

// Published AI posts (boom lane)
const PUBLISHED_AI = [
  'ai-advantage-summit-review.html',
  'ai-tools-for-independent-artists.html',
  'how-to-use-claude-api-for-musicians.html',
];

// Matt posts with AI angle
const MATT_AI = [
  'twenty-years-internet-marketing.html',
];

function isAICore(slug) {
  return AI_CORE_PATTERNS.some(p => p.test(slug));
}
function isCreatorSystem(slug) {
  return CREATOR_SYSTEM_PATTERNS.some(p => p.test(slug));
}

// ---------------------------------------------------------------------------
// Injection
// ---------------------------------------------------------------------------

const NUDGE_BLOCK = [
  '      <div data-ai-nudge data-blog-slug="SLUG"></div>',
  '      <script src="/js/ai-engine-nudge.js" defer></script>',
].join('\n');

// In drafts the nudge goes just before the .post-cta div
const DRAFT_ANCHOR = '<div class="post-cta">';
// In published posts it goes before data-ebook-cta (if present), else before </article>
const PUB_ANCHOR_1 = '<div data-ebook-cta';
const PUB_ANCHOR_2 = '</article>';

function slugFromFilename(filename) {
  return filename.replace(/\.html$/, '');
}

function inject(filepath, slug, anchorStr) {
  const html = fs.readFileSync(filepath, 'utf8');

  // Skip if already present
  if (html.includes('data-ai-nudge')) {
    return { status: 'skipped', reason: 'already has nudge' };
  }

  const nudge = NUDGE_BLOCK.replace('SLUG', slug);

  let updated;
  if (html.includes(anchorStr)) {
    updated = html.replace(anchorStr, nudge + '\n      ' + anchorStr);
  } else if (html.includes(PUB_ANCHOR_2)) {
    // Fallback: before </article>
    updated = html.replace(PUB_ANCHOR_2, nudge + '\n' + PUB_ANCHOR_2);
  } else {
    return { status: 'skipped', reason: 'no anchor found' };
  }

  if (WRITE) {
    fs.writeFileSync(filepath, updated, 'utf8');
  }
  return { status: WRITE ? 'written' : 'dry-run' };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const results = { written: [], dryRun: [], skipped: [] };

function processDir(dir, files, anchorStr, filter) {
  files.forEach(filename => {
    const slug     = slugFromFilename(filename);
    const filepath = path.join(dir, filename);
    if (!fs.existsSync(filepath)) return;
    if (EXCLUDE.has(slug)) return;
    if (filter && !filter(slug)) return;

    const r = inject(filepath, slug, anchorStr);
    if (r.status === 'written')   results.written.push(filename);
    if (r.status === 'dry-run')   results.dryRun.push(filename);
    if (r.status === 'skipped')   results.skipped.push(`${filename} (${r.reason})`);
  });
}

// Published boom posts
processDir(
  path.join(ROOT, 'static/blog/boom/posts'),
  PUBLISHED_AI,
  PUB_ANCHOR_1,
  null
);

// Published matt posts
processDir(
  path.join(ROOT, 'static/blog/matt/posts'),
  MATT_AI,
  PUB_ANCHOR_1,
  null
);

// Drafts
const DRAFTS_DIR = path.join(ROOT, 'static/blog/boom/drafts');
const allDrafts  = fs.readdirSync(DRAFTS_DIR).filter(f => f.endsWith('.html'));

processDir(
  DRAFTS_DIR,
  allDrafts,
  DRAFT_ANCHOR,
  slug => isAICore(slug) || isCreatorSystem(slug)
);

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const mode = WRITE ? 'WRITE' : 'DRY RUN';
console.log(`\n[ai-engine-nudge] ${mode} complete`);
console.log(`  Updated : ${(results.written.length || results.dryRun.length)} files`);
console.log(`  Skipped : ${results.skipped.length} files`);

if (!WRITE && results.dryRun.length) {
  console.log('\nFiles that WOULD be updated:');
  results.dryRun.forEach(f => console.log('  +', f));
}
if (results.skipped.length) {
  console.log('\nSkipped:');
  results.skipped.forEach(f => console.log('  ~', f));
}
if (WRITE) {
  console.log('\nWritten:');
  results.written.forEach(f => console.log('  +', f));
}
if (!WRITE) {
  console.log('\nRun with --write to apply changes.');
}
