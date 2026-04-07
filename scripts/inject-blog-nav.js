#!/usr/bin/env node
/**
 * inject-blog-nav.js — Add full site navigation to all Forest Temple & Boom Frequency pages
 *
 * Replaces existing <nav>…</nav> with a two-row nav:
 *   Row 1: VOA logo + full site links + hamburger
 *   Row 2: breadcrumb (kept from original)
 *
 * Forest Temple uses amber (#ffb300), Boom Frequency uses cyan (#00e5ff).
 * Fixed position for post pages, relative for lane index pages.
 */
import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, "..");

// ── CSS snippets ──────────────────────────────────────────────────────────────

const AMBER_CSS = `
/* ── Site Nav (injected by inject-blog-nav.js) ───────────────── */
nav.site-nav { display: block !important; padding: 0 !important;
  position: fixed !important; top: 0; left: 0; right: 0; z-index: 200 !important;
  background: rgba(2,10,8,0.97) !important;
  border-bottom: 1px solid rgba(255,179,0,0.12) !important;
  backdrop-filter: blur(8px); flex-direction: unset !important; }
.site-nav-main { display: flex; align-items: center;
  justify-content: space-between; min-height: 62px; padding: 1.3rem 3rem;
  border-bottom: 1px solid rgba(255,179,0,0.06); }
a.site-nav-logo { font-family: 'Cinzel Decorative', serif; font-size: 1.1rem;
  color: #ffb300 !important; text-decoration: none; letter-spacing: 0.15em;
  text-shadow: 0 0 15px rgba(255,179,0,0.3); }
.site-nav-links { display: flex; gap: 2.5rem; list-style: none;
  align-items: center; }
.site-nav-logo, .site-nav-links a { line-height: 1; }
.site-nav-links a { font-family: 'Rajdhani', sans-serif; font-size: 0.8rem;
  letter-spacing: 0.2em; text-transform: uppercase;
  color: rgba(208,255,248,0.55); text-decoration: none;
  transition: color 0.2s; position: relative; }
.site-nav-links a::after { content: ''; position: absolute; bottom: -3px;
  left: 0; width: 0; height: 1px; background: #ffb300; transition: width 0.3s; }
.site-nav-links a:hover, .site-nav-links a.active { color: #ffb300; }
.site-nav-links a:hover::after, .site-nav-links a.active::after { width: 100%; }
.site-nav-links a.nav-aura-link { color: #ffb300 !important;
  border: 1px solid rgba(255,179,0,0.35); padding: 0.25rem 0.7rem;
  border-radius: 2px; }
.site-nav-links a.nav-aura-link::after { display: none !important; }
.site-nav-links a.nav-aura-link:hover { background: rgba(255,179,0,0.08); }
.site-nav-links a.nav-guide-link { color: #22c06a !important;
  border: 1px solid rgba(34,192,106,0.42); padding: 0.3rem 0.8rem;
  border-radius: 2px; background: transparent; box-shadow: none; }
.site-nav-links a.nav-guide-link::after { display: none !important; }
.site-nav-links a.nav-guide-link:hover { background: rgba(34,192,106,0.08); box-shadow: 0 0 12px rgba(34,192,106,0.18); }
.site-nav-breadcrumb { display: flex; align-items: center; gap: 0.45rem;
  min-height: 32px; padding: 0.28rem 3rem; }
.site-nav-breadcrumb a { font-family: 'Rajdhani', sans-serif; font-size: 0.68rem;
  letter-spacing: 0.15em; text-transform: uppercase;
  color: rgba(208,255,248,0.4); text-decoration: none; transition: color 0.2s; }
.site-nav-breadcrumb a:hover { color: #ffb300; }
.site-nav-breadcrumb .nav-sep { font-size: 0.6rem; color: rgba(208,255,248,0.2); }
.site-nav-breadcrumb .nav-current { font-family: 'Rajdhani', sans-serif;
  font-size: 0.68rem; letter-spacing: 0.15em; text-transform: uppercase;
  color: #ffb300; }
.site-nav-hamburger { display: none; flex-direction: column; gap: 5px;
  cursor: pointer; background: none; border: none; padding: 4px; }
.site-nav-hamburger span { display: block; width: 22px; height: 2px;
  background: rgba(208,255,248,0.7); border-radius: 1px; transition: all 0.3s; }
.site-nav-hamburger.open span:nth-child(1) { transform: rotate(45deg) translate(4px,4px); }
.site-nav-hamburger.open span:nth-child(2) { opacity: 0; }
.site-nav-hamburger.open span:nth-child(3) { transform: rotate(-45deg) translate(4px,-4px); }
@media(max-width:768px) {
  .site-nav-main { padding: 0.75rem 1.2rem; }
  .site-nav-hamburger { display: flex; }
  .site-nav-links { display: none; flex-direction: column; gap: 0; width: 100%;
    background: rgba(2,10,8,0.98); border-bottom: 1px solid rgba(255,179,0,0.12);
    padding: 0.5rem 0; }
  .site-nav-links.open { display: flex; }
  .site-nav-links li { width: 100%; }
  .site-nav-links a { display: block; padding: 0.65rem 1.5rem; font-size: 0.8rem; }
  .site-nav-links a.nav-aura-link { margin: 0.3rem 1.2rem; display: inline-block; }
  .site-nav-breadcrumb { padding: 0.35rem 1.2rem; flex-wrap: wrap; }
}`;

