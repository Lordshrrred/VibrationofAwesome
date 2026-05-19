export const FIELD_GUIDE_URL = "https://vibrationofawesome.com/field-guide/";
export const AI_ENGINE_URL = "https://vibrationofawesome.com/ai-engine/";

const BOOM_NAV_CSS = `
/* Boom Site Nav */
nav.site-nav{display:block;padding:0;position:fixed;top:0;left:0;right:0;z-index:200;background:rgba(2,10,10,0.97);border-bottom:1px solid rgba(0,229,204,0.1);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);}
.site-nav-main{display:flex;align-items:center;justify-content:space-between;gap:1.15rem;min-height:62px;padding:1.1rem 3rem;border-bottom:1px solid rgba(0,229,204,0.06);}
a.site-nav-logo{font-family:'Space Grotesk',sans-serif;font-size:1rem;color:#00e5cc;text-decoration:none;letter-spacing:0.15em;font-weight:700;text-shadow:0 0 14px rgba(0,229,204,0.18);}
.site-nav-links{display:flex;gap:2.2rem;list-style:none;align-items:center;justify-content:flex-end;flex:1 1 auto;min-width:0;}
.site-nav-links a{font-family:'Space Grotesk',sans-serif;font-size:0.78rem;letter-spacing:0.14em;text-transform:uppercase;color:rgba(208,255,248,0.5);text-decoration:none;transition:color 0.2s;white-space:nowrap;}
.site-nav-links a:hover,.site-nav-links a.active{color:#00e5cc;}
.site-nav-links a.nav-aura-link{color:rgba(0,229,204,0.9);border:1px solid rgba(0,229,204,0.28);padding:0.22rem 0.6rem;border-radius:2px;}
.site-nav-links a.nav-guide-link{color:#22c06a;border:1px solid rgba(34,192,106,0.35);padding:0.25rem 0.7rem;border-radius:2px;}
.site-nav-links a.nav-ai-link{color:rgba(0,229,204,0.8);border:1px solid rgba(0,229,204,0.18);padding:0.2rem 0.52rem;border-radius:3px;}
.site-nav-breadcrumb{display:flex;align-items:center;gap:0.4rem;min-height:30px;padding:0.22rem 3rem;}
.site-nav-breadcrumb a{font-family:'Space Grotesk',sans-serif;font-size:0.66rem;letter-spacing:0.18em;text-transform:uppercase;color:rgba(208,255,248,0.3);text-decoration:none;}
.site-nav-breadcrumb a:hover{color:#00e5cc;}
.site-nav-breadcrumb .nav-sep{font-size:0.58rem;color:rgba(208,255,248,0.18);}
.site-nav-breadcrumb .nav-current{font-family:'Space Grotesk',sans-serif;font-size:0.66rem;letter-spacing:0.13em;text-transform:uppercase;color:rgba(208,255,248,0.4);max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.site-nav-hamburger{display:none;flex-direction:column;gap:5px;background:none;border:none;cursor:pointer;padding:6px;}
.site-nav-hamburger span{display:block;width:22px;height:2px;background:rgba(208,255,248,0.55);border-radius:1px;}
@media(max-width:900px){
  .site-nav-hamburger{display:flex;}
  .site-nav-links{display:none;position:fixed;top:92px;left:0;right:0;background:rgba(2,10,10,0.99);flex-direction:column;gap:0;padding:1rem 0 1.5rem;border-bottom:1px solid rgba(0,229,204,0.12);}
  .site-nav-links.open{display:flex;}
  .site-nav-links li{width:100%;}
  .site-nav-links a{display:block;padding:0.65rem 3rem;}
  .site-nav-breadcrumb{padding:0.3rem 1.5rem;}
}
@media(max-width:768px){
  .site-nav-main{padding:0.9rem 1.5rem;min-height:52px;}
  .post-header{min-height:26.5rem;padding:10rem 1.5rem 3rem;}
}
`;

