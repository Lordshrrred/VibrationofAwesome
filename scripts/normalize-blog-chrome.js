#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const START = "/* ── Blog Chrome Normalization";
const END = "/* ── End Blog Chrome Normalization ───────────────────────────────── */";
const BLOCK = `
/* ── Blog Chrome Normalization ───────────────────────────────────── */
nav.site-nav { position: fixed !important; top: 0; left: 0; right: 0; z-index: 200 !important; }
.site-nav-main { min-height: 62px !important; padding: 1.3rem 3rem !important; }
.site-nav-logo,
.site-nav-links a { line-height: 1 !important; }
.site-nav-links a.nav-guide-link {
  color: #39d98a !important;
  border: 1px solid rgba(57,217,138,0.42) !important;
  background: rgba(57,217,138,0.08) !important;
  box-shadow: inset 0 0 0 1px rgba(57,217,138,0.04) !important;
}
.site-nav-links a.nav-guide-link::after { display: none !important; }
.site-nav-links a.nav-guide-link:hover {
  background: rgba(57,217,138,0.14) !important;
  box-shadow: 0 0 12px rgba(57,217,138,0.22) !important;
}
.site-nav--boom { transform: translateY(-2px); }
.site-nav--boom .site-nav-main { min-height: 58px !important; padding-top: 1rem !important; padding-bottom: 1rem !important; }
.site-nav--boom .site-nav-breadcrumb { transform: translateY(-2px); }
.site-nav-breadcrumb { gap: 0.45rem !important; min-height: 32px !important; padding: 0.28rem 3rem !important; }
.site-nav-breadcrumb a,
.site-nav-breadcrumb .nav-current { font-size: 0.68rem !important; }
.site-nav-breadcrumb .nav-sep { font-size: 0.6rem !important; }
.post-hero,
.post-header {
  overflow: hidden;
  min-height: 31rem;
  display: flex;
  align-items: flex-end;
  padding: 11rem 4rem 3.75rem;
  background-position: center center;
}
.post-hero { border-bottom-color: rgba(255,179,0,0.16) !important; }
.post-header { border-bottom-color: rgba(0,229,255,0.16) !important; }
.post-hero-inner,
.post-header-inner {
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
  padding: 0 1.5rem;
}
.post-hero > *:not(.ev-art),
.post-header > *:not(.ev-art) {
  position: relative;
  z-index: 1;
}
@media (max-width: 768px) {
  .site-nav-main { padding: 0.75rem 1.2rem !important; min-height: auto !important; }
  .post-hero,
  .post-header {
    min-height: 26.5rem;
    padding: 10rem 1.5rem 3rem;
  }
}
/* ── End Blog Chrome Normalization ───────────────────────────────── */
`.trim();

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

function normalizeFile(filePath) {
  let html = fs.readFileSync(filePath, "utf8");
  const laneClass = filePath.includes(`${path.sep}boom${path.sep}`) ? "site-nav site-nav--boom" : "site-nav site-nav--matt";

  html = html.replace(/<nav class="site-nav(?:\s+site-nav--(?:matt|boom))?">/g, `<nav class="${laneClass}">`);

  if (html.includes(START)) {
    html = html.replace(/\/\* ── Blog Chrome Normalization[\s\S]*?\/\* ── End Blog Chrome Normalization ───────────────────────────────── \*\//, BLOCK);
  } else {
    html = html.replace("</style>", `\n${BLOCK}\n</style>`);
  }

  fs.writeFileSync(filePath, html, "utf8");
}

const targets = [
  path.join(ROOT, "static/blog/matt/index.html"),
  path.join(ROOT, "static/blog/boom/index.html"),
  ...collectHtml(path.join(ROOT, "static/blog/matt/posts")),
  ...collectHtml(path.join(ROOT, "static/blog/boom/posts")),
];

for (const target of targets) normalizeFile(target);

console.log(`Normalized blog chrome in ${targets.length} file(s).`);