const CYAN_CSS = `
/* ── Site Nav (injected by inject-blog-nav.js) ───────────────── */
nav.site-nav { display: block !important; padding: 0 !important;
  position: fixed !important; top: 0; left: 0; right: 0; z-index: 200 !important;
  background: rgba(1,13,16,0.97) !important;
  border-bottom: 1px solid rgba(0,229,255,0.12) !important;
  backdrop-filter: blur(8px); flex-direction: unset !important; }
.site-nav-main { display: flex; align-items: center;
  justify-content: space-between; min-height: 62px; padding: 1.3rem 3rem;
  border-bottom: 1px solid rgba(0,229,255,0.06); }
a.site-nav-logo { font-family: 'Cinzel Decorative', serif; font-size: 1.1rem;
  color: #00e5ff !important; text-decoration: none; letter-spacing: 0.15em;
  text-shadow: 0 0 15px rgba(0,229,255,0.3); }
.site-nav-links { display: flex; gap: 2.5rem; list-style: none;
  align-items: center; }
.site-nav-logo, .site-nav-links a { line-height: 1; }
.site-nav-links a { font-family: 'Rajdhani', sans-serif; font-size: 0.8rem;
  letter-spacing: 0.2em; text-transform: uppercase;
  color: rgba(207,246,255,0.55); text-decoration: none;
  transition: color 0.2s; position: relative; }
.site-nav-links a::after { content: ''; position: absolute; bottom: -3px;
  left: 0; width: 0; height: 1px; background: #00e5ff; transition: width 0.3s; }
.site-nav-links a:hover, .site-nav-links a.active { color: #00e5ff; }
.site-nav-links a:hover::after, .site-nav-links a.active::after { width: 100%; }
.site-nav-links a.nav-aura-link { color: #00e5ff !important;
  border: 1px solid rgba(0,229,255,0.35); padding: 0.25rem 0.7rem;
  border-radius: 2px; }
.site-nav-links a.nav-aura-link::after { display: none !important; }
.site-nav-links a.nav-aura-link:hover { background: rgba(0,229,255,0.08); }
.site-nav-links a.nav-guide-link { color: #22c06a !important;
  border: 1px solid rgba(34,192,106,0.42); padding: 0.3rem 0.8rem;
  border-radius: 2px; background: transparent; box-shadow: none; }
.site-nav-links a.nav-guide-link::after { display: none !important; }
.site-nav-links a.nav-guide-link:hover { background: rgba(34,192,106,0.08); box-shadow: 0 0 12px rgba(34,192,106,0.18); }
.site-nav-breadcrumb { display: flex; align-items: center; gap: 0.45rem;
  min-height: 32px; padding: 0.28rem 3rem; }
.site-nav-breadcrumb a { font-family: 'Rajdhani', sans-serif; font-size: 0.68rem;
  letter-spacing: 0.15em; text-transform: uppercase;
  color: rgba(207,246,255,0.4); text-decoration: none; transition: color 0.2s; }
.site-nav-breadcrumb a:hover { color: #00e5ff; }
.site-nav-breadcrumb .nav-sep { font-size: 0.6rem; color: rgba(207,246,255,0.2); }
.site-nav-breadcrumb .nav-current { font-family: 'Rajdhani', sans-serif;
  font-size: 0.68rem; letter-spacing: 0.15em; text-transform: uppercase;
  color: #00e5ff; }
.site-nav-hamburger { display: none; flex-direction: column; gap: 5px;
  cursor: pointer; background: none; border: none; padding: 4px; }
.site-nav-hamburger span { display: block; width: 22px; height: 2px;
  background: rgba(207,246,255,0.7); border-radius: 1px; transition: all 0.3s; }
.site-nav-hamburger.open span:nth-child(1) { transform: rotate(45deg) translate(4px,4px); }
.site-nav-hamburger.open span:nth-child(2) { opacity: 0; }
.site-nav-hamburger.open span:nth-child(3) { transform: rotate(-45deg) translate(4px,-4px); }
@media(max-width:768px) {
  .site-nav-main { padding: 0.75rem 1.2rem; }
  .site-nav-hamburger { display: flex; }
  .site-nav-links { display: none; flex-direction: column; gap: 0; width: 100%;
    background: rgba(1,13,16,0.98); border-bottom: 1px solid rgba(0,229,255,0.12);
    padding: 0.5rem 0; }
  .site-nav-links.open { display: flex; }
  .site-nav-links li { width: 100%; }
  .site-nav-links a { display: block; padding: 0.65rem 1.5rem; font-size: 0.8rem; }
  .site-nav-links a.nav-aura-link { margin: 0.3rem 1.2rem; display: inline-block; }
  .site-nav-breadcrumb { padding: 0.35rem 1.2rem; flex-wrap: wrap; }
}`;