function buildBoomNavHtml(title) {
  const safeTitle = escapeAttr(title || "");
  return [
    '<nav class="site-nav site-nav--boom">',
    '  <div class="site-nav-main">',
    '    <a href="/" class="site-nav-logo">VOA</a>',
    '    <button class="site-nav-hamburger" id="siteNavHamburger" onclick="toggleSiteNav()" aria-label="Menu">',
    '      <span></span><span></span><span></span>',
    "    </button>",
    '    <ul class="site-nav-links" id="siteNavLinks">',
    '      <li><a href="/">Home</a></li>',
    '      <li><a href="/blog/">Blog</a></li>',
    '      <li><a href="/blog/boom/" class="active">Boom Frequency</a></li>',
    '      <li><a href="/field-guide/" class="nav-guide-link">Free Guide &#10022;</a></li>',
    '      <li><a href="/ai-engine/" class="nav-ai-link">AI Engine</a></li>',
    '      <li><a href="/art-store/">Art Store</a></li>',
    '      <li><a href="/aura/" class="nav-aura-link">AURA &#10022;</a></li>',
    '      <li><a href="/earthstar/">EarthStar &#10022;</a></li>',
    "    </ul>",
    "  </div>",
    '  <div class="site-nav-breadcrumb">',
    '    <a href="/">VOA</a>',
    '    <span class="nav-sep">/</span>',
    '    <a href="/blog/">Blog</a>',
    '    <span class="nav-sep">/</span>',
    '    <a href="/blog/boom/">Boom Frequency</a>',
    '    <span class="nav-sep">/</span>',
    `    <span class="nav-current">${safeTitle}</span>`,
    "  </div>",
    "</nav>",
    '<script>function toggleSiteNav(){var l=document.getElementById("siteNavLinks");if(l)l.classList.toggle("open");}</script>',
  ].join("\n");
}

function injectBoomNav(html, title) {
  let out = html;

  // Strip any existing Boom nav (so order changes are re-applied on every run)
  out = out.replace(/<nav class="site-nav site-nav--boom">[\s\S]*?<\/nav>\s*<script>function toggleSiteNav[\s\S]*?<\/script>/g, "");
  // Also strip the BOOM_NAV_CSS if already injected (to avoid duplicates)
  out = out.replace(/\n\/\* Boom Site Nav \*\/[\s\S]*?@media\(max-width:768px\)\{[\s\S]*?\}\n/g, "");

  // Remove old site-header block
  out = out.replace(/<header class="site-header">[\s\S]*?<\/header>\s*/g, "");
  // Remove old breadcrumb nav inside .container
  out = out.replace(/<nav class="breadcrumb"[^>]*>[\s\S]*?<\/nav>\s*/g, "");

  // Strip old nav-related CSS rules from the <style> block
  out = out.replace(/\s*\.site-header\s*\{[^}]*\}/g, "");
  out = out.replace(/\s*\.site-header\s+\.container\s*\{[^}]*\}/g, "");
  out = out.replace(/\s*\.voa-logo\s*\{[^}]*\}/g, "");
  out = out.replace(/\s*\.voa-logo\s+span\s*\{[^}]*\}/g, "");
  out = out.replace(/\s*\.voa-logo:hover\s*\{[^}]*\}/g, "");
  out = out.replace(/\s*\.header-blog-name\s*\{[^}]*\}/g, "");
  out = out.replace(/\s*\.breadcrumb\s*\{[^}]*\}/g, "");
  out = out.replace(/\s*\.breadcrumb\s+a\s*\{[^}]*\}/g, "");
  out = out.replace(/\s*\.breadcrumb\s+a:hover\s*\{[^}]*\}/g, "");
  out = out.replace(/\s*\.breadcrumb\s+\.sep\s*\{[^}]*\}/g, "");

  // Inject nav CSS before </style>
  out = out.replace("</style>", `${BOOM_NAV_CSS}</style>`);

  // Insert nav HTML: after stars-canvas if present, else after <body>
  const nav = buildBoomNavHtml(title);
  if (out.includes('id="stars-canvas"')) {
    out = out.replace(/(<canvas[^>]+id="stars-canvas"[^>]*><\/canvas>)/, `$1\n\n${nav}`);
  } else {
    out = out.replace(/<body>/, `<body>\n\n${nav}`);
  }

  return out;
}

const AI_PATTERN = /\b(ai|claude|chatgpt|openai|perplexity|notebooklm|api|automation|automated|tool|tools|prompt|prompts|workflow|creator|creators|musician|musicians|music|faceless|lead magnet|content|spreadsheet|coworking|taxes|deep research)\b/i;
const FIELD_GUIDE_PATTERN = /\b(identity|potential|spiritual|self|growth|mindset|survival|stuck|lost|burnout|anxiety|nervous system|abundance|purpose|reinvent|escape|freedom|healing|creative life|love|mental overload)\b/i;

