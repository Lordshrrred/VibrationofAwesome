export const EDITORIAL_BYLINE = "Vibration of Awesome · AI-assisted";
export const EDITORIAL_AUTHOR = { "@type": "Organization", "@id": "https://vibrationofawesome.com/#organization", name: "Vibration of Awesome", url: "https://vibrationofawesome.com/" };
export const EDITORIAL_NOTE = '<p data-editorial-byline style="font-size:0.85rem;opacity:0.75;line-height:1.6">Published by Vibration of Awesome. AI-assisted writing. Explore a useful next step below.</p>';
export const HUMAN_BYLINE = '<aside data-author-byline style="display:flex;align-items:center;gap:1rem;margin:2rem 0;font-size:0.9rem;line-height:1.6"><img src="/personal-photos/matt/skateparkmug.jpeg" alt="Matt EarthStar" width="64" height="64" loading="lazy" style="border-radius:50%;object-fit:cover;object-position:50% 25%;flex-shrink:0"><p style="margin:0"><strong>Matt EarthStar</strong><br>Personal writing from the Forest Temple.</p></aside>';

export function applyEditorial(html, lane = "boom") {
  if (lane === "boom") {
    html = html.replace(/(<span\b[^>]*class=["']author["'][^>]*>)[\s\S]*?(<\/span>)/gi, `$1${EDITORIAL_BYLINE}$2`);
    html = html.replace(/<div\b[^>]*class=["']voa-photo-rotator["'][^>]*>\s*<\/div>/gi, EDITORIAL_NOTE)
      .replace(/\s*<script[^>]*src=["']\/js\/photo-rotator\.js[^"']*["'][^>]*><\/script>/gi, "");
  } else {
    html = html.replace(/<div\b[^>]*class=["']voa-photo-rotator["'][^>]*>\s*<\/div>/gi, HUMAN_BYLINE)
      .replace(/\s*<script[^>]*src=["']\/js\/photo-rotator\.js[^"']*["'][^>]*><\/script>/gi, "");
  }
  return html.replace(/(<script\b[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi, (all, open, raw, close) => {
    let schema;
    try { schema = JSON.parse(raw); } catch { return all; }
    const visit = value => {
      if (!value || typeof value !== "object") return;
      const types = [value["@type"]].flat();
      if (lane === "boom" && types.some(t => ["Blog", "Article", "BlogPosting"].includes(t))) value.author = EDITORIAL_AUTHOR;
      if (value["@graph"]) value["@graph"].forEach(visit);
    };
    visit(schema);
    return open + JSON.stringify(schema) + close;
  });
}

export function articleText(html) {
  let body = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] || html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || html;
  body = body.replace(/<section\b[^>]*data-internal-related[^>]*>[\s\S]*?<\/section>/gi, "")
    .split(/<(?:div|p)\b[^>]*(?:data-editorial-byline|voa-photo-rotator|data-ebook-cta|voa-ebook-cta|class="post-cta)/i)[0];
  return body.replace(/<(script|style|nav|aside)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " ").replace(/&(?:amp|nbsp|quot|apos|#39|#x27);/gi, " ")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function shingles(text, size = 5) {
  const words = text.split(/\s+/);
  return new Set(words.slice(0, Math.max(0, words.length - size + 1)).map((_, index) => words.slice(index, index + size).join(" ")));
}

export function overlap(a, b) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const token of a.size < b.size ? a : b) if ((a.size < b.size ? b : a).has(token)) shared++;
  return shared / (a.size + b.size - shared);
}

export function findRepeatedContent(html, articles) {
  const text = articleText(html), tokens = shingles(text);
  if (tokens.size < 100) return null;
  for (const article of articles) {
    const similarity = overlap(tokens, shingles(articleText(article.html)));
    if (similarity >= 0.5) return { slug: article.slug, similarity };
  }
  return null;
}
