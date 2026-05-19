export const FIELD_GUIDE_URL = "https://vibrationofawesome.com/field-guide/";
export const AI_ENGINE_URL = "https://vibrationofawesome.com/ai-engine/";

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
  const includeAiNudge = target && target.primary === "ai-engine";
  return [
    '<div style="height:1rem;"></div>',
    '<div class="voa-photo-rotator" data-folder="boombot" data-mode="signature"></div>',
    '<script src="/js/photo-rotator.js"></script>',
    '<div style="height:1rem;"></div>',
    includeAiNudge ? `      <div data-ai-nudge data-blog-slug="${safeSlug}"></div>` : "",
    includeAiNudge ? '      <script src="/js/ai-engine-nudge.js" defer></script>' : "",
    `      <div data-ebook-cta data-placement="end-of-post" data-blog-slug="${safeSlug}"></div>`,
    '<script src="/js/ebook-cta.js?v=4d2b383"></script>',
    `        <div data-art-store-whisper data-blog-slug="${safeSlug}"></div>`,
    '        <script src="/js/art-store-whisper.js"></script>',
  ].filter(Boolean).join("\n");
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
  if (html.includes("Blog footer alignment repair")) return html;
  const css = [
    "",
    "/* Blog footer alignment repair */",
    "footer, .site-footer { text-align: center; width: 100%; }",
    "footer .footer-meta, .site-footer .footer-meta { display: block; width: 100%; margin-left: auto; margin-right: auto; text-align: center; }",
    "footer .footer-brand, .site-footer .footer-brand { margin-left: auto; margin-right: auto; text-align: center; }",
  ].join("\n");
  return html.replace("</style>", `${css}\n</style>`);
}

function buildSoftMention(target) {
  if (target && target.primary === "ai-engine") {
    return `<p>If you are building your own creative system around this, the <a href="${AI_ENGINE_URL}">AI Engine guide</a> goes deeper into using AI as a creative exoskeleton instead of another productivity costume.</p>`;
  }
  return `<p>If this is the kind of inner work you are doing right now, the <a href="${FIELD_GUIDE_URL}">VOA Field Guide</a> is the deeper map for turning that signal into a way of living.</p>`;
}

function removeLegacyBottom(html) {
  let out = html;
  out = out.replace(/\s*<div class="post-cta">[\s\S]*?<\/div>/g, "");
  out = out.replace(/\s*<div style="height:\s*(?:1|2)rem;"><\/div>\s*/g, "\n");
  out = out.replace(/\s*<div class="voa-photo-rotator"[^>]*><\/div>\s*/g, "\n");
  out = out.replace(/\s*<script src="\/js\/photo-rotator\.js"[^>]*><\/script>\s*/g, "\n");
  out = out.replace(/\s*<div data-ai-nudge[^>]*><\/div>\s*/g, "\n");
  out = out.replace(/\s*<script src="\/js\/ai-engine-nudge\.js"[^>]*><\/script>\s*/g, "\n");
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

function insertSoftMention(html, target) {
  const primaryUrl = target && target.primary === "ai-engine" ? AI_ENGINE_URL : FIELD_GUIDE_URL;
  const articleMatch = html.match(/<article class="post-body">([\s\S]*?)<\/article>/);
  const scope = articleMatch ? articleMatch[1] : html;
  if (scope.includes(primaryUrl)) return html;

  const mention = buildSoftMention(target);
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
  out = insertSoftMention(out, target);
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
