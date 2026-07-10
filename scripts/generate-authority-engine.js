#!/usr/bin/env node
/**
 * generate-authority-engine.js
 *
 * Builds VOA authority hub and tool pages from data files. This keeps
 * evergreen assets in a second lane beside daily blog publishing.
 *
 * Visual system (2026-07-11 redesign): reuses the site's actual DNA instead
 * of a generic SEO-template look ~ Cinzel/Cinzel Decorative/Rajdhani/Lora/
 * Cormorant Garamond font stack, the twinkling stars background, clip-path
 * glow CTA buttons, and the section-label/divider convention all come
 * straight from layouts/_default/baseof.html and layouts/index.html. The
 * hex-circuit icon (ai-creator-workflows) and mandala motif (voa-concepts)
 * are the literal SVGs already used elsewhere on the site, not new artwork.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { inferCluster, keywordMatches, loadTopicClusters } from "./lib/internal-linking.js";
import { absoluteVoaUrl, cleanPublicPath } from "./lib/clean-url.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const BASE = "https://vibrationofawesome.com";
const TODAY = new Date().toISOString().slice(0, 10);

function readJson(rel, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
  } catch (_) {
    return fallback;
  }
}

function writePage(rel, html) {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html, "utf8");
  console.log(`Wrote ${rel}`);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function absoluteUrl(url) {
  return absoluteVoaUrl(url);
}

function normalizePost(post, lane, clusterData) {
  const cluster = inferCluster(post, clusterData);
  return {
    ...post,
    lane,
    cluster,
    url: cleanPublicPath(post.url || `/blog/${lane}/posts/${post.slug}`),
  };
}

function matchesHub(post, hub) {
  if (hub.clusterKeys?.includes(post.cluster)) return true;
  const haystack = [post.title, post.slug, post.excerpt, ...(post.tags || [])].join(" ").toLowerCase();
  return (hub.keywords || []).some(keyword => keywordMatches(haystack, keyword));
}

// How many of the hub's own keywords a post's text actually contains ~ used
// to pick the most representative "Start Here" post instead of just the
// newest one, which is arbitrary rather than curated.
function hubRelevanceScore(post, hub) {
  const haystack = [post.title, post.slug, post.excerpt, ...(post.tags || [])].join(" ").toLowerCase();
  return (hub.keywords || []).filter(keyword => keywordMatches(haystack, keyword)).length;
}

function sortPosts(posts) {
  return posts
    .filter(post => post.title && post.url)
    .sort((a, b) => (Date.parse(b.date || "") || 0) - (Date.parse(a.date || "") || 0));
}

// ── Per-hub visual theme ─────────────────────────────────────────────────────
// Restrained, purposeful variation ~ not ten identical white cards. Icons are
// small inline SVGs (no external image requests). Colors stay inside the
// site's existing accent set (cyan / amber / a single restrained violet for
// the more inward-facing hubs) rather than inventing a new palette per hub.
const HUB_THEME = {
  "nervous-system-regulation": { accent: "cyan", icon: "rings" },
  "dopamine-attention":        { accent: "amber", icon: "pulse" },
  "adhd-focus":                { accent: "violet", icon: "compass" },
  "meditation":                { accent: "moss", icon: "lotus" },
  "creativity":                { accent: "cyan", icon: "spark" },
  "personal-growth":           { accent: "amber", icon: "spiral" },
  "self-trust":                { accent: "violet", icon: "anchor" },
  "purpose":                   { accent: "amber", icon: "star" },
  "ai-creator-workflows":      { accent: "cyan", icon: "hex" },
  "voa-concepts":              { accent: "amber", icon: "mandala" },
};

const RELATED_HUBS = {
  "nervous-system-regulation": ["meditation", "dopamine-attention"],
  "adhd-focus":                ["dopamine-attention", "creativity"],
  "dopamine-attention":        ["adhd-focus", "nervous-system-regulation"],
  "meditation":                ["nervous-system-regulation", "personal-growth"],
  "creativity":                ["ai-creator-workflows", "purpose"],
  "personal-growth":           ["self-trust", "purpose"],
  "self-trust":                ["personal-growth", "purpose"],
  "purpose":                   ["creativity", "personal-growth"],
  "ai-creator-workflows":      ["creativity"],
  "voa-concepts":              ["purpose", "personal-growth"],
};

// Lightweight subtheme grouping so "Explore Deeper" isn't one long dumped
// list. Buckets are matched against each post's title/excerpt/tags; anything
// left over falls into a final "More in this hub" bucket rather than being
// dropped.
const HUB_SUBTHEMES = {
  "adhd-focus": [
    { label: "Understanding attention", patterns: [/attention/i, /focus/i, /adhd/i] },
    { label: "Starting and finishing tasks", patterns: [/start/i, /procrastinat/i, /finish/i, /task/i] },
    { label: "Managing distraction", patterns: [/distract/i, /scrol/i, /notification/i] },
    { label: "Tools and systems", patterns: [/tool/i, /system/i, /app/i, /ai/i] },
  ],
  "dopamine-attention": [
    { label: "Understanding the loop", patterns: [/dopamine/i, /loop/i, /reward/i] },
    { label: "Digital habits", patterns: [/scrol/i, /phone/i, /screen/i, /social/i] },
    { label: "Reclaiming attention", patterns: [/reclaim/i, /detox/i, /reset/i, /boundar/i] },
  ],
  "nervous-system-regulation": [
    { label: "Understanding the nervous system", patterns: [/nervous system/i, /alarm/i, /safe in your body/i] },
    { label: "Regulation practices", patterns: [/regulat/i, /breath/i, /ground/i, /calm/i] },
    { label: "Burnout and overwhelm", patterns: [/burnout/i, /overwhelm/i, /exhaust/i] },
  ],
  "creativity": [
    { label: "Creative identity", patterns: [/identity/i, /voice/i, /authentic/i] },
    { label: "Creative tools and workflow", patterns: [/tool/i, /ai/i, /workflow/i, /music/i] },
    { label: "Protecting creative energy", patterns: [/energy/i, /protect/i, /burnout/i] },
  ],
  "personal-growth": [
    { label: "Changing your life", patterns: [/change your life/i, /transform/i, /reinvent/i] },
    { label: "Getting unstuck", patterns: [/stuck/i, /lost/i, /survival mode/i] },
    { label: "Healing and integration", patterns: [/heal/i, /shadow/i, /emotion/i] },
  ],
};

function groupBySubtheme(hubSlug, posts) {
  const buckets = HUB_SUBTHEMES[hubSlug];
  if (!buckets || posts.length < 4) return null;

  const used = new Set();
  const groups = buckets.map(bucket => {
    const items = posts.filter(post => {
      if (used.has(post.slug)) return false;
      const haystack = [post.title, post.excerpt, ...(post.tags || [])].join(" ");
      const hit = bucket.patterns.some(p => p.test(haystack));
      if (hit) used.add(post.slug);
      return hit;
    });
    return { label: bucket.label, items };
  }).filter(group => group.items.length > 0);

  const leftover = posts.filter(post => !used.has(post.slug));
  if (leftover.length) groups.push({ label: "More in this hub", items: leftover });
  return groups.length > 1 ? groups : null;
}

// ── Icons (inline SVG, restrained line-art, no external requests) ───────────
const ICONS = {
  rings: `<svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="1"/><circle cx="24" cy="24" r="13" stroke="currentColor" stroke-width="1"/><circle cx="24" cy="24" r="6" stroke="currentColor" stroke-width="1"/></svg>`,
  pulse: `<svg viewBox="0 0 48 48" fill="none"><path d="M4 24H14L18 8L26 40L30 24H44" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/></svg>`,
  compass: `<svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="19" stroke="currentColor" stroke-width="1"/><path d="M31 17L26 26L17 31L22 22L31 17Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>`,
  lotus: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 40C24 40 10 32 10 20C10 13 16 8 24 16C32 8 38 13 38 20C38 32 24 40 24 40Z" stroke="currentColor" stroke-width="1"/><path d="M24 40V16" stroke="currentColor" stroke-width="1"/></svg>`,
  spark: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 4L27 20L44 24L27 28L24 44L21 28L4 24L21 20L24 4Z" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/></svg>`,
  spiral: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 24C24 20 27 18 30 20C34 23 32 30 26 31C18 33 12 25 16 16C21 6 34 9 38 20" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
  anchor: `<svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="10" r="4" stroke="currentColor" stroke-width="1"/><path d="M24 14V38M14 26C14 34 18 38 24 38C30 38 34 34 34 26" stroke="currentColor" stroke-width="1" stroke-linecap="round"/><path d="M8 26H14M34 26H40" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>`,
  star: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 4L28.5 19.5L44 24L28.5 28.5L24 44L19.5 28.5L4 24L19.5 19.5L24 4Z" stroke="currentColor" stroke-width="1"/></svg>`,
  hex: `<svg viewBox="0 0 48 48" fill="none"><polygon points="24,5 40,14 40,34 24,43 8,34 8,14" stroke="currentColor" stroke-width="1"/><circle cx="24" cy="23" r="5" fill="currentColor"/><line x1="24" y1="5" x2="24" y2="14" stroke="currentColor" stroke-width="1" opacity="0.6"/></svg>`,
  mandala: `<svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="22" stroke="currentColor" stroke-width="0.6"/><circle cx="24" cy="24" r="16" stroke="currentColor" stroke-width="0.6"/><circle cx="24" cy="24" r="9" stroke="currentColor" stroke-width="0.6"/><line x1="24" y1="2" x2="24" y2="46" stroke="currentColor" stroke-width="0.5"/><line x1="2" y1="24" x2="46" y2="24" stroke="currentColor" stroke-width="0.5"/><line x1="8" y1="8" x2="40" y2="40" stroke="currentColor" stroke-width="0.4"/><line x1="40" y1="8" x2="8" y2="40" stroke="currentColor" stroke-width="0.4"/></svg>`,
};

const TYPE_LABELS = {
  assessment: "Assessment", planner: "Planner", timer: "Timer", glossary: "Glossary",
  journal: "Journal", "protocol-library": "Protocol Library", reference: "Reference", guide: "Guide",
  ritual: "Ritual",
};

// ── Shared page chrome ───────────────────────────────────────────────────────

function pageChrome({ title, description, canonical, type = "website", body, schema = [], extraStyle = "" }) {
  const jsonLd = schema.map(item => `  <script type="application/ld+json">\n${JSON.stringify(item)}\n  </script>`).join("\n");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-G5HF0WKZT9"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-G5HF0WKZT9');
  </script>
  <title>${escapeHtml(title)} | Vibration of Awesome</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${absoluteUrl(canonical)}">
  <meta name="robots" content="index, follow">
  <meta name="theme-color" content="#00e5cc">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="192x192" href="/favicon-192x192.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
  <link rel="manifest" href="/site.webmanifest">
  <meta property="og:type" content="${type}">
  <meta property="og:site_name" content="Vibration of Awesome">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${absoluteUrl(canonical)}">
  <meta property="og:image" content="${BASE}/images/StarLogo.png">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${BASE}/images/StarLogo.png">
${jsonLd}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Cinzel+Decorative:wght@400;700&family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Lora:ital,wght@0,400;0,500;1,400&family=Rajdhani:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
${AUTHORITY_CSS}
${extraStyle}
  </style>
</head>
<body>
  <div class="stars" id="stars" aria-hidden="true"></div>
  <nav class="voa-nav" aria-label="Site navigation">
    <a href="/" class="voa-nav-logo">VOA</a>
    <button class="voa-hamburger" id="voaHamburger" onclick="voaToggleNav()" aria-label="Menu" aria-expanded="false">
      <span></span><span></span><span></span>
    </button>
    <ul class="voa-nav-links" id="voaNavLinks">
      <li><a href="/field-guide/" class="voa-field-guide-link">Field Guide &#10022;</a></li>
      <li><a href="/ai-engine/" class="voa-ai-engine-link">AI Engine
        <svg class="voa-nav-hex" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <polygon points="6,0.8 10.4,3.3 10.4,8.5 6,11 1.6,8.5 1.6,3.3" stroke="currentColor" stroke-width="0.9"/>
          <circle cx="6" cy="5.9" r="1.3" fill="currentColor"/>
          <line x1="6" y1="0.8" x2="6" y2="3.2" stroke="currentColor" stroke-width="0.7" opacity="0.6"/>
        </svg>
      </a></li>
      <li><a href="/hubs/" class="voa-resources-link">Resources</a></li>
      <li><a href="/art-store/">Art Store</a></li>
      <li><a href="/aura/" class="voa-aura-link">AURA &#10022;</a></li>
      <li><a href="/earthstar/">EarthStar &#10022;</a></li>
      <li><a href="/blog/">Blog</a></li>
    </ul>
  </nav>
  <main class="voa-shell">
${body}
  </main>
  <footer class="voa-footer">
    <div class="voa-footer-left">
      <div class="voa-footer-logo">Vibration of Awesome</div>
      <div class="voa-footer-tagline">Empower Thyself. Empower the Earth.</div>
    </div>
    <nav class="voa-footer-nav" aria-label="Footer navigation">
      <a href="/field-guide/">Field Guide</a>
      <a href="/hubs/">Resources</a>
      <a href="/blog/">Blog</a>
      <a href="/art-store/" style="color:var(--cyan);opacity:0.75;">Art Store &#10022;</a>
    </nav>
  </footer>
  <script>
    (function () {
      var el = document.getElementById('stars');
      if (el) {
        var frag = document.createDocumentFragment();
        for (var i = 0; i < 50; i++) {
          var star = document.createElement('div');
          star.className = 'voa-star';
          var size = Math.random() * 2.2 + 0.5;
          star.style.cssText = 'width:' + size + 'px;height:' + size + 'px;left:' + (Math.random() * 100) + '%;top:' + (Math.random() * 100) + '%;--dur:' + (Math.random() * 4 + 2) + 's;--delay:' + (Math.random() * 5) + 's;--brightness:' + (Math.random() * 0.5 + 0.25) + ';';
          frag.appendChild(star);
        }
        el.appendChild(frag);
      }
      function voaToggleNav() {
        document.getElementById('voaNavLinks').classList.toggle('open');
        document.getElementById('voaHamburger').classList.toggle('open');
      }
      window.voaToggleNav = voaToggleNav;

      function voaTrack(eventName, params) {
        if (typeof window.gtag === 'function') {
          window.gtag('event', eventName, params || {});
        }
      }
      document.addEventListener('click', function (event) {
        var link = event.target.closest ? event.target.closest('a[href]') : null;
        if (!link) return;
        var href = link.getAttribute('href') || '';
        if (/^\\/blog\\//.test(href)) {
          voaTrack('related_article_click', { link_url: href, link_text: (link.textContent || '').trim().slice(0, 80) });
        } else if (/^\\/(hubs|tools)\\//.test(href)) {
          voaTrack('authority_resource_click', { link_url: href, link_text: (link.textContent || '').trim().slice(0, 80) });
        }
      });

      var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!prefersReduced && 'IntersectionObserver' in window) {
        var reveals = document.querySelectorAll('.voa-reveal');
        var observer = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) { if (entry.isIntersecting) entry.target.classList.add('voa-visible'); });
        }, { threshold: 0.12 });
        reveals.forEach(function (r) { observer.observe(r); });
      } else {
        document.querySelectorAll('.voa-reveal').forEach(function (r) { r.classList.add('voa-visible'); });
      }
    })();
  </script>
</body>
</html>
`;
}

const AUTHORITY_CSS = `
    :root {
      --deep: #020a0a; --panel: rgba(255,255,255,0.025); --line: rgba(201,168,76,0.14);
      --cream: #e8fff9; --muted: rgba(232,255,249,0.68);
      --cyan: #00e5cc; --cyan-light: #4dfff0;
      --amber: #ffb300; --amber-light: #ffd76b;
      --violet: #a78bfa; --violet-light: #cdbcff;
      --moss: #22c06a; --moss-light: #6fe6a0;
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0; background: var(--deep); color: var(--cream); overflow-x: hidden;
      font-family: 'Lora', Georgia, serif; line-height: 1.7;
    }
    .stars { position: fixed; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }
    .voa-star { position: absolute; background: white; border-radius: 50%; animation: voaTwinkle var(--dur, 3s) ease-in-out infinite; animation-delay: var(--delay, 0s); opacity: 0; }
    @keyframes voaTwinkle { 0%, 100% { opacity: 0; transform: scale(0.5); } 50% { opacity: var(--brightness, 0.6); transform: scale(1); } }
    @media (prefers-reduced-motion: reduce) { .voa-star { animation: none; opacity: 0.35; } }

    a { color: var(--cyan); }
    .voa-shell { position: relative; z-index: 1; max-width: 1100px; margin: 0 auto; padding: 0 1.5rem; }

    /* NAV */
    .voa-nav { position: sticky; top: 0; z-index: 100; display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1.1rem 1.5rem; background: linear-gradient(to bottom, rgba(2,10,10,0.97), rgba(2,10,10,0.9)); border-bottom: 1px solid var(--line); backdrop-filter: blur(6px); }
    .voa-nav-logo { font-family: 'Cinzel Decorative', serif; font-size: 1rem; color: var(--cyan); letter-spacing: 0.15em; text-decoration: none; text-shadow: 0 0 16px rgba(0,229,204,0.35); }
    .voa-nav-links { display: flex; gap: 1.6rem; list-style: none; margin: 0; padding: 0; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
    .voa-nav-links a { font-family: 'Rajdhani', sans-serif; font-size: 0.78rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); text-decoration: none; transition: color 0.2s; position: relative; display: inline-flex; align-items: center; }
    .voa-nav-links a::after { content: ''; position: absolute; bottom: -4px; left: 0; width: 0; height: 1px; background: var(--cyan); transition: width 0.3s; }
    .voa-nav-links a:hover { color: var(--cyan); }
    .voa-nav-links a:hover::after { width: 100%; }
    .voa-nav-links a.voa-field-guide-link { color: var(--deep) !important; background: var(--cyan); padding: 0.3rem 0.8rem; border-radius: 2px; font-weight: 700; animation: voaNavGuidePulse 3s ease-in-out infinite; }
    .voa-nav-links a.voa-field-guide-link:hover { box-shadow: 0 0 22px rgba(0,229,204,0.55); }
    .voa-nav-links a.voa-field-guide-link::after { display: none; }
    @keyframes voaNavGuidePulse { 0%, 100% { box-shadow: 0 0 6px rgba(0,229,204,0.3); } 50% { box-shadow: 0 0 16px rgba(0,229,204,0.6); } }
    .voa-nav-links a.voa-aura-link { color: var(--cyan); border: 1px solid rgba(0,229,204,0.32); padding: 0.28rem 0.7rem; border-radius: 2px; }
    .voa-nav-links a.voa-aura-link::after { display: none; }
    .voa-nav-links a.voa-ai-engine-link { color: rgba(0,229,204,0.75); border: 1px solid rgba(0,229,204,0.18); padding: 0.28rem 0.7rem; border-radius: 4px; gap: 0.32rem; background: rgba(0,229,204,0.04); animation: voaNavCyberPulse 4s ease-in-out infinite; }
    .voa-nav-links a.voa-ai-engine-link::after { display: none; }
    .voa-nav-hex { width: 10px; height: 10px; flex-shrink: 0; opacity: 0.8; }
    @keyframes voaNavCyberPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(0,229,204,0); } 50% { box-shadow: 0 0 0 2px rgba(0,229,204,0.08); } }
    .voa-nav-links a.voa-resources-link { color: var(--amber-light); }
    .voa-nav-links a.voa-resources-link::after { background: var(--amber); }
    .voa-nav-links a.voa-resources-link:hover { color: var(--amber); }
    .voa-hamburger { display: none; flex-direction: column; gap: 5px; background: none; border: none; cursor: pointer; padding: 4px; }
    .voa-hamburger span { display: block; width: 22px; height: 2px; background: var(--cyan); border-radius: 2px; }
    @media (min-width: 901px) and (max-width: 1180px) {
      .voa-nav-links { gap: 1rem; }
      .voa-nav-links a { font-size: 0.7rem; }
      .voa-nav-links a.voa-field-guide-link, .voa-nav-links a.voa-aura-link, .voa-nav-links a.voa-ai-engine-link { padding: 0.26rem 0.55rem; }
    }
    @media (max-width: 900px) {
      .voa-hamburger { display: flex; }
      .voa-nav-links { display: none; position: absolute; top: 100%; left: 0; right: 0; flex-direction: column; align-items: flex-start; background: rgba(2,10,10,0.98); border-bottom: 1px solid var(--line); padding: 0.5rem 1.2rem 1rem; }
      .voa-nav-links.open { display: flex; }
      .voa-nav-links li { width: 100%; }
      .voa-nav { position: sticky; }
    }

    /* SECTION CONVENTIONS (matches homepage) */
    .voa-eyebrow { font-family: 'Rajdhani', sans-serif; font-size: 0.78rem; letter-spacing: 0.32em; text-transform: uppercase; display: flex; align-items: center; gap: 0.9rem; margin-bottom: 1rem; }
    .voa-eyebrow::before { content: ''; width: 26px; height: 1px; background: currentColor; opacity: 0.6; }
    .voa-divider { width: 54px; height: 1px; background: linear-gradient(to right, currentColor, transparent); margin: 1.6rem 0; opacity: 0.6; }
    .voa-reveal { opacity: 0; transform: translateY(16px); transition: opacity 0.7s ease, transform 0.7s ease; }
    .voa-reveal.voa-visible { opacity: 1; transform: translateY(0); }

    /* ACCENT UTILITIES */
    .accent-cyan   { color: var(--cyan); }
    .accent-amber  { color: var(--amber); }
    .accent-violet { color: var(--violet); }
    .accent-moss   { color: var(--moss); }
    .border-cyan   { border-color: rgba(0,229,204,0.28) !important; }
    .border-amber  { border-color: rgba(255,179,0,0.28) !important; }
    .border-violet { border-color: rgba(167,139,250,0.28) !important; }
    .border-moss   { border-color: rgba(34,192,106,0.28) !important; }
    .glow-cyan   { box-shadow: 0 0 32px rgba(0,229,204,0.14); }
    .glow-amber  { box-shadow: 0 0 32px rgba(255,179,0,0.14); }
    .glow-violet { box-shadow: 0 0 32px rgba(167,139,250,0.14); }
    .glow-moss   { box-shadow: 0 0 32px rgba(34,192,106,0.14); }

    /* HERO */
    .voa-hero { position: relative; padding: 7rem 0 3.5rem; overflow: hidden; }
    .voa-hero-bg { position: absolute; inset: -20% -10%; z-index: -1; opacity: 0.9; background:
      radial-gradient(ellipse 60% 55% at 22% 15%, var(--hero-glow, rgba(0,229,204,0.14)) 0%, transparent 65%),
      radial-gradient(ellipse 45% 40% at 85% 80%, rgba(201,168,76,0.06) 0%, transparent 60%); }
    .voa-hero-icon { position: absolute; right: -40px; top: 10%; width: 260px; height: 260px; opacity: 0.08; }
    .voa-hero-icon svg { width: 100%; height: 100%; }
    .voa-hero-inner { max-width: 760px; position: relative; }
    .voa-h1 { font-family: 'Cinzel', serif; font-size: clamp(2rem, 5.2vw, 3.6rem); line-height: 1.08; margin: 0 0 1.1rem; color: var(--cream); letter-spacing: 0.01em; }
    .voa-hero-desc { font-size: 1.08rem; line-height: 1.8; color: var(--muted); max-width: 680px; margin-bottom: 1.6rem; }
    .voa-hero-quote { font-family: 'Cormorant Garamond', serif; font-style: italic; font-size: clamp(1.05rem, 2vw, 1.28rem); line-height: 1.7; color: rgba(232,255,249,0.82); border-left: 2px solid currentColor; padding-left: 1.2rem; margin: 1.6rem 0; max-width: 640px; }

    /* BUTTONS */
    .voa-btn { font-family: 'Rajdhani', sans-serif; font-size: 0.82rem; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; padding: 0.95rem 1.9rem; text-decoration: none; display: inline-flex; align-items: center; gap: 0.5rem; clip-path: polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%); transition: transform 0.2s, box-shadow 0.2s; border: none; cursor: pointer; }
    .voa-btn-primary {
      color: var(--deep);
      background: linear-gradient(110deg, var(--cyan) 0%, var(--cyan) 35%, var(--cyan-light) 50%, var(--cyan) 65%, var(--cyan) 100%);
      background-size: 250% 100%; background-position: 140% center;
      animation: voaBtnShimmer 3.5s ease-in-out infinite, voaBtnGlow 2.5s ease-in-out infinite;
    }
    @keyframes voaBtnShimmer { 0% { background-position: 140% center; } 55%, 100% { background-position: -40% center; } }
    @keyframes voaBtnGlow { 0%, 100% { box-shadow: 0 0 12px rgba(0,229,204,0.4), 0 4px 16px rgba(0,0,0,0.3); } 50% { box-shadow: 0 0 34px rgba(0,229,204,0.85), 0 0 60px rgba(0,229,204,0.3), 0 4px 16px rgba(0,0,0,0.3); } }
    .voa-btn-primary:hover { background: var(--cyan-light); background-size: 100% 100%; box-shadow: 0 0 46px rgba(0,229,204,0.9), 0 0 90px rgba(0,229,204,0.4) !important; transform: translateY(-3px) scale(1.03); }
    .voa-btn-secondary { color: var(--cyan); border: 1px solid rgba(0,229,204,0.35); background: transparent; }
    .voa-btn-secondary:hover { transform: translateY(-2px); border-color: var(--cyan); background: rgba(0,229,204,0.05); }
    @media (prefers-reduced-motion: reduce) { .voa-btn-primary { animation: none; background-position: center; } }

    /* SECTION */
    .voa-section { padding: 3.2rem 0; border-top: 1px solid var(--line); }
    .voa-section:first-of-type { border-top: none; }
    .voa-section-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.6rem; }
    .voa-h2 { font-family: 'Cinzel', serif; font-size: clamp(1.3rem, 3vw, 1.9rem); margin: 0; color: var(--cream); }
    .voa-section-note { color: var(--muted); font-size: 0.95rem; max-width: 640px; }

    /* HUB PATHWAY GRID (index page) ~ asymmetric, not uniform */
    .voa-hub-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 1rem; }
    .voa-hub-card { grid-column: span 3; border: 1px solid var(--line); background: var(--panel); padding: 1.6rem; text-decoration: none; color: inherit; position: relative; overflow: hidden; transition: transform 0.25s, border-color 0.25s, background 0.25s; display: flex; flex-direction: column; min-height: 100%; }
    .voa-hub-card:hover { transform: translateY(-4px); background: rgba(255,255,255,0.04); }
    .voa-hub-card--feature { grid-column: span 6; padding: 2.4rem; }
    .voa-hub-card--feature .voa-hub-title { font-size: 1.5rem; }
    @media (min-width: 700px) { .voa-hub-card:nth-child(5n+3), .voa-hub-card:nth-child(5n+4) { grid-column: span 3; } }
    .voa-hub-icon { width: 34px; height: 34px; margin-bottom: 1rem; opacity: 0.85; }
    .voa-hub-icon svg { width: 100%; height: 100%; }
    .voa-hub-label { font-family: 'Rajdhani', sans-serif; font-size: 0.68rem; letter-spacing: 0.24em; text-transform: uppercase; margin-bottom: 0.5rem; opacity: 0.85; }
    .voa-hub-title { font-family: 'Cinzel', serif; font-size: 1.12rem; color: var(--cream); margin-bottom: 0.6rem; line-height: 1.3; }
    .voa-hub-desc { font-size: 0.92rem; line-height: 1.65; color: var(--muted); margin-bottom: 1rem; flex-grow: 1; }
    .voa-hub-meta { font-family: 'Rajdhani', sans-serif; font-size: 0.7rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); opacity: 0.75; display: flex; justify-content: space-between; align-items: center; margin-top: auto; }
    @media (max-width: 760px) { .voa-hub-grid { grid-template-columns: 1fr; } .voa-hub-card, .voa-hub-card--feature { grid-column: span 1 !important; } }

    /* RESOURCE / ARTICLE CARDS */
    .voa-card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1rem; }
    .voa-card { display: block; border: 1px solid var(--line); background: var(--panel); padding: 1.25rem; text-decoration: none; color: inherit; transition: transform 0.2s, border-color 0.2s; }
    .voa-card:hover { transform: translateY(-3px); }
    .voa-card-eyebrow { font-family: 'Rajdhani', sans-serif; font-size: 0.66rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted); margin-bottom: 0.5rem; }
    .voa-card h3 { font-family: 'Cinzel', serif; font-size: 1rem; margin: 0 0 0.5rem; line-height: 1.4; color: var(--cream); }
    .voa-card p { font-size: 0.9rem; line-height: 1.6; color: var(--muted); margin: 0; }

    /* FEATURED / START HERE */
    .voa-featured { display: grid; grid-template-columns: 1fr; gap: 1.5rem; border: 1px solid var(--line); background: var(--panel); padding: 1.75rem; }
    .voa-featured-label { font-family: 'Rajdhani', sans-serif; font-size: 0.7rem; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 0.6rem; }
    .voa-featured h3 { font-family: 'Cinzel', serif; font-size: 1.4rem; margin: 0 0 0.7rem; color: var(--cream); }
    .voa-featured p { color: var(--muted); font-size: 1rem; line-height: 1.75; margin-bottom: 1.2rem; }

    /* BADGES */
    .voa-badge { display: inline-block; font-family: 'Rajdhani', sans-serif; font-size: 0.64rem; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; padding: 0.22em 0.65em; border: 1px solid currentColor; border-radius: 2px; opacity: 0.9; }

    /* SUBTHEME GROUPS */
    .voa-subtheme { margin-bottom: 2rem; }
    .voa-subtheme-label { font-family: 'Rajdhani', sans-serif; font-size: 0.72rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); margin-bottom: 0.9rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--line); }

    /* RELATED PATHWAYS */
    .voa-pathways { display: flex; flex-wrap: wrap; gap: 0.9rem; }
    .voa-pathway { display: flex; align-items: center; gap: 0.6rem; border: 1px solid var(--line); padding: 0.8rem 1.1rem; text-decoration: none; color: inherit; transition: border-color 0.2s, transform 0.2s; }
    .voa-pathway:hover { transform: translateY(-2px); }
    .voa-pathway-icon { width: 20px; height: 20px; flex-shrink: 0; }
    .voa-pathway-icon svg { width: 100%; height: 100%; }
    .voa-pathway-text { font-family: 'Rajdhani', sans-serif; font-size: 0.82rem; letter-spacing: 0.05em; text-transform: uppercase; }

    /* TOOL STATUS PREVIEW (honest, non-clickable future items) */
    .voa-tool-preview { border: 1px dashed var(--line); background: transparent; padding: 1.25rem; opacity: 0.75; }
    .voa-tool-preview .voa-card-eyebrow { color: var(--muted); }

    /* CONTINUE THE JOURNEY */
    .voa-continue { text-align: center; padding: 3rem 0; }
    .voa-continue p { max-width: 560px; margin: 0 auto 1.5rem; color: var(--muted); }
    .voa-continue-cta { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }

    /* FOOTER */
    .voa-footer { position: relative; z-index: 1; max-width: 1100px; margin: 0 auto; padding: 3rem 1.5rem; border-top: 1px solid var(--line); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1.5rem; }
    .voa-footer-logo { font-family: 'Cinzel Decorative', serif; font-size: 1.1rem; color: var(--cyan); text-shadow: 0 0 16px rgba(0,229,204,0.3); }
    .voa-footer-tagline { font-family: 'Lora', serif; font-style: italic; font-size: 0.92rem; color: rgba(208,255,248,0.7); margin-top: 0.4rem; }
    .voa-footer-nav { display: flex; gap: 1.3rem; flex-wrap: wrap; }
    .voa-footer-nav a { font-family: 'Rajdhani', sans-serif; font-size: 0.72rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted); text-decoration: none; }
    .voa-footer-nav a:hover { color: var(--cyan); }

    @media (max-width: 640px) {
      .voa-hero { padding-top: 5.5rem; }
      .voa-hero-icon { width: 160px; height: 160px; opacity: 0.06; }
      .voa-section { padding: 2.2rem 0; }
    }