// ── JS to inject ──────────────────────────────────────────────────────────────

const TOGGLE_JS = `
<script>
function toggleSiteNav() {
  document.getElementById('siteNavLinks').classList.toggle('open');
  document.getElementById('siteNavHamburger').classList.toggle('open');
}
</script>`;

// ── Nav HTML builders ─────────────────────────────────────────────────────────

function mattIndexNav() {
  return `<nav class="site-nav site-nav--matt">
  <div class="site-nav-main">
    <a href="/" class="site-nav-logo">VOA</a>
    <button class="site-nav-hamburger" id="siteNavHamburger" onclick="toggleSiteNav()" aria-label="Menu">
      <span></span><span></span><span></span>
    </button>
    <ul class="site-nav-links" id="siteNavLinks">
      <li><a href="/">Home</a></li>
      <li><a href="/blog/">Blog</a></li>
      <li><a href="/blog/matt/" class="active">Forest Temple</a></li>
      <li><a href="/earthstar/">EarthStar ✦</a></li>
      <li><a href="/art-store/">Art Store</a></li>
      <li><a href="/field-guide/" class="nav-guide-link">Free Guide &#10022;</a></li>
      <li><a href="/aura/" class="nav-aura-link">AURA ✦</a></li>
      <li><a href="/portfolio/">Portfolio</a></li>
    </ul>
  </div>
  <div class="site-nav-breadcrumb">
    <a href="/">VOA</a>
    <span class="nav-sep">/</span>
    <a href="/blog/">Blog</a>
    <span class="nav-sep">/</span>
    <span class="nav-current">Forest Temple</span>
  </div>
</nav>`;
}

