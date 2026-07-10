import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { cleanPublicPath } from "./clean-url.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");
const CLUSTERS_FILE = path.join(ROOT, "static", "_data", "topic-clusters.json");
const HUBS_FILE = path.join(ROOT, "static", "_data", "authority-hubs.json");
const ASSETS_FILE = path.join(ROOT, "static", "_data", "authority-assets.json");

const RELATED_MARKER = "data-internal-related";

const MONEY_TARGETS = {
  "ai-creator-tools": { url: "/ai-engine/", label: "AI Engine guide" },
  "creator-automation": { url: "/ai-engine/", label: "AI Engine guide" },
  "consciousness-technology": { url: "/ai-engine/", label: "AI Engine guide" },
  "art-buying-online": { url: "/art-store/", label: "EarthStar Art Store" },
  earthstar: { url: "/earthstar/", label: "EarthStar Initiative" },
  "nervous-system-creativity": { url: "/field-guide/", label: "VOA Field Guide" },
  "dopamine-attention": { url: "/field-guide/", label: "VOA Field Guide" },
  "emotional-regulation": { url: "/field-guide/", label: "VOA Field Guide" },
  philosophy: { url: "/field-guide/", label: "VOA Field Guide" },
  default: { url: "/field-guide/", label: "VOA Field Guide" },
};

const KEYWORD_CLUSTER_RULES = [
  { cluster: "ai-creator-tools", patterns: [/\bAI\b/i, /chatgpt/i, /claude/i, /gemini/i, /prompt/i, /pictory/i, /canva/i, /automation/i, /music/i, /musician/i] },
  { cluster: "art-buying-online", patterns: [/original art/i, /buy.*art/i, /art.*home/i, /art prints?/i, /art store/i, /wall art/i, /art for your/i] },
  { cluster: "nervous-system-creativity", patterns: [/nervous system/i, /anxiety/i, /overwhelmed/i, /safe in your body/i, /burnout/i] },
  { cluster: "dopamine-attention", patterns: [/dopamine/i, /scrolling/i, /numbing/i, /focus/i] },
  { cluster: "purpose-direction", patterns: [/purpose/i, /direction/i, /lost/i, /path/i] },
  { cluster: "building-life-that-fits", patterns: [/life.*want/i, /misaligned/i, /wrong life/i, /settled/i, /survival mode/i] },
  { cluster: "authentic-self-expression", patterns: [/true self/i, /identity/i, /authentic/i, /creative control/i, /voice/i] },
  { cluster: "spiritual-productivity", patterns: [/productiv/i, /morning routine/i, /alignment/i, /energy management/i] },
  { cluster: "emotional-regulation", patterns: [/emotion/i, /heal/i, /regulat/i, /shadow work/i] },
  { cluster: "consciousness-technology", patterns: [/conscious/i, /technology/i, /earthstar/i, /signal/i] },
];

export function loadTopicClusters() {
  try {
    const data = JSON.parse(fs.readFileSync(CLUSTERS_FILE, "utf8"));
    const clusters = Array.isArray(data.clusters) ? data.clusters : [];
    return {
      ...data,
      clusters,
      byKey: Object.fromEntries(clusters.map(cluster => [cluster.key, cluster])),
    };
  } catch (_) {
    return { clusters: [], byKey: {} };
  }
}

export function loadAuthorityHubs() {
  try {
    const data = JSON.parse(fs.readFileSync(HUBS_FILE, "utf8"));
    const hubs = Array.isArray(data.hubs) ? data.hubs : [];
    return {
      ...data,
      hubs,
      bySlug: Object.fromEntries(hubs.map(hub => [hub.slug, hub])),
    };
  } catch (_) {
    return { hubs: [], bySlug: {} };
  }
}

export function loadAuthorityAssets() {
  try {
    const data = JSON.parse(fs.readFileSync(ASSETS_FILE, "utf8"));
    const assets = Array.isArray(data.assets) ? data.assets : [];
    return {
      ...data,
      assets,
      bySlug: Object.fromEntries(assets.map(asset => [asset.slug, asset])),
    };
  } catch (_) {
    return { assets: [], bySlug: {} };
  }
}

export function inferCluster(post = {}, clusterData = loadTopicClusters()) {
  if (post.cluster && clusterData.byKey[post.cluster]) return post.cluster;

  const niche = post.niche || (Array.isArray(post.tags) ? post.tags.find(tag => clusterData.clusters.some(c => c.relatedNiches?.includes(tag))) : null);
  if (niche) {
    const direct = clusterData.clusters.find(cluster => Array.isArray(cluster.relatedNiches) && cluster.relatedNiches.includes(niche));
    if (direct) return direct.key;
  }

  const haystack = [post.title, post.slug, post.excerpt, post.keyword, post.pillar].filter(Boolean).join(" ");
  for (const rule of KEYWORD_CLUSTER_RULES) {
    if (rule.patterns.some(pattern => pattern.test(haystack))) return rule.cluster;
  }
  return null;
}

