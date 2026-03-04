#!/usr/bin/env node
/**
 * seo-research.js — Keyword brainstorm tool for vibrationofawesome.com
 *
 * Usage:
 *   node seo-research.js --topic "AI tools for musicians"
 *   node seo-research.js --topic "spiritual entrepreneurship" --save
 *
 * Requires: ANTHROPIC_API_KEY in .env
 * Install deps: npm install @anthropic-ai/sdk dotenv
 */

const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Anthropic = require('@anthropic-ai/sdk');

const ROOT = path.join(__dirname, '..');

// ── CLI args ──────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      opts[key] = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
      if (opts[key] !== true) i++;
    }
  }
  return opts;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();

  if (!opts.topic) {
    console.error('Error: --topic is required');
    console.error('Example: node seo-research.js --topic "AI tools for musicians"');
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY not found in .env');
    process.exit(1);
  }

  const client = new Anthropic();

  console.log(`\n🔍 SEO Research: "${opts.topic}"\n`);
  console.log('Consulting the signal...\n');

  const prompt = `You are an SEO research assistant specializing in content for vibrationofawesome.com.

The site's audience: spiritually awakening creators, neurodivergent entrepreneurs, independent musicians learning AI, and abundance-minded outliers. The content voice ranges from raw/personal (Matt EarthStar's blog) to eccentric/helpful AI-generated content (Boom Frequency by Matty BoomBoom).

Seed topic: "${opts.topic}"

Generate exactly 20 long-tail keyword variations. For each keyword, provide:
1. The keyword phrase
2. Search intent: informational, navigational, or transactional
3. Suggested SEO post title (compelling, specific, not clickbait)
4. Brief H2 outline (4-6 section titles only, no descriptions)

Format each entry EXACTLY like this:

---
KEYWORD: [keyword phrase]
INTENT: [informational|navigational|transactional]
TITLE: [suggested post title]
OUTLINE:
- H2: [section title]
- H2: [section title]
- H2: [section title]
- H2: [section title]
---

After all 20 entries, add a section:

=== QUICK WINS ===
List the top 3 keywords from the 20 that would be easiest to rank for and most aligned with the site's audience. Explain briefly why each is a quick win.

=== PRIORITY PICKS ===
List the top 3 keywords with the highest potential value for the site even if more competitive. Explain briefly.`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const rawOutput = message.content[0].text;

  // ── Parse into structured data ──────────────────────────────────────────────

  const entries = [];
  const entryBlocks = rawOutput.split(/^---$/m).filter(b => b.trim());

  for (const block of entryBlocks) {
    const kwMatch = block.match(/KEYWORD:\s*(.+)/);
    const intentMatch = block.match(/INTENT:\s*(.+)/);
    const titleMatch = block.match(/TITLE:\s*(.+)/);
    const outlineMatch = block.match(/OUTLINE:([\s\S]+?)(?=---|$)/);

    if (!kwMatch) continue;

    const outline = outlineMatch
      ? outlineMatch[1].trim().split('\n').map(l => l.replace(/^-\s*H2:\s*/, '').trim()).filter(Boolean)
      : [];

    entries.push({
      keyword: kwMatch ? kwMatch[1].trim() : '',
      intent: intentMatch ? intentMatch[1].trim() : '',
      title: titleMatch ? titleMatch[1].trim() : '',
      outline,
    });
  }

  // Extract sections after entries
  const quickWinsMatch = rawOutput.match(/=== QUICK WINS ===([\s\S]+?)(?====|$)/);
  const priorityMatch = rawOutput.match(/=== PRIORITY PICKS ===([\s\S]+?)(?====|$)/);

  // ── Terminal output ─────────────────────────────────────────────────────────

  console.log(`═══════════════════════════════════════════════════`);
  console.log(`  SEO Research Results: "${opts.topic}"`);
  console.log(`  ${entries.length} keyword variations generated`);
  console.log(`═══════════════════════════════════════════════════\n`);

  entries.forEach((entry, i) => {
    const intentColor = entry.intent === 'informational' ? '📖' : entry.intent === 'transactional' ? '💰' : '🧭';
    console.log(`${String(i + 1).padStart(2, ' ')}. ${intentColor} [${entry.intent || 'unknown'}]`);
    console.log(`    KEYWORD: ${entry.keyword}`);
    console.log(`    TITLE:   ${entry.title}`);
    if (entry.outline.length) {
      console.log(`    OUTLINE: ${entry.outline.slice(0, 2).join(' | ')}${entry.outline.length > 2 ? ' ...' : ''}`);
    }
    console.log('');
  });

  if (quickWinsMatch) {
    console.log('─── QUICK WINS ────────────────────────────────────');
    console.log(quickWinsMatch[1].trim());
    console.log('');
  }

  if (priorityMatch) {
    console.log('─── PRIORITY PICKS ────────────────────────────────');
    console.log(priorityMatch[1].trim());
    console.log('');
  }

  // ── Save to topic-queue.json ────────────────────────────────────────────────

  const dataDir = path.join(ROOT, '_data');
  fs.mkdirSync(dataDir, { recursive: true });
  const queuePath = path.join(dataDir, 'topic-queue.json');

  let queue = [];
  if (fs.existsSync(queuePath)) {
    queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
  }

  const queueEntry = {
    topic: opts.topic,
    researched: new Date().toISOString().split('T')[0],
    keywords: entries,
    quickWins: quickWinsMatch ? quickWinsMatch[1].trim() : '',
    priorityPicks: priorityMatch ? priorityMatch[1].trim() : '',
  };

  // Replace existing entry for same topic or append
  const existingIdx = queue.findIndex(q => q.topic.toLowerCase() === opts.topic.toLowerCase());
  if (existingIdx >= 0) {
    queue[existingIdx] = queueEntry;
  } else {
    queue.unshift(queueEntry);
  }

  fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2));

  console.log(`═══════════════════════════════════════════════════`);
  console.log(`✅ Saved to _data/topic-queue.json`);
  console.log(`\nNext step: Pick a keyword and run:`);
  console.log(`  node scripts/generate-post.js --lane boombot --keyword "[keyword]" --topic "[topic]"\n`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