`;

function baseSchema({ title, description, canonical }) {
  return [
    { "@context": "https://schema.org", "@type": "Organization", "@id": `${BASE}/#organization`, name: "Vibration of Awesome", url: BASE, logo: `${BASE}/images/StarLogo.png` },
    { "@context": "https://schema.org", "@type": "WebSite", "@id": `${BASE}/#website`, name: "Vibration of Awesome", url: BASE, description: "Original resources for nervous system regulation, attention, creativity, personal transformation, and AI creator workflows.", publisher: { "@id": `${BASE}/#organization` } },
    { "@context": "https://schema.org", "@type": "WebPage", name: title, description, url: absoluteUrl(canonical), isPartOf: { "@id": `${BASE}/#website` }, dateModified: TODAY },
  ];
}

function breadcrumbs(items) {
  return {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: absoluteUrl(item.url) })),
  };
}

function iconFor(slug) {
  const theme = HUB_THEME[slug] || { accent: "cyan", icon: "star" };
  return { accent: theme.accent, svg: ICONS[theme.icon] || ICONS.star };
}

function postCards(posts, limit = 9) {
  if (!posts.length) return `<p>Fresh resources are being mapped into this hub.</p>`;
  return `<div class="voa-card-grid">
${posts.slice(0, limit).map(post => `<a class="voa-card" href="${post.url}">
  <div class="voa-card-eyebrow">${escapeHtml(post.lane === "matt" ? "Forest Temple" : "Boom Frequency")}</div>
  <h3>${escapeHtml(post.title)}</h3>
  <p>${escapeHtml(post.excerpt || "")}</p>
</a>`).join("\n")}
</div>`;
}