export function getMoneyTarget(post = {}, clusterKey = null, clusterData = loadTopicClusters()) {
  const cluster = clusterKey ? clusterData.byKey[clusterKey] : null;
  if (clusterKey && MONEY_TARGETS[clusterKey]) return MONEY_TARGETS[clusterKey];
  if (cluster?.contentType && MONEY_TARGETS[cluster.contentType]) return MONEY_TARGETS[cluster.contentType];
  return MONEY_TARGETS.default;
}

export function getAuthorityTargets(post = {}, clusterKey = null) {
  const hubData = loadAuthorityHubs();
  const assetData = loadAuthorityAssets();
  const haystack = [post.title, post.slug, post.excerpt, post.keyword, ...(post.tags || [])].filter(Boolean).join(" ").toLowerCase();
  const hub = hubData.hubs.find(item => {
    if (clusterKey && item.clusterKeys?.includes(clusterKey)) return true;
    return (item.keywords || []).some(keyword => haystack.includes(String(keyword).toLowerCase()));
  });
  const asset = assetData.assets.find(item => {
    if (!["published", "ready"].includes(item.status)) return false;
    return hub?.slug && item.hub === hub.slug;
  });

  return {
    hub: hub ? { url: `/hubs/${hub.slug}/`, label: `${hub.title} hub` } : null,
    asset: asset ? { url: cleanPublicPath(asset.canonical), label: asset.title } : null,
  };
}

function wordSet(value) {
  const stop = new Set(["the", "and", "for", "with", "that", "this", "your", "you", "how", "what", "why", "when", "from", "into", "are", "not", "can", "actually"]);
  return new Set(String(value || "").toLowerCase().match(/[a-z0-9]+/g)?.filter(word => word.length > 2 && !stop.has(word)) || []);
}

function scoreRelatedPost(source, candidate, clusterData) {
  if (!candidate?.slug || candidate.slug === source.slug) return -Infinity;

  const sourceCluster = inferCluster(source, clusterData);
  const candidateCluster = inferCluster(candidate, clusterData);
  const sourceClusterDef = sourceCluster ? clusterData.byKey[sourceCluster] : null;

  let score = 0;
  if (sourceCluster && candidateCluster && sourceCluster === candidateCluster) score += 100;
  if (sourceClusterDef?.relatedClusters?.includes(candidateCluster)) score += 45;
  if (source.niche && candidate.niche && source.niche === candidate.niche) score += 35;

  const a = wordSet([source.title, source.slug, source.keyword].join(" "));
  const b = wordSet([candidate.title, candidate.slug, candidate.excerpt].join(" "));
  for (const word of a) if (b.has(word)) score += 4;

  const age = Date.parse(candidate.date || "") || 0;
  if (age) score += Math.min(10, Math.max(0, (Date.now() - age) / 86_400_000 < 45 ? 10 : 0));
  return score;
}

