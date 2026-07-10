const VOA_BASE = "https://vibrationofawesome.com";
const FEEDER_BASE = "https://lordshrrred.github.io/VOA_Feeder";
const FEEDER_POSTS_URL = `${FEEDER_BASE}/blog/posts.json`;
const FEEDER_SUFFIXES = ["-signal", "-shift", "-insight", "-guide"];
const BLOGGER_BASE = process.env.BLOGGER_BASE_URL || "https://vibrationofawesomeearthstar.blogspot.com";
const WORDPRESS_BASE = process.env.WORDPRESS_PUBLIC_BASE || "https://earthstarrisingsun.wordpress.com";
const TUMBLR_BLOG = process.env.VOA_TUMBLR_BLOG_NAME || "vibrationofawesome";
const DEVTO_USERNAME = process.env.DEVTO_USERNAME || "earthstarrising";
const ALLOWED_PLATFORMS = new Set([
  "devto",
  "tumblr_voa",
  "blogger",
  "wordpress_earthstar",
  "feeder",
]);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

function cleanSlug(slug) {
  const out = String(slug || "").trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]{2,160}$/.test(out) ? out : "";
}

function expectedUrls(slug) {
  return [
    `${VOA_BASE}/blog/boom/posts/${slug}`.toLowerCase(),
    `${VOA_BASE}/blog/matt/posts/${slug}/`.toLowerCase(),
    `${VOA_BASE}/blog/matt/posts/${slug}`.toLowerCase(),
    // Backward-compatible legacy shapes still resolve through Vercel cleanUrls.
    `${VOA_BASE}/blog/boom/posts/${slug}.html`.toLowerCase(),
    `${VOA_BASE}/blog/matt/posts/${slug}.html`.toLowerCase(),
  ];
}

function hrefLinks(html) {
  const out = [];
  const rx = /href\s*=\s*["'](https?:\/\/(?:www\.)?vibrationofawesome\.com[^"']*)["']/gi;
  for (const match of String(html || "").matchAll(rx)) out.push(match[1]);
  return out;
}

function matchesSlug(link, slug) {
  const normalized = String(link || "").trim().toLowerCase().replace(/\/$/, "");
  return expectedUrls(slug).some(expected => {
    const bare = expected.replace(/\/$/, "");
    return normalized === bare || normalized.startsWith(`${bare}?`);
  });
}

function firstVoaAnchor(html) {
  const match = String(html || "").match(/href\s*=\s*["']https?:\/\/(?:www\.)?vibrationofawesome\.com[^"']*["'][^>]*>([^<]+)</i);
  return match ? match[1].trim() : "";
}

function lastPathSegment(url) {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    return (parts.at(-1) || "").replace(/\.html$/i, "");
  } catch {
    return "";
  }
}

function coreWords(slug) {
  const stop = new Set(["what", "to", "do", "the", "a", "an", "in", "for", "and", "or", "with", "how", "why", "is", "of"]);
  return slug.split("-").filter(word => word && !stop.has(word));
}

async function fetchText(url, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "VOA-Backlink-Checker/1.0 (+https://vibrationofawesome.com)" },
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text, url: res.url || url };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url, timeoutMs = 20000) {
  const res = await fetchText(url, timeoutMs);
  if (!res.ok) return { ...res, data: null };
  return { ...res, data: JSON.parse(res.text) };
}

async function verifyHtml(slug, url) {
  if (!url) return { verified: null, reason: "no_url", url: "" };
  try {
    const res = await fetchText(url, 25000);
    if (!res.ok) return { verified: false, reason: `http_${res.status}`, url };
    const exact = hrefLinks(res.text).find(link => matchesSlug(link, slug));
    return {
      verified: Boolean(exact),
      reason: exact ? "ok" : "slug_mismatch",
      anchor: firstVoaAnchor(res.text),
      matched: exact || "",
      url: res.url || url,
    };
  } catch (error) {
    return { verified: null, reason: `error:${error.name || "FetchError"}`, url };
  }
}