// ── /hubs/ index ─────────────────────────────────────────────────────────────

function renderHubsIndex(hubs, assets) {
  const title = "Vibration of Awesome Resources";
  const description = "Ten pathways into the deeper writing on Vibration of Awesome ~ nervous system regulation, ADHD and focus, dopamine and attention, meditation, creativity, purpose, self-trust, AI creator workflows, personal growth, and the core VOA concepts ~ plus the tools library built to go with them.";
  const publishedTools = assets.filter(a => a.status === "published");

  const cards = hubs.map((hub, i) => {
    const { accent, svg } = iconFor(hub.slug);
    const featured = i === 0 ? " voa-hub-card--feature" : "";
    return `<a class="voa-hub-card${featured} border-${accent}" href="/hubs/${hub.slug}/">
  <div class="voa-hub-icon accent-${accent}">${svg}</div>
  <div class="voa-hub-label accent-${accent}">Pathway</div>
  <h3 class="voa-hub-title">${escapeHtml(hub.title)}</h3>
  <p class="voa-hub-desc">${escapeHtml(hub.description)}</p>
  <div class="voa-hub-meta"><span>Explore the hub</span><span>&rarr;</span></div>
</a>`;
  }).join("\n");

  const body = `    <section class="voa-hero voa-reveal">
      <div class="voa-hero-bg" style="--hero-glow: rgba(0,229,204,0.16);"></div>
      <div class="voa-hero-icon accent-cyan">${ICONS.mandala}</div>
      <div class="voa-hero-inner">
        <div class="voa-eyebrow accent-cyan">Begin Here</div>
        <h1 class="voa-h1">Choose the pathway you're ready to explore</h1>
        <p class="voa-hero-desc">${escapeHtml(description)}</p>
        <p class="voa-hero-desc">Vibration of Awesome holds years of writing across two voices. This is your gateway into it ~ themes to sit with, practices to try, and tools built to go deeper on the same subject, instead of scrolling through everything at once.</p>
      </div>
    </section>
    <section class="voa-section voa-reveal" aria-label="Authority hubs">
      <div class="voa-hub-grid">
${cards}
      </div>
    </section>
    <section class="voa-section voa-reveal" aria-label="Tools">
      <div class="voa-section-head">
        <h2 class="voa-h2">Reflection Tools</h2>
        <p class="voa-section-note">Interactive companions to the hubs above ~ built to be used in a few minutes, not studied for an hour.</p>
      </div>
      <div class="voa-card-grid">
${publishedTools.map(asset => `<a class="voa-card border-cyan" href="${cleanPublicPath(asset.canonical)}">
  <div class="voa-card-eyebrow"><span class="voa-badge accent-cyan border-cyan">${escapeHtml(TYPE_LABELS[asset.type] || asset.type)}</span></div>
  <h3>${escapeHtml(asset.title)}</h3>
  <p>${escapeHtml(asset.description)}</p>
</a>`).join("\n")}
      </div>
    </section>
    <section class="voa-continue voa-reveal">
      <p>The full tools library ~ including what's still in development ~ lives on its own page.</p>
      <div class="voa-continue-cta">
        <a class="voa-btn voa-btn-primary" href="/tools/">Browse the Tools Library</a>
        <a class="voa-btn voa-btn-secondary" href="/field-guide/">Get the Field Guide</a>
      </div>
    </section>`;

  return pageChrome({
    title, description, canonical: "/hubs/", body,
    schema: [...baseSchema({ title, description, canonical: "/hubs/" }), breadcrumbs([{ name: "Home", url: "/" }, { name: "Resources", url: "/hubs/" }])],
  });
}

// ── Individual hub page ──────────────────────────────────────────────────────

function renderHub(hub, posts, assets, hubsBySlug) {
  const title = `${hub.title} Hub`;
  const description = hub.description;
  const canonical = `/hubs/${hub.slug}/`;
  const { accent, svg } = iconFor(hub.slug);
  // Exclude an asset that just points back at this hub's own URL ~ that's a
  // self-reference, never a real tool recommendation, and looks broken as a
  // "Featured Resource" card linking to the page it's already on.
  const isSelfReference = (asset) => cleanPublicPath(asset.canonical) === `/hubs/${hub.slug}/`;
  const sameHubAssets = assets.filter(asset => asset.hub === hub.slug && !isSelfReference(asset));
  const secondaryAssets = (hub.secondaryAssets || [])
    .map(slug => assets.find(a => a.slug === slug))
    .filter(Boolean)
    .filter(asset => !sameHubAssets.some(a => a.slug === asset.slug));
  const relatedAssets = [...sameHubAssets, ...secondaryAssets];
  const publishedAssets = relatedAssets.filter(a => a.status === "published");
  const upcomingAssets = relatedAssets.filter(a => a.status !== "published");
  // "Start Here" should be the post that most clearly represents this hub's
  // subject, not simply whichever published most recently ~ rank by keyword
  // relevance first (stable sort keeps recency as the tiebreaker for equal
  // scores, since `posts` arrives already sorted newest-first).
  const rankedPosts = [...posts].sort((a, b) => hubRelevanceScore(b, hub) - hubRelevanceScore(a, hub));
  const featuredPost = rankedPosts[0];
  const restPosts = posts.filter(post => post.slug !== featuredPost?.slug);
  const subthemeGroups = groupBySubtheme(hub.slug, restPosts);
  const relatedHubSlugs = RELATED_HUBS[hub.slug] || [];

  const exploreSection = subthemeGroups
    ? subthemeGroups.map(group => `<div class="voa-subtheme">
  <div class="voa-subtheme-label">${escapeHtml(group.label)}</div>
  ${postCards(group.items, 6)}
</div>`).join("\n")
    : postCards(restPosts, 9);

  const relatedPathways = relatedHubSlugs.map(slug => {
    const relHub = hubsBySlug[slug];
    if (!relHub) return "";
    const relTheme = iconFor(slug);
    return `<a class="voa-pathway border-${relTheme.accent}" href="/hubs/${slug}/">
  <span class="voa-pathway-icon accent-${relTheme.accent}">${relTheme.svg}</span>
  <span class="voa-pathway-text">${escapeHtml(relHub.title)}</span>
</a>`;
  }).join("\n");

  const assetCards = (list, dashed) => list.map(asset => `<a class="voa-card${dashed ? " voa-tool-preview" : ""} border-${accent}" href="${dashed ? "#" : cleanPublicPath(asset.canonical)}"${dashed ? " onclick=\"return false\" aria-disabled=\"true\"" : ""}>
  <div class="voa-card-eyebrow"><span class="voa-badge accent-${accent} border-${accent}">${escapeHtml(TYPE_LABELS[asset.type] || asset.type)}</span>${dashed ? ` &middot; ${escapeHtml(asset.status)}` : ""}</div>
  <h3>${escapeHtml(asset.title)}</h3>
  <p>${escapeHtml(asset.description)}</p>
</a>`).join("\n");

  const body = `    <section class="voa-hero voa-reveal">
      <div class="voa-hero-bg" style="--hero-glow: var(--${accent === "moss" ? "moss" : accent});"></div>
      <div class="voa-hero-icon accent-${accent}">${svg}</div>
      <div class="voa-hero-inner">
        <div class="voa-eyebrow accent-${accent}">Explore This Theme</div>
        <h1 class="voa-h1">${escapeHtml(hub.title)}</h1>
        <p class="voa-hero-desc">${escapeHtml(description)}</p>
        ${hub.primaryAsset ? `<a class="voa-btn voa-btn-primary" href="${hub.primaryAsset}">Open the featured resource</a>` : ""}
      </div>
    </section>

    ${featuredPost ? `<section class="voa-section voa-reveal">
      <div class="voa-section-head"><h2 class="voa-h2">Start Here</h2></div>
      <a class="voa-featured border-${accent}" href="${featuredPost.url}">
        <div>
          <div class="voa-featured-label accent-${accent}">${escapeHtml(featuredPost.lane === "matt" ? "Forest Temple" : "Boom Frequency")} &middot; Start here</div>
          <h3>${escapeHtml(featuredPost.title)}</h3>
          <p>${escapeHtml(featuredPost.excerpt || "The clearest entry point into this hub right now.")}</p>
          <span class="voa-btn voa-btn-secondary">Read the piece</span>
        </div>
      </a>
    </section>` : ""}

    ${(publishedAssets.length || upcomingAssets.length) ? `<section class="voa-section voa-reveal">
      <div class="voa-section-head"><h2 class="voa-h2">Featured Resources</h2></div>
      <div class="voa-card-grid">
${assetCards(publishedAssets, false)}
${assetCards(upcomingAssets, true)}
      </div>
    </section>` : ""}

    <section class="voa-section voa-reveal">
      <div class="voa-section-head"><h2 class="voa-h2">Explore Deeper</h2></div>
      ${restPosts.length ? exploreSection : `<p>More writing is being mapped into this hub as it publishes.</p>`}
    </section>

    ${relatedPathways ? `<section class="voa-section voa-reveal">
      <div class="voa-section-head"><h2 class="voa-h2">Related Pathways</h2></div>
      <div class="voa-pathways">
${relatedPathways}
      </div>
    </section>` : ""}

    <section class="voa-continue voa-reveal">
      <p>Ready for the next layer? The Field Guide is the short map back to the state this whole site is built around.</p>
      <div class="voa-continue-cta">
        <a class="voa-btn voa-btn-primary" href="/field-guide/">Get the Field Guide &#10022;</a>
        <a class="voa-btn voa-btn-secondary" href="/hubs/">Back to all Hubs</a>
      </div>
    </section>`;

  return pageChrome({
    title, description, canonical, body,
    schema: [
      ...baseSchema({ title, description, canonical }),
      breadcrumbs([{ name: "Home", url: "/" }, { name: "Resources", url: "/hubs/" }, { name: hub.title, url: canonical }]),
      {
        "@context": "https://schema.org", "@type": "CollectionPage", name: title, description, url: absoluteUrl(canonical), about: hub.title,
        hasPart: posts.slice(0, 12).map(post => ({ "@type": "Article", name: post.title, url: absoluteUrl(post.url) })),
      },
    ],
  });
}

// ── /tools/ index ────────────────────────────────────────────────────────────

