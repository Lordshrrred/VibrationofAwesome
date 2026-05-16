// art-store-whisper.js ~ Subtle art store end-of-post moment for vibrationofawesome.com
// Drop into any blog post:
//   <div data-art-store-whisper data-blog-slug="your-slug"></div>
//   <script src="/js/art-store-whisper.js"></script>
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  'use strict';

  // Collection pool ~ one image per collection, short evocative line
  var COLLECTIONS = [
    {
      name:  'Abstratocaster',
      line:  'Raw frequency made visible.',
      img:   '/personal-photos/merch/Abstrar-male-tee-1.jpg',
      alt:   'Abstratocaster shirt ~ abstract guitar art on dark tee',
    },
    {
      name:  'Wiz Biz',
      line:  'Where dark magic meets street sorcery.',
      img:   '/personal-photos/merch/WizBiz-male-tee-1.jpg',
      alt:   'Wiz Biz shirt ~ wizard art on dark tee',
    },
    {
      name:  'Loaf Life',
      line:  'Spiritual loafing is a lifestyle.',
      img:   '/personal-photos/merch/LoafCrew-1.jpg',
      alt:   'Loaf Life crewneck ~ cat art on dark sweatshirt',
    },
    {
      name:  'Wizard in the Window',
      line:  'The art is on the front. The story is on the back.',
      img:   '/personal-photos/merch/WizWin-Hoodie-1.jpg',
      alt:   'Wizard in the Window hoodie ~ story art on dark hoodie',
    },
    {
      name:  'Ascent EarthStar',
      line:  'Sacred geometry meets the upward pull.',
      img:   '/personal-photos/merch/AscentCrew-1.jpg',
      alt:   'Ascent EarthStar crewneck ~ sacred geometry on dark sweatshirt',
    },
    {
      name:  'ADHD Higher Dimension',
      line:  'Not a disorder. A different dial.',
      img:   '/personal-photos/merch/ADHD-Crew-1.jpg',
      alt:   'ADHD Higher Dimension crewneck ~ neurodivergent art on dark sweatshirt',
    },
    {
      name:  'Uncontrollably Awesome',
      line:  'The energy is bigger than the plan.',
      img:   '/personal-photos/merch/UncontrollablyAwesome-Hoodie-1.jpg',
      alt:   'Uncontrollably Awesome hoodie ~ bold art on dark hoodie',
    },
  ];

  var STYLES = [
    '.voa-store-whisper {',
    '  margin: 2.5rem auto 1.5rem;',
    '  max-width: 620px;',
    '  border-top: 1px solid rgba(0,229,204,0.12);',
    '  padding-top: 2rem;',
    '}',
    '.voa-store-whisper-label {',
    '  font-family: "Rajdhani", sans-serif;',
    '  font-size: 0.62rem;',
    '  letter-spacing: 0.38em;',
    '  text-transform: uppercase;',
    '  color: rgba(0,229,204,0.45);',
    '  margin-bottom: 1rem;',
    '  display: flex;',
    '  align-items: center;',
    '  gap: 0.75rem;',
    '}',
    '.voa-store-whisper-label::before,',
    '.voa-store-whisper-label::after {',
    '  content: "";',
    '  display: block;',
    '  height: 1px;',
    '  flex: 1;',
    '  background: rgba(0,229,204,0.15);',
    '}',
    '.voa-store-whisper-card {',
    '  display: flex;',
    '  align-items: center;',
    '  gap: 1.25rem;',
    '  padding: 1rem 1.1rem;',
    '  background: rgba(0,229,204,0.03);',
    '  border: 1px solid rgba(0,229,204,0.1);',
    '  border-radius: 8px;',
    '  text-decoration: none;',
    '  transition: border-color 0.25s, background 0.25s, transform 0.25s;',
    '}',
    '.voa-store-whisper-card:hover {',
    '  border-color: rgba(0,229,204,0.28);',
    '  background: rgba(0,229,204,0.06);',
    '  transform: translateY(-2px);',
    '}',
    '.voa-store-whisper-img {',
    '  width: 72px;',
    '  height: 72px;',
    '  object-fit: cover;',
    '  border-radius: 6px;',
    '  border: 1px solid rgba(0,229,204,0.14);',
    '  flex-shrink: 0;',
    '  transition: filter 0.25s;',
    '}',
    '.voa-store-whisper-card:hover .voa-store-whisper-img {',
    '  filter: brightness(1.08) saturate(1.08);',
    '}',
    '.voa-store-whisper-body {',
    '  flex: 1;',
    '  min-width: 0;',
    '}',
    '.voa-store-whisper-name {',
    '  font-family: "Rajdhani", sans-serif;',
    '  font-size: 0.72rem;',
    '  letter-spacing: 0.22em;',
    '  text-transform: uppercase;',
    '  color: rgba(0,229,204,0.7);',
    '  margin-bottom: 0.2rem;',
    '}',
    '.voa-store-whisper-line {',
    '  font-family: "Cormorant Garamond", "Lora", Georgia, serif;',
    '  font-size: 1rem;',
    '  font-style: italic;',
    '  color: rgba(208,255,248,0.82);',
    '  line-height: 1.4;',
    '}',
    '.voa-store-whisper-link {',
    '  font-family: "Rajdhani", sans-serif;',
    '  font-size: 0.65rem;',
    '  letter-spacing: 0.2em;',
    '  text-transform: uppercase;',
    '  color: rgba(0,229,204,0.55);',
    '  margin-top: 0.35rem;',
    '  display: block;',
    '  transition: color 0.2s;',
    '}',
    '.voa-store-whisper-card:hover .voa-store-whisper-link {',
    '  color: rgba(0,229,204,0.9);',
    '}',
    '@media (max-width: 480px) {',
    '  .voa-store-whisper-img { width: 58px; height: 58px; }',
    '  .voa-store-whisper-line { font-size: 0.92rem; }',
    '}',
  ].join('\n');

  function injectStyles() {
    if (document.getElementById('voa-art-store-whisper-styles')) return;
    var tag = document.createElement('style');
    tag.id = 'voa-art-store-whisper-styles';
    tag.textContent = STYLES;
    document.head.appendChild(tag);
  }

  // Stable pick per page: hash the slug so the same post always shows the same collection
  function pickCollection(slug) {
    var hash = 0;
    for (var i = 0; i < slug.length; i++) {
      hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
    }
    return COLLECTIONS[hash % COLLECTIONS.length];
  }

  function render(el) {
    var slug = el.dataset.blogSlug ||
      window.location.pathname.replace(/\/$/, '').split('/').pop() ||
      'voa';
    var col = pickCollection(slug);

    el.innerHTML =
      '<div class="voa-store-whisper">' +
        '<div class="voa-store-whisper-label">From the Studio</div>' +
        '<a href="/art-store/" class="voa-store-whisper-card" aria-label="Browse the EarthStar Art Store">' +
          '<img class="voa-store-whisper-img" src="' + col.img + '" alt="' + col.alt + '" loading="lazy">' +
          '<div class="voa-store-whisper-body">' +
            '<div class="voa-store-whisper-name">' + col.name + '</div>' +
            '<div class="voa-store-whisper-line">' + col.line + '</div>' +
            '<span class="voa-store-whisper-link">Browse the Art Store →</span>' +
          '</div>' +
        '</a>' +
      '</div>';

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: 'art_store_whisper_view', collection: col.name, blog_slug: slug });

    var card = el.querySelector('.voa-store-whisper-card');
    if (card) {
      card.addEventListener('click', function () {
        window.dataLayer.push({ event: 'art_store_whisper_click', collection: col.name, blog_slug: slug });
      });
    }
  }

  function init() {
    injectStyles();
    var containers = document.querySelectorAll('[data-art-store-whisper]');
    for (var i = 0; i < containers.length; i++) {
      render(containers[i]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