async function verifyDevto(slug, url) {
  if (!url) return { verified: null, reason: "no_url", url: "" };
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    if (parts.length < 2) return { verified: null, reason: "bad_url", url };
    const res = await fetchJson(`https://dev.to/api/articles/${parts[0]}/${parts[1]}`, 20000);
    if (!res.ok) return { verified: false, reason: `http_${res.status}`, url };
    const canonical = String(res.data?.canonical_url || "").trim().toLowerCase().replace(/\/$/, "");
    const body = String(res.data?.body_html || "");
    const exact = hrefLinks(body).find(link => matchesSlug(link, slug));
    const canonicalOk = expectedUrls(slug).some(expected => canonical === expected.replace(/\/$/, ""));
    return {
      verified: canonicalOk || Boolean(exact),
      reason: canonicalOk || exact ? "ok" : "slug_mismatch",
      canonical: canonicalOk,
      anchor: firstVoaAnchor(body),
      matched: exact || (canonicalOk ? canonical : ""),
      url,
    };
  } catch (error) {
    return { verified: null, reason: `error:${error.name || "FetchError"}`, url };
  }
}

async function feederPosts() {
  const res = await fetchJson(FEEDER_POSTS_URL, 20000);
  return Array.isArray(res.data) ? res.data : [];
}

async function verifyFeeder(slug, url) {
  const candidates = [];
  const pathSlug = lastPathSegment(url);
  if (pathSlug) candidates.push(pathSlug);
  candidates.push(slug, ...FEEDER_SUFFIXES.map(suffix => `${slug}${suffix}`));

  try {
    const posts = await feederPosts();
    for (const post of posts) {
      if (!post?.url || !post?.slug) continue;
      const sourceSlug = FEEDER_SUFFIXES.reduce(
        (current, suffix) => current.endsWith(suffix) ? current.slice(0, -suffix.length) : current,
        String(post.slug),
      );
      if (sourceSlug === slug) candidates.unshift(post.slug);
    }
  } catch {}

  const seen = new Set();
  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    const checkUrl = `${FEEDER_BASE}/blog/${candidate}.html`;
    const checked = await verifyHtml(slug, checkUrl);
    if (checked.verified) return checked;
  }

  return { verified: false, reason: "slug_mismatch", url: url || "" };
}

async function recoverDevto(slug) {
  try {
    const res = await fetchJson(`https://dev.to/api/articles?username=${DEVTO_USERNAME}&per_page=100`, 20000);
    if (!res.ok || !Array.isArray(res.data)) return null;
    for (const article of res.data) {
      const canonical = String(article?.canonical_url || "").trim().toLowerCase().replace(/\/$/, "");
      if (!expectedUrls(slug).some(expected => canonical === expected.replace(/\/$/, ""))) continue;
      const verified = await verifyDevto(slug, article.url);
      if (verified.verified) return { ...verified, recovered_live: true };
    }
  } catch {}
  return null;
}

async function recoverTumblr(slug) {
  try {
    const res = await fetchText(`https://${TUMBLR_BLOG.replace(/\.tumblr\.com$/i, "")}.tumblr.com/api/read/json?num=120`, 20000);
    if (!res.ok) return null;
    const match = res.text.match(/^var tumblr_api_read = (.*);\s*$/s);
    if (!match) return null;
    const data = JSON.parse(match[1]);
    const post = (data.posts || []).find(row => hrefLinks(row["regular-body"] || "").some(link => matchesSlug(link, slug)));
    if (!post?.id) return null;
    return {
      verified: true,
      reason: "ok",
      matched: `${VOA_BASE}/blog/boom/posts/${slug}`,
      url: `https://www.tumblr.com/${TUMBLR_BLOG.replace(/\.tumblr\.com$/i, "")}/${post.id}/${slug}`,
      recovered_live: true,
    };
  } catch {}
  return null;
}