export function getBoomConversionTarget({ title = "", slug = "", keyword = "", niche = "" } = {}) {
  const text = [title, slug, keyword, niche].filter(Boolean).join(" ");
  if (AI_PATTERN.test(text)) {
    return {
      id: "ai-engine",
      primary: "ai-engine",
      url: AI_ENGINE_URL,
      text: "Go deeper with the AI Engine guide",
      label: "AI Engine guide",
      isAIPrimary: true,
    };
  }
  if (FIELD_GUIDE_PATTERN.test(text)) {
    return {
      id: "field-guide",
      primary: "field-guide",
      url: FIELD_GUIDE_URL,
      text: "Start with the Field Guide",
      label: "Field Guide",
      isAIPrimary: false,
    };
  }
  return {
    id: "field-guide",
    primary: "field-guide",
    url: FIELD_GUIDE_URL,
    text: "Start with the Field Guide",
    label: "Field Guide",
    isAIPrimary: false,
  };
}

export function buildBoomCtaInstruction(target) {
  if (target && target.primary === "ai-engine") {
    return [
      "",
      "---",
      "CTA STRATEGY:",
      `Primary conversion target: AI Engine / AI creative exoskeleton guide (${AI_ENGINE_URL}).`,
      "Weave 1-2 natural soft mentions of this guide into the article body where it fits the thought.",
      "End with a stronger but still natural invitation to go deeper with the AI Engine guide.",
      `Secondary target, only if genuinely relevant: VOA Field Guide (${FIELD_GUIDE_URL}).`,
      "Do not make the Field Guide the main CTA on AI, Claude, technology, creator-tool, or automation posts.",
      "No generic marketing copy, no duplicate CTA blocks, and no author bio or sign-off.",
      "---",
    ].join("\n");
  }

  return [
    "",
    "---",
    "CTA STRATEGY:",
    `Primary conversion target: VOA Field Guide (${FIELD_GUIDE_URL}).`,
    "Weave 1-2 natural soft mentions of the Field Guide into the article body where it fits the thought.",
    "End with a stronger but still natural invitation to download/read the Field Guide.",
    `Secondary target, only if genuinely relevant: AI Engine / AI creative exoskeleton guide (${AI_ENGINE_URL}).`,
    "Do not make the AI ebook the main CTA on self-help, personal growth, spiritual, identity, or potential posts.",
    "No generic marketing copy, no duplicate CTA blocks, and no author bio or sign-off.",
    "---",
  ].join("\n");
}

function escapeAttr(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildCurrentBottom(slug, target) {
  const safeSlug = escapeAttr(slug);
  const isAI = target && target.primary === "ai-engine";
  const lines = [];
  // For AI posts: AI Engine CTA appears BEFORE the signature (conclusion offer)
  if (isAI) {
    lines.push(`      <div data-ai-engine-cta data-blog-slug="${safeSlug}"></div>`);
    lines.push('      <script src="/js/ai-engine-cta.js"></script>');
    lines.push('<div style="height:1rem;"></div>');
  }
  // Signature block
  lines.push('<div style="height:1rem;"></div>');
  lines.push('<div class="voa-photo-rotator" data-folder="boombot" data-mode="signature"></div>');
  lines.push('<script src="/js/photo-rotator.js"></script>');
  lines.push('<div style="height:1rem;"></div>');
  // Universal bottom: ALWAYS Field Guide regardless of post type
  lines.push(`      <div data-ebook-cta data-placement="end-of-post" data-blog-slug="${safeSlug}"></div>`);
  lines.push('      <script src="/js/ebook-cta.js?v=4d2b383"></script>');
  lines.push(`        <div data-art-store-whisper data-blog-slug="${safeSlug}"></div>`);
  lines.push('        <script src="/js/art-store-whisper.js"></script>');
  return lines.join("\n");
}

function buildFooter() {
  return [
    "<footer>",
    '  <p class="footer-meta">&copy; 2026 <a href="/">Vibration of Awesome</a> &nbsp;&middot;&nbsp; <a href="/blog/boom/">Boom Frequency</a> &nbsp;&middot;&nbsp; <a href="/blog/">All Posts</a></p>',
    "",
    '  <div class="footer-brand">',
    '    <a href="/" class="footer-logo">Vibration <span>of</span> Awesome</a>',
    '    <div class="footer-tagline">Empower Thyself. Empower the Earth.</div>',
    "  </div>",
    "</footer>",
  ].join("\n");
}

function ensureFooterCentering(html) {
  const css = [
    "",
    "/* Blog footer alignment repair */",
    "footer, .site-footer { text-align: center; width: 100%; }",
    "footer .footer-meta, .site-footer .footer-meta { display: block; width: 100%; margin-left: auto; margin-right: auto; text-align: center; }",
    "footer .footer-brand, .site-footer .footer-brand { margin-left: auto; margin-right: auto; text-align: center; }",
    "footer .footer-meta a, .site-footer .footer-meta a { color: var(--accent, var(--cyan, var(--amber, #00e5ff))) !important; text-decoration: none; border-bottom: 1px solid rgba(0,229,255,0.28); }",
    "footer .footer-meta a:hover, .site-footer .footer-meta a:hover { color: var(--accent-light, var(--cyan, var(--amber, #7ef2ff))) !important; border-bottom-color: currentColor; }",
  ].join("\n");
  if (html.includes("Blog footer alignment repair")) {
    return html.replace(/\/\* Blog footer alignment repair \*\/[\s\S]*?footer \.footer-meta a:hover, \.site-footer \.footer-meta a:hover \{[^}]*\}/, css.trim());
  }
  return html.replace("</style>", `${css}\n</style>`);
}

