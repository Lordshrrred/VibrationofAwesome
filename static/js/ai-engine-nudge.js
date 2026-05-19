// ai-engine-nudge.js ~ Contextual AI Engine reference widget
//
// Drop into any AI-related blog post:
//   <div data-ai-nudge data-blog-slug="your-post-slug"></div>
//   <script src="/js/ai-engine-nudge.js" defer></script>
//
// Renders a small prose-style editorial note linking to /ai-engine/.
// No competing email form ~ just a clean contextual mention.
// Copy rotates across 8 variants based on slug hash (deterministic).
// ---------------------------------------------------------------------

(function () {
  'use strict';

  var LINK = '/ai-engine/';

  // 8 variants ~ tonal range from practical to philosophical.
  // Anchor text varies; no two variants use identical phrasing.
  var VARIANTS = [
    'The tools, the workflow, the actual system ~ I mapped all of it in <a href="' + LINK + '">The Creative Exoskeleton</a>, the AI guide built from 20 years of creator friction.',
    'If this kind of workflow is what you\'re building toward, the <a href="' + LINK + '">AI Engine</a> connects it all into a working system.',
    'There\'s a deeper philosophy underneath all these tools. <a href="' + LINK + '">The Creative Exoskeleton</a> is where that\'s laid out.',
    'The bridge between individual AI tools and a real creator system is what the <a href="' + LINK + '">VOA AI guide</a> is specifically about.',
    'I built the full creator infrastructure behind VOA using these exact tools. It\'s documented in <a href="' + LINK + '">the AI Field Guide</a>.',
    'This is one piece of a larger architecture. The <a href="' + LINK + '">Creative Exoskeleton</a> maps the whole thing ~ tools, automation, and the mindset that holds it together.',
    'If reducing the gap between vision and execution is the goal, the <a href="' + LINK + '">AI Engine</a> is the most direct resource I\'ve built for that.',
    'I go deeper on exactly this in <a href="' + LINK + '">the creator AI guide</a> ~ the real system, not the highlight reel.',
  ];

  var STYLES = [
    '.aen-wrap {',
    '  margin: 2.2rem 0 1.8rem;',
    '  padding: 0.9rem 1.1rem 0.9rem 1rem;',
    '  border-left: 2px solid rgba(0,229,204,0.3);',
    '  background: rgba(0,229,204,0.03);',
    '  border-radius: 0 6px 6px 0;',
    '  display: flex;',
    '  align-items: flex-start;',
    '  gap: 0.65rem;',
    '}',
    '.aen-icon {',
    '  flex-shrink: 0;',
    '  margin-top: 0.18em;',
    '  opacity: 0.55;',
    '}',
    '.aen-text {',
    '  font-size: 0.95rem;',
    '  line-height: 1.68;',
    '  color: rgba(232,244,240,0.68);',
    '  font-family: "Lora", "Cormorant Garamond", Georgia, serif;',
    '  font-style: italic;',
    '}',
    '.aen-text a {',
    '  color: rgba(0,229,204,0.85);',
    '  text-decoration: none;',
    '  border-bottom: 1px solid rgba(0,229,204,0.22);',
    '  transition: color 0.18s, border-color 0.18s;',
    '}',
    '.aen-text a:hover {',
    '  color: #00e5cc;',
    '  border-color: rgba(0,229,204,0.5);',
    '}',
  ].join('\n');

  // Deterministic variant selection: same slug always gets same copy
  function pickVariant(slug) {
    var hash = 0;
    for (var i = 0; i < slug.length; i++) {
      hash = (hash * 31 + slug.charCodeAt(i)) & 0x7fffffff;
    }
    return VARIANTS[hash % VARIANTS.length];
  }

  function injectStyles() {
    if (document.getElementById('aen-styles')) return;
    var s = document.createElement('style');
    s.id = 'aen-styles';
    s.textContent = STYLES;
    document.head.appendChild(s);
  }

  function render(el) {
    var slug = el.dataset.blogSlug
      || window.location.pathname.replace(/\/$/, '').split('/').pop()
      || 'post';
    var copy = pickVariant(slug);

    el.innerHTML = [
      '<div class="aen-wrap">',
      '  <svg class="aen-icon" width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">',
      '    <polygon points="6.5,0.6 11.5,3.4 11.5,9 6.5,12.4 1.5,9 1.5,3.4"',
      '      stroke="rgba(0,229,204,0.8)" stroke-width="1" fill="none"/>',
      '    <circle cx="6.5" cy="6.5" r="1.6" fill="rgba(0,229,204,0.8)"/>',
      '  </svg>',
      '  <span class="aen-text">' + copy + '</span>',
      '</div>',
    ].join('');

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: 'ai_engine_nudge_view', blog_slug: slug });
  }

  function init() {
    var els = document.querySelectorAll('[data-ai-nudge]');
    if (!els.length) return;
    injectStyles();
    els.forEach(render);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