async function recoverFromSitemap(slug, sitemapUrl, hostMustContain = "") {
  try {
    const res = await fetchText(sitemapUrl, 20000);
    if (!res.ok) return null;
    const locs = [...res.text.matchAll(/<loc>(https?:\/\/[^<]+)<\/loc>/gi)].map(match => match[1]);
    const words = coreWords(slug);
    const scored = locs
      .filter(candidate => !hostMustContain || candidate.toLowerCase().includes(hostMustContain.toLowerCase()))
      .map(candidate => {
        const lower = candidate.toLowerCase();
        let score = lower.includes(slug) ? 10 : 0;
        for (const word of words.slice(0, 8)) if (lower.includes(word)) score += 1;
        return { candidate, score };
      })
      .filter(row => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);

    for (const { candidate } of scored) {
      const checked = await verifyHtml(slug, candidate);
      if (checked.verified) return { ...checked, recovered_live: true };
    }
  } catch {}
  return null;
}

async function recoverBlogger(slug) {
  return recoverFromSitemap(slug, `${BLOGGER_BASE.replace(/\/+$/, "")}/sitemap.xml`, new URL(BLOGGER_BASE).hostname);
}

async function recoverWordPress(slug) {
  const tag = await verifyHtml(slug, `${WORDPRESS_BASE.replace(/\/+$/, "")}/tag/${slug}/`);
  if (tag.verified) return { ...tag, recovered_live: true };
  return recoverFromSitemap(slug, `${WORDPRESS_BASE.replace(/\/+$/, "")}/sitemap.xml`, new URL(WORDPRESS_BASE).hostname);
}

async function checkOne(input) {
  const slug = cleanSlug(input?.slug);
  const platform = String(input?.platform || "").trim().toLowerCase();
  const url = String(input?.url || "").trim();

  if (!slug) return { verified: null, reason: "bad_slug", url };
  if (!ALLOWED_PLATFORMS.has(platform)) return { verified: null, reason: "bad_platform", url };

  let result;
  if (platform === "devto") result = await verifyDevto(slug, url);
  if (platform === "tumblr_voa") result = await verifyHtml(slug, url);
  if (platform === "blogger") result = await verifyHtml(slug, url);
  if (platform === "wordpress_earthstar") result = await verifyHtml(slug, url);
  if (platform === "feeder") result = await verifyFeeder(slug, url);

  if (result?.verified === true) return result;

  let recovered = null;
  if (platform === "devto") recovered = await recoverDevto(slug);
  if (platform === "tumblr_voa") recovered = await recoverTumblr(slug);
  if (platform === "blogger") recovered = await recoverBlogger(slug);
  if (platform === "wordpress_earthstar") recovered = await recoverWordPress(slug);
  if (platform === "feeder") {
    const feeder = await verifyFeeder(slug, "");
    recovered = feeder.verified ? { ...feeder, recovered_live: true } : null;
  }

  return recovered || result || { verified: null, reason: "not_checked", url };
}

export async function checkBacklinksEvent(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  if (!["GET", "POST"].includes(event.httpMethod)) return json(405, { error: "Method not allowed" });

  try {
    const checks = [];
    if (event.httpMethod === "POST") {
      const body = event.body ? JSON.parse(event.body) : {};
      if (Array.isArray(body.checks)) checks.push(...body.checks.slice(0, 50));
      else checks.push(body);
    } else {
      checks.push(event.queryStringParameters || {});
    }

    const results = {};
    for (const check of checks) {
      const slug = cleanSlug(check?.slug);
      const platform = String(check?.platform || "").trim().toLowerCase();
      if (!slug || !ALLOWED_PLATFORMS.has(platform)) continue;
      const result = await checkOne(check);
      results[slug] ||= {};
      results[slug][platform] = result;
    }

    return json(200, {
      ok: true,
      generated_at: new Date().toISOString(),
      checked: Object.values(results).reduce((sum, row) => sum + Object.keys(row).length, 0),
      slugs: results,
    });
  } catch (error) {
    console.error("backlink checker error:", error);
    return json(500, { ok: false, error: error.message || "Backlink checker failed" });
  }
}