export function selectRelatedPosts(source, posts, { limit = 3 } = {}) {
  const clusterData = loadTopicClusters();
  const seen = new Set();
  return posts
    .filter(post => post?.url && post?.title && post.slug !== source.slug)
    .map(post => ({ post, score: scoreRelatedPost(source, post, clusterData) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || String(a.post.title).localeCompare(String(b.post.title)))
    .filter(item => {
      if (seen.has(item.post.slug)) return false;
      seen.add(item.post.slug);
      return true;
    })
    .slice(0, limit)
    .map(item => ({
      title: item.post.title,
      slug: item.post.slug,
      url: cleanPublicPath(item.post.url),
      cluster: inferCluster(item.post, clusterData),
      score: item.score,
    }));
}

function linkExists(html, url) {
  const full = url.startsWith("http") ? url : `https://vibrationofawesome.com${url}`;
  return html.includes(`href="${url}"`) || html.includes(`href="${full}"`);
}

function buildRelatedBlock(source, related, clusterKey, clusterData) {
  const money = getMoneyTarget(source, clusterKey, clusterData);
  const authority = getAuthorityTargets(source, clusterKey);
  const lines = [
    `        <section ${RELATED_MARKER} data-cluster="${clusterKey || "unassigned"}" aria-label="Related reading">`,
    "          <h2>Related reading</h2>",
    "          <ul>",
    ...related.map(item => `            <li><a href="${item.url}">${escapeHtml(item.title)}</a></li>`),
  ];
  if (money && !related.some(item => item.url === money.url)) {
    lines.push(`            <li><a href="${money.url}">${escapeHtml(money.label)}</a></li>`);
  }
  if (authority.hub && !linkExists(lines.join("\n"), authority.hub.url)) {
    lines.push(`            <li><a href="${authority.hub.url}">${escapeHtml(authority.hub.label)}</a></li>`);
  }
  if (authority.asset && !linkExists(lines.join("\n"), authority.asset.url)) {
    lines.push(`            <li><a href="${authority.asset.url}">${escapeHtml(authority.asset.label)}</a></li>`);
  }
  lines.push("          </ul>");
  lines.push("        </section>");
  return lines.join("\n");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function ensureDeterministicInternalLinks(html, source, allPosts, options = {}) {
  if (!html) return { html, inserted: false, related: [], cluster: inferCluster(source) };
  if (html.includes(RELATED_MARKER) && !options.refresh) {
    return { html, inserted: false, related: [], cluster: inferCluster(source) };
  }

  const clusterData = loadTopicClusters();
  const cluster = inferCluster(source, clusterData);
  const workingHtml = options.refresh
    ? html.replace(/\s*<section\s+data-internal-related[\s\S]*?<\/section>\s*/gi, "\n")
    : html;
  const related = selectRelatedPosts(source, allPosts, { limit: options.limit || 3 })
    .filter(item => !linkExists(workingHtml, item.url));

  if (related.length < (options.minRelated || 1)) {
    return { html: workingHtml, inserted: false, related, cluster };
  }

  const block = buildRelatedBlock(source, related, cluster, clusterData);
  const anchors = [
    /(\s*<div style="height:1rem;"><\/div>\s*<div class="voa-photo-rotator")/i,
    /(\s*<div class="voa-photo-rotator")/i,
    /(\s*<div data-ebook-cta)/i,
    /(\s*<\/article>)/i,
  ];
  for (const anchor of anchors) {
    if (anchor.test(workingHtml)) {
      return {
        html: workingHtml.replace(anchor, `\n${block}\n$1`),
        inserted: true,
        related,
        cluster,
      };
    }
  }
  return { html, inserted: false, related, cluster };
}

/**
 * Reciprocal side of ensureDeterministicInternalLinks(): that function makes
 * the NEW post link forward to `related` older posts. This makes those older
 * posts link back to the new one, so topic clusters interlink both ways
 * instead of only accumulating forward links from whichever post was written
 * most recently. Mutates each older post's HTML file on disk directly (they're
 * already published). Idempotent ~ skips a post that already links to the new
 * one, and skips (rather than corrupts) a file with no recognizable insertion
 * point. Returns the list of slugs actually updated.
 */
export function backlinkOlderPosts(newPost, relatedPosts, { postsDir }) {
  const updated = [];
  for (const rel of relatedPosts) {
    const filePath = path.join(postsDir, `${rel.slug}.html`);
    if (!fs.existsSync(filePath)) continue;

    const html = fs.readFileSync(filePath, "utf8");
    if (linkExists(html, newPost.url)) continue;

    const newLi = `            <li><a href="${newPost.url}">${escapeHtml(newPost.title)}</a></li>`;
    let patched = html;

    if (html.includes(RELATED_MARKER)) {
      const withNewLi = html.replace(
        new RegExp(`(<section[^>]*${RELATED_MARKER}[\\s\\S]*?<ul>)`, "i"),
        `$1\n${newLi}`
      );
      if (withNewLi !== html) patched = withNewLi;
    } else {
      const block = [
        `        <section ${RELATED_MARKER} data-cluster="${rel.cluster || "unassigned"}" aria-label="Related reading">`,
        "          <h2>Related reading</h2>",
        "          <ul>",
        newLi,
        "          </ul>",
        "        </section>",
      ].join("\n");
      const anchors = [
        /(\s*<div style="height:1rem;"><\/div>\s*<div class="voa-photo-rotator")/i,
        /(\s*<div class="voa-photo-rotator")/i,
        /(\s*<div data-ebook-cta)/i,
        /(\s*<\/article>)/i,
      ];
      for (const anchor of anchors) {
        if (anchor.test(html)) {
          patched = html.replace(anchor, `\n${block}\n$1`);
          break;
        }
      }
    }

    if (patched !== html) {
      fs.writeFileSync(filePath, patched, "utf8");
      updated.push(rel.slug);
    }
  }
  return updated;
}

export function countContextualInternalLinks(html) {
  const articleMatch = String(html || "").match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  const scope = articleMatch ? articleMatch[1] : String(html || "");
  const cleaned = scope
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<section[^>]*data-internal-related[\s\S]*?<\/section>/gi, "")
    .replace(/<div[^>]*(?:data-ebook-cta|data-art-store-whisper|data-ai-engine-cta|voa-photo-rotator)[\s\S]*?<\/div>/gi, "");
  return [...cleaned.matchAll(/<a\s+href="([^"]+)"/gi)]
    .filter(match => /^\/(?:blog|ai-engine|art-store|field-guide|earthstar)\//.test(match[1]) || /^https:\/\/vibrationofawesome\.com\/(?:blog|ai-engine|art-store|field-guide|earthstar)\//.test(match[1]))
    .length;
}