const AI_SOFT_MENTIONS = [
  `<p>If you are building your own creative system around this, the <a href="${AI_ENGINE_URL}">AI Engine guide</a> goes deeper into using AI as a creative exoskeleton instead of another productivity costume.</p>`,
  `<p>The <a href="${AI_ENGINE_URL}">AI Engine guide</a> is where this gets practical: a grounded system for using these tools without losing your creative center.</p>`,
  `<p>If you want the full map, the <a href="${AI_ENGINE_URL}">AI Engine guide</a> lays out the tools, the system, and the mindset that holds it all together.</p>`,
  `<p>There is a way to use AI that amplifies your voice instead of replacing it. The <a href="${AI_ENGINE_URL}">AI Engine guide</a> is the framework for that.</p>`,
  `<p>For the deeper system behind what this post is pointing at, the <a href="${AI_ENGINE_URL}">AI Engine guide</a> walks through how to wire these tools into your actual creative life.</p>`,
  `<p>The <a href="${AI_ENGINE_URL}">AI Engine guide</a> is the companion piece here: less theory, more working system for creators who want AI to extend them, not flatten them.</p>`,
  `<p>If this landed, the <a href="${AI_ENGINE_URL}">AI Engine guide</a> is the next step: a practical creative OS built around staying human while using the tools.</p>`,
  `<p>Building a creative workflow with AI is harder than the hype makes it look. The <a href="${AI_ENGINE_URL}">AI Engine guide</a> is the honest, grounded version of that process.</p>`,
];

const FG_SOFT_MENTIONS = [
  `<p>If this is the kind of inner work you are doing right now, the <a href="${FIELD_GUIDE_URL}">VOA Field Guide</a> is the deeper map for turning that signal into a way of living.</p>`,
  `<p>The <a href="${FIELD_GUIDE_URL}">Field Guide</a> is built for exactly this kind of moment: when you know something has to shift but you are not sure where to start.</p>`,
  `<p>If you want a grounded framework for the work this post is pointing at, the <a href="${FIELD_GUIDE_URL}">Field Guide</a> is where that lives.</p>`,
  `<p>There is a longer version of this conversation in the <a href="${FIELD_GUIDE_URL}">Field Guide</a>, including the tools and the practices that make the shift sustainable.</p>`,
  `<p>The <a href="${FIELD_GUIDE_URL}">Field Guide</a> covers the terrain between where you are and where you are trying to go, with more honesty than most self-help allows.</p>`,
  `<p>For the deeper system behind what this post is pointing at, the <a href="${FIELD_GUIDE_URL}">Field Guide</a> offers the framework and the practices to make it real.</p>`,
  `<p>If this resonated, the <a href="${FIELD_GUIDE_URL}">Field Guide</a> is the next layer: a map for the kind of reinvention that actually holds.</p>`,
  `<p>The <a href="${FIELD_GUIDE_URL}">Field Guide</a> exists for people who are done with surface-level self-help and ready for the version that actually costs something.</p>`,
];

function hashSlug(slug) {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return h;
}

function buildSoftMention(target, slug) {
  if (target && target.primary === "ai-engine") {
    const idx = hashSlug(slug || "") % AI_SOFT_MENTIONS.length;
    return AI_SOFT_MENTIONS[idx];
  }
  const idx = hashSlug(slug || "") % FG_SOFT_MENTIONS.length;
  return FG_SOFT_MENTIONS[idx];
}

