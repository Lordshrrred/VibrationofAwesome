#!/usr/bin/env node
/**
 * generate-from-inspiration.js
 *
 * Reads PDF filenames from the AI inspiration folder, derives topics from
 * filenames only (no PDF parsing), generates original Boom Frequency posts
 * via Claude API, and adds them to the drip queue (status stays paused).
 *
 * Usage:
 *   node scripts/generate-from-inspiration.js
 *
 * Fully resumable ~ skips any slug that already has a draft HTML file.
 * Processes in batches of 5 with a 3s delay between batches.
 */

import { createAnthropicClient } from './lib/anthropic-client.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import { AI_ENGINE_URL, FIELD_GUIDE_URL, normalizeBoomHtml } from './lib/boom-format.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── Config ────────────────────────────────────────────────────────────────────
const PDF_FOLDER   = path.resolve(process.env.HOME, 'Library/Mobile Documents/com~apple~CloudDocs/Documents/EarthStarVOA/AI-Advantage-Resources 4 Blog Engine');
const DRAFTS_DIR   = path.resolve(ROOT, 'static/blog/boom/drafts');
const QUEUE_FILE   = path.resolve(ROOT, 'static/_data/drip-queue.json');
const BATCH_SIZE   = 5;
const BATCH_DELAY  = 3000;
const MODEL_FAST   = 'claude-haiku-4-5-20251001';   // keyword step ~ cheap + fast
const MODEL_WRITER = 'claude-sonnet-4-6';            // post generation ~ full quality