function renderToolsIndex(assets) {
  const title = "VOA Reflection Tools";
  const description = "An evolving library of reflection tools, planners, timers, and assessments from Vibration of Awesome ~ built for focus, regulation, creativity, and intentional living.";
  const published = assets.filter(a => a.status === "published");
  const upcoming = assets.filter(a => a.status !== "published");

  const body = `    <section class="voa-hero voa-reveal">
      <div class="voa-hero-bg" style="--hero-glow: rgba(0,229,204,0.16);"></div>
      <div class="voa-hero-icon accent-cyan">${ICONS.spark}</div>
      <div class="voa-hero-inner">
        <div class="voa-eyebrow accent-cyan">Reflection Tools</div>
        <h1 class="voa-h1">Tools for attention, regulation, and direction</h1>
        <p class="voa-hero-desc">${escapeHtml(description)}</p>
        <p class="voa-hero-desc">This library grows alongside the hubs. Each tool is built to be used in five minutes, not studied for an hour ~ a reflection, not a test.</p>
      </div>
    </section>

    <section class="voa-section voa-reveal">
      <div class="voa-section-head"><h2 class="voa-h2">Available Now</h2></div>
      <div class="voa-card-grid">
${published.map(asset => `<a class="voa-card border-cyan" href="${cleanPublicPath(asset.canonical)}">
  <div class="voa-card-eyebrow"><span class="voa-badge accent-cyan border-cyan">${escapeHtml(TYPE_LABELS[asset.type] || asset.type)}</span></div>
  <h3>${escapeHtml(asset.title)}</h3>
  <p>${escapeHtml(asset.description)}</p>
</a>`).join("\n")}
      </div>
    </section>

    ${upcoming.length ? `<section class="voa-section voa-reveal">
      <div class="voa-section-head">
        <h2 class="voa-h2">In Development</h2>
        <p class="voa-section-note">Honest previews only ~ these are real items in the build queue, not placeholders. They'll link out once they publish.</p>
      </div>
      <div class="voa-card-grid">
${upcoming.map(asset => `<div class="voa-card voa-tool-preview border-amber">
  <div class="voa-card-eyebrow"><span class="voa-badge accent-amber border-amber">${escapeHtml(TYPE_LABELS[asset.type] || asset.type)}</span> &middot; ${escapeHtml(asset.status)}</div>
  <h3>${escapeHtml(asset.title)}</h3>
  <p>${escapeHtml(asset.description)}</p>
</div>`).join("\n")}
      </div>
    </section>` : ""}

    <section class="voa-continue voa-reveal">
      <p>Each tool connects back to a hub with the writing that goes deeper on the same subject.</p>
      <div class="voa-continue-cta">
        <a class="voa-btn voa-btn-primary" href="/hubs/">Browse the Hubs</a>
      </div>
    </section>`;

  return pageChrome({
    title, description, canonical: "/tools/", body,
    schema: [...baseSchema({ title, description, canonical: "/tools/" }), breadcrumbs([{ name: "Home", url: "/" }, { name: "Tools", url: "/tools/" }])],
  });
}

// ── Digital Attention Audit ──────────────────────────────────────────────────

function renderDigitalAttentionAudit() {
  const title = "Digital Attention Audit";
  const description = "A non-clinical reflection tool for noticing which digital inputs are draining focus, self-trust, and creative energy.";
  const canonical = "/tools/digital-attention-audit/";

  // Same 6 reflection statements as before (content preserved), each now
  // presented as its own stage with a thematic label ~ no new clinical
  // content invented, just a guided one-at-a-time flow instead of one long form.
  const stages = [
    { label: "Attention Environment", q: "I reach for a screen before I know what I am actually feeling." },
    { label: "Habit Patterns", q: "My attention feels split even when I have time to focus." },
    { label: "Creative Signal", q: "Digital inputs make it harder to hear my own creative signal." },
    { label: "Emotional Triggers", q: "I use scrolling, feeds, or videos to avoid a decision I already know I need to make." },
    { label: "After-Effects", q: "After being online, I often feel flatter, foggier, or less self-trusting." },
    { label: "Daily Rhythm", q: "My tools are controlling the rhythm of my day more than my actual priorities are." },
  ];

  const stageMarkup = stages.map((stage, i) => `<fieldset class="voa-audit-stage" data-stage="${i}" ${i === 0 ? "" : "hidden"}>
        <legend class="voa-audit-stage-label accent-cyan">Stage ${i + 1} of ${stages.length} &middot; ${escapeHtml(stage.label)}</legend>
        <p class="voa-audit-question">${escapeHtml(stage.q)}</p>
        <div class="voa-audit-answers" role="radiogroup" aria-label="${escapeHtml(stage.q)}">
          ${["Rarely", "Sometimes", "Often", "Very often"].map((label, value) => `<label class="voa-audit-answer">
            <input type="radio" name="q${i}" value="${value}">
            <span>${label}</span>
          </label>`).join("\n          ")}
        </div>
      </fieldset>`).join("\n");

  const body = `    <section class="voa-hero voa-reveal">
      <div class="voa-hero-bg" style="--hero-glow: rgba(0,229,204,0.16);"></div>
      <div class="voa-hero-icon accent-cyan">${ICONS.pulse}</div>
      <div class="voa-hero-inner">
        <div class="voa-eyebrow accent-cyan">Reflection Tool</div>
        <h1 class="voa-h1">Digital Attention Audit</h1>
        <p class="voa-hero-desc">${escapeHtml(description)}</p>
        <p class="voa-hero-quote">This is a reflective, educational tool ~ not a medical, psychological, or diagnostic instrument. It does not assess or diagnose ADHD, anxiety, addiction, or any other condition.</p>
      </div>
    </section>

    <section class="voa-section voa-reveal" aria-label="Digital Attention Audit">
      <div id="audit-welcome" class="voa-featured border-cyan">
        <div>
          <div class="voa-featured-label accent-cyan">Before You Start</div>
          <h3>Six short reflections, about two minutes</h3>
          <p>There's no score to pass or fail here. Answer honestly, based on the last couple of weeks, and see what pattern shows up. You can go back and change an answer at any point before you finish.</p>
          <button class="voa-btn voa-btn-primary" id="audit-start" type="button">Begin the Audit</button>
        </div>
      </div>

      <form id="attention-audit" class="voa-audit-form" hidden>
        <div class="voa-audit-progress" aria-hidden="true">
          <div class="voa-audit-progress-bar" id="audit-progress-bar" style="width: 0%"></div>
        </div>
${stageMarkup}
        <div class="voa-audit-nav">
          <button class="voa-btn voa-btn-secondary" id="audit-back" type="button">Back</button>
          <button class="voa-btn voa-btn-primary" id="audit-next" type="button">Next</button>
        </div>
      </form>

      <div id="audit-result" class="voa-audit-result" tabindex="-1" hidden></div>
    </section>

    <section class="voa-section voa-reveal">
      <div class="voa-section-head"><h2 class="voa-h2">What to Do With the Result</h2></div>
      <p class="voa-section-note">Use the result as a signal, not a verdict. Pick one digital input to reduce for seven days, then replace that slot with a physical cue: a walk, a notebook, one song, one breath practice, or one unfinished creative action.</p>
    </section>

    <section class="voa-continue voa-reveal">
      <p>Ready to go deeper on the same subject?</p>
      <div class="voa-continue-cta">
        <a class="voa-btn voa-btn-primary" href="/hubs/dopamine-attention/">Continue into Dopamine &amp; Attention</a>
        <a class="voa-btn voa-btn-secondary" href="/hubs/adhd-focus/">Explore ADHD &amp; Focus</a>
      </div>
    </section>

    <style>
      .voa-audit-progress { height: 4px; background: rgba(255,255,255,0.08); margin-bottom: 2rem; border-radius: 2px; overflow: hidden; }
      .voa-audit-progress-bar { height: 100%; background: var(--cyan); transition: width 0.3s ease; }
      .voa-audit-stage { border: none; padding: 0; margin: 0 0 1.5rem; }
      .voa-audit-stage-label { font-family: 'Rajdhani', sans-serif; font-size: 0.75rem; letter-spacing: 0.16em; text-transform: uppercase; margin-bottom: 1rem; padding: 0; }
      .voa-audit-question { font-family: 'Cinzel', serif; font-size: clamp(1.1rem, 2.4vw, 1.5rem); line-height: 1.5; color: var(--cream); margin-bottom: 1.6rem; }
      .voa-audit-answers { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.7rem; }
      .voa-audit-answer { display: flex; align-items: center; justify-content: center; text-align: center; gap: 0.5rem; border: 1px solid var(--line); padding: 1rem 0.6rem; cursor: pointer; min-height: 56px; font-family: 'Rajdhani', sans-serif; font-size: 0.85rem; letter-spacing: 0.04em; text-transform: uppercase; transition: border-color 0.2s, background 0.2s; }
      .voa-audit-answer:has(input:checked) { border-color: var(--cyan); background: rgba(0,229,204,0.08); color: var(--cyan); }
      .voa-audit-answer input { position: absolute; opacity: 0; width: 1px; height: 1px; }
      .voa-audit-answer input:focus-visible ~ span { outline: 2px solid var(--cyan); outline-offset: 3px; }
      .voa-audit-nav { display: flex; justify-content: space-between; margin-top: 2rem; }
      .voa-audit-result { border: 1px solid rgba(0,229,204,0.3); background: rgba(0,229,204,0.04); padding: 2rem; margin-top: 1.5rem; }
      .voa-audit-result h3 { font-family: 'Cinzel', serif; font-size: 1.4rem; color: var(--cream); margin-bottom: 0.8rem; }
      .voa-audit-result-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.2rem; margin: 1.5rem 0; }
      .voa-audit-result-grid h4 { font-family: 'Rajdhani', sans-serif; font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--cyan); margin-bottom: 0.5rem; }
      .voa-audit-result-grid p { font-size: 0.92rem; color: var(--muted); margin: 0; }
      .voa-audit-result-actions { display: flex; gap: 0.8rem; flex-wrap: wrap; margin-top: 1.5rem; }
      @media (max-width: 640px) {
        .voa-audit-answers { grid-template-columns: repeat(2, 1fr); }
        .voa-audit-result-grid { grid-template-columns: 1fr; }
      }
    </style>
    <script>
    (function () {
      var STAGES = ${stages.length};
      var current = 0;
      var welcome = document.getElementById('audit-welcome');
      var form = document.getElementById('attention-audit');
      var startBtn = document.getElementById('audit-start');
      var backBtn = document.getElementById('audit-back');
      var nextBtn = document.getElementById('audit-next');
      var progressBar = document.getElementById('audit-progress-bar');
      var resultBox = document.getElementById('audit-result');
      var STORAGE_KEY = 'voa-attention-audit-progress';

      function showStage(i) {
        document.querySelectorAll('.voa-audit-stage').forEach(function (el, idx) {
          el.hidden = idx !== i;
        });
        backBtn.style.visibility = i === 0 ? 'hidden' : 'visible';
        nextBtn.textContent = i === STAGES - 1 ? 'See Reflection' : 'Next';
        progressBar.style.width = (((i + 1) / STAGES) * 100) + '%';
        saveProgress();
      }

      function saveProgress() {
        try {
          var data = new FormData(form);
          var answers = {};
          for (var i = 0; i < STAGES; i++) { if (data.has('q' + i)) answers['q' + i] = data.get('q' + i); }
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ current: current, answers: answers }));
        } catch (e) { /* storage unavailable ~ progress just won't persist across refresh */ }
      }

      function restoreProgress() {
        try {
          var raw = sessionStorage.getItem(STORAGE_KEY);
          if (!raw) return;
          var data = JSON.parse(raw);
          Object.keys(data.answers || {}).forEach(function (name) {
            var input = form.querySelector('input[name="' + name + '"][value="' + data.answers[name] + '"]');
            if (input) input.checked = true;
          });
        } catch (e) { /* ignore corrupt/blocked storage */ }
      }

      startBtn.addEventListener('click', function () {
        if (typeof window.gtag === 'function') {
          window.gtag('event', 'digital_attention_audit_start', { tool_slug: 'digital-attention-audit' });
        }
        welcome.hidden = true;
        form.hidden = false;
        restoreProgress();
        showStage(0);
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });

      backBtn.addEventListener('click', function () {
        if (current > 0) { current -= 1; showStage(current); }
      });

      nextBtn.addEventListener('click', function () {
        var checked = form.querySelector('input[name="q' + current + '"]:checked');
        if (!checked) {
          var stage = document.querySelector('.voa-audit-stage[data-stage="' + current + '"]');
          stage.style.outline = '1px solid rgba(255,179,0,0.5)';
          setTimeout(function () { stage.style.outline = 'none'; }, 900);
          return;
        }
        if (current < STAGES - 1) {
          current += 1;
          showStage(current);
        } else {
          finish();
        }
      });

      function finish() {
        var data = new FormData(form);
        var total = 0;
        for (var i = 0; i < STAGES; i++) { total += Number(data.get('q' + i)) || 0; }

        var profile;
        if (total <= 5) {
          profile = {
            name: 'Signal Guardian',
            summary: 'Your attention has real room around it right now.',
            strengths: 'You are noticing your own patterns before they become a problem ~ that awareness is most of the work.',
            drains: 'Watch for the one input that quietly creeps up during busy weeks.',
            action: 'Protect the block of time where your own signal is clearest, and keep it screen-free.',
            practice: 'Once a week, notice one moment your attention felt fully yours. Write it down.',
          };
        } else if (total <= 12) {
          profile = {
            name: 'Steady but Splitting',
            summary: 'Your attention is asking for cleaner boundaries, not a full overhaul.',
            strengths: 'You already know which input is the repeat offender ~ that clarity is valuable.',
            drains: 'Fragmented focus after digital inputs, especially feeds and notifications.',
            action: 'Choose one repeat input that reliably leaves you foggier and give it a smaller container for the next seven days.',
            practice: 'Before opening the app you reach for automatically, name what you are actually feeling first.',
          };
        } else {
          profile = {
            name: 'Static Overload',
            summary: 'Your system may be carrying more digital noise than it can process right now.',
            strengths: 'Finishing this audit honestly is itself a signal that you are ready for something to shift.',
            drains: 'Likely candidates: reactive scrolling, notification pull, and using screens to avoid a feeling or decision.',
            action: 'Start gently. Reduce one noisy source this week and add one grounding practice in its place.',
            practice: 'Avoid turning this into another perfection project. One honest change beats a total reset that does not stick.',
          };
        }

        if (typeof window.gtag === 'function') {
          window.gtag('event', 'digital_attention_audit_complete', {
            tool_slug: 'digital-attention-audit',
            result_profile: profile.name,
            score_band: total <= 5 ? 'low' : total <= 12 ? 'medium' : 'high'
          });
        }

        resultBox.innerHTML =
          '<h3>' + profile.name + '</h3>' +
          '<p>' + profile.summary + '</p>' +
          '<div class="voa-audit-result-grid">' +
            '<div><h4>Strength</h4><p>' + profile.strengths + '</p></div>' +
            '<div><h4>Likely Drain</h4><p>' + profile.drains + '</p></div>' +
            '<div><h4>One Immediate Action</h4><p>' + profile.action + '</p></div>' +
            '<div><h4>One Deeper Practice</h4><p>' + profile.practice + '</p></div>' +
          '</div>' +
          '<p style="font-size:0.85rem;opacity:0.7;">This is a reflective, educational read on your answers today ~ not a diagnosis, a score to compare against others, or a scientific measurement.</p>' +
          '<div class="voa-audit-result-actions">' +
            '<button class="voa-btn voa-btn-secondary" id="audit-copy" type="button">Copy My Result</button>' +
          '</div>';
        form.hidden = true;
        resultBox.hidden = false;
        resultBox.focus();
        resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
        try { sessionStorage.removeItem(STORAGE_KEY); } catch (e) {}

        var copyBtn = document.getElementById('audit-copy');
        if (copyBtn) {
          copyBtn.addEventListener('click', function () {
            var text = profile.name + ': ' + profile.summary + '\\n\\nStrength: ' + profile.strengths + '\\nLikely drain: ' + profile.drains + '\\nOne immediate action: ' + profile.action + '\\nOne deeper practice: ' + profile.practice;
            if (navigator.clipboard) {
              navigator.clipboard.writeText(text).then(function () {
                copyBtn.textContent = 'Copied';
                setTimeout(function () { copyBtn.textContent = 'Copy My Result'; }, 1800);
              });
            }
          });
        }
      }

      form.addEventListener('submit', function (e) { e.preventDefault(); });
    })();
    </script>`;

  return pageChrome({
    title, description, canonical, body,
    schema: [
      ...baseSchema({ title, description, canonical }),
      breadcrumbs([{ name: "Home", url: "/" }, { name: "Tools", url: "/tools/" }, { name: title, url: canonical }]),
      { "@context": "https://schema.org", "@type": "WebApplication", name: title, description, url: absoluteUrl(canonical), applicationCategory: "EducationalApplication", operatingSystem: "Any", isAccessibleForFree: true },
    ],
  });
}