function removeLegacyBottom(html) {
  let out = html;
  out = out.replace(/\s*<div class="post-cta">[\s\S]*?<\/div>/g, "");
  out = out.replace(/\s*<div style="height:\s*(?:1|2)rem;"><\/div>\s*/g, "\n");
  out = out.replace(/\s*<div class="voa-photo-rotator"[^>]*><\/div>\s*/g, "\n");
  out = out.replace(/\s*<script src="\/js\/photo-rotator\.js"[^>]*><\/script>\s*/g, "\n");
  out = out.replace(/\s*<div data-ai-nudge[^>]*><\/div>\s*/g, "\n");
  out = out.replace(/\s*<script src="\/js\/ai-engine-nudge\.js"[^>]*><\/script>\s*/g, "\n");
  out = out.replace(/\s*<div data-ai-engine-cta[^>]*><\/div>\s*/g, "\n");
  out = out.replace(/\s*<script src="\/js\/ai-engine-cta\.js"[^>]*><\/script>\s*/g, "\n");
  out = out.replace(/\s*<div (?:class="voa-ebook-cta"|data-ebook-cta)[^>]*><\/div>\s*/g, "\n");
  out = out.replace(/\s*<script src="\/js\/ebook-cta\.js[^"]*"[^>]*><\/script>\s*/g, "\n");
  out = out.replace(/\s*<div data-art-store-whisper[^>]*><\/div>\s*/g, "\n");
  out = out.replace(/\s*<script src="\/js\/art-store-whisper\.js"[^>]*><\/script>\s*/g, "\n");
  return out;
}

function removeLegacyVisuals(html) {
  let out = html;
  out = out.replace(/\s*<div class="nasa-img-wrap">[\s\S]*?<\/div>\s*/g, "\n");
  out = out.replace(/^\s*\.nasa-img-wrap[^\n]*\n/gm, "");
  out = out.replace(/^\s*@media \(max-width: 600px\) \{ \.nasa-img-wrap[^\n]*\n/gm, "");
  out = out.replace(/^\s*@media\(max-width:600px\)\{\.nasa-img-wrap[^\n]*\n/gm, "");
  out = out.replace(/^\s*\.post-cta[^\n]*\n/gm, "");
  return out;
}

function replaceFooter(html) {
  const footer = buildFooter();
  if (/<footer[\s\S]*?<\/footer>/.test(html)) {
    return html.replace(/<footer[\s\S]*?<\/footer>/, footer);
  }
  return html.replace(/<\/body>/, `${footer}\n\n</body>`);
}

function getSocialImage(html) {
  const og = html.match(/<meta property="og:image" content="([^"]+)"/i);
  if (og && og[1]) return og[1];
  const twitter = html.match(/<meta name="twitter:image" content="([^"]+)"/i);
  return twitter && twitter[1] ? twitter[1] : "";
}

function ensureBoomHeroHeader(html) {
  const image = getSocialImage(html);
  if (!image) return html;

  let out = html;
  const heroRule = `.post-header { position:relative; z-index:1; overflow:hidden; width:100vw; margin-left:calc(50% - 50vw); margin-right:calc(50% - 50vw); min-height:31rem; display:flex; align-items:flex-end; padding:11rem 4rem 3.75rem; border-bottom:1px solid rgba(0,229,255,0.16); background-color:#020a0a; background:linear-gradient(to bottom, rgba(2,10,8,0.55) 0%, rgba(2,10,8,0.82) 62%, #020a0a 100%), url('${image}') center/cover no-repeat; }`;

  out = out.replace(/\.post-header\s*\{\s*padding:\s*2\.5rem\s+0\s+2rem;\s*border-bottom:\s*1px\s+solid\s+var\(--border\);\s*\}/g, heroRule);
  out = out.replace(/\.post-header\s*\{\s*padding:2\.5rem\s+0\s+2rem;\s*border-bottom:1px\s+solid\s+var\(--border\);\s*\}/g, heroRule);
  out = out.replace(/\.post-header\s*\{[^}]*background[^}]*url\(['"][^'"]+['"]\)[^}]*\}/, heroRule);
  out = out.replace(/@media \(max-width: 600px\) \{ body \{ font-size: 16px; \} \.post-header \{ padding: 1\.8rem 0 1\.4rem; \} \}/g, "@media (max-width: 768px) { body { font-size: 16px; } .post-header { padding: 10rem 1.5rem 3rem; } }");

  if (!out.includes(".post-header-inner")) {
    out = out.replace(/<\/style>/, [
      "    .post-header-inner { max-width:760px; margin:0 auto; padding:0 1.5rem; width:100%; }",
      "    .post-header > *:not(.ev-art) { position:relative; z-index:1; }",
      "    .ev-art { position:absolute; inset:0; z-index:0; opacity:0.35; pointer-events:none; }",
      "</style>",
    ].join("\n"));
  } else if (!out.includes(".post-header > *:not(.ev-art)")) {
    out = out.replace(/<\/style>/, [
      "    .post-header > *:not(.ev-art) { position:relative; z-index:1; }",
      "    .ev-art { position:absolute; inset:0; z-index:0; opacity:0.35; pointer-events:none; }",
      "</style>",
    ].join("\n"));
  }

  out = out.replace(/<header class="post-header">\s*([\s\S]*?)\s*<\/header>/, (match, inner) => {
    if (inner.includes("post-header-inner")) return match;
    return `<header class="post-header">\n        <div class="post-header-inner">\n${inner.trim()}\n        </div>\n      </header>`;
  });

  return out;
}