// NASA APOD images rotated across posts so OG images aren't all identical
const NASA_IMAGES = [
  'https://apod.nasa.gov/apod/image/0610/IC342NML_gendler_f.jpg',
  'https://apod.nasa.gov/apod/image/0712/ic1396_wood_big.jpg',
  'https://apod.nasa.gov/apod/image/2310/ngc1232b_vlt_960.jpg',
  'https://apod.nasa.gov/apod/image/2209/NGC7293-Helix-Nebula.jpg',
  'https://apod.nasa.gov/apod/image/2301/TaurusRegion_Coenraads.jpg',
  'https://apod.nasa.gov/apod/image/2311/Pillars_Webb_960.jpg',
  'https://apod.nasa.gov/apod/image/2208/NGC6618_Webb_960.jpg',
  'https://apod.nasa.gov/apod/image/2302/CrabNebula_Webb_960.jpg',
  'https://apod.nasa.gov/apod/image/2304/sombrero_spitzer_3000.jpg',
  'https://apod.nasa.gov/apod/image/2307/M31_HubbleSpitzerGalex.jpg',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/** "16 - custom-gpts-build-your-first-one.pdf" → "How to Build Your First Custom GPT" */
function filenameToRawTopic(filename) {
  let name = filename.replace(/\.pdf$/i, '');
  // strip leading number + separator (e.g. "16 - " or "16. " or "16- ")
  name = name.replace(/^\d+\s*[-\.]\s*/, '');
  // strip "hotw-" prefix (stands for "how-to workflow" series)
  name = name.replace(/^hotw-/i, '');
  // hyphens/underscores → spaces
  name = name.replace(/[-_]+/g, ' ').trim();
  // title-case each word
  name = name.replace(/\b\w/g, c => c.toUpperCase());
  // fix known acronyms and tool names
  name = name
    .replace(/\bAi\b/g, 'AI')
    .replace(/\bLlm\b/g, 'LLM')
    .replace(/\bChatgpt\b/g, 'ChatGPT')
    .replace(/\bGpt\b/g, 'GPT')
    .replace(/\bNotebooklm\b/g, 'NotebookLM')
    .replace(/\bElevenlabs\b/g, 'ElevenLabs')
    .replace(/\bHeygen\b/g, 'HeyGen')
    .replace(/\bReplit\b/g, 'Replit')
    .replace(/\bSop\b/g, 'SOP')
    .replace(/\bDms\b/g, 'DMs')
    .replace(/\bDean[''s]*\s+Top/g, 'Top AI');  // strip trainer name, keep topic intent
  return name;
}

/** Keyword phrase → URL slug */
function keywordToSlug(keyword) {
  return keyword
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/** ISO date → "May 7, 2026" */
function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/** Escape HTML attribute values */
function esc(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── API calls ─────────────────────────────────────────────────────────────────

async function getKeyword(client, rawTopic) {
  const msg = await client.messages.create({
    model: MODEL_FAST,
    max_tokens: 60,
    messages: [{
      role: 'user',
      content:
`You are an SEO expert for a blog targeting creators, musicians, independent artists, and neurodivergent entrepreneurs.

Topic area: "${rawTopic}"

Identify the single best SEO long-tail keyword for this topic.
Requirements:
~ Low to medium competition
~ High intent ~ someone who wants to actually DO this, not just learn abstractly
~ Specific enough to rank for
~ Sounds natural, not keyword-stuffed
~ Directly relevant to creators, musicians, artists, or AI users

Return ONLY the keyword phrase. No explanation, no quotes, no trailing punctuation.`,
    }],
  });
  return msg.content[0].text.trim().toLowerCase();
}

async function generatePost(client, rawTopic, keyword) {
  const msg = await client.messages.create({
    model: MODEL_WRITER,
    max_tokens: 4096,
    system:
`You are Matty BoomBoom ~ the voice of the Boom Frequency blog at vibrationofawesome.com.
You are a creator, musician, and AI power user with 20 years of internet marketing experience.
You write for creators, musicians, neurodivergent entrepreneurs, independent artists, and people
using AI to build creative freedom and income.

TRUTHFULNESS RULES (non-negotiable):
- You may use first person ONLY for broad viewpoint, tone, or philosophy ~ never for a specific lived experience, action, or result.
- Allowed: "The way I think about this is...", "The mistake most creators make is...", "This matters because...".
- NOT allowed unless explicitly provided as source data: fabricated testing history, tool usage, timelines, origin stories, customer/client results, income or traffic claims, or specific personal actions.
- Never write first-person claims of specific lived experience or testing, including: "I tested", "I tried", "I threw", "I built", "I discovered", "I use daily", "I've been using", "I spent [time period]", "I stumbled into", "I ran", "I uploaded", "I compared", "I measured", "I found that", "my workflow", "my stack", "my clients", "my customers", "what I use", "after testing dozens", "I made $X".
- This includes disguised versions: a personal origin story ("the system I built after years of crashing and burning"), a fabricated timeline, or a fabricated skill-history claim.
- Matty BoomBoom is an AI persona. Do not fabricate first-person tool usage or testing history.
- Instead use: "worth testing", "a practical starting point", "these tools can help when used intentionally", "for creators who want...", "the case for this tool is...", "here's a method for...".
- When uncertain whether a claim is fabricated, rewrite it as general guidance, not personal testimony.
- Editorial opinion and voice are fine. Fake personal authority over specific tools is not.`,
    messages: [{
      role: 'user',
      content:
`Your job is to write a KILLER original SEO blog post targeting this keyword: ${keyword}
Topic area: ${rawTopic}

This post must be the best damn article someone has ever read on this subject. Genuinely helpful.
Specific. Real. No fluff. No padding. No generic AI content that could have been written by anyone.

Write it like someone who has done the research and synthesis, and you are sharing hard-won clarity
with someone who needs to know it right now. Frame insights as grounded observations, not personal anecdotes.

HARD RULES:
~ 100% original content ~ not inspired by, not based on, not referencing any course, program,
  training, or external resource whatsoever
~ No images ~ text only
~ No comments sections ~ just the article
~ No em dashes ~ use tildes instead
~ No corporate language, no generic AI voice
~ Short punchy paragraphs ~ max 3 sentences each
~ Use H2 and H3 subheadings throughout
~ First line must be exactly:
  META: [compelling meta description under 160 chars]
~ Use the target keyword naturally in the first paragraph, at least 2 H2s, and the conclusion
~ Mention the AI Engine guide naturally 1-2 times as the primary deeper resource: ${AI_ENGINE_URL}
~ Mention the VOA Field Guide only if it genuinely fits as a softer secondary resource: ${FIELD_GUIDE_URL}
~ End with a genuine CTA to go deeper with the AI Engine guide
~ 900-1200 words
~ Return clean HTML body content only ~ no html/head/body wrapper tags
~ No reference to AI Advantage, any course, any trainer, any program ~ ever`,
    }],
  });
  return msg.content[0].text.trim();
}

// ── Template ──────────────────────────────────────────────────────────────────

function buildHTML({ title, slug, keyword, meta, body, dateISO, nasaImg }) {
  const url = `https://vibrationofawesome.com/blog/boom/posts/${slug}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)} | Boom Frequency | Vibration of Awesome</title>
  <meta name="description" content="${esc(meta)}">
  <link rel="canonical" href="${url}">
  <meta name="robots" content="index, follow">
  <meta name="theme-color" content="#00e5ff">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="192x192" href="/favicon-192x192.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
  <link rel="manifest" href="/site.webmanifest">
  <!-- Open Graph -->
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Vibration of Awesome">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(meta)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${nasaImg}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <!-- Twitter / X Cards -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(meta)}">
  <meta name="twitter:image" content="${nasaImg}">
  <!-- Structured Data -->
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"BlogPosting","headline":"${esc(title)}","description":"${esc(meta)}","url":"${url}","datePublished":"${dateISO}","author":{"@type":"Person","name":"Matty BoomBoom","url":"https://vibrationofawesome.com"},"publisher":{"@type":"Organization","name":"Vibration of Awesome","url":"https://vibrationofawesome.com"},"image":"${nasaImg}","mainEntityOfPage":{"@type":"WebPage","@id":"${url}"}}
  <\/script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <!-- Google Analytics GA4 -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-G5HF0WKZT9"><\/script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag("js", new Date());
    gtag("config", "G-G5HF0WKZT9");
  <\/script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #020a0a; --surface: #060f10; --surface2: #0b1a1c;
      --accent: #00e5ff; --accent-light: #b2f5ff; --accent-dark: #0097a7;
      --text: #e8f4f0; --text-muted: #7a9e9a; --border: rgba(255,255,255,0.06);
    }
    html { scroll-behavior: smooth; }
    body { background: var(--bg); color: var(--text); font-family: Space Grotesk, Inter, sans-serif; font-size: 18px; line-height: 1.75; min-height: 100vh; overflow-x: hidden; }
    #stars-canvas { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; pointer-events: none; }
    .site-wrapper { position: relative; z-index: 1; display: flex; flex-direction: column; min-height: 100vh; }
    .container { max-width: 760px; margin: 0 auto; padding: 0 1.5rem; width: 100%; }
    .site-header { border-bottom: 1px solid var(--border); background: rgba(2,10,10,0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); padding: 1rem 0; position: sticky; top: 0; z-index: 100; }
    .site-header .container { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
    .voa-logo { font-family: Space Grotesk, sans-serif; font-weight: 700; font-size: 1rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text); text-decoration: none; opacity: 0.9; transition: opacity 0.2s; }
    .voa-logo span { color: var(--accent); }
    .voa-logo:hover { opacity: 1; }
    .header-blog-name { font-size: 0.8rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); opacity: 0.8; }
    .breadcrumb { padding: 0.75rem 0; font-size: 0.82rem; color: var(--text-muted); }
    .breadcrumb a { color: var(--text-muted); text-decoration: none; transition: color 0.2s; }
    .breadcrumb a:hover { color: var(--accent); }
    .breadcrumb .sep { margin: 0 0.4rem; opacity: 0.4; }
    .post-header { position:relative; z-index:1; overflow:hidden; width:100vw; margin-left:calc(50% - 50vw); margin-right:calc(50% - 50vw); min-height:31rem; display:flex; align-items:flex-end; padding:12rem 4rem 4rem; border-bottom:1px solid rgba(0,229,255,0.16); background-color:#020a0a; background:linear-gradient(to bottom, rgba(2,10,8,0.55) 0%, rgba(2,10,8,0.82) 62%, #020a0a 100%), url('${nasaImg}') center/cover no-repeat; }
    .post-header-inner { max-width:760px; margin:0 auto; padding:0 1.5rem; width:100%; }
    .post-header > *:not(.ev-art) { position:relative; z-index:1; }
    .ev-art { position:absolute; inset:0; z-index:0; opacity:0.35; pointer-events:none; }
    .lane-badge { display: inline-block; font-family: Space Grotesk, sans-serif; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: var(--accent); border: 1px solid var(--accent); border-radius: 2px; padding: 0.2em 0.6em; margin-bottom: 1.2rem; }
    .post-title { font-size: clamp(1.8rem, 4vw, 2.6rem); font-weight: 700; line-height: 1.2; color: var(--text); margin-bottom: 1rem; }
    .post-meta { font-size: 0.85rem; color: var(--text-muted); display: flex; gap: 1rem; flex-wrap: wrap; align-items: center; }
    .post-meta .author { color: var(--accent-light); }
    .post-body { padding: 2.5rem 0 3rem; flex: 1; }
    .post-body p { margin-bottom: 1.4em; }
    .post-body h2 { font-size: 1.5rem; font-weight: 700; color: var(--accent-light); margin: 2.5rem 0 0.8rem; padding-bottom: 0.3rem; border-bottom: 1px solid var(--border); }
    .post-body h3 { font-size: 1.2rem; font-weight: 600; color: var(--text); margin: 1.8rem 0 0.6rem; }
    .post-body h4, .post-body h5, .post-body h6 { font-size: 1.05rem; font-weight: 600; color: var(--text-muted); margin: 1.4rem 0 0.5rem; }
    .post-body a { color: var(--accent); text-decoration: underline; text-underline-offset: 3px; transition: color 0.2s; }
    .post-body a:hover { color: var(--accent-light); }
    .post-body ul, .post-body ol { margin: 0.8em 0 1.4em 1.6em; }
    .post-body li { margin-bottom: 0.4em; }
    .post-body blockquote { border-left: 3px solid var(--accent); padding: 0.6em 1.2em; margin: 1.5em 0; color: var(--text-muted); font-style: italic; background: var(--surface2); border-radius: 0 4px 4px 0; }
    .post-body code { background: var(--surface2); color: var(--accent-light); padding: 0.15em 0.4em; border-radius: 3px; font-size: 0.88em; font-family: JetBrains Mono, Fira Code, monospace; }
    .post-body pre { background: var(--surface2); border: 1px solid var(--border); border-radius: 6px; padding: 1.2em; overflow-x: auto; margin: 1.5em 0; }
    .post-body pre code { background: none; padding: 0; color: var(--text); }
    .post-body hr { border: none; border-top: 1px solid var(--border); margin: 2.5em 0; }
    .post-body strong { color: var(--accent-light); font-weight: 600; }
    .post-body em { font-style: italic; }
    .site-footer { border-top: 1px solid var(--border); padding: 2rem 0; text-align: center; font-size: 0.82rem; color: var(--text-muted); }
    .site-footer a { color: var(--accent); text-decoration: none; }
    footer p { margin: 0; }
    footer .footer-brand { margin-top: 0.9rem; display: flex; flex-direction: column; align-items: center; gap: 0.36rem; }
    footer .footer-logo { font-family: 'Cinzel Decorative', serif; font-size: 1.18rem; letter-spacing: 0.08em; color: rgba(112,182,196,0.72); text-decoration: none; text-shadow: 0 0 18px rgba(0,229,255,0.12); transition: color 0.22s ease; border-bottom: 1px solid transparent; padding-bottom: 0.08rem; }
    footer .footer-logo span { font-size: 0.82em; opacity: 0.92; }
    footer a.footer-logo:hover { color: #00e5ff; text-shadow: 0 0 24px rgba(0,229,255,0.24); border-bottom-color: rgba(0,229,255,0.75); }
    footer .footer-tagline { font-family: Georgia, serif; font-style: italic; font-size: 0.98rem; color: rgba(207,246,255,0.76); }
    footer, .site-footer { text-align: center; width: 100%; }
    footer .footer-meta, .site-footer .footer-meta { display: block; width: 100%; margin-left: auto; margin-right: auto; text-align: center; }
    footer .footer-brand, .site-footer .footer-brand { margin-left: auto; margin-right: auto; text-align: center; }
    footer .footer-meta a, .site-footer .footer-meta a { color: var(--accent, var(--cyan, var(--amber, #00e5ff))) !important; text-decoration: none; border-bottom: 1px solid rgba(0,229,255,0.28); }
    footer .footer-meta a:hover, .site-footer .footer-meta a:hover { color: var(--accent-light, var(--cyan, var(--amber, #7ef2ff))) !important; border-bottom-color: currentColor; }
    .site-footer a:hover { text-decoration: underline; }
    @media (max-width: 768px) { body { font-size: 16px; } .post-header { padding: 10rem 1.5rem 3rem; } }
  </style>
</head>
<body>

<canvas id="stars-canvas" aria-hidden="true"></canvas>

<div class="site-wrapper">
  <header class="site-header">
    <div class="container">
      <a href="/" class="voa-logo">Vibration<span>of</span>Awesome</a>
      <span class="header-blog-name">Boom Frequency</span>
    </div>
  </header>
  <main>
    <div class="container">
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a href="/">Home</a><span class="sep">&#8250;</span>
        <a href="/blog/">Blog</a><span class="sep">&#8250;</span>
        <a href="/blog/boom/">Boom Frequency</a><span class="sep">&#8250;</span>
        <span>${esc(title)}</span>
      </nav>
      <header class="post-header">
        <div class="post-header-inner">
          <div class="lane-badge">BOOM FREQUENCY</div>
          <h1 class="post-title">${esc(title)}</h1>
          <div class="post-meta">
            <span class="author">by Matty BoomBoom (AI)</span>
            <span>&middot;</span>
            <time datetime="${dateISO}">${formatDate(dateISO)}</time>
          </div>
        </div>
      </header>
      <article class="post-body">
        ${body}
      </article>
    </div>
  </main>
  <footer class="site-footer">
    <div class="container">
      <p>&copy; 2026 <a href="https://vibrationofawesome.com">Vibration of Awesome</a>
      &nbsp;&middot;&nbsp; <a href="/blog/boom/">Boom Frequency</a> &nbsp;&middot;&nbsp; <a href="/blog/">All Posts</a></p>
    </div>
    <div class="footer-brand">
      <a href="/" class="footer-logo">Vibration <span>of</span> Awesome</a>
      <div class="footer-tagline">Empower Thyself. Empower the Earth.</div>
    </div>
  </footer>
</div>

<script>
(function() {
  var canvas = document.getElementById("stars-canvas");
  var ctx = canvas.getContext("2d");
  var stars = [];
  var STAR_COUNT = 160;
  var AR = 0, AG = 229, AB = 255;
  function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  function initStars() {
    stars = [];
    for (var i = 0; i < STAR_COUNT; i++) {
      stars.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height,
        r: Math.random() * 1.2 + 0.2, speed: Math.random() * 0.15 + 0.03,
        opacity: Math.random() * 0.6 + 0.2, pulse: Math.random() * Math.PI * 2,
        pulseSpeed: Math.random() * 0.008 + 0.003, isAccent: Math.random() < 0.04 });
    }
  }
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      s.pulse += s.pulseSpeed;
      var op = s.opacity * (0.7 + 0.3 * Math.sin(s.pulse));
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      if (s.isAccent) { ctx.fillStyle = "rgba(" + AR + "," + AG + "," + AB + "," + op + ")"; }
      else { ctx.fillStyle = "rgba(255,255,255," + op + ")"; }
      ctx.fill();
      s.y += s.speed;
      if (s.y > canvas.height + 2) { s.y = -2; s.x = Math.random() * canvas.width; }
    }
    requestAnimationFrame(draw);
  }
  window.addEventListener("resize", function() { resize(); initStars(); });
  resize(); initStars(); draw();
})();
<\/script>
</body>
</html>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Verify PDF folder exists
  if (!fs.existsSync(PDF_FOLDER)) {
    console.error('\n❌  PDF folder not found at:');
    console.error(`    ${PDF_FOLDER}\n`);
    console.error('Please place the 69 PDF files at that path and run this script again.');
    console.error('The script reads filenames only ~ no PDF content is ever parsed or sent to the API.\n');
    process.exit(1);
  }

  // Read PDF filenames
  const allFiles = fs.readdirSync(PDF_FOLDER).filter(f => f.toLowerCase().endsWith('.pdf')).sort();
  const total = allFiles.length;
  console.log(`\n📂  Found ${total} PDF files in inspiration folder`);

  if (total === 0) {
    console.error('❌  No .pdf files found in folder. Check the path and try again.\n');
    process.exit(1);
  }

  // Load drip queue
  const queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
  if (queue.status !== 'paused') {
    console.warn(`⚠️   drip-queue.json status is "${queue.status}" ~ expected "paused". Proceeding but NOT changing status.`);
  }
  const existingSlugs = new Set(queue.queue.map(e => e.slug));

  // Determine which PDFs still need processing
  const toProcess = [];
  const skipped = [];
  for (const file of allFiles) {
    const rawTopic = filenameToRawTopic(file);
    // Use a temp slug from raw topic to check draft existence ~ real slug comes from keyword
    // Instead check by raw topic slug to see if any draft file already handles this topic
    const rawSlug = keywordToSlug(rawTopic);
    const draftPath = path.join(DRAFTS_DIR, `${rawSlug}.html`);
    // Also check queue for a matching raw slug
    if (fs.existsSync(draftPath) || existingSlugs.has(rawSlug)) {
      skipped.push(file);
    } else {
      toProcess.push(file);
    }
  }

  console.log(`✅  ${skipped.length} already have drafts ~ skipping`);
  console.log(`⚡  ${toProcess.length} to generate\n`);

  if (toProcess.length === 0) {
    console.log('Nothing left to generate. All done!\n');
    reportFinal(queue, skipped.length, 0, 0, []);
    return;
  }

  const client = createAnthropicClient({ label: "generate-from-inspiration" });
  fs.mkdirSync(DRAFTS_DIR, { recursive: true });

  let generated = 0;
  const failures = [];

  // Process in batches
  for (let batchStart = 0; batchStart < toProcess.length; batchStart += BATCH_SIZE) {
    const batch = toProcess.slice(batchStart, batchStart + BATCH_SIZE);

    for (const file of batch) {
      const idx = allFiles.indexOf(file) + 1;
      const rawTopic = filenameToRawTopic(file);
      console.log(`[${idx}/${total}] Topic: ${rawTopic}`);

      try {
        // Step A ~ keyword
        const keyword = await getKeyword(client, rawTopic);
        console.log(`[${idx}/${total}] Keyword: ${keyword}`);

        // Step B ~ post
        const rawContent = await generatePost(client, rawTopic, keyword);

        // Parse META line
        const lines = rawContent.split('\n');
        let meta = `${rawTopic} ~ a practical guide for creators and independent artists.`;
        let bodyLines = lines;
        if (lines[0].trim().startsWith('META:')) {
          meta = lines[0].replace(/^META:\s*/i, '').trim().slice(0, 160);
          bodyLines = lines.slice(1);
        }
        const body = bodyLines.join('\n').trim();

        // Derive slug from keyword
        const slug = keywordToSlug(keyword);
        const dateISO = new Date().toISOString();
        const nasaImg = NASA_IMAGES[generated % NASA_IMAGES.length];

        // Build the title: use keyword converted to title-case as the post title
        const title = keyword.replace(/\b\w/g, c => c.toUpperCase());

        // Build and save HTML
        const html = normalizeBoomHtml(
          buildHTML({ title, slug, keyword, meta, body, dateISO, nasaImg }),
          { slug, title, keyword, niche: 'ai-creator-tools' }
        );
        const draftPath = path.join(DRAFTS_DIR, `${slug}.html`);
        fs.writeFileSync(draftPath, html, 'utf8');
        console.log(`[${idx}/${total}] ✓ Saved: static/blog/boom/drafts/${slug}.html`);

        // Add to drip queue if not already present
        if (!existingSlugs.has(slug)) {
          queue.queue.push({ slug, title, keyword, pillar: 'AI + Creator Tools' });
          existingSlugs.add(slug);
          // Re-save queue after each entry so progress is preserved on interruption
          fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2), 'utf8');
          console.log(`[${idx}/${total}] ✓ Added to drip queue`);
        } else {
          console.log(`[${idx}/${total}] ~ Slug already in queue, skipping queue add`);
        }

        generated++;
      } catch (err) {
        console.error(`[${idx}/${total}] ✗ FAILED: ${err.message}`);
        failures.push({ file, error: err.message });
      }

      console.log('---');
    }

    // Delay between batches (not after the last batch)
    if (batchStart + BATCH_SIZE < toProcess.length) {
      console.log(`⏳  Batch complete. Waiting ${BATCH_DELAY / 1000}s before next batch...\n`);
      await delay(BATCH_DELAY);
    }
  }

  // Ensure queue status remains paused
  queue.status = 'paused';
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2), 'utf8');

  reportFinal(queue, skipped.length, generated, failures.length, failures);
}

function reportFinal(queue, skippedCount, generatedCount, failureCount, failures) {
  console.log('\n' + '═'.repeat(52));
  console.log('FINAL REPORT');
  console.log('═'.repeat(52));
  console.log(`Posts generated this run:  ${generatedCount}`);
  console.log(`Posts skipped (existed):   ${skippedCount}`);
  console.log(`Failures:                  ${failureCount}`);
  console.log(`Total in drip queue:       ${queue.queue.length}`);
  console.log(`Drip queue status:         ${queue.status}`);
  if (failures.length > 0) {
    console.log('\nFailures:');
    failures.forEach(f => console.log(`  ~ ${f.file}: ${f.error}`));
  }
  console.log('═'.repeat(52) + '\n');
}

main().catch(err => {
  console.error('\n❌  Fatal error:', err.message);
  process.exit(1);
});
