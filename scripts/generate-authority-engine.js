#!/usr/bin/env node
/**
 * generate-authority-engine.js
 *
 * Builds VOA authority hub and tool pages from data files. This keeps
 * evergreen assets in a second lane beside daily blog publishing.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { inferCluster, loadTopicClusters } from "./lib/internal-linking.js";

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

function ensureDir(rel) {
  fs.mkdirSync(path.join(ROOT, rel), { recursive: true });
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
  if (!url) return BASE + "/";
  if (url.startsWith("http")) return url;
  return `${BASE}${url.startsWith("/") ? "" : "/"}${url}`;
}

function normalizePost(post, lane, clusterData) {
  const cluster = inferCluster(post, clusterData);
  return {
    ...post,
    lane,
    cluster,
    url: post.url || `/blog/${lane}/posts/${post.slug}`,
  };
}

function matchesHub(post, hub) {
  if (hub.clusterKeys?.includes(post.cluster)) return true;
  const haystack = [post.title, post.slug, post.excerpt, ...(post.tags || [])].join(" ").toLowerCase();
  return (hub.keywords || []).some(keyword => haystack.includes(String(keyword).toLowerCase()));
}

function sortPosts(posts) {
  return posts
    .filter(post => post.title && post.url)
    .sort((a, b) => (Date.parse(b.date || "") || 0) - (Date.parse(a.date || "") || 0));
}

function pageChrome({ title, description, canonical, type = "website", body, schema = [] }) {
  const jsonLd = schema.map(item => {
    return `  <script type="application/ld+json">\n${JSON.stringify(item)}\n  </script>`;
  }).join("\n");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
  <style>
    :root { --bg:#020a0a; --panel:#061312; --line:rgba(0,229,204,.16); --text:#e8fff9; --muted:rgba(232,255,249,.72); --cyan:#00e5cc; --green:#30ff54; }
    * { box-sizing:border-box; }
    body { margin:0; background:radial-gradient(circle at 50% -10%, rgba(0,229,204,.18), transparent 34%), var(--bg); color:var(--text); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height:1.65; }
    a { color:var(--cyan); text-underline-offset:3px; }
    .shell { width:min(1080px, calc(100% - 32px)); margin:0 auto; }
    .nav { display:flex; justify-content:space-between; align-items:center; gap:1rem; padding:1rem 0; border-bottom:1px solid var(--line); }
    .brand { color:var(--text); text-decoration:none; font-weight:800; letter-spacing:.08em; text-transform:uppercase; font-size:.82rem; }
    .navlinks { display:flex; gap:.9rem; flex-wrap:wrap; justify-content:flex-end; }
    .navlinks a { color:var(--muted); text-decoration:none; font-size:.78rem; text-transform:uppercase; letter-spacing:.08em; }
    .hero { padding:5.5rem 0 3rem; }
    .eyebrow { color:var(--green); text-transform:uppercase; letter-spacing:.18em; font-size:.78rem; font-weight:800; }
    h1 { font-size:clamp(2.2rem, 7vw, 4.7rem); line-height:1.02; margin:.75rem 0 1rem; max-width:920px; }
    h2 { margin-top:2.5rem; font-size:clamp(1.35rem, 3vw, 2rem); }
    p { color:var(--muted); max-width:780px; }
    .grid { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:1rem; margin:1.5rem 0 3rem; }
    .card { border:1px solid var(--line); background:rgba(255,255,255,.025); padding:1.1rem; min-height:100%; }
    .card h3 { margin:.1rem 0 .55rem; font-size:1rem; line-height:1.35; }
    .card p { margin:0; font-size:.92rem; }
    .meta { color:rgba(232,255,249,.52); font-size:.78rem; text-transform:uppercase; letter-spacing:.08em; }
    .button { display:inline-flex; align-items:center; justify-content:center; min-height:44px; padding:.75rem 1rem; border:1px solid rgba(48,255,84,.34); color:var(--green); text-decoration:none; text-transform:uppercase; letter-spacing:.08em; font-weight:800; font-size:.8rem; }
    .tool { border:1px solid var(--line); background:rgba(0,0,0,.25); padding:1.25rem; margin:1.5rem 0 3rem; }
    .question { padding:1rem 0; border-top:1px solid rgba(255,255,255,.08); }
    .answers { display:grid; grid-template-columns:repeat(4, 1fr); gap:.5rem; margin-top:.7rem; }
    label { display:flex; gap:.45rem; align-items:center; border:1px solid rgba(255,255,255,.12); padding:.65rem; color:var(--muted); cursor:pointer; }
    .result { display:none; border:1px solid rgba(48,255,84,.28); padding:1rem; background:rgba(48,255,84,.04); }
    footer { padding:3rem 0; color:rgba(232,255,249,.55); border-top:1px solid var(--line); margin-top:3rem; }
    @media (max-width:820px) { .grid, .answers { grid-template-columns:1fr; } .hero { padding-top:3rem; } }
  </style>
</head>
<body>
  <div class="shell">
    <nav class="nav" aria-label="Site navigation">
      <a class="brand" href="/">Vibration of Awesome</a>
      <div class="navlinks">
        <a href="/hubs/">Hubs</a>
        <a href="/tools/">Tools</a>
        <a href="/field-guide/">Field Guide</a>
        <a href="/blog/">Blog</a>
      </div>
    </nav>
${body}
    <footer>
      <p>Vibration of Awesome builds original reference material, reflection tools, and creative systems for humans reclaiming their signal.</p>
    </footer>
  </div>
</body>
</html>
`;
}

function baseSchema({ title, description, canonical }) {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${BASE}/#organization`,
      "name": "Vibration of Awesome",
      "url": BASE,
      "logo": `${BASE}/images/StarLogo.png`
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${BASE}/#website`,
      "name": "Vibration of Awesome",
      "url": BASE,
      "description": "Original resources for nervous system regulation, attention, creativity, personal transformation, and AI creator workflows.",
      "publisher": { "@id": `${BASE}/#organization` }
    },
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": title,
      "description": description,
      "url": absoluteUrl(canonical),
      "isPartOf": { "@id": `${BASE}/#website` },
      "dateModified": TODAY
    }
  ];
}

function breadcrumbs(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": absoluteUrl(item.url)
    }))
  };
}

function postCards(posts) {
  if (!posts.length) return `<p>Fresh resources are being mapped into this hub.</p>`;
  return `<div class="grid">
${posts.slice(0, 9).map(post => `<a class="card" href="${post.url}">
  <div class="meta">${escapeHtml(post.lane === "matt" ? "Forest Temple" : "Boom Frequency")}</div>
  <h3>${escapeHtml(post.title)}</h3>
  <p>${escapeHtml(post.excerpt || "")}</p>
</a>`).join("\n")}
</div>`;
}

function renderHubsIndex(hubs) {
  const title = "Vibration of Awesome Authority Hubs";
  const description = "Pillar pages for nervous system regulation, ADHD and focus, dopamine and attention, meditation, creativity, purpose, self-trust, AI creator workflows, and core VOA concepts.";
  const body = `    <main>
      <section class="hero">
        <div class="eyebrow">Authority Engine</div>
        <h1>Original VOA reference hubs</h1>
        <p>${escapeHtml(description)}</p>
      </section>
      <section class="grid" aria-label="Authority hubs">
${hubs.map(hub => `<a class="card" href="/hubs/${hub.slug}/">
  <div class="meta">Pillar Hub</div>
  <h3>${escapeHtml(hub.title)}</h3>
  <p>${escapeHtml(hub.description)}</p>
</a>`).join("\n")}
      </section>
    </main>`;
  return pageChrome({
    title,
    description,
    canonical: "/hubs/",
    body,
    schema: [...baseSchema({ title, description, canonical: "/hubs/" }), breadcrumbs([{ name: "Home", url: "/" }, { name: "Hubs", url: "/hubs/" }])]
  });
}

function renderHub(hub, posts, assets) {
  const title = `${hub.title} Hub`;
  const description = hub.description;
  const canonical = `/hubs/${hub.slug}/`;
  const relatedAssets = assets.filter(asset => asset.hub === hub.slug || asset.canonical === hub.primaryAsset);
  const body = `    <main>
      <section class="hero">
        <div class="eyebrow">VOA Pillar Hub</div>
        <h1>${escapeHtml(hub.title)}</h1>
        <p>${escapeHtml(description)}</p>
        ${hub.primaryAsset ? `<a class="button" href="${hub.primaryAsset}">Open the featured resource</a>` : ""}
      </section>
      <section>
        <h2>Start Here</h2>
        ${postCards(posts)}
      </section>
      <section>
        <h2>Authority Assets</h2>
        <div class="grid">
${relatedAssets.length ? relatedAssets.map(asset => `<a class="card" href="${asset.canonical}">
  <div class="meta">${escapeHtml(asset.type)} - ${escapeHtml(asset.status)}</div>
  <h3>${escapeHtml(asset.title)}</h3>
  <p>${escapeHtml(asset.description)}</p>
</a>`).join("\n") : `<div class="card"><h3>Asset lane open</h3><p>Future tools, planners, glossaries, and protocol libraries will attach to this hub as they are approved.</p></div>`}
        </div>
      </section>
    </main>`;
  return pageChrome({
    title,
    description,
    canonical,
    body,
    schema: [
      ...baseSchema({ title, description, canonical }),
      breadcrumbs([{ name: "Home", url: "/" }, { name: "Hubs", url: "/hubs/" }, { name: hub.title, url: canonical }]),
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": title,
        "description": description,
        "url": absoluteUrl(canonical),
        "about": hub.title,
        "hasPart": posts.slice(0, 12).map(post => ({ "@type": "Article", "name": post.title, "url": absoluteUrl(post.url) }))
      }
    ]
  });
}

function renderToolsIndex(assets) {
  const title = "VOA Tools and Authority Assets";
  const description = "Assessments, planners, worksheets, journals, glossaries, timers, and protocol libraries from Vibration of Awesome.";
  const published = assets.filter(asset => ["published", "ready", "validating", "in development", "approved"].includes(asset.status));
  const body = `    <main>
      <section class="hero">
        <div class="eyebrow">Authority Assets</div>
        <h1>Useful tools for attention, regulation, creativity, and direction</h1>
        <p>${escapeHtml(description)}</p>
      </section>
      <section class="grid">
${published.map(asset => `<a class="card" href="${asset.canonical}">
  <div class="meta">${escapeHtml(asset.type)} - ${escapeHtml(asset.status)}</div>
  <h3>${escapeHtml(asset.title)}</h3>
  <p>${escapeHtml(asset.description)}</p>
</a>`).join("\n")}
      </section>
    </main>`;
  return pageChrome({
    title,
    description,
    canonical: "/tools/",
    body,
    schema: [...baseSchema({ title, description, canonical: "/tools/" }), breadcrumbs([{ name: "Home", url: "/" }, { name: "Tools", url: "/tools/" }])]
  });
}

function renderDigitalAttentionAudit() {
  const title = "Digital Attention Audit";
  const description = "A non-clinical reflection tool for noticing which digital inputs are draining focus, self-trust, and creative energy.";
  const canonical = "/tools/digital-attention-audit/";
  const questions = [
    "I reach for a screen before I know what I am actually feeling.",
    "My attention feels split even when I have time to focus.",
    "Digital inputs make it harder to hear my own creative signal.",
    "I use scrolling, feeds, or videos to avoid a decision I already know I need to make.",
    "After being online, I often feel flatter, foggier, or less self-trusting.",
    "My tools are controlling the rhythm of my day more than my actual priorities are."
  ];
  const body = `    <main>
      <section class="hero">
        <div class="eyebrow">Reflection Tool</div>
        <h1>Digital Attention Audit</h1>
        <p>${escapeHtml(description)}</p>
        <p><strong>Important:</strong> this is an educational reflection tool, not a medical, psychological, or diagnostic instrument.</p>
      </section>
      <section class="tool" aria-label="Digital Attention Audit questions">
        <form id="attention-audit">
${questions.map((q, i) => `<div class="question">
  <p><strong>${i + 1}.</strong> ${escapeHtml(q)}</p>
  <div class="answers">
    ${[0, 1, 2, 3].map(value => `<label><input type="radio" name="q${i}" value="${value}"> ${["Rarely", "Sometimes", "Often", "Very often"][value]}</label>`).join("")}
  </div>
</div>`).join("\n")}
          <button class="button" type="submit">See reflection</button>
        </form>
        <div id="audit-result" class="result" tabindex="-1"></div>
      </section>
      <section>
        <h2>What to do with the result</h2>
        <p>Use the score as a signal, not a verdict. Pick one digital input to reduce for seven days, then replace that slot with a physical cue: a walk, a notebook, one song, one breath practice, or one unfinished creative action.</p>
        <p><a href="/hubs/dopamine-attention/">Continue into the Dopamine & Attention hub</a>.</p>
      </section>
    </main>
    <script>
      document.getElementById("attention-audit").addEventListener("submit", function (event) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        let total = 0;
        let answered = 0;
        for (let i = 0; i < ${questions.length}; i += 1) {
          if (data.has("q" + i)) {
            total += Number(data.get("q" + i));
            answered += 1;
          }
        }
        const box = document.getElementById("audit-result");
        if (answered < ${questions.length}) {
          box.innerHTML = "<h2>Finish the audit</h2><p>Answer each prompt so the reflection has enough signal to be useful.</p>";
        } else if (total <= 5) {
          box.innerHTML = "<h2>Your attention has some room around it</h2><p>Your current digital inputs may be manageable. Keep protecting the parts of your day where your own signal is clearest.</p>";
        } else if (total <= 12) {
          box.innerHTML = "<h2>Your attention is asking for cleaner boundaries</h2><p>Choose one repeat input that reliably leaves you foggier, then give it a smaller container for the next seven days.</p>";
        } else {
          box.innerHTML = "<h2>Your system may be overloaded by input</h2><p>Start gently. Reduce one noisy source, add one grounding practice, and avoid turning this into another perfection project.</p>";
        }
        box.style.display = "block";
        box.focus();
      });
    </script>`;
  return pageChrome({
    title,
    description,
    canonical,
    body,
    schema: [
      ...baseSchema({ title, description, canonical }),
      breadcrumbs([{ name: "Home", url: "/" }, { name: "Tools", url: "/tools/" }, { name: title, url: canonical }]),
      {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        "name": title,
        "description": description,
        "url": absoluteUrl(canonical),
        "applicationCategory": "EducationalApplication",
        "operatingSystem": "Any",
        "isAccessibleForFree": true
      }
    ]
  });
}

function main() {
  ensureDir("static/hubs");
  ensureDir("static/tools");

  const clusterData = loadTopicClusters();
  const hubs = readJson("static/_data/authority-hubs.json", { hubs: [] }).hubs || [];
  const assets = readJson("static/_data/authority-assets.json", { assets: [] }).assets || [];
  const posts = [
    ...readJson("static/_data/boom-posts.json", []).map(post => normalizePost(post, "boom", clusterData)),
    ...readJson("static/_data/matt-posts.json", []).map(post => normalizePost(post, "matt", clusterData))
  ];

  writePage("static/hubs/index.html", renderHubsIndex(hubs));
  for (const hub of hubs) {
    const related = sortPosts(posts.filter(post => matchesHub(post, hub)));
    writePage(`static/hubs/${hub.slug}/index.html`, renderHub(hub, related, assets));
  }

  writePage("static/tools/index.html", renderToolsIndex(assets));
  writePage("static/tools/digital-attention-audit/index.html", renderDigitalAttentionAudit());
}

main();
