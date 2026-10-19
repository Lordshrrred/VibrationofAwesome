function contentsOf(html, opening) {
  const tag = opening[1];
  const start = opening.index + opening[0].length;
  const tokens = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi");
  tokens.lastIndex = start;
  let depth = 1;
  for (let token; (token = tokens.exec(html));) {
    depth += token[1] ? -1 : 1;
    if (!depth) return html.slice(start, token.index);
  }
  return null;
}

export function articleBody(html) {
  const clean = String(html || "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|nav|header|footer|aside)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
  // Prefer the actual post body over a theme's enclosing article/sidebar.
  for (const opening of clean.matchAll(/<(div|section)\b[^>]*>/gi)) {
    const classes = opening[0].match(/\bclass\s*=\s*["']([^"']*)["']/i)?.[1] || "";
    if (/(?:^|\s)(?:entry-content|post-body|post-content|regular-body)(?:\s|$)/i.test(classes)) {
      return contentsOf(clean, opening);
    }
  }
  const article = /<(article)\b[^>]*>/i.exec(clean);
  return article ? contentsOf(clean, article) : null;
}

function normalizedUrl(value) {
  try {
    const url = new URL(value.replace(/&amp;/gi, "&"));
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.hostname.toLowerCase().replace(/^www\./, "") + url.pathname.replace(/\.html\/?$/i, "").replace(/\/$/, "");
  } catch { return null; }
}

export function inspectBacklink(html, sourceUrl, status = 200) {
  if (status === 404 || status === 410) return { verified: false, reason: `http_${status}` };
  if (status < 200 || status >= 300) return { verified: null, reason: `http_${status}` };
  const body = articleBody(html);
  if (body === null) return { verified: null, reason: "article_body_unrecognized" };
  const source = normalizedUrl(sourceUrl);
  const links = [...body.matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi)].map(match => match[1]);
  const matched = source && links.find(link => normalizedUrl(link) === source);
  return { verified: Boolean(matched), reason: matched ? "ok" : "source_link_missing_in_article", matched: matched || "" };
}