// ── ADHD Focus Session Planner ───────────────────────────────────────────────
//
// A ritual, not a form. Five small decisions revealed one at a time, each one
// deterministically placing a point in a personal "Focus Star" constellation
// (same stage+choice always draws the same point ~ intentional, not random
// noise), a synthesized Web Audio ambient tone chosen instead of a real audio
// file (no external assets, no network requests, no library), a breathing
// pause, a real wall-clock session timer, and a closing Focus Card built from
// the session's own answers ~ copyable and printable, no accounts, nothing
// persisted past the tab.

function renderAdhdFocusSessionPlanner() {
  const title = "ADHD Focus Session Planner";
  const description = "A short ritual for starting deep work when your attention is scattered ~ five small decisions, one breath, then a real focus session that ends with a Focus Card built from your own answers.";
  const canonical = "/tools/adhd-focus-session-planner/";

  const MISSIONS = [
    { id: "write", label: "Writing", detail: "Words, a draft, a page that needs to exist." },
    { id: "music", label: "Music", detail: "A track, a lyric, a sound you can hear but haven't made yet." },
    { id: "code", label: "Building", detail: "Code, a tool, something that needs to work." },
    { id: "art", label: "Art", detail: "A visual, a design, something for the eye." },
    { id: "think", label: "Deep Thinking", detail: "A decision, a plan, a problem worth sitting with." },
    { id: "other", label: "Something Else", detail: "Whatever it is, it's yours today." },
  ];
  const DURATIONS = [
    { id: "15", label: "15 minutes", minutes: 15, detail: "A small, honest start." },
    { id: "25", label: "25 minutes", minutes: 25, detail: "One real lap." },
    { id: "45", label: "45 minutes", minutes: 45, detail: "Enough time to disappear into it." },
    { id: "90", label: "90 minutes", minutes: 90, detail: "A deep session. Only if it's really realistic today." },
  ];
  const DISTRACTIONS = [
    { id: "phone", label: "My phone", detail: "The reach-for-it-before-you-notice kind." },
    { id: "tabs", label: "Other tabs", detail: "The nine other things open right now." },
    { id: "perfection", label: "Perfectionism", detail: "Rewriting the first line for the fifth time." },
    { id: "start", label: "Not knowing where to start", detail: "The blank-page freeze." },
    { id: "noise", label: "Someone else's noise", detail: "Messages, notifications, other people's urgency." },
  ];
  const ATMOSPHERES = [
    { id: "space", label: "Deep Space Hum", detail: "A low, steady drone.", audio: "space" },
    { id: "forest", label: "Forest Undertone", detail: "Soft, filtered, alive.", audio: "forest" },
    { id: "pulse", label: "Heartbeat Pulse", detail: "A slow, grounding rhythm.", audio: "pulse" },
    { id: "silence", label: "Still Silence", detail: "No tone. Just the room you're in.", audio: "none" },
  ];

  const REMINDERS = {
    phone: "Future you already knows the phone will still be there in {min} minutes. It can wait.",
    tabs: "Future you doesn't need the other tabs closed ~ just this one open a little longer.",
    perfection: "Future you would rather have a finished rough thing than a perfect thing that never left this session.",
    start: "Future you isn't asking for the whole thing. Just the first honest sentence.",
    noise: "Future you gives you full permission to be unreachable for {min} minutes. That's the whole ritual.",
  };
  const COMMITMENTS = {
    write: "Write one true sentence before you let yourself edit anything.",
    music: "Get one idea down, even rough, before you judge it.",
    code: "Make one small thing work before you make it right.",
    art: "Put one mark down before you second-guess it.",
    think: "Write the first honest thought, not the polished one.",
    other: "Take one real step, however small, before you stop.",
  };

  const stageIndex = (stage, i) => `${stage}-${i}`;

  function optionStage(key, stageNum, question, note, options, field) {
    return `<fieldset class="fsp-stage" data-fsp-stage="${stageNum}" data-fsp-field="${field}" hidden>
        <legend class="fsp-stage-label accent-violet">Step ${stageNum} of 6</legend>
        <p class="fsp-question">${escapeHtml(question)}</p>
        ${note ? `<p class="fsp-note">${escapeHtml(note)}</p>` : ""}
        <div class="fsp-options" role="radiogroup" aria-label="${escapeHtml(question)}">
          ${options.map((opt, i) => `<label class="fsp-option" data-seed="${stageIndex(stageNum, i)}">
            <input type="radio" name="${field}" value="${opt.id}">
            <span class="fsp-option-label">${escapeHtml(opt.label)}</span>
            <span class="fsp-option-detail">${escapeHtml(opt.detail)}</span>
          </label>`).join("\n          ")}
        </div>
      </fieldset>`;
  }

  const stage1 = optionStage("mission", 1, "What are you creating today?", null, MISSIONS, "mission");
  const stage2 = optionStage("duration", 2, "How long feels realistic?", "Not ambitious. Realistic.", DURATIONS, "duration");
  const stage3 = optionStage("distraction", 3, "What's most likely to pull you away?", null, DISTRACTIONS, "distraction");
  const stage4 = optionStage("atmosphere", 4, "Choose your atmosphere.", "A quiet ambient tone, not music ~ something to sit underneath the work.", ATMOSPHERES, "atmosphere");

  const body = `    <section class="voa-hero voa-reveal">
      <div class="voa-hero-bg" style="--hero-glow: rgba(167,139,250,0.18);"></div>
      <div class="voa-hero-icon accent-violet">${ICONS.compass}</div>
      <div class="voa-hero-inner">
        <div class="voa-eyebrow accent-violet">A Focus Ritual</div>
        <h1 class="voa-h1">Begin your Focus Session</h1>
        <p class="voa-hero-desc">${escapeHtml(description)}</p>
        <p class="voa-hero-quote">This is a reflective ritual, not a medical or clinical tool. It does not diagnose ADHD or any other condition ~ it's a small, honest way to start.</p>
      </div>
    </section>

    <section class="voa-section voa-reveal" aria-label="Focus Session Planner">
      <div class="fsp-shell">
        <canvas id="fsp-constellation" class="fsp-constellation" aria-hidden="true"></canvas>

        <div id="fsp-welcome" class="voa-featured border-violet">
          <div>
            <div class="voa-featured-label accent-violet">Before You Begin</div>
            <h3>Five small decisions, one breath, then you begin</h3>
            <p>Each choice you make quietly becomes part of a small constellation ~ your own Focus Star, built from nothing but your own answers. At the end you'll get a Focus Card to keep, copy, or print. Nothing is saved, tracked, or sent anywhere.</p>
            <button class="voa-btn voa-btn-primary" id="fsp-start" type="button">Begin the Ritual</button>
          </div>
        </div>

        <form id="fsp-form" class="fsp-form" hidden>
          <div class="fsp-progress" aria-hidden="true"><div class="fsp-progress-bar" id="fsp-progress-bar" style="width:0%"></div></div>
${stage1}
${stage2}
${stage3}
${stage4}

          <fieldset class="fsp-stage" data-fsp-stage="5" hidden>
            <legend class="fsp-stage-label accent-violet">Step 5 of 6</legend>
            <p class="fsp-question">Take one breath.</p>
            <p class="fsp-note">In for four. Hold for four. Out for six. Then continue whenever you're ready.</p>
            <div class="fsp-breath-wrap">
              <div class="fsp-breath-circle" id="fsp-breath-circle" aria-hidden="true"></div>
            </div>
          </fieldset>

          <div class="fsp-nav">
            <button class="voa-btn voa-btn-secondary" id="fsp-back" type="button">Back</button>
            <button class="voa-btn voa-btn-primary" id="fsp-next" type="button">Continue</button>
          </div>
        </form>

        <div id="fsp-session" class="fsp-session" hidden>
          <div class="fsp-session-label accent-violet">Session in progress</div>
          <div class="fsp-timer" id="fsp-timer">25:00</div>
          <p class="fsp-session-note" id="fsp-session-note">Come back here when you're done, or let it run out on its own.</p>
          <button class="voa-btn voa-btn-secondary" id="fsp-finish-early" type="button">I'm Done</button>
        </div>

        <div id="fsp-card-wrap" class="fsp-card-wrap" hidden>
          <div class="fsp-card" id="fsp-card">
            <div class="fsp-card-eyebrow">Your Focus Star</div>
            <div class="fsp-card-star" id="fsp-card-star"></div>
            <h3 class="fsp-card-title">Today's Mission</h3>
            <p class="fsp-card-value" id="fsp-card-mission"></p>
            <div class="fsp-card-grid">
              <div><h4>Estimated Focus Time</h4><p id="fsp-card-duration"></p></div>
              <div><h4>Chosen Atmosphere</h4><p id="fsp-card-atmosphere"></p></div>
              <div><h4>Primary Distraction</h4><p id="fsp-card-distraction"></p></div>
              <div><h4>One Tiny Commitment</h4><p id="fsp-card-commitment"></p></div>
            </div>
            <p class="fsp-card-reminder" id="fsp-card-reminder"></p>
          </div>
          <div class="fsp-card-actions">
            <button class="voa-btn voa-btn-primary" id="fsp-copy" type="button">Copy Focus Card</button>
            <button class="voa-btn voa-btn-secondary" id="fsp-print" type="button">Print Focus Card</button>
            <button class="voa-btn voa-btn-secondary" id="fsp-restart" type="button">Begin Another Session</button>
          </div>
        </div>
      </div>
    </section>

    <section class="voa-section voa-reveal">
      <div class="voa-section-head"><h2 class="voa-h2">Related Pathways</h2></div>
      <div class="voa-pathways">
        <a class="voa-pathway border-violet" href="/hubs/adhd-focus/">
          <span class="voa-pathway-icon accent-violet">${ICONS.compass}</span>
          <span class="voa-pathway-text">ADHD &amp; Focus Hub</span>
        </a>
        <a class="voa-pathway border-amber" href="/hubs/dopamine-attention/">
          <span class="voa-pathway-icon accent-amber">${ICONS.pulse}</span>
          <span class="voa-pathway-text">Dopamine &amp; Attention</span>
        </a>
        <a class="voa-pathway border-cyan" href="/tools/digital-attention-audit/">
          <span class="voa-pathway-icon accent-cyan">${ICONS.pulse}</span>
          <span class="voa-pathway-text">Digital Attention Audit</span>
        </a>
      </div>
    </section>

    <section class="voa-continue voa-reveal">
      <p>Ready to go deeper on the same subject?</p>
      <div class="voa-continue-cta">
        <a class="voa-btn voa-btn-primary" href="/hubs/adhd-focus/">Explore ADHD &amp; Focus</a>
        <a class="voa-btn voa-btn-secondary" href="/tools/">Browse the Tools Library</a>
      </div>
    </section>`;

  const extraStyle = `
    .fsp-shell { position: relative; max-width: 720px; margin: 0 auto; }
    .fsp-constellation { position: absolute; inset: -4rem -2rem auto -2rem; height: 220px; width: calc(100% + 4rem); pointer-events: none; opacity: 0.9; }
    .fsp-progress { height: 4px; background: rgba(255,255,255,0.08); margin-bottom: 2.2rem; border-radius: 2px; overflow: hidden; }
    .fsp-progress-bar { height: 100%; background: linear-gradient(90deg, var(--violet), var(--cyan)); transition: width 0.4s ease; }
    .fsp-stage { border: none; padding: 0; margin: 0 0 1.5rem; }
    .fsp-stage-label { font-family: 'Rajdhani', sans-serif; font-size: 0.72rem; letter-spacing: 0.18em; text-transform: uppercase; margin-bottom: 0.9rem; padding: 0; }
    .fsp-question { font-family: 'Cinzel', serif; font-size: clamp(1.25rem, 2.8vw, 1.7rem); line-height: 1.4; color: var(--cream); margin: 0 0 0.6rem; }
    .fsp-note { font-family: 'Cormorant Garamond', serif; font-style: italic; font-size: 1.05rem; color: var(--muted); margin: 0 0 1.4rem; }
    .fsp-options { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.8rem; }
    .fsp-option { display: flex; flex-direction: column; gap: 0.3rem; border: 1px solid var(--line); padding: 1.1rem 1.2rem; cursor: pointer; transition: border-color 0.25s, background 0.25s, transform 0.25s; position: relative; }
    .fsp-option:hover { transform: translateY(-2px); border-color: rgba(167,139,250,0.4); }
    .fsp-option:has(input:checked) { border-color: var(--violet); background: rgba(167,139,250,0.08); box-shadow: 0 0 24px rgba(167,139,250,0.18); }
    .fsp-option input { position: absolute; opacity: 0; width: 1px; height: 1px; }
    .fsp-option input:focus-visible ~ .fsp-option-label { outline: 2px solid var(--violet); outline-offset: 3px; }
    .fsp-option-label { font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 0.95rem; letter-spacing: 0.03em; color: var(--cream); }
    .fsp-option-detail { font-size: 0.82rem; color: var(--muted); line-height: 1.5; }
    .fsp-nav { display: flex; justify-content: space-between; margin-top: 1rem; }

    .fsp-breath-wrap { display: flex; justify-content: center; padding: 2rem 0 1rem; }
    .fsp-breath-circle { width: 120px; height: 120px; border-radius: 50%; background: radial-gradient(circle, rgba(167,139,250,0.35), rgba(0,229,204,0.08) 70%, transparent 100%); border: 1px solid rgba(167,139,250,0.4); animation: fspBreathe 14s ease-in-out infinite; }
    @keyframes fspBreathe {
      0%   { transform: scale(0.7); box-shadow: 0 0 20px rgba(167,139,250,0.15); }
      28%  { transform: scale(1.15); box-shadow: 0 0 46px rgba(167,139,250,0.4); }
      57%  { transform: scale(1.15); box-shadow: 0 0 46px rgba(167,139,250,0.4); }
      100% { transform: scale(0.7); box-shadow: 0 0 20px rgba(167,139,250,0.15); }
    }
    @media (prefers-reduced-motion: reduce) { .fsp-breath-circle { animation: none; transform: scale(1); } }

    .fsp-session { text-align: center; padding: 3rem 0; }
    .fsp-session-label { font-family: 'Rajdhani', sans-serif; font-size: 0.75rem; letter-spacing: 0.24em; text-transform: uppercase; margin-bottom: 1rem; }
    .fsp-timer { font-family: 'Cinzel', serif; font-size: clamp(2.4rem, 8vw, 4rem); color: var(--cream); text-shadow: 0 0 30px rgba(167,139,250,0.4); margin-bottom: 0.8rem; letter-spacing: 0.04em; }
    .fsp-session-note { color: var(--muted); margin-bottom: 1.6rem; }

    .fsp-card-wrap { padding: 1rem 0; }
    .fsp-card { border: 1px solid rgba(167,139,250,0.4); background: linear-gradient(160deg, rgba(167,139,250,0.06), rgba(0,229,204,0.03)); padding: 2.4rem; text-align: center; position: relative; overflow: hidden; }
    .fsp-card-eyebrow { font-family: 'Rajdhani', sans-serif; font-size: 0.72rem; letter-spacing: 0.24em; text-transform: uppercase; color: var(--violet-light); margin-bottom: 1rem; }
    .fsp-card-star { width: 140px; height: 140px; margin: 0 auto 1.2rem; }
    .fsp-card-star svg { width: 100%; height: 100%; }
    .fsp-card-title { font-family: 'Rajdhani', sans-serif; font-size: 0.7rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--muted); margin: 0 0 0.5rem; }
    .fsp-card-value { font-family: 'Cinzel', serif; font-size: 1.5rem; color: var(--cream); margin: 0 0 1.6rem; }
    .fsp-card-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.3rem; text-align: left; margin-bottom: 1.6rem; }
    .fsp-card-grid h4 { font-family: 'Rajdhani', sans-serif; font-size: 0.68rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--violet-light); margin: 0 0 0.4rem; }
    .fsp-card-grid p { font-size: 0.95rem; color: var(--cream); margin: 0; }
    .fsp-card-reminder { font-family: 'Cormorant Garamond', serif; font-style: italic; font-size: 1.15rem; color: rgba(232,255,249,0.85); border-top: 1px solid var(--line); padding-top: 1.4rem; margin: 0; }
    .fsp-card-actions { display: flex; gap: 0.9rem; justify-content: center; flex-wrap: wrap; margin-top: 1.8rem; }

    @media (max-width: 640px) {
      .fsp-options { grid-template-columns: 1fr; }
      .fsp-card-grid { grid-template-columns: 1fr; }
      .fsp-constellation { height: 140px; }
    }

    @media print {
      body * { visibility: hidden; }
      .fsp-card, .fsp-card * { visibility: visible; }
      .fsp-card { position: absolute; top: 0; left: 0; width: 100%; border: none; background: white; color: black; }
      .fsp-card-value, .fsp-card-title, .fsp-card-grid h4, .fsp-card-grid p, .fsp-card-reminder, .fsp-card-eyebrow { color: black !important; }
    }
  `;

  const scriptBlock = `<script>
    (function () {
      var MISSIONS = ${JSON.stringify(MISSIONS)};
      var DURATIONS = ${JSON.stringify(DURATIONS)};
      var DISTRACTIONS = ${JSON.stringify(DISTRACTIONS)};
      var ATMOSPHERES = ${JSON.stringify(ATMOSPHERES)};
      var REMINDERS = ${JSON.stringify(REMINDERS)};
      var COMMITMENTS = ${JSON.stringify(COMMITMENTS)};
      var STAGES = 5;
      var current = 0;
      var answers = {};
      var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      var welcome = document.getElementById('fsp-welcome');
      var form = document.getElementById('fsp-form');
      var startBtn = document.getElementById('fsp-start');
      var backBtn = document.getElementById('fsp-back');
      var nextBtn = document.getElementById('fsp-next');
      var progressBar = document.getElementById('fsp-progress-bar');
      var sessionEl = document.getElementById('fsp-session');
      var timerEl = document.getElementById('fsp-timer');
      var sessionNote = document.getElementById('fsp-session-note');
      var finishEarlyBtn = document.getElementById('fsp-finish-early');
      var cardWrap = document.getElementById('fsp-card-wrap');
      var canvas = document.getElementById('fsp-constellation');

      function trackEvent(name, params) {
        if (typeof window.gtag === 'function') window.gtag('event', name, params || {});
      }

      // ── Constellation (deterministic points from stage+choice index, not random) ──
      function seedPoint(seed) {
        var parts = seed.split('-').map(Number);
        var stage = parts[0], idx = parts[1];
        var angle = ((stage * 67 + idx * 41) % 360) * (Math.PI / 180);
        var radius = 20 + ((stage * 13 + idx * 7) % 26);
        return { x: 50 + Math.cos(angle) * radius, y: 50 + Math.sin(angle) * radius };
      }

      function drawConstellation(target, seeds, size) {
        if (!target) return;
        var w = size || 300, h = size || 120;
        var ctx = target.getContext('2d');
        var dpr = window.devicePixelRatio || 1;
        var displayW = target.clientWidth || w, displayH = target.clientHeight || h;
        target.width = displayW * dpr;
        target.height = displayH * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, displayW, displayH);

        var points = seeds.map(function (s) {
          var p = seedPoint(s);
          return { x: (p.x / 100) * displayW, y: (p.y / 100) * displayH };
        });

        ctx.strokeStyle = 'rgba(167,139,250,0.35)';
        ctx.lineWidth = 1;
        for (var i = 1; i < points.length; i++) {
          ctx.beginPath();
          ctx.moveTo(points[i - 1].x, points[i - 1].y);
          ctx.lineTo(points[i].x, points[i].y);
          ctx.stroke();
        }
        points.forEach(function (p, i) {
          var grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 10);
          grad.addColorStop(0, 'rgba(232,255,249,0.95)');
          grad.addColorStop(1, 'rgba(167,139,250,0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'white';
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      function currentSeeds() {
        var seeds = [];
        ['mission', 'duration', 'distraction', 'atmosphere'].forEach(function (field, stageNum) {
          var checked = form.querySelector('input[name="' + field + '"]:checked');
          if (checked) {
            var label = checked.closest('.fsp-option');
            if (label) seeds.push(label.getAttribute('data-seed'));
          }
        });
        return seeds;
      }

      function updateConstellation() {
        drawConstellation(canvas, currentSeeds());
      }
      window.addEventListener('resize', function () { if (!form.hidden) updateConstellation(); });

      // ── Ambient tone (Web Audio synthesis only ~ no files, no network) ──
      var audioCtx = null, audioNodes = [];
      function stopAmbient() {
        audioNodes.forEach(function (n) { try { n.stop && n.stop(); n.disconnect && n.disconnect(); } catch (e) {} });
        audioNodes = [];
      }
      function startAmbient(kind) {
        stopAmbient();
        if (kind === 'none' || prefersReduced) return;
        try {
          audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
          var master = audioCtx.createGain();
          master.gain.value = 0.05;
          master.connect(audioCtx.destination);
          audioNodes.push(master);

          if (kind === 'space') {
            var osc1 = audioCtx.createOscillator(); osc1.type = 'sine'; osc1.frequency.value = 60;
            var osc2 = audioCtx.createOscillator(); osc2.type = 'sine'; osc2.frequency.value = 90;
            osc1.connect(master); osc2.connect(master);
            osc1.start(); osc2.start();
            audioNodes.push(osc1, osc2);
          } else if (kind === 'forest') {
            var bufferSize = 2 * audioCtx.sampleRate;
            var buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            var data = buffer.getChannelData(0);
            for (var i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
            var noise = audioCtx.createBufferSource(); noise.buffer = buffer; noise.loop = true;
            var filter = audioCtx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 500;
            noise.connect(filter); filter.connect(master);
            noise.start();
            audioNodes.push(noise, filter);
          } else if (kind === 'pulse') {
            var osc = audioCtx.createOscillator(); osc.type = 'sine'; osc.frequency.value = 110;
            var pulseGain = audioCtx.createGain();
            osc.connect(pulseGain); pulseGain.connect(master);
            osc.start();
            var t0 = audioCtx.currentTime;
            var lfo = audioCtx.createOscillator(); lfo.frequency.value = 0.9;
            var lfoGain = audioCtx.createGain(); lfoGain.gain.value = 0.5;
            lfo.connect(lfoGain); lfoGain.connect(pulseGain.gain);
            pulseGain.gain.value = 0.5;
            lfo.start();
            audioNodes.push(osc, pulseGain, lfo, lfoGain);
          }
        } catch (e) { /* Web Audio unavailable ~ silently continue without ambient tone */ }
      }
      function chime() {
        if (prefersReduced) return;
        try {
          audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
          var g = audioCtx.createGain(); g.gain.value = 0.001; g.connect(audioCtx.destination);
          [523.25, 659.25, 783.99].forEach(function (freq, i) {
            var o = audioCtx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
            var og = audioCtx.createGain();
            var start = audioCtx.currentTime + i * 0.18;
            og.gain.setValueAtTime(0, start);
            og.gain.linearRampToValueAtTime(0.08, start + 0.05);
            og.gain.exponentialRampToValueAtTime(0.0001, start + 1.4);
            o.connect(og); og.connect(audioCtx.destination);
            o.start(start); o.stop(start + 1.5);
          });
        } catch (e) {}
      }

      function showStage(i) {
        document.querySelectorAll('.fsp-stage').forEach(function (el) {
          el.hidden = Number(el.getAttribute('data-fsp-stage')) !== i + 1;
        });
        backBtn.style.visibility = i === 0 ? 'hidden' : 'visible';
        nextBtn.textContent = i === STAGES - 1 ? 'Begin' : 'Continue';
        progressBar.style.width = (((i + 1) / STAGES) * 100) + '%';
        updateConstellation();
      }

      startBtn.addEventListener('click', function () {
        trackEvent('adhd_focus_planner_start', {});
        welcome.hidden = true;
        form.hidden = false;
        showStage(0);
        form.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
      });

      backBtn.addEventListener('click', function () {
        if (current > 0) { current -= 1; showStage(current); }
      });

      nextBtn.addEventListener('click', function () {
        var isBreathStage = current === STAGES - 1;
        if (!isBreathStage) {
          var stageEl = document.querySelector('.fsp-stage[data-fsp-stage="' + (current + 1) + '"]');
          var checked = stageEl.querySelector('input:checked');
          if (!checked) {
            stageEl.style.outline = '1px solid rgba(255,179,0,0.5)';
            setTimeout(function () { stageEl.style.outline = 'none'; }, 900);
            return;
          }
          if (checked.name === 'atmosphere') startAmbient(checked.value === 'none' ? 'none' : (ATMOSPHERES.filter(function (a) { return a.id === checked.value; })[0] || {}).audio);
        }
        if (current < STAGES - 1) {
          current += 1;
          showStage(current);
        } else {
          beginSession();
        }
      });

      function collectAnswers() {
        var data = new FormData(form);
        answers.mission = MISSIONS.filter(function (m) { return m.id === data.get('mission'); })[0];
        answers.duration = DURATIONS.filter(function (d) { return d.id === data.get('duration'); })[0];
        answers.distraction = DISTRACTIONS.filter(function (d) { return d.id === data.get('distraction'); })[0];
        answers.atmosphere = ATMOSPHERES.filter(function (a) { return a.id === data.get('atmosphere'); })[0];
      }

      var timerInterval = null, endTime = null;
      function beginSession() {
        collectAnswers();
        form.hidden = true;
        sessionEl.hidden = false;
        var minutes = answers.duration.minutes;
        endTime = Date.now() + minutes * 60 * 1000;
        sessionNote.textContent = 'Creating: ' + answers.mission.label + '. Come back here when you\\'re done, or let it run out on its own.';
        updateTimer();
        timerInterval = setInterval(updateTimer, 500);
        sessionEl.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
      }

      function updateTimer() {
        var remaining = Math.max(0, endTime - Date.now());
        var mins = Math.floor(remaining / 60000);
        var secs = Math.floor((remaining % 60000) / 1000);
        timerEl.textContent = (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;
        if (remaining <= 0) {
          clearInterval(timerInterval);
          finishSession();
        }
      }

      finishEarlyBtn.addEventListener('click', function () {
        clearInterval(timerInterval);
        finishSession();
      });

      function finishSession() {
        stopAmbient();
        chime();
        sessionEl.hidden = true;
        cardWrap.hidden = false;
        renderCard();
        trackEvent('adhd_focus_planner_complete', {
          mission: answers.mission.id,
          duration_minutes: answers.duration.minutes,
          distraction: answers.distraction.id,
          atmosphere: answers.atmosphere.id
        });
        cardWrap.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
      }

      function renderCard() {
        document.getElementById('fsp-card-mission').textContent = answers.mission.label;
        document.getElementById('fsp-card-duration').textContent = answers.duration.label;
        document.getElementById('fsp-card-atmosphere').textContent = answers.atmosphere.label;
        document.getElementById('fsp-card-distraction').textContent = answers.distraction.label;
        document.getElementById('fsp-card-commitment').textContent = COMMITMENTS[answers.mission.id] || COMMITMENTS.other;
        var reminder = (REMINDERS[answers.distraction.id] || '').replace('{min}', answers.duration.minutes);
        document.getElementById('fsp-card-reminder').textContent = reminder;

        var starEl = document.getElementById('fsp-card-star');
        var seeds = currentSeeds();
        var svgPoints = seeds.map(function (s) { return seedPoint(s); });
        var lines = '';
        for (var i = 1; i < svgPoints.length; i++) {
          lines += '<line x1="' + svgPoints[i - 1].x + '" y1="' + svgPoints[i - 1].y + '" x2="' + svgPoints[i].x + '" y2="' + svgPoints[i].y + '" stroke="rgba(167,139,250,0.45)" stroke-width="0.6"/>';
        }
        var dots = svgPoints.map(function (p) {
          return '<circle cx="' + p.x + '" cy="' + p.y + '" r="2.2" fill="white"/><circle cx="' + p.x + '" cy="' + p.y + '" r="5" fill="rgba(167,139,250,0.25)"/>';
        }).join('');
        starEl.innerHTML = '<svg viewBox="0 0 100 100">' + lines + dots + '</svg>';
      }

      document.getElementById('fsp-copy').addEventListener('click', function () {
        var btn = this;
        var text = 'FOCUS CARD\\n\\nToday\\'s Mission: ' + answers.mission.label +
          '\\nEstimated Focus Time: ' + answers.duration.label +
          '\\nChosen Atmosphere: ' + answers.atmosphere.label +
          '\\nPrimary Distraction: ' + answers.distraction.label +
          '\\nOne Tiny Commitment: ' + (COMMITMENTS[answers.mission.id] || COMMITMENTS.other) +
          '\\n\\n' + (REMINDERS[answers.distraction.id] || '').replace('{min}', answers.duration.minutes);
        if (navigator.clipboard) {
          navigator.clipboard.writeText(text).then(function () {
            btn.textContent = 'Copied';
            setTimeout(function () { btn.textContent = 'Copy Focus Card'; }, 1800);
          });
        }
      });

      document.getElementById('fsp-print').addEventListener('click', function () { window.print(); });

      document.getElementById('fsp-restart').addEventListener('click', function () {
        stopAmbient();
        current = 0;
        answers = {};
        form.reset();
        cardWrap.hidden = true;
        welcome.hidden = false;
        welcome.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
      });

      form.addEventListener('submit', function (e) { e.preventDefault(); });
      window.addEventListener('beforeunload', stopAmbient);
    })();
    </script>`;

  return pageChrome({
    title, description, canonical, body: body + scriptBlock, extraStyle,
    schema: [
      ...baseSchema({ title, description, canonical }),
      breadcrumbs([{ name: "Home", url: "/" }, { name: "Resources", url: "/hubs/" }, { name: "ADHD & Focus", url: "/hubs/adhd-focus/" }, { name: title, url: canonical }]),
      { "@context": "https://schema.org", "@type": "WebApplication", name: title, description, url: absoluteUrl(canonical), applicationCategory: "LifestyleApplication", operatingSystem: "Any", isAccessibleForFree: true },
    ],
  });
}