function mattPostNav() {
  return `<nav class="site-nav site-nav--matt">
  <div class="site-nav-main">
    <a href="/" class="site-nav-logo">VOA</a>
    <button class="site-nav-hamburger" id="siteNavHamburger" onclick="toggleSiteNav()" aria-label="Menu">
      <span></span><span></span><span></span>
    </button>
    <ul class="site-nav-links" id="siteNavLinks">
      <li><a href="/">Home</a></li>
      <li><a href="/blog/">Blog</a></li>
      <li><a href="/blog/matt/" class="active">Forest Temple</a></li>
      <li><a href="/earthstar/">EarthStar ✦</a></li>
      <li><a href="/art-store/">Art Store</a></li>
      <li><a href="/field-guide/" class="nav-guide-link">Free Guide &#10022;</a></li>
      <li><a href="/aura/" class="nav-aura-link">AURA ✦</a></li>
      <li><a href="/portfolio/">Portfolio</a></li>
    </ul>
  </div>
  <div class="site-nav-breadcrumb">
    <a href="/">VOA</a>
    <span class="nav-sep">/</span>
    <a href="/blog/">Blog</a>
    <span class="nav-sep">/</span>
    <a href="/blog/matt/">Forest Temple</a>
  </div>
</nav>`;
}

function boomIndexNav() {
  return `<nav class="site-nav site-nav--boom">
  <div class="site-nav-main">
    <a href="/" class="site-nav-logo">VOA</a>
    <button class="site-nav-hamburger" id="siteNavHamburger" onclick="toggleSiteNav()" aria-label="Menu">
      <span></span><span></span><span></span>
    </button>
    <ul class="site-nav-links" id="siteNavLinks">
      <li><a href="/">Home</a></li>
      <li><a href="/blog/">Blog</a></li>
      <li><a href="/blog/boom/" class="active">Boom Frequency ⚡</a></li>
      <li><a href="/earthstar/">EarthStar ✦</a></li>
      <li><a href="/art-store/">Art Store</a></li>
      <li><a href="/field-guide/" class="nav-guide-link">Free Guide &#10022;</a></li>
      <li><a href="/aura/" class="nav-aura-link">AURA ✦</a></li>
      <li><a href="/portfolio/">Portfolio</a></li>
    </ul>
  </div>
  <div class="site-nav-breadcrumb">
    <a href="/">VOA</a>
    <span class="nav-sep">/</span>
    <a href="/blog/">Blog</a>
    <span class="nav-sep">/</span>
    <span class="nav-current">Boom Frequency</span>
  </div>
</nav>`;
}

function boomPostNav() {
  return `<nav class="site-nav site-nav--boom">
  <div class="site-nav-main">
    <a href="/" class="site-nav-logo">VOA</a>
    <button class="site-nav-hamburger" id="siteNavHamburger" onclick="toggleSiteNav()" aria-label="Menu">
      <span></span><span></span><span></span>
    </button>
    <ul class="site-nav-links" id="siteNavLinks">
      <li><a href="/">Home</a></li>
      <li><a href="/blog/">Blog</a></li>
      <li><a href="/blog/boom/" class="active">Boom Frequency ⚡</a></li>
      <li><a href="/earthstar/">EarthStar ✦</a></li>
      <li><a href="/art-store/">Art Store</a></li>
      <li><a href="/field-guide/" class="nav-guide-link">Free Guide &#10022;</a></li>
      <li><a href="/aura/" class="nav-aura-link">AURA ✦</a></li>
      <li><a href="/portfolio/">Portfolio</a></li>
    </ul>
  </div>
  <div class="site-nav-breadcrumb">
    <a href="/">VOA</a>
    <span class="nav-sep">/</span>
    <a href="/blog/">Blog</a>
    <span class="nav-sep">/</span>
    <a href="/blog/boom/">Boom Frequency</a>
  </div>
</nav>`;
}

