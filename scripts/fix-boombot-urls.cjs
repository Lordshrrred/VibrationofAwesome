// fix-boombot-urls.js
// Replaces all remaining /blog/boombot/ URL references with /blog/boom/
// across the data files, sitemap, dashboard, and docs.
// The rename-boombot.js script itself is intentionally excluded.

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const targets = [
  'static/_data/boom-posts.json',
  'static/sitemap.xml',
  'static/dashboard/index.html',
  'scripts/update-sitemap.js',
  'static/_data/syndication-log.json',
  'README.md',
];

let totalFixed = 0;

targets.forEach(rel => {
  const fp = path.join(ROOT, rel);
  if (!fs.existsSync(fp)) { console.log('SKIP (not found):', rel); return; }

  let text = fs.readFileSync(fp, 'utf8');
  const countBefore = (text.match(/boombot/gi) || []).length;

  // URL path fixes
  text = text.split('/blog/boombot/').join('/blog/boom/');
  text = text.split('/blog/boombot').join('/blog/boom');

  // Data file name fixes
  text = text.split('boombot-posts.json').join('boom-posts.json');

  // JS variable / identifier fixes (update-sitemap.js, dashboard)
  text = text.split('boombotPosts').join('boomPosts');
  text = text.split('BOOMBOT_URL').join('BOOM_URL');

  // HTML option value / lane string fixes
  text = text.split('value="boombot"').join('value="boom"');
  text = text.split("value='boombot'").join("value='boom'");
  text = text.split('lane: "boombot"').join('lane: "boom"');
  text = text.split("lane: 'boombot'").join("lane: 'boom'");
  text = text.split('"lane": "boombot"').join('"lane": "boom"');

  // dashboard --lane boombot CLI example
  text = text.split('--lane boombot').join('--lane boom');

  const countAfter = (text.match(/boombot/gi) || []).length;
  const fixed = countBefore - countAfter;
  totalFixed += fixed;

  if (fixed === 0) {
    console.log('NO CHANGE:', rel);
  } else {
    fs.writeFileSync(fp, text, 'utf8');
    console.log('UPDATED (' + fixed + ' replacements):', rel);
  }

  if (countAfter > 0) {
    console.log('  [!] Still has', countAfter, 'boombot instance(s) in', rel);
  }
});

console.log('\nTotal boombot instances fixed:', totalFixed);