// ── Nervous System Reset ──────────────────────────────────────────────────────
//
// A short grounding ritual, not a medical assessment. Five small decisions
// (energy, body location, need, time, environment) deterministically pick a
// short reset sequence from a fixed practice library and render a "Reset
// Mandala" ~ a concentric radial artifact built from the same five choices
// (ring count from duration, petals per ring from body location, rotation
// from energy type, color from mode). Deliberately not the Focus Star
// constellation again ~ different geometry, different payoff.

function renderNervousSystemReset() {
  const title = "Nervous System Reset";
  const description = "A short grounding ritual for whatever your nervous system is doing right now ~ five small decisions, then a personalized reset sequence and a Reset Mandala built from your own answers.";
  const canonical = "/tools/nervous-system-reset/";

  const ENERGY = [
    { id: "wired", label: "Wired", detail: "Buzzing, can't settle, mind racing." },
    { id: "foggy", label: "Foggy", detail: "Slow, unclear, hard to think straight." },
    { id: "heavy", label: "Heavy", detail: "Weighted down, low, hard to move." },
    { id: "scattered", label: "Scattered", detail: "Pulled in six directions at once." },
    { id: "tight", label: "Tight", detail: "Clenched, braced, on guard." },
    { id: "numb", label: "Numb", detail: "Flat, far away, hard to feel anything." },
  ];
  const LOCATIONS = [
    { id: "chest", label: "Chest", detail: "Tightness or fluttering right in the center." },
    { id: "stomach", label: "Stomach", detail: "The knot, the drop, the unsettled feeling." },
    { id: "shoulders", label: "Shoulders & Neck", detail: "Carried tension, up around the ears." },
    { id: "head", label: "Head", detail: "Pressure, noise, a mind that won't quiet." },
    { id: "whole-body", label: "Whole Body", detail: "It's everywhere, not one clear spot." },
    { id: "hard-to-say", label: "Hard to Say", detail: "You just know something's off." },
  ];
  const MODES = [
    { id: "calming", label: "Calming", detail: "Slow the system down.", accent: "cyan" },
    { id: "activation", label: "Activation", detail: "Gently wake energy up.", accent: "amber" },
    { id: "grounding", label: "Grounding", detail: "Come back into your body.", accent: "violet" },
    { id: "release", label: "Release", detail: "Let go of what's held.", accent: "moss" },
  ];
  const DURATIONS = [
    { id: "2", label: "2 minutes", minutes: 2, steps: 1 },
    { id: "5", label: "5 minutes", minutes: 5, steps: 2 },
    { id: "10", label: "10 minutes", minutes: 10, steps: 3 },
    { id: "20", label: "20 minutes", minutes: 20, steps: 4 },
  ];
  const ENVIRONMENTS = [
    { id: "quiet", label: "Somewhere Quiet" },
    { id: "movement", label: "Somewhere I Can Move" },
    { id: "private", label: "Somewhere Private" },
    { id: "anywhere", label: "Wherever I Am Right Now" },
  ];

  const REFLECTIONS = {
    calming: "You don't have to fix this. You just have to slow it down.",
    activation: "You're allowed to meet low energy with real movement, not more pressure.",
    grounding: "You are here, in this body, right now. That's enough to start from.",
    release: "Whatever you're carrying, you're allowed to put some of it down.",
  };
  const NEXT_RESOURCE = {
    calming: { url: "/hubs/nervous-system-regulation/", label: "Nervous System Regulation Hub" },
    activation: { url: "/tools/adhd-focus-session-planner/", label: "ADHD Focus Session Planner" },
    grounding: { url: "/hubs/meditation/", label: "Meditation Hub" },
    release: { url: "/hubs/personal-growth/", label: "Personal Growth Hub" },
  };

  const stageIndex = (stage, i) => `${stage}-${i}`;

  function optionStage(stageNum, question, note, options, field) {
    return `<fieldset class="nsr-stage" data-nsr-stage="${stageNum}" data-nsr-field="${field}" hidden>
        <legend class="nsr-stage-label accent-cyan">Step ${stageNum} of 5</legend>
        <p class="nsr-question">${escapeHtml(question)}</p>
        ${note ? `<p class="nsr-note">${escapeHtml(note)}</p>` : ""}
        <div class="nsr-options" role="radiogroup" aria-label="${escapeHtml(question)}">
          ${options.map((opt, i) => `<label class="nsr-option" data-seed="${stageIndex(stageNum, i)}">
            <input type="radio" name="${field}" value="${opt.id}">
            <span class="nsr-option-label">${escapeHtml(opt.label)}</span>
            <span class="nsr-option-detail">${escapeHtml(opt.detail)}</span>
          </label>`).join("\n          ")}
        </div>
      </fieldset>`;
  }

  const stage1 = optionStage(1, "What does your energy feel like right now?", null, ENERGY, "energy");
  const stage2 = optionStage(2, "Where do you feel it in your body?", null, LOCATIONS, "location");
  const stage3 = optionStage(3, "What do you need right now?", "There's no wrong answer ~ just what feels true.", MODES, "mode");
  const stage4 = optionStage(4, "How much time do you have?", null, DURATIONS, "duration");
  const stage5 = optionStage(5, "Choose your environment.", null, ENVIRONMENTS, "environment");

  const body = `    <section class="voa-hero voa-reveal">
      <div class="voa-hero-bg" style="--hero-glow: rgba(0,229,204,0.16);"></div>
      <div class="voa-hero-icon accent-cyan">${ICONS.rings}</div>
      <div class="voa-hero-inner">
        <div class="voa-eyebrow accent-cyan">A Grounding Ritual</div>
        <h1 class="voa-h1">Nervous System Reset</h1>
        <p class="voa-hero-desc">${escapeHtml(description)}</p>
        <p class="voa-hero-quote">This is a reflective ritual, not a medical or clinical tool. It does not diagnose anxiety, trauma, or any other condition ~ it's a small, honest way to come back to yourself.</p>
      </div>
    </section>

    <section class="voa-section voa-reveal" aria-label="Nervous System Reset">
      <div class="nsr-shell">
        <canvas id="nsr-mandala-preview" class="nsr-mandala-preview" aria-hidden="true"></canvas>

        <div id="nsr-welcome" class="voa-featured border-cyan">
          <div>
            <div class="voa-featured-label accent-cyan">Before You Begin</div>
            <h3>Five small decisions, then a reset built for you</h3>
            <p>Answer honestly, based on how you feel right this minute. At the end you'll get a short sequence to actually do, plus a Reset Mandala built from your own answers ~ yours to keep, copy, or print. Nothing is saved, tracked, or sent anywhere.</p>
            <button class="voa-btn voa-btn-primary" id="nsr-start" type="button">Begin the Reset</button>
          </div>
        </div>

        <form id="nsr-form" class="nsr-form" hidden>
          <div class="nsr-progress" aria-hidden="true"><div class="nsr-progress-bar" id="nsr-progress-bar" style="width:0%"></div></div>
${stage1}
${stage2}
${stage3}
${stage4}
${stage5}
          <div class="nsr-nav">
            <button class="voa-btn voa-btn-secondary" id="nsr-back" type="button">Back</button>
            <button class="voa-btn voa-btn-primary" id="nsr-next" type="button">Continue</button>
          </div>
        </form>

        <div id="nsr-result-wrap" class="nsr-result-wrap" hidden>
          <div class="nsr-result-grid">
            <div class="nsr-mandala-card" id="nsr-mandala-card">
              <div class="nsr-mandala-eyebrow">Your Reset Mandala</div>
              <div class="nsr-mandala-art" id="nsr-mandala-art"></div>
            </div>
            <div class="nsr-sequence-card">
              <div class="nsr-card-eyebrow">Current State</div>
              <p class="nsr-card-value" id="nsr-current-state"></p>
              <div class="nsr-card-eyebrow">Selected Reset Mode</div>
              <p class="nsr-card-value" id="nsr-mode-value"></p>
              <div class="nsr-card-eyebrow">Your Sequence</div>
              <ol class="nsr-sequence-list" id="nsr-sequence-list"></ol>
              <div class="nsr-card-eyebrow">Duration</div>
              <p class="nsr-card-value" id="nsr-duration-value"></p>
              <p class="nsr-reflection" id="nsr-reflection"></p>
              <a class="nsr-next-link" id="nsr-next-link" href="/hubs/nervous-system-regulation/">Continue into the Nervous System Regulation Hub</a>
            </div>
          </div>
          <div class="nsr-card-actions">
            <button class="voa-btn voa-btn-primary" id="nsr-copy" type="button">Copy Reset Card</button>
            <button class="voa-btn voa-btn-secondary" id="nsr-print" type="button">Print Reset Card</button>
            <button class="voa-btn voa-btn-secondary" id="nsr-restart" type="button">Start Another Reset</button>
          </div>
        </div>
      </div>
    </section>

    <section class="voa-section voa-reveal">
      <div class="voa-section-head"><h2 class="voa-h2">Related Pathways</h2></div>
      <div class="voa-pathways">
        <a class="voa-pathway border-cyan" href="/hubs/nervous-system-regulation/">
          <span class="voa-pathway-icon accent-cyan">${ICONS.rings}</span>
          <span class="voa-pathway-text">Nervous System Regulation Hub</span>
        </a>
        <a class="voa-pathway border-violet" href="/hubs/meditation/">
          <span class="voa-pathway-icon accent-violet">${ICONS.lotus}</span>
          <span class="voa-pathway-text">Meditation Hub</span>
        </a>
        <a class="voa-pathway border-amber" href="/tools/adhd-focus-session-planner/">
          <span class="voa-pathway-icon accent-amber">${ICONS.compass}</span>
          <span class="voa-pathway-text">ADHD Focus Session Planner</span>
        </a>
      </div>
    </section>

    <section class="voa-continue voa-reveal">
      <p>Ready to go deeper on the same subject?</p>
      <div class="voa-continue-cta">
        <a class="voa-btn voa-btn-primary" href="/hubs/nervous-system-regulation/">Explore Nervous System Regulation</a>
        <a class="voa-btn voa-btn-secondary" href="/tools/">Browse the Tools Library</a>
      </div>
    </section>`;

  const extraStyle = `
    .nsr-shell { position: relative; max-width: 720px; margin: 0 auto; }
    .nsr-mandala-preview { position: absolute; inset: -3rem -1rem auto -1rem; height: 180px; width: calc(100% + 2rem); pointer-events: none; opacity: 0.85; }
    .nsr-progress { height: 4px; background: rgba(255,255,255,0.08); margin-bottom: 2.2rem; border-radius: 2px; overflow: hidden; }
    .nsr-progress-bar { height: 100%; background: linear-gradient(90deg, var(--cyan), var(--violet)); transition: width 0.4s ease; }
    .nsr-stage { border: none; padding: 0; margin: 0 0 1.5rem; }
    .nsr-stage-label { font-family: 'Rajdhani', sans-serif; font-size: 0.72rem; letter-spacing: 0.18em; text-transform: uppercase; margin-bottom: 0.9rem; padding: 0; }
    .nsr-question { font-family: 'Cinzel', serif; font-size: clamp(1.25rem, 2.8vw, 1.7rem); line-height: 1.4; color: var(--cream); margin: 0 0 0.6rem; }
    .nsr-note { font-family: 'Cormorant Garamond', serif; font-style: italic; font-size: 1.05rem; color: var(--muted); margin: 0 0 1.4rem; }
    .nsr-options { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.8rem; }
    .nsr-option { display: flex; flex-direction: column; gap: 0.3rem; border: 1px solid var(--line); padding: 1.1rem 1.2rem; cursor: pointer; transition: border-color 0.25s, background 0.25s, transform 0.25s; position: relative; }
    .nsr-option:hover { transform: translateY(-2px); border-color: rgba(0,229,204,0.4); }
    .nsr-option:has(input:checked) { border-color: var(--cyan); background: rgba(0,229,204,0.08); box-shadow: 0 0 24px rgba(0,229,204,0.18); }
    .nsr-option input { position: absolute; opacity: 0; width: 1px; height: 1px; }
    .nsr-option input:focus-visible ~ .nsr-option-label { outline: 2px solid var(--cyan); outline-offset: 3px; }
    .nsr-option-label { font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 0.95rem; letter-spacing: 0.03em; color: var(--cream); }
    .nsr-option-detail { font-size: 0.82rem; color: var(--muted); line-height: 1.5; }
    .nsr-nav { display: flex; justify-content: space-between; margin-top: 1rem; }

    .nsr-result-wrap { padding: 1rem 0; }
    .nsr-result-grid { display: grid; grid-template-columns: 1fr 1.2fr; gap: 1.5rem; align-items: start; }
    .nsr-mandala-card { border: 1px solid rgba(0,229,204,0.35); background: radial-gradient(circle, rgba(0,229,204,0.06), transparent 70%); padding: 1.5rem; text-align: center; }
    .nsr-mandala-eyebrow { font-family: 'Rajdhani', sans-serif; font-size: 0.68rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--cyan-light); margin-bottom: 1rem; }
    .nsr-mandala-art { width: 100%; aspect-ratio: 1; }
    .nsr-mandala-art svg { width: 100%; height: 100%; }
    .nsr-sequence-card { border: 1px solid var(--line); background: var(--panel); padding: 1.5rem; }
    .nsr-card-eyebrow { font-family: 'Rajdhani', sans-serif; font-size: 0.68rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--cyan-light); margin: 1rem 0 0.4rem; }
    .nsr-card-eyebrow:first-child { margin-top: 0; }
    .nsr-card-value { font-family: 'Cinzel', serif; font-size: 1.1rem; color: var(--cream); margin: 0; }
    .nsr-sequence-list { margin: 0; padding-left: 1.2rem; color: var(--cream); font-size: 0.95rem; line-height: 1.7; }
    .nsr-sequence-list li { margin-bottom: 0.4rem; }
    .nsr-reflection { font-family: 'Cormorant Garamond', serif; font-style: italic; font-size: 1.1rem; color: rgba(232,255,249,0.85); border-top: 1px solid var(--line); padding-top: 1.2rem; margin-top: 1.2rem; }
    .nsr-next-link { display: inline-block; margin-top: 1rem; font-family: 'Rajdhani', sans-serif; font-size: 0.8rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--cyan); }
    .nsr-card-actions { display: flex; gap: 0.9rem; justify-content: center; flex-wrap: wrap; margin-top: 1.8rem; }

    @media (max-width: 700px) {
      .nsr-options { grid-template-columns: 1fr; }
      .nsr-result-grid { grid-template-columns: 1fr; }
      .nsr-mandala-preview { height: 120px; }
    }

    @media print {
      body * { visibility: hidden; }
      .nsr-sequence-card, .nsr-sequence-card * { visibility: visible; }
      .nsr-sequence-card { position: absolute; top: 0; left: 0; width: 100%; border: none; background: white; color: black; }
      .nsr-card-value, .nsr-card-eyebrow, .nsr-sequence-list, .nsr-reflection { color: black !important; }
    }
  `;

  const scriptBlock = `<script>
    (function () {
      var ENERGY = ${JSON.stringify(ENERGY)};
      var LOCATIONS = ${JSON.stringify(LOCATIONS)};
      var MODES = ${JSON.stringify(MODES)};
      var DURATIONS = ${JSON.stringify(DURATIONS)};
      var ENVIRONMENTS = ${JSON.stringify(ENVIRONMENTS)};
      var REFLECTIONS = ${JSON.stringify(REFLECTIONS)};
      var NEXT_RESOURCE = ${JSON.stringify(NEXT_RESOURCE)};

      var STEP_LIBRARY = {
        calming: [
          { text: "Breathe out longer than you breathe in ~ in for 4, out for 7.", envs: "all" },
          { text: "Rest one hand on your chest and one on your belly. Feel them rise and fall.", envs: "all" },
          { text: "Soften your jaw, drop your shoulders, unclench your hands.", envs: "all" },
          { text: "Hum low in your throat on the exhale, or let out one long sigh.", envs: ["private", "movement"] }
        ],
        activation: [
          { text: "Roll your shoulders back and shake out your hands.", envs: "all" },
          { text: "Stand up and stretch both arms toward the ceiling.", envs: ["movement", "private", "anywhere"] },
          { text: "Splash cool water on your wrists, or press something cold to your skin.", envs: ["private", "anywhere"] },
          { text: "Play one upbeat song and move for sixty seconds, however that looks for you.", envs: ["movement", "private"] }
        ],
        grounding: [
          { text: "Name 5 things you can actually see around you right now.", envs: "all" },
          { text: "Press your feet flat into the floor and notice the contact.", envs: "all" },
          { text: "Hold something solid in your hands for 10 seconds. Notice its weight and texture.", envs: "all" },
          { text: "Notice the temperature of the air on your skin.", envs: "all" }
        ],
        release: [
          { text: "Clench your fists tight for 5 seconds, then let them go completely.", envs: "all" },
          { text: "Shake out your whole body for 15 seconds, like you are shaking off water.", envs: ["movement", "private"] },
          { text: "Sigh out loud, three times, longer and heavier each time.", envs: ["private", "movement"] },
          { text: "Write one true sentence about how you actually feel right now.", envs: ["quiet", "private", "anywhere"] }
        ]
      };
      var MODE_COLOR = { calming: "0,229,204", activation: "255,179,0", grounding: "167,139,250", release: "34,192,106" };

      var STAGES = 5;
      var current = 0;
      var answers = {};
      var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      var welcome = document.getElementById('nsr-welcome');
      var form = document.getElementById('nsr-form');
      var startBtn = document.getElementById('nsr-start');
      var backBtn = document.getElementById('nsr-back');
      var nextBtn = document.getElementById('nsr-next');
      var progressBar = document.getElementById('nsr-progress-bar');
      var resultWrap = document.getElementById('nsr-result-wrap');
      var previewCanvas = document.getElementById('nsr-mandala-preview');

      function trackEvent(name, params) {
        var payload = Object.assign({ tool_id: 'nervous-system-reset' }, params || {});
        if (typeof window.gtag === 'function') window.gtag('event', name, payload);
      }

      function selectedIndexes() {
        var idx = {};
        ['energy', 'location', 'mode', 'duration', 'environment'].forEach(function (field, stageNum) {
          var checked = form.querySelector('input[name="' + field + '"]:checked');
          idx[field] = checked ? checked.closest('.nsr-option').getAttribute('data-seed') : null;
        });
        return idx;
      }

      // ── Reset Mandala (concentric radial rings, not a constellation) ──
      function drawMandala(target, params, size) {
        if (!target) return;
        var w = size || target.clientWidth || 200, h = size || target.clientHeight || 200;
        var ctx = target.getContext('2d');
        var dpr = window.devicePixelRatio || 1;
        target.width = w * dpr;
        target.height = h * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);

        var cx = w / 2, cy = h / 2;
        var maxRadius = Math.min(w, h) / 2 - 16;
        var color = MODE_COLOR[params.mode] || MODE_COLOR.calming;

        for (var ring = 0; ring < params.rings; ring++) {
          var radius = maxRadius * ((ring + 1) / params.rings);
          var petals = params.petals + ring * 2;
          var rotation = params.rotation + ring * (Math.PI / params.rings);
          for (var p = 0; p < petals; p++) {
            var angle = rotation + (p / petals) * Math.PI * 2;
            var x = cx + Math.cos(angle) * radius;
            var y = cy + Math.sin(angle) * radius;
            var petalSize = 2.4 + (params.rings - ring) * 0.6;
            var grad = ctx.createRadialGradient(x, y, 0, x, y, petalSize * 2.2);
            grad.addColorStop(0, 'rgba(' + color + ',0.9)');
            grad.addColorStop(1, 'rgba(' + color + ',0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(x, y, petalSize * 2.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.beginPath();
            ctx.arc(x, y, petalSize * 0.4, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.strokeStyle = 'rgba(' + color + ',0.25)';
          ctx.lineWidth = 0.75;
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      function mandalaParamsFromAnswers() {
        var idx = selectedIndexes();
        var durationIdx = idx.duration ? Number(idx.duration.split('-')[1]) : 0;
        var locationIdx = idx.location ? Number(idx.location.split('-')[1]) : 0;
        var energyIdx = idx.energy ? Number(idx.energy.split('-')[1]) : 0;
        var modeChecked = form.querySelector('input[name="mode"]:checked');
        return {
          rings: durationIdx + 1,
          petals: 5 + locationIdx,
          rotation: energyIdx * (Math.PI * 2 / 6),
          mode: modeChecked ? modeChecked.value : 'calming'
        };
      }

      function updatePreview() {
        if (form.hidden) return;
        drawMandala(previewCanvas, mandalaParamsFromAnswers());
      }
      window.addEventListener('resize', updatePreview);

      function showStage(i) {
        document.querySelectorAll('.nsr-stage').forEach(function (el) {
          el.hidden = Number(el.getAttribute('data-nsr-stage')) !== i + 1;
        });
        backBtn.style.visibility = i === 0 ? 'hidden' : 'visible';
        nextBtn.textContent = i === STAGES - 1 ? 'Receive My Reset' : 'Continue';
        progressBar.style.width = (((i + 1) / STAGES) * 100) + '%';
        updatePreview();
      }

      startBtn.addEventListener('click', function () {
        trackEvent('experience_start', {});
        welcome.hidden = true;
        form.hidden = false;
        showStage(0);
        form.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
      });

      backBtn.addEventListener('click', function () {
        if (current > 0) { current -= 1; showStage(current); }
      });

      nextBtn.addEventListener('click', function () {
        var fields = ['energy', 'location', 'mode', 'duration', 'environment'];
        var stageEl = document.querySelector('.nsr-stage[data-nsr-stage="' + (current + 1) + '"]');
        var checked = stageEl.querySelector('input:checked');
        if (!checked) {
          stageEl.style.outline = '1px solid rgba(255,179,0,0.5)';
          setTimeout(function () { stageEl.style.outline = 'none'; }, 900);
          return;
        }
        updatePreview();
        if (current < STAGES - 1) {
          current += 1;
          showStage(current);
        } else {
          finish();
        }
      });

      function pickSequence(mode, envId, stepCount) {
        var library = STEP_LIBRARY[mode] || STEP_LIBRARY.calming;
        var compatible = library.filter(function (step) { return step.envs === 'all' || step.envs.indexOf(envId) !== -1; });
        var chosen = compatible.slice(0, stepCount);
        if (chosen.length < stepCount) {
          library.forEach(function (step) {
            if (chosen.length >= stepCount) return;
            if (chosen.indexOf(step) === -1) chosen.push(step);
          });
        }
        return chosen.slice(0, stepCount);
      }

      function finish() {
        var data = new FormData(form);
        answers.energy = ENERGY.filter(function (e) { return e.id === data.get('energy'); })[0];
        answers.location = LOCATIONS.filter(function (l) { return l.id === data.get('location'); })[0];
        answers.mode = MODES.filter(function (m) { return m.id === data.get('mode'); })[0];
        answers.duration = DURATIONS.filter(function (d) { return d.id === data.get('duration'); })[0];
        answers.environment = ENVIRONMENTS.filter(function (e) { return e.id === data.get('environment'); })[0];

        var sequence = pickSequence(answers.mode.id, answers.environment.id, answers.duration.steps);

        document.getElementById('nsr-current-state').textContent = answers.energy.label + ' in the ' + answers.location.label.toLowerCase();
        document.getElementById('nsr-mode-value').textContent = answers.mode.label;
        document.getElementById('nsr-duration-value').textContent = answers.duration.label;
        var list = document.getElementById('nsr-sequence-list');
        list.innerHTML = sequence.map(function (s) { return '<li>' + s.text + '</li>'; }).join('');
        document.getElementById('nsr-reflection').textContent = REFLECTIONS[answers.mode.id];
        var nextResource = NEXT_RESOURCE[answers.mode.id];
        var nextLink = document.getElementById('nsr-next-link');
        nextLink.href = nextResource.url;
        nextLink.textContent = 'Continue into ' + nextResource.label;
        nextLink.addEventListener('click', function () {
          trackEvent('related_resource_click', { destination: nextResource.url });
        });

        var params = mandalaParamsFromAnswers();
        drawMandala(document.getElementById('nsr-mandala-art'), params, 320);
        // Re-render as a static <canvas> element sized for the result card
        var artHost = document.getElementById('nsr-mandala-art');
        artHost.innerHTML = '';
        var artCanvas = document.createElement('canvas');
        artCanvas.width = 320; artCanvas.height = 320;
        artCanvas.style.width = '100%'; artCanvas.style.height = '100%';
        artHost.appendChild(artCanvas);
        drawMandala(artCanvas, params, 320);

        form.hidden = true;
        resultWrap.hidden = false;
        trackEvent('experience_complete', {
          energy: answers.energy.id,
          location: answers.location.id,
          mode: answers.mode.id,
          duration_minutes: answers.duration.minutes,
          environment: answers.environment.id
        });
        resultWrap.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
      }

      document.getElementById('nsr-copy').addEventListener('click', function () {
        var btn = this;
        var sequenceText = Array.prototype.map.call(document.querySelectorAll('#nsr-sequence-list li'), function (li, i) {
          return (i + 1) + '. ' + li.textContent;
        }).join('\\n');
        var text = 'RESET CARD\\n\\nCurrent State: ' + answers.energy.label + ' in the ' + answers.location.label.toLowerCase() +
          '\\nSelected Reset Mode: ' + answers.mode.label +
          '\\nDuration: ' + answers.duration.label +
          '\\n\\nYour Sequence:\\n' + sequenceText +
          '\\n\\n' + REFLECTIONS[answers.mode.id];
        if (navigator.clipboard) {
          navigator.clipboard.writeText(text).then(function () {
            trackEvent('artifact_copy', { mode: answers.mode.id });
            btn.textContent = 'Copied';
            setTimeout(function () { btn.textContent = 'Copy Reset Card'; }, 1800);
          });
        }
      });

      document.getElementById('nsr-print').addEventListener('click', function () { window.print(); });

      document.getElementById('nsr-restart').addEventListener('click', function () {
        current = 0;
        answers = {};
        form.reset();
        resultWrap.hidden = true;
        welcome.hidden = false;
        welcome.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
      });

      form.addEventListener('submit', function (e) { e.preventDefault(); });
    })();
    </script>`;

  return pageChrome({
    title, description, canonical, body: body + scriptBlock, extraStyle,
    schema: [
      ...baseSchema({ title, description, canonical }),
      breadcrumbs([{ name: "Home", url: "/" }, { name: "Resources", url: "/hubs/" }, { name: "Nervous System Regulation", url: "/hubs/nervous-system-regulation/" }, { name: title, url: canonical }]),
      { "@context": "https://schema.org", "@type": "WebApplication", name: title, description, url: absoluteUrl(canonical), applicationCategory: "LifestyleApplication", operatingSystem: "Any", isAccessibleForFree: true },
    ],
  });
}

function main() {
  const clusterData = loadTopicClusters();
  const hubs = readJson("static/_data/authority-hubs.json", { hubs: [] }).hubs || [];
  const assets = readJson("static/_data/authority-assets.json", { assets: [] }).assets || [];
  const hubsBySlug = Object.fromEntries(hubs.map(h => [h.slug, h]));
  const posts = [
    ...readJson("static/_data/boom-posts.json", []).map(post => normalizePost(post, "boom", clusterData)),
    ...readJson("static/_data/matt-posts.json", []).map(post => normalizePost(post, "matt", clusterData)),
  ];

  writePage("static/hubs/index.html", renderHubsIndex(hubs, assets));
  for (const hub of hubs) {
    const related = sortPosts(posts.filter(post => matchesHub(post, hub)));
    writePage(`static/hubs/${hub.slug}/index.html`, renderHub(hub, related, assets, hubsBySlug));
  }

  writePage("static/tools/index.html", renderToolsIndex(assets));
  writePage("static/tools/digital-attention-audit/index.html", renderDigitalAttentionAudit());
  writePage("static/tools/adhd-focus-session-planner/index.html", renderAdhdFocusSessionPlanner());
  writePage("static/tools/nervous-system-reset/index.html", renderNervousSystemReset());
}

main();