// ── File processor ────────────────────────────────────────────────────────────

function processFile(filePath, lane, isIndex) {
  let html = fs.readFileSync(filePath, "utf8");

  // Skip files already processed (CSS marker present)
  if (html.includes("inject-blog-nav.js")) {
    console.log("  (skipped — already processed)", path.relative(ROOT, filePath));
    return false;
  }

  // 1. Replace <nav>...</nav> — handle both single-line and multi-line
  const navBlock = isIndex
    ? (lane === "matt" ? mattIndexNav() : boomIndexNav())
    : (lane === "matt" ? mattPostNav()  : boomPostNav());

  // Match <nav> ... </nav> (greedy, handles any whitespace/newlines)
  html = html.replace(/<nav>[\s\S]*?<\/nav>/, navBlock);

  // 2. Inject nav CSS before </style>
  const css = lane === "matt" ? AMBER_CSS : CYAN_CSS;
  html = html.replace("</style>", css + "\n</style>");

  // 3. For post pages: bump post-hero top padding to clear the taller two-row nav
  if (!isIndex) {
    // Desktop: 9rem → 12rem  (also handles "9rem 4rem 4rem" pattern)
    html = html.replace(/padding\s*:\s*9rem(\s+\S)/g, "padding:12rem$1");
    // Mobile media query: 7rem → 10rem
    html = html.replace(/\.post-hero\s*\{padding:7rem/g, ".post-hero{padding:10rem");
    // Also handle space variants in mobile
    html = html.replace(/\.post-hero\{padding:7rem/g, ".post-hero{padding:10rem");
  }

  // 4. Inject toggleSiteNav() before </body>
  if (!html.includes("toggleSiteNav")) {
    html = html.replace("</body>", TOGGLE_JS + "\n</body>");
  }

  fs.writeFileSync(filePath, html, "utf8");
  return true;
}

// ── Target files ──────────────────────────────────────────────────────────────

// Collect HTML files using fs.readdirSync (no glob dependency needed)
function collectHtml(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...collectHtml(full));
    else if (entry.name.endsWith(".html")) results.push(full);
  }
  return results;
}

const mattFiles  = [
  path.join(ROOT, "static/blog/matt/index.html"),
  ...collectHtml(path.join(ROOT, "static/blog/matt/posts")),
];

const boomFiles  = [
  path.join(ROOT, "static/blog/boom/index.html"),
  ...collectHtml(path.join(ROOT, "static/blog/boom/posts")),
];

// ── Run ───────────────────────────────────────────────────────────────────────

let updated = 0;

const SEP = path.sep; // '\' on Windows, '/' on Unix

for (const f of mattFiles) {
  const norm = f.replace(/\\/g, "/");
  const isIndex = norm.endsWith("/blog/matt/index.html");
  try {
    const changed = processFile(f, "matt", isIndex);
    if (changed) {
      console.log("✓ matt", isIndex ? "(index)" : "(post) ", path.relative(ROOT, f));
      updated++;
    }
  } catch (err) {
    console.error("✗", path.relative(ROOT, f), err.message);
  }
}

for (const f of boomFiles) {
  const norm = f.replace(/\\/g, "/");
  const isIndex = norm.endsWith("/blog/boom/index.html");
  try {
    const changed = processFile(f, "boom", isIndex);
    if (changed) {
      console.log("✓ boom", isIndex ? "(index)" : "(post) ", path.relative(ROOT, f));
      updated++;
    }
  } catch (err) {
    console.error("✗", path.relative(ROOT, f), err.message);
  }
}

console.log(`\n✅ Done — updated ${updated} file(s).`);
