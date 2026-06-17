#!/usr/bin/env node
// Adds an independent-review disclaimer to all ai-advantage-campaign posts.
// Safe to re-run — skips files that already have the disclaimer.

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const DISCLAIMER = `
      <div style="margin:2rem 0 1rem;padding:1rem 1.25rem;border-left:3px solid rgba(0,229,255,0.3);background:rgba(0,229,255,0.04);border-radius:0 6px 6px 0;">
        <p style="margin:0;font-size:0.82rem;color:rgba(255,255,255,0.45);line-height:1.6;"><em>Independent review. Vibration of Awesome is not affiliated with AI Advantage, Tony Robbins, Dean Graziosi, or any related programs or companies.</em></p>
      </div>`;

const MARKER = '<!-- disclaimer:ai-advantage -->';

const queue = JSON.parse(readFileSync(join(ROOT, 'static/_data/drip-queue.json'), 'utf8'));
const campaignSlugs = new Set([
  ...queue.queue.filter(p => p.niche === 'ai-advantage-campaign').map(p => p.slug),
  ...(queue.published || []).filter(p => p.niche === 'ai-advantage-campaign').map(p => p.slug),
]);

// Also include the one already-published post
campaignSlugs.add('ai-advantage-summit-review');

const DRAFTS_DIR = join(ROOT, 'static/blog/boom/drafts');
const POSTS_DIR = join(ROOT, 'static/blog/boom/posts');

let patched = 0;
let skipped = 0;

function patchFile(filePath) {
  const html = readFileSync(filePath, 'utf8');
  if (html.includes(MARKER)) {
    skipped++;
    return;
  }
  // Insert before </article> close
  const updated = html.replace('</article></div>', `${MARKER}${DISCLAIMER}\n      </article></div>`);
  if (updated === html) {
    // Fallback: try without </div>
    const updated2 = html.replace('</article>', `${MARKER}${DISCLAIMER}\n      </article>`);
    if (updated2 === html) {
      console.warn(`  WARN: could not find </article> in ${basename(filePath)}`);
      skipped++;
      return;
    }
    writeFileSync(filePath, updated2, 'utf8');
  } else {
    writeFileSync(filePath, updated, 'utf8');
  }
  patched++;
  console.log(`  patched: ${basename(filePath)}`);
}

// Check drafts
for (const file of readdirSync(DRAFTS_DIR)) {
  if (!file.endsWith('.html')) continue;
  const slug = file.replace('.html', '');
  if (campaignSlugs.has(slug)) {
    patchFile(join(DRAFTS_DIR, file));
  }
}

// Check published posts
for (const file of readdirSync(POSTS_DIR)) {
  if (!file.endsWith('.html')) continue;
  const slug = file.replace('.html', '');
  if (campaignSlugs.has(slug)) {
    patchFile(join(POSTS_DIR, file));
  }
}

console.log(`\nDone. Patched: ${patched}, Already had disclaimer: ${skipped}`);