function ensureScript(html, scriptTag) {
  if (html.includes(scriptTag)) return html;
  if (html.includes('<script src="/js/voa-nav.js" defer></script>')) {
    return html.replace('<script src="/js/voa-nav.js" defer></script>', `${scriptTag}\n<script src="/js/voa-nav.js" defer></script>`);
  }
  return html.replace(/<\/body>/, `${scriptTag}\n</body>`);
}

function fixAnchorText(html) {
  return html
    .replace(
      /<a\s+href="https:\/\/vibrationofawesome\.com\/field-guide\/"[^>]*>Vibration of Awesome\/field-guide\/<\/a>/gi,
      `<a href="${FIELD_GUIDE_URL}">Field Guide</a>`,
    )
    .replace(
      /<a\s+href="https:\/\/vibrationofawesome\.com\/field-guide\/"[^>]*>vibrationofawesome\.com\/field-guide\/<\/a>/gi,
      `<a href="${FIELD_GUIDE_URL}">Field Guide</a>`,
    )
    .replace(
      /<a\s+href="https:\/\/vibrationofawesome\.com\/ai-engine\/"[^>]*>Vibration of Awesome\/ai-engine\/<\/a>/gi,
      `<a href="${AI_ENGINE_URL}">AI Engine guide</a>`,
    )
    .replace(
      /<a\s+href="https:\/\/vibrationofawesome\.com\/ai-engine\/"[^>]*>vibrationofawesome\.com\/ai-engine\/<\/a>/gi,
      `<a href="${AI_ENGINE_URL}">AI Engine guide</a>`,
    );
}

function insertSoftMention(html, target, slug) {
  const primaryUrl = target && target.primary === "ai-engine" ? AI_ENGINE_URL : FIELD_GUIDE_URL;
  const articleMatch = html.match(/<article class="post-body">([\s\S]*?)<\/article>/);
  const scope = articleMatch ? articleMatch[1] : html;
  if (scope.includes(primaryUrl)) return html;

  const mention = buildSoftMention(target, slug);
  if (/<hr>\s*<\/article>/.test(html)) {
    return html.replace(/<hr>\s*<\/article>/, `<hr>\n${mention}\n</article>`);
  }
  if (html.includes("</article>")) {
    return html.replace(/<\/article>/, `${mention}\n</article>`);
  }
  return html.replace(/<footer/, `${mention}\n<footer`);
}

export function normalizeBoomHtml(html, { slug = "", title = "", keyword = "", niche = "" } = {}) {
  const target = getBoomConversionTarget({ title, slug, keyword, niche });
  let out = html;
  out = removeLegacyVisuals(out);
  out = removeLegacyBottom(out);
  out = ensureBoomHeroHeader(out);
  out = injectBoomNav(out, title);
  out = fixAnchorText(out);
  out = insertSoftMention(out, target, slug);
  const bottom = buildCurrentBottom(slug, target);
  if (out.includes("</article>")) {
    out = out.replace(/<\/article>/, `${bottom}\n      </article>`);
  } else {
    out = out.replace(/<footer/, `${bottom}\n\n<footer`);
  }
  out = replaceFooter(out);
  out = ensureFooterCentering(out);
  out = ensureScript(out, '<script src="/js/announcement-bar.js"></script>');
  out = ensureScript(out, '<script src="/js/earthstar-visual.js"></script>');
  out = out.replace(/\n{4,}/g, "\n\n\n");
  return out;
}
