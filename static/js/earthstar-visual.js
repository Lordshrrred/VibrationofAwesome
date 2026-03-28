// earthstar-visual.js
// Dynamic EarthStar SVG injector for blog post hero sections.
// Drop-in: <script src="/js/earthstar-visual.js"></script>
//
// • Reads page context (title, meta description, h1, keyword tags)
// • Detects content theme via keyword matching
// • Selects matching pattern family + random palette using a seeded
//   PRNG (same post → same image every load; varied across posts)
// • Injects SVG absolutely into .post-hero, behind all text
// • Exposes window.EarthstarVisual for programmatic use
// ─────────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  // ── Palettes ──────────────────────────────────────────────────────
  var PALETTES = [
    { name: 'EarthStar Emerald', primary: '#1FE4B5', secondary: '#19B8FF', tertiary: '#8B6CFF', gold: '#D2AF64' },
    { name: 'Forest Plasma',     primary: '#00FF9C', secondary: '#00E2FF', tertiary: '#6F63FF', gold: '#C9A24D' },
    { name: 'Blue Temple',       primary: '#2DDCFF', secondary: '#45F1C7', tertiary: '#7D85FF', gold: '#D4B26C' },
    { name: 'Aurora Violet',     primary: '#00E5FF', secondary: '#7C68FF', tertiary: '#38FFCF', gold: '#CBB06A' },
    { name: 'Deep Green Gold',   primary: '#15E0B2', secondary: '#0FA8FF', tertiary: '#7A61FF', gold: '#D8B55B' },
    { name: 'Cosmic Cyan',       primary: '#00D1C7', secondary: '#7BF4FF', tertiary: '#5A7BFF', gold: '#CFA656' },
  ];

  // ── Geometry helpers ───────────────────────────────────────────────
  var CX = 300, CY = 300;

  function polar(r, angle) {
    var a = ((angle - 90) * Math.PI) / 180;
    return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
  }

  function pts(points) {
    return points.map(function (p) {
      return p.x.toFixed(2) + ',' + p.y.toFixed(2);
    }).join(' ');
  }

  // ── SVG component helpers (return markup strings) ─────────────────
  function rings(p, radii, opacity) {
    if (opacity === undefined) opacity = 0.28;
    return radii.map(function (r, i) {
      var stroke = i % 3 === 0 ? p.primary : i % 3 === 1 ? p.secondary : p.tertiary;
      var sw = i === 0 ? 1.5 : 1.05;
      return '<circle cx="' + CX + '" cy="' + CY + '" r="' + r + '" fill="none"' +
        ' stroke="' + stroke + '" stroke-width="' + sw + '" opacity="' + opacity + '"/>';
    }).join('');
  }

  function radials(p, count, r1, r2, rotation, opacity, sw) {
    if (rotation === undefined) rotation = 0;
    if (opacity  === undefined) opacity  = 0.4;
    if (sw       === undefined) sw       = 1.15;
    return Array.from({ length: count }, function (_, i) {
      var a  = rotation + (360 / count) * i;
      var p1 = polar(r1, a);
      var p2 = polar(r2, a);
      var stroke = i % 2 === 0 ? p.primary : p.secondary;
      return '<line x1="' + p1.x.toFixed(2) + '" y1="' + p1.y.toFixed(2) +
        '" x2="' + p2.x.toFixed(2) + '" y2="' + p2.y.toFixed(2) +
        '" stroke="' + stroke + '" stroke-width="' + sw +
        '" stroke-linecap="round" opacity="' + opacity + '"/>';
    }).join('');
  }

  function flower(p, petals, r, orbit, rotation) {
    if (petals   === undefined) petals   = 6;
    if (r        === undefined) r        = 82;
    if (orbit    === undefined) orbit    = 82;
    if (rotation === undefined) rotation = 0;
    var petalSvg = Array.from({ length: petals }, function (_, i) {
      var c      = polar(orbit, rotation + (360 / petals) * i);
      var stroke = i % 2 === 0 ? p.secondary : p.tertiary;
      return '<circle cx="' + c.x.toFixed(2) + '" cy="' + c.y.toFixed(2) +
        '" r="' + r + '" fill="none" stroke="' + stroke +
        '" stroke-width="1.05" opacity="0.45"/>';
    }).join('');
    return '<circle cx="' + CX + '" cy="' + CY + '" r="' + r +
      '" fill="none" stroke="' + p.primary + '" stroke-width="1.4" opacity="0.75"/>' +
      petalSvg +
      '<circle cx="' + CX + '" cy="' + CY + '" r="10" fill="' + p.secondary + '" opacity="0.92"/>';
  }

  function triforceSet(p, size, rotation, opacity) {
    if (size     === undefined) size     = 150;
    if (rotation === undefined) rotation = 0;
    if (opacity  === undefined) opacity  = 0.9;
    var h     = size;
    var top   = [{ x: CX,         y: CY - h * 0.62 }, { x: CX - h * 0.36, y: CY }, { x: CX + h * 0.36, y: CY }];
    var left  = [{ x: CX - h * 0.39, y: CY + h * 0.03 }, { x: CX - h * 0.75, y: CY + h * 0.64 }, { x: CX - h * 0.03, y: CY + h * 0.64 }];
    var right = [{ x: CX + h * 0.39, y: CY + h * 0.03 }, { x: CX + h * 0.75, y: CY + h * 0.64 }, { x: CX + h * 0.03, y: CY + h * 0.64 }];
    var outer = [polar(size * 0.82, rotation), polar(size * 0.82, rotation + 120), polar(size * 0.82, rotation + 240)];
    return '<g transform="rotate(' + rotation + ' ' + CX + ' ' + CY + ')" opacity="' + opacity + '">' +
      '<polygon points="' + pts(top)   + '" fill="none" stroke="' + p.primary   + '" stroke-width="1.45"/>' +
      '<polygon points="' + pts(left)  + '" fill="none" stroke="' + p.secondary + '" stroke-width="1.3"/>'  +
      '<polygon points="' + pts(right) + '" fill="none" stroke="' + p.tertiary  + '" stroke-width="1.3"/>'  +
      '<polygon points="' + pts(outer) + '" fill="none" stroke="' + p.gold      + '" stroke-width="1.1" opacity="0.7"/>' +
      '</g>';
  }

  function starField() {
    return Array.from({ length: 24 }, function (_, i) {
      var x = 30 + (i * 83) % 540;
      var y = 28 + (i * 61) % 544;
      var r = i % 6 === 0 ? 1.5 : i % 3 === 0 ? 1.0 : 0.7;
      var o = i % 4 === 0 ? 0.3 : 0.15;
      return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="white" opacity="' + o + '"/>';
    }).join('');
  }

  // ── 10 Pattern definitions ─────────────────────────────────────────
  var PATTERNS = [
    {
      id: 'earthstar-compass', title: 'EarthStar Compass', family: 'compass',
      draw: function (p, v) {
        var main = [0, 90, 180, 270].map(function (a) {
          var a1  = polar(50, a),  a2  = polar(194, a);
          var tip = polar(228, a), L   = polar(198, a - 5), R = polar(198, a + 5);
          return '<line x1="' + a1.x.toFixed(2) + '" y1="' + a1.y.toFixed(2) +
            '" x2="' + a2.x.toFixed(2) + '" y2="' + a2.y.toFixed(2) +
            '" stroke="' + p.gold + '" stroke-width="1.8" opacity="0.88"/>' +
            '<polygon points="' + pts([tip, L, R]) + '" fill="' + p.gold + '" opacity="0.84"/>';
        }).join('');
        var diag = [45, 135, 225, 315].map(function (a, i) {
          var a1  = polar(42, a),  a2  = polar(148, a);
          var tip = polar(190, a), L   = polar(150, a - 8), R = polar(150, a + 8);
          var fill = i % 2 === 0 ? p.primary : p.secondary;
          return '<line x1="' + a1.x.toFixed(2) + '" y1="' + a1.y.toFixed(2) +
            '" x2="' + a2.x.toFixed(2) + '" y2="' + a2.y.toFixed(2) +
            '" stroke="' + p.gold + '" stroke-width="1.2" opacity="0.65"/>' +
            '<polygon points="' + pts([tip, L, R]) + '" fill="' + fill + '" opacity="0.8"/>';
        }).join('');
        return rings(p, [44, 92, 156, 228]) + main + diag +
          '<circle cx="' + CX + '" cy="' + CY + '" r="25" fill="none" stroke="' + p.secondary +
          '" stroke-width="1.35" opacity="0.8"/>' +
          '<circle cx="' + CX + '" cy="' + CY + '" r="11" fill="' + p.gold + '" opacity="0.94"/>';
      }
    },
    {
      id: 'flower-engine', title: 'Flower Engine', family: 'flower',
      draw: function (p, v) {
        var r = 82 + (v % 2) * 6;
        return flower(p, 6, r, r, 30) + rings(p, [166, 224], 0.14);
      }
    },
    {
      id: 'triforce-array', title: 'Triforce Array', family: 'triforce',
      draw: function (p, v) {
        return rings(p, [54, 116, 178, 238], 0.2) +
          triforceSet(p, 150, (v * 12) % 360, 0.9) +
          triforceSet(p, 104, 180 + ((v * 12) % 360), 0.42) +
          '<circle cx="' + CX + '" cy="' + CY + '" r="14" fill="' + p.secondary + '" opacity="0.92"/>';
      }
    },
    {
      id: 'orbital-bloom', title: 'Orbital Bloom', family: 'orbital',
      draw: function (p, v) {
        var orbs = Array.from({ length: 5 }, function (_, i) {
          var c      = polar(106, i * 72 + 18);
          var stroke = i % 2 === 0 ? p.primary : p.secondary;
          return '<circle cx="' + c.x.toFixed(2) + '" cy="' + c.y.toFixed(2) +
            '" r="72" fill="none" stroke="' + stroke + '" stroke-width="1.1" opacity="0.48"/>';
        }).join('');
        return rings(p, [72, 132, 194, 250], 0.22) + orbs +
          '<circle cx="' + CX + '" cy="' + CY + '" r="10" fill="' + p.primary + '" opacity="0.9"/>';
      }
    },
    {
      id: 'portal-gate', title: 'Portal Gate', family: 'portal',
      draw: function (p, v) {
        return '<ellipse cx="' + CX + '" cy="' + CY + '" rx="160" ry="220" fill="none" stroke="' + p.primary   + '" stroke-width="1.35" opacity="0.32"/>' +
          '<ellipse cx="' + CX + '" cy="' + CY + '" rx="110" ry="158" fill="none" stroke="' + p.secondary + '" stroke-width="1.45" opacity="0.58"/>' +
          '<ellipse cx="' + CX + '" cy="' + CY + '" rx="52"  ry="82"  fill="none" stroke="' + p.tertiary  + '" stroke-width="1.2"  opacity="0.54"/>' +
          '<rect x="148" y="82" width="304" height="436" rx="152" fill="none" stroke="' + p.gold + '" stroke-width="1.0" opacity="0.14"/>' +
          radials(p, 4, 0, 220, 45, 0.12) +
          '<circle cx="' + CX + '" cy="' + CY + '" r="11" fill="' + p.secondary + '" opacity="0.92"/>';
      }
    },
    {
      id: 'diamond-pulse', title: 'Diamond Pulse', family: 'diamond',
      draw: function (p, v) {
        var diam = [92, 162, 232].map(function (r, i) {
          var stroke = i === 0 ? p.primary : i === 1 ? p.secondary : p.tertiary;
          var sw     = i === 0 ? 1.45 : 1.1;
          var op     = (0.72 - i * 0.17).toFixed(2);
          return '<polygon points="' + pts([{ x: CX, y: CY - r }, { x: CX + r, y: CY }, { x: CX, y: CY + r }, { x: CX - r, y: CY }]) +
            '" fill="none" stroke="' + stroke + '" stroke-width="' + sw + '" opacity="' + op + '"/>';
        }).join('');
        return diam +
          '<line x1="' + CX + '" y1="54" x2="' + CX + '" y2="546" stroke="' + p.gold + '" stroke-width="1.0" opacity="0.24"/>' +
          '<line x1="54" y1="' + CY + '" x2="546" y2="' + CY + '" stroke="' + p.gold + '" stroke-width="1.0" opacity="0.24"/>' +
          '<circle cx="' + CX + '" cy="' + CY + '" r="14" fill="' + p.gold + '" opacity="0.92"/>';
      }
    },
    {
      id: 'signal-web', title: 'Signal Web', family: 'waves',
      draw: function (p, v) {
        var waves = [0, 1, 2, 3, 4].map(function (i) {
          var d = 'M 86 ' + (196 + i * 32) +
            ' C 160 ' + (150 + (i % 2 === 0 ? -20 : 20)) +
            ' 230 '  + (268 + (i % 2 === 0 ? 28 : -28)) +
            ' 300 '  + (222 + i * 3) +
            ' C 365 ' + (182 + (i % 2 === 0 ? -12 : 12)) +
            ' 438 '   + (314 + (i % 2 === 0 ? 16 : -16)) +
            ' 514 '   + (248 + i * 18);
          var stroke = i % 2 === 0 ? p.primary : p.secondary;
          var op     = (0.18 + i * 0.1).toFixed(2);
          return '<path d="' + d + '" fill="none" stroke="' + stroke +
            '" stroke-width="1.4" opacity="' + op + '" stroke-linecap="round"/>';
        }).join('');
        return waves +
          '<circle cx="' + CX + '" cy="' + CY + '" r="26" fill="none" stroke="' + p.tertiary + '" stroke-width="1.2" opacity="0.62"/>';
      }
    },
    {
      id: 'hex-flower', title: 'Hex Flower', family: 'hex',
      draw: function (p, v) {
        var hexes = [88, 152, 220].map(function (r, i) {
          var hexPts = pts(Array.from({ length: 6 }, function (_, n) { return polar(r, n * 60 + 30); }));
          var stroke = i === 0 ? p.primary : i === 1 ? p.secondary : p.tertiary;
          var sw     = i === 0 ? 1.45 : 1.1;
          var op     = (0.65 - i * 0.14).toFixed(2);
          return '<polygon points="' + hexPts + '" fill="none" stroke="' + stroke + '" stroke-width="' + sw + '" opacity="' + op + '"/>';
        }).join('');
        return hexes + flower(p, 6, 64, 64, 0);
      }
    },
    {
      id: 'solar-mandala', title: 'Solar Mandala', family: 'mandala',
      draw: function (p, v) {
        var rays = Array.from({ length: 16 }, function (_, i) {
          var a   = i * 22.5;
          var c1  = polar(126, a);
          var c2  = polar(166, a + 9.5);
          var tip = polar(208, a);
          var stroke = i % 2 === 0 ? p.primary : p.secondary;
          return '<polyline points="' + pts([c1, tip, c2]) +
            '" fill="none" stroke="' + stroke + '" stroke-width="1.15"' +
            ' opacity="0.54" stroke-linecap="round" stroke-linejoin="round"/>';
        }).join('');
        return rings(p, [58, 104, 156, 214], 0.18) + rays +
          '<circle cx="' + CX + '" cy="' + CY + '" r="22" fill="' + p.gold + '" opacity="0.9"/>';
      }
    },
    {
      id: 'sacred-grid', title: 'Sacred Grid', family: 'grid',
      draw: function (p, v) {
        var vl = [-160, -80, 0, 80, 160].map(function (x, i) {
          return '<line x1="' + (CX + x) + '" y1="88" x2="' + (CX + x) + '" y2="512"' +
            ' stroke="' + (i % 2 === 0 ? p.primary : p.secondary) + '" stroke-width="1.0" opacity="0.14"/>';
        }).join('');
        var hl = [-160, -80, 0, 80, 160].map(function (y, i) {
          return '<line x1="88" y1="' + (CY + y) + '" x2="512" y2="' + (CY + y) + '"' +
            ' stroke="' + (i % 2 === 0 ? p.secondary : p.primary) + '" stroke-width="1.0" opacity="0.14"/>';
        }).join('');
        var cs = [80, 160, 240].map(function (r, i) {
          var stroke = i === 0 ? p.primary : i === 1 ? p.secondary : p.tertiary;
          return '<circle cx="' + CX + '" cy="' + CY + '" r="' + r +
            '" fill="none" stroke="' + stroke + '" stroke-width="1.0" opacity="0.2"/>';
        }).join('');
        return vl + hl + cs +
          '<circle cx="' + CX + '" cy="' + CY + '" r="11" fill="' + p.primary + '" opacity="0.92"/>';
      }
    },
  ];

  // ── Theme → pattern family map ─────────────────────────────────────
  var THEME_MAP = [
    {
      keywords: ['power', 'direction', 'purpose', 'path', 'action', 'choice', 'navigate', 'guide', 'lead', 'compass'],
      families: ['triforce', 'compass', 'diamond'],
    },
    {
      keywords: ['flow', 'energy', 'vibration', 'frequency', 'alignment', 'wave', 'music', 'sound', 'feel', 'body', 'heal', 'nervous'],
      families: ['flower', 'orbital', 'waves', 'mandala'],
    },
    {
      keywords: ['system', 'structure', 'build', 'foundation', 'framework', 'money', 'income', 'business', 'process', 'work', 'marketing'],
      families: ['grid', 'hex', 'compass'],
    },
    {
      keywords: ['universe', 'infinite', 'unknown', 'expansion', 'consciousness', 'cosmic', 'spiritual', 'sacred', 'soul', 'aware', 'quantum'],
      families: ['portal', 'mandala', 'orbital'],
    },
    {
      keywords: ['stuck', 'lost', 'identity', 'self', 'change', 'transform', 'shift', 'become', 'reinvent', 'grow', 'shadow'],
      families: ['triforce', 'flower', 'portal'],
    },
    {
      keywords: ['ai', 'tool', 'technology', 'create', 'artist', 'music', 'make', 'produce', 'creative', 'independent', 'claude', 'api'],
      families: ['hex', 'grid', 'orbital'],
    },
    {
      keywords: ['abundance', 'law', 'attraction', 'manifest', 'attract', 'receive', 'wealth', 'potential', 'unlock', 'mindset'],
      families: ['flower', 'mandala', 'orbital'],
    },
    {
      keywords: ['forest', 'temple', 'nature', 'earth', 'ancient', 'ritual', 'ayahuasca', 'indigo', 'qi', 'chi', 'gong', 'plant'],
      families: ['triforce', 'compass', 'mandala'],
    },
    {
      keywords: ['burnout', 'anxiety', 'survive', 'survival', 'stress', 'overwhelm', 'escape', 'freedom', 'stuck', 'lost', 'fear'],
      families: ['waves', 'portal', 'flower'],
    },
  ];

  // ── Seeded PRNG ────────────────────────────────────────────────────
  // Same seed → same sequence every time. Different posts → different images.
  function seededRng(seed) {
    var s = 0;
    for (var i = 0; i < seed.length; i++) {
      s = ((s * 31) + seed.charCodeAt(i)) >>> 0;
    }
    return function () {
      s = ((s * 1664525) + 1013904223) >>> 0;
      return s / 0xFFFFFFFF;
    };
  }

  // ── Core public API: getEarthstarImage ────────────────────────────
  /**
   * Given a post descriptor, returns a stable visual config.
   * Same title → identical result on every call (seeded).
   *
   * @param {{ title?: string, content?: string, tags?: string[] }} post
   * @returns {{ pattern, palette, rotation: number, scale: number, variant: number }}
   */
  function getEarthstarImage(post) {
    var title   = post.title   || '';
    var content = post.content || '';
    var tags    = (post.tags   || []).join(' ');
    var text    = (title + ' ' + content + ' ' + tags).toLowerCase();

    // Pick theme with the most keyword hits
    var bestTheme = null;
    var bestScore = 0;
    for (var i = 0; i < THEME_MAP.length; i++) {
      var theme = THEME_MAP[i];
      var score = 0;
      for (var j = 0; j < theme.keywords.length; j++) {
        if (text.indexOf(theme.keywords[j]) !== -1) score++;
      }
      if (score > bestScore) { bestScore = score; bestTheme = theme; }
    }

    // Valid patterns for this theme (or all if no theme hit)
    var validFamilies = bestTheme
      ? bestTheme.families
      : PATTERNS.map(function (p) { return p.family; });
    var validPatterns = PATTERNS.filter(function (p) {
      return validFamilies.indexOf(p.family) !== -1;
    });
    if (!validPatterns.length) validPatterns = PATTERNS; // safety fallback

    // Seeded random picks
    var rng     = seededRng(title || String(Date.now()));
    var pattern = validPatterns[Math.floor(rng() * validPatterns.length)];
    var palette = PALETTES[Math.floor(rng() * PALETTES.length)];
    var rotation = Math.floor(rng() * 360);            // 0–359 deg
    var scale    = +(0.9 + rng() * 0.2).toFixed(3);   // 0.90–1.10
    var variant  = 1 + Math.floor(rng() * 8);          // 1–8

    return {
      pattern:  pattern,
      palette:  palette,
      rotation: rotation,
      scale:    scale,
      variant:  variant,
    };
  }

  // ── Build a full SVG string from config ────────────────────────────
  function buildSvg(config) {
    var p      = config.palette;
    var pat    = config.pattern;
    var v      = config.variant;
    var uid    = pat.id + '-' + v + '-' + config.rotation;
    var inner  = pat.draw(p, v);
    var xform  = 'style="transform-origin:300px 300px;transform:rotate(' +
                 config.rotation + 'deg) scale(' + config.scale + ')"';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">' +
      '<defs>' +
        '<filter id="ev-glow-' + uid + '" x="-50%" y="-50%" width="200%" height="200%">' +
          '<feDropShadow dx="0" dy="0" stdDeviation="5"' +
          ' flood-color="' + p.primary + '" flood-opacity="0.32"/>' +
        '</filter>' +
      '</defs>' +
      '<g filter="url(#ev-glow-' + uid + ')">' +
        starField() +
        '<g ' + xform + '>' +
          inner +
        '</g>' +
      '</g>' +
    '</svg>';
  }

  // ── Inject SVG into a hero element ─────────────────────────────────
  function inject(heroEl, config) {
    if (!heroEl) return;

    // One-time stylesheet injection
    if (!document.getElementById('ev-styles')) {
      var css = [
        '@keyframes ev-float {',
        '  0%,100%{ transform:translateY(0px) scale(1); }',
        '  50%    { transform:translateY(-12px) scale(1.015); }',
        '}',
        '.ev-art {',
        '  position:absolute; inset:0; pointer-events:none; overflow:hidden;',
        '  display:flex; align-items:center; justify-content:flex-end;',
        '  padding-right:4%; z-index:0;',
        '  opacity:0; transition:opacity 0.8s ease;',
        '}',
        '.ev-art.ev-visible { opacity:1; }',
        '.ev-art svg {',
        '  width:min(360px,55%); height:auto; flex-shrink:0;',
        '  animation:ev-float 9s ease-in-out infinite;',
        '}',
        /* On mobile: center and shrink the art, lower opacity so text stays readable */
        '@media(max-width:768px){',
        '  .ev-art { justify-content:center; padding-right:0; opacity:0; }',
        '  .ev-art.ev-visible { opacity:0.5; }',
        '  .ev-art svg { width:min(260px,70%); }',
        '}',
      ].join('\n');
      var styleEl = document.createElement('style');
      styleEl.id = 'ev-styles';
      styleEl.textContent = css;
      document.head.appendChild(styleEl);
    }

    // Remove any previous injection
    var old = heroEl.querySelector('.ev-art');
    if (old) old.remove();

    // Build and attach
    var wrap = document.createElement('div');
    wrap.className = 'ev-art';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.setAttribute('data-earthstar-id', config.pattern.id);
    wrap.innerHTML = buildSvg(config);

    // Insert as first child so text layers above it
    heroEl.insertBefore(wrap, heroEl.firstChild);

    // Fade in on next frame
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        wrap.classList.add('ev-visible');
      });
    });

    return wrap;
  }

  // ── Auto-init on page load ─────────────────────────────────────────
  function init() {
    try {
      // Build post context from DOM
      var titleEl = document.querySelector('title');
      var descEl  = document.querySelector('meta[name="description"]');
      var h1El    = document.querySelector('h1');
      var bodyEl  = document.querySelector('.post-body');

      var post = {
        title: titleEl ? titleEl.textContent.trim() : '',
        content: [
          descEl  ? descEl.getAttribute('content') || '' : '',
          h1El    ? h1El.textContent                     : '',
          bodyEl  ? bodyEl.textContent.slice(0, 800)     : '',
        ].join(' '),
        tags: [],
      };

      // Pull in keyword/tag elements if present
      document.querySelectorAll('.keyword-tag, .post-tag, [data-tag]').forEach(function (el) {
        post.tags.push(el.textContent.trim());
      });

      var config = getEarthstarImage(post);

      // Find hero target — tries explicit marker first, then standard selectors
      var hero =
        document.querySelector('[data-earthstar-visual]') ||
        document.querySelector('.post-hero')              ||
        document.querySelector('.hero-art')               ||
        document.querySelector('.earthstar-hero');

      if (hero) inject(hero, config);
    } catch (e) {
      // Fail silently — never break blog rendering
      if (window.console && console.warn) {
        console.warn('[earthstar-visual] init error:', e);
      }
    }
  }

  // ── Expose public API ──────────────────────────────────────────────
  window.EarthstarVisual = {
    /** Select a visual config for a post. Call this anywhere. */
    getEarthstarImage: getEarthstarImage,
    /** Build an SVG string from a config object. */
    buildSvg: buildSvg,
    /** Inject a config into a given DOM element. */
    inject: inject,
    /** All 10 pattern definitions. */
    PATTERNS: PATTERNS,
    /** All 6 palettes. */
    PALETTES: PALETTES,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());
