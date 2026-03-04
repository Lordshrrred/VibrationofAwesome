#!/usr/bin/env node
/**
 * generate-post.js — Claude API post generator for vibrationofawesome.com
 *
 * Usage:
 *   node generate-post.js --lane matt --title "Your Post Title Here"
 *   node generate-post.js --lane boombot --keyword "how to use claude api for musicians" --topic "AI tools for independent artists"
 *
 * Requires: ANTHROPIC_API_KEY in .env
 * Install deps: npm install @anthropic-ai/sdk dotenv marked
 */

const fs = require('fs');
const path = require('path');

// Load .env
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Anthropic = require('@anthropic-ai/sdk');
const { marked } = require('marked');

const ROOT = path.join(__dirname, '..');

// ── CLI argument parsing ──────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      opts[args[i].slice(2)] = args[i + 1] || true;
      i++;
    }
  }
  return opts;
}

// ── Slug generation ───────────────────────────────────────────────────────────

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 80);
}

// ── System prompts ────────────────────────────────────────────────────────────

const SYSTEM_PROMPTS = {
  matt: `You are Matt EarthStar, writing for your personal blog "From the Forest Temple."
Matt is a musician (EarthStar rock/metal/electronic, Ruzindla EDM/psytrance),
digital creator, Apple Tech Expert, and someone who has been grinding at internet
marketing for 20 years. He organizes his life through a personal system called
Forest Temple. His writing is raw, direct, and honest. No motivational fluff.
No generic self-help hooks. He writes like he talks — real stories, real lessons,
real frustration when warranted. His audience is spiritually awakening,
purpose-driven, neurodivergent, HSP, and alternative abundance seekers.
Write a full blog post based on the given title. Return raw markdown only.
No frontmatter. No meta blocks. Just the post content starting with the body.
Use H2 and H3 headings. Include a horizontal rule (---) as a divider where appropriate.
Aim for 800-1200 words.`,

  boombot: `You are Matty BoomBoom, an AI writer for the blog "Boom Frequency" at
vibrationofawesome.com. You are inspired by the spirit of Matt EarthStar — a musician,
digital creator, and 20-year internet marketing veteran who has gone deep on AI tools.
Your job is to write SEO-optimized, genuinely helpful long-form posts targeting
specific long-tail keywords. Your audience: spiritually awakening creators,
neurodivergent entrepreneurs, musicians learning AI, and abundance-minded outliers.
Write in a voice that is helpful, slightly eccentric, and real — never corporate,
never generic. Include H2 and H3 subheadings, a meta description at the top in this
format: [META: your description here], and a CTA section at the end pointing readers
to vibrationofawesome.com. Return raw markdown only. No frontmatter. Aim for 1200-1800 words.`,
};

// ── HTML post template ────────────────────────────────────────────────────────

function buildMattPostHTML({ title, date, slug, bodyHTML }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — Matt EarthStar</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&family=Rajdhani:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
  :root { --bg: #080e08; --amber: #ffb300; --text: #f0ead6; --muted: #6b7c5a; --gold: #00e5cc; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body { background: var(--bg); color: var(--text); font-family: 'Cormorant Garamond', serif; overflow-x: hidden; cursor: none; }
  .cursor { width: 8px; height: 8px; background: var(--amber); border-radius: 50%; position: fixed; pointer-events: none; z-index: 9999; transform: translate(-50%, -50%); display: none; }
  .cursor-ring { width: 30px; height: 30px; border: 1px solid rgba(255,179,0,0.35); border-radius: 50%; position: fixed; pointer-events: none; z-index: 9998; transform: translate(-50%, -50%); transition: all 0.15s ease; display: none; }
  .stars { position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; overflow: hidden; }
  .star { position: absolute; background: #ffd580; border-radius: 50%; animation: twinkle var(--dur, 3s) ease-in-out infinite; animation-delay: var(--delay, 0s); opacity: 0; }
  @keyframes twinkle { 0%, 100% { opacity: 0; } 50% { opacity: var(--brightness, 0.4); } }
  nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; padding: 1.5rem 3rem; display: flex; align-items: center; justify-content: space-between; background: linear-gradient(to bottom, rgba(8,14,8,0.97), transparent); border-bottom: 1px solid rgba(255,179,0,0.07); }
  .nav-logo { font-family: 'Cinzel Decorative', serif; font-size: 1rem; color: var(--amber); letter-spacing: 0.15em; text-decoration: none; }
  .nav-links { display: flex; gap: 2.5rem; list-style: none; }
  .nav-links a { font-family: 'Rajdhani', sans-serif; font-size: 0.8rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--muted); text-decoration: none; transition: color 0.3s; }
  .nav-links a:hover { color: var(--amber); }
  .hamburger { display: none; flex-direction: column; gap: 5px; cursor: pointer; padding: 4px; background: none; border: none; }
  .hamburger span { display: block; width: 24px; height: 2px; background: var(--amber); border-radius: 2px; }
  .post-hero { padding: 9rem 2rem 4rem; text-align: center; position: relative; overflow: hidden; border-bottom: 1px solid rgba(255,179,0,0.06); }
  .post-hero-bg { position: absolute; inset: 0; background: radial-gradient(ellipse 70% 80% at 50% 0%, rgba(30,55,10,0.7) 0%, transparent 70%), linear-gradient(to bottom, #040a04, #080e08); }
  .post-meta-top { position: relative; z-index: 2; margin-bottom: 2rem; }
  .breadcrumb { font-family: 'Rajdhani', sans-serif; font-size: 0.7rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--muted); }
  .breadcrumb a { color: var(--amber); text-decoration: none; opacity: 0.7; }
  .breadcrumb span { margin: 0 0.5rem; opacity: 0.4; }
  .post-title-hero { font-family: 'Cinzel Decorative', serif; font-size: clamp(1.6rem, 4vw, 2.8rem); color: #fff8e7; line-height: 1.2; max-width: 750px; margin: 1.5rem auto; position: relative; z-index: 2; }
  .post-meta { display: flex; align-items: center; justify-content: center; gap: 2rem; position: relative; z-index: 2; flex-wrap: wrap; }
  .post-byline { font-family: 'Rajdhani', sans-serif; font-size: 0.75rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--amber); opacity: 0.8; }
  .post-date-display { font-family: 'Rajdhani', sans-serif; font-size: 0.7rem; letter-spacing: 0.15em; color: var(--muted); }
  .post-container { max-width: 720px; margin: 0 auto; padding: 5rem 2rem 6rem; position: relative; z-index: 1; }
  .post-body { font-size: 1.15rem; line-height: 1.95; color: rgba(240,234,214,0.82); }
  .post-body p { margin-bottom: 1.8rem; }
  .post-body h2 { font-family: 'Cinzel Decorative', serif; font-size: 1.4rem; color: #fff8e7; margin: 3rem 0 1.2rem; line-height: 1.3; }
  .post-body h3 { font-family: 'Rajdhani', sans-serif; font-size: 1rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--amber); margin: 2.5rem 0 1rem; }
  .post-body blockquote { border-left: 2px solid var(--amber); padding-left: 2rem; margin: 2.5rem 0; color: rgba(255,230,160,0.6); font-style: italic; font-size: 1.25rem; line-height: 1.7; }
  .post-body strong { color: #fff8e7; font-weight: 600; }
  .post-body ul, .post-body ol { margin: 1.5rem 0 1.5rem 2rem; }
  .post-body li { margin-bottom: 0.7rem; line-height: 1.8; }
  .post-body hr { border: none; border-top: 1px solid rgba(255,179,0,0.15); margin: 3rem 0; }
  .post-body a { color: var(--amber); text-decoration: none; border-bottom: 1px solid rgba(255,179,0,0.3); }
  .post-footer { border-top: 1px solid rgba(255,179,0,0.08); padding-top: 3rem; margin-top: 4rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 2rem; }
  .back-link { font-family: 'Rajdhani', sans-serif; font-size: 0.75rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--amber); text-decoration: none; opacity: 0.7; }
  .back-link:hover { opacity: 1; }
  .lane-badge { font-family: 'Rajdhani', sans-serif; font-size: 0.65rem; letter-spacing: 0.3em; text-transform: uppercase; color: var(--amber); border: 1px solid rgba(255,179,0,0.3); padding: 0.4rem 0.8rem; }
  footer { padding: 3rem 4rem; border-top: 1px solid rgba(255,179,0,0.07); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 2rem; position: relative; z-index: 1; }
  .footer-logo { font-family: 'Cinzel Decorative', serif; font-size: 1rem; color: var(--amber); }
  footer p { font-family: 'Rajdhani', sans-serif; font-size: 0.7rem; letter-spacing: 0.15em; color: rgba(107,124,90,0.4); text-transform: uppercase; }
  @media (max-width: 768px) { nav { padding: 1.2rem 1.5rem; } .post-container { padding: 3rem 1.5rem 4rem; } footer { padding: 2rem 1.5rem; } }
</style>
</head>
<body>
<div class="cursor" id="cursor"></div>
<div class="cursor-ring" id="cursorRing"></div>
<div class="stars" id="stars"></div>
<nav>
  <a href="/" class="nav-logo">VOA</a>
  <ul class="nav-links">
    <li><a href="/">Home</a></li>
    <li><a href="/blog/">Blog</a></li>
    <li><a href="/blog/matt/">Forest Temple</a></li>
    <li><a href="/blog/boombot/">Boom Frequency</a></li>
    <li><a href="/aura/">AURA ✦</a></li>
  </ul>
</nav>
<div class="post-hero">
  <div class="post-hero-bg"></div>
  <div class="post-meta-top">
    <p class="breadcrumb"><a href="/blog/">Blog</a><span>›</span><a href="/blog/matt/">From the Forest Temple</a><span>›</span>This Post</p>
  </div>
  <h1 class="post-title-hero">${title}</h1>
  <div class="post-meta">
    <span class="post-byline">by Matt EarthStar</span>
    <span class="post-date-display">${new Date(date + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
  </div>
</div>
<div class="post-container">
  <article class="post-body">${bodyHTML}</article>
  <div class="post-footer">
    <a href="/blog/matt/" class="back-link">← Back to Forest Temple</a>
    <span class="lane-badge">From the Forest Temple</span>
  </div>
</div>
<footer>
  <div><div class="footer-logo">Vibration of Awesome</div></div>
  <p>© 2026 Vibration of Awesome</p>
</footer>
<script>
  const starsEl = document.getElementById('stars');
  for (let i = 0; i < 80; i++) { const star = document.createElement('div'); star.className = 'star'; const size = Math.random() * 2 + 0.5; star.style.cssText = 'width:'+size+'px;height:'+size+'px;left:'+Math.random()*100+'%;top:'+Math.random()*100+'%;--dur:'+(Math.random()*4+2)+'s;--delay:'+(Math.random()*5)+'s;--brightness:'+(Math.random()*0.35+0.1)+';'; starsEl.appendChild(star); }
  const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
  if (!isTouchDevice) { const cursor = document.getElementById('cursor'); const ring = document.getElementById('cursorRing'); cursor.style.display = 'block'; ring.style.display = 'block'; let rx=0,ry=0,cx=0,cy=0; document.addEventListener('mousemove',e=>{cx=e.clientX;cy=e.clientY;cursor.style.left=cx+'px';cursor.style.top=cy+'px';}); function animateRing(){rx+=(cx-rx)*0.12;ry+=(cy-ry)*0.12;ring.style.left=rx+'px';ring.style.top=ry+'px';requestAnimationFrame(animateRing);} animateRing(); }
<\/script>
</body>
</html>`;
}

function buildBoombotPostHTML({ title, metaDesc, date, slug, bodyHTML }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${metaDesc}">
<link rel="canonical" href="https://vibrationofawesome.com/blog/boombot/posts/${slug}.html">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700&family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Rajdhani:wght@300;400;500;600&family=Space+Mono:wght@400&display=swap" rel="stylesheet">
<style>
  :root { --bg: #020a0e; --cyan: #00e5ff; --text: #e0f4ff; --muted: #3a6a7a; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body { background: var(--bg); color: var(--text); font-family: 'Cormorant Garamond', serif; overflow-x: hidden; cursor: none; }
  body::after { content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 1; background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,229,255,0.006) 2px, rgba(0,229,255,0.006) 4px); }
  .cursor { width: 8px; height: 8px; background: var(--cyan); border-radius: 50%; position: fixed; pointer-events: none; z-index: 9999; transform: translate(-50%, -50%); display: none; }
  .cursor-ring { width: 30px; height: 30px; border: 1px solid rgba(0,229,255,0.35); border-radius: 50%; position: fixed; pointer-events: none; z-index: 9998; transform: translate(-50%, -50%); transition: all 0.15s ease; display: none; }
  .stars { position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; overflow: hidden; }
  .star { position: absolute; background: #00e5ff; border-radius: 50%; animation: twinkle var(--dur, 3s) ease-in-out infinite; animation-delay: var(--delay, 0s); opacity: 0; }
  @keyframes twinkle { 0%, 100% { opacity: 0; } 50% { opacity: var(--brightness, 0.3); } }
  nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; padding: 1.5rem 3rem; display: flex; align-items: center; justify-content: space-between; background: linear-gradient(to bottom, rgba(2,10,14,0.97), transparent); border-bottom: 1px solid rgba(0,229,255,0.07); }
  .nav-logo { font-family: 'Cinzel Decorative', serif; font-size: 1rem; color: var(--cyan); letter-spacing: 0.15em; text-decoration: none; text-shadow: 0 0 15px rgba(0,229,255,0.3); }
  .nav-links { display: flex; gap: 2.5rem; list-style: none; }
  .nav-links a { font-family: 'Rajdhani', sans-serif; font-size: 0.8rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--muted); text-decoration: none; transition: color 0.3s; }
  .nav-links a:hover { color: var(--cyan); }
  .post-hero { padding: 9rem 2rem 4rem; text-align: center; position: relative; overflow: hidden; border-bottom: 1px solid rgba(0,229,255,0.06); }
  .post-hero-bg { position: absolute; inset: 0; background: radial-gradient(ellipse 70% 80% at 50% 0%, rgba(0,30,50,0.9) 0%, transparent 70%), linear-gradient(to bottom, #010608, #020a0e); }
  .post-meta-top { position: relative; z-index: 2; margin-bottom: 2rem; }
  .breadcrumb { font-family: 'Space Mono', monospace; font-size: 0.6rem; color: var(--muted); }
  .breadcrumb a { color: var(--cyan); text-decoration: none; opacity: 0.6; }
  .breadcrumb span { margin: 0 0.5rem; opacity: 0.3; }
  .post-title-hero { font-family: 'Cinzel Decorative', serif; font-size: clamp(1.4rem, 3.5vw, 2.4rem); color: #e0f8ff; line-height: 1.2; max-width: 800px; margin: 1.5rem auto; position: relative; z-index: 2; }
  .post-meta { display: flex; align-items: center; justify-content: center; gap: 2rem; position: relative; z-index: 2; flex-wrap: wrap; }
  .post-byline { font-family: 'Space Mono', monospace; font-size: 0.65rem; color: var(--cyan); opacity: 0.7; }
  .post-date-display { font-family: 'Space Mono', monospace; font-size: 0.6rem; color: var(--muted); }
  .post-container { max-width: 760px; margin: 0 auto; padding: 5rem 2rem 6rem; position: relative; z-index: 2; }
  .post-body { font-size: 1.1rem; line-height: 1.95; color: rgba(224,244,255,0.75); }
  .post-body p { margin-bottom: 1.8rem; }
  .post-body h2 { font-family: 'Cinzel Decorative', serif; font-size: 1.3rem; color: #e0f8ff; margin: 3rem 0 1.2rem; }
  .post-body h3 { font-family: 'Space Mono', monospace; font-size: 0.8rem; letter-spacing: 0.15em; text-transform: uppercase; color: var(--cyan); margin: 2rem 0 0.8rem; opacity: 0.8; }
  .post-body blockquote { border-left: 2px solid var(--cyan); padding-left: 2rem; margin: 2.5rem 0; color: rgba(0,229,255,0.5); font-style: italic; font-size: 1.2rem; line-height: 1.7; }
  .post-body strong { color: #e0f8ff; font-weight: 600; }
  .post-body ul, .post-body ol { margin: 1.5rem 0 1.5rem 2rem; }
  .post-body li { margin-bottom: 0.7rem; line-height: 1.8; }
  .post-body hr { border: none; border-top: 1px solid rgba(0,229,255,0.1); margin: 3rem 0; }
  .post-body a { color: var(--cyan); text-decoration: none; border-bottom: 1px solid rgba(0,229,255,0.3); }
  .post-body code { font-family: 'Space Mono', monospace; font-size: 0.8rem; background: rgba(0,229,255,0.06); border: 1px solid rgba(0,229,255,0.1); padding: 0.1rem 0.4rem; color: var(--cyan); }
  .post-body pre { font-family: 'Space Mono', monospace; font-size: 0.75rem; background: rgba(0,0,0,0.4); border: 1px solid rgba(0,229,255,0.12); padding: 1.5rem; margin: 2rem 0; overflow-x: auto; line-height: 1.6; color: rgba(0,229,255,0.7); }
  .post-cta { margin-top: 4rem; padding: 2.5rem; border: 1px solid rgba(0,229,255,0.15); background: rgba(0,229,255,0.03); text-align: center; }
  .post-cta h4 { font-family: 'Cinzel Decorative', serif; font-size: 1.1rem; color: #e0f8ff; margin-bottom: 1rem; }
  .post-cta p { font-size: 0.95rem; color: rgba(0,229,255,0.5); font-style: italic; margin-bottom: 1.5rem; line-height: 1.7; }
  .cta-btn { display: inline-block; font-family: 'Space Mono', monospace; font-size: 0.7rem; letter-spacing: 0.15em; color: var(--bg); background: var(--cyan); padding: 0.8rem 2rem; text-decoration: none; }
  .post-footer { border-top: 1px solid rgba(0,229,255,0.07); padding-top: 3rem; margin-top: 3rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 2rem; }
  .back-link { font-family: 'Space Mono', monospace; font-size: 0.65rem; color: var(--cyan); text-decoration: none; opacity: 0.6; }
  .back-link:hover { opacity: 1; }
  .lane-badge { font-family: 'Space Mono', monospace; font-size: 0.6rem; color: var(--cyan); border: 1px solid rgba(0,229,255,0.25); padding: 0.4rem 0.8rem; opacity: 0.7; }
  footer { padding: 3rem 4rem; border-top: 1px solid rgba(0,229,255,0.06); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 2rem; position: relative; z-index: 2; }
  .footer-logo { font-family: 'Cinzel Decorative', serif; font-size: 1rem; color: var(--cyan); }
  footer p { font-family: 'Space Mono', monospace; font-size: 0.6rem; color: rgba(58,106,122,0.4); text-transform: uppercase; }
  @media (max-width: 768px) { nav { padding: 1.2rem 1.5rem; } .post-container { padding: 3rem 1.5rem 4rem; } footer { padding: 2rem 1.5rem; } }
</style>
</head>
<body>
<div class="cursor" id="cursor"></div>
<div class="cursor-ring" id="cursorRing"></div>
<div class="stars" id="stars"></div>
<nav>
  <a href="/" class="nav-logo">VOA</a>
  <ul class="nav-links">
    <li><a href="/">Home</a></li>
    <li><a href="/blog/">Blog</a></li>
    <li><a href="/blog/matt/">Forest Temple</a></li>
    <li><a href="/blog/boombot/">Boom Frequency</a></li>
    <li><a href="/aura/">AURA ✦</a></li>
  </ul>
</nav>
<div class="post-hero">
  <div class="post-hero-bg"></div>
  <div class="post-meta-top">
    <p class="breadcrumb"><a href="/blog/">Blog</a><span>›</span><a href="/blog/boombot/">Boom Frequency</a><span>›</span>This Transmission</p>
  </div>
  <h1 class="post-title-hero">${title}</h1>
  <div class="post-meta">
    <span class="post-byline">// by Matty BoomBoom</span>
    <span class="post-date-display">${date}</span>
  </div>
</div>
<div class="post-container">
  <article class="post-body">${bodyHTML}</article>
  <div class="post-cta">
    <h4>More from Vibration of Awesome</h4>
    <p>Tools, insights, and transmissions for creators building on their own terms.</p>
    <a href="/" class="cta-btn">Explore →</a>
  </div>
  <div class="post-footer">
    <a href="/blog/boombot/" class="back-link">← Back to Boom Frequency</a>
    <span class="lane-badge">◈ Boom Frequency</span>
  </div>
</div>
<footer>
  <div><div class="footer-logo">Vibration of Awesome</div></div>
  <p>© 2026 Vibration of Awesome</p>
</footer>
<script>
  const starsEl = document.getElementById('stars');
  for (let i = 0; i < 60; i++) { const star = document.createElement('div'); star.className = 'star'; const size = Math.random()*1.5+0.5; star.style.cssText='width:'+size+'px;height:'+size+'px;left:'+Math.random()*100+'%;top:'+Math.random()*100+'%;--dur:'+(Math.random()*3+2)+'s;--delay:'+(Math.random()*5)+'s;--brightness:'+(Math.random()*0.25+0.05)+';'; starsEl.appendChild(star); }
  const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
  if (!isTouchDevice) { const cursor = document.getElementById('cursor'); const ring = document.getElementById('cursorRing'); cursor.style.display='block'; ring.style.display='block'; let rx=0,ry=0,cx=0,cy=0; document.addEventListener('mousemove',e=>{cx=e.clientX;cy=e.clientY;cursor.style.left=cx+'px';cursor.style.top=cy+'px';}); function animateRing(){rx+=(cx-rx)*0.12;ry+=(cy-ry)*0.12;ring.style.left=rx+'px';ring.style.top=ry+'px';requestAnimationFrame(animateRing);} animateRing(); }
<\/script>
</body>
</html>`;
}

// ── Update JSON index ─────────────────────────────────────────────────────────

function updatePostIndex(lane, entry) {
  const indexPath = path.join(ROOT, '_data', `${lane}-posts.json`);
  let posts = [];
  if (fs.existsSync(indexPath)) {
    posts = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  }
  // Remove existing entry with same slug if re-generating
  posts = posts.filter(p => p.slug !== entry.slug);
  posts.unshift(entry);
  fs.writeFileSync(indexPath, JSON.stringify(posts, null, 2));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();

  if (!opts.lane || !['matt', 'boombot'].includes(opts.lane)) {
    console.error('Error: --lane must be "matt" or "boombot"');
    process.exit(1);
  }

  if (opts.lane === 'matt' && !opts.title) {
    console.error('Error: --title is required for matt lane');
    process.exit(1);
  }

  if (opts.lane === 'boombot' && (!opts.keyword || !opts.topic)) {
    console.error('Error: --keyword and --topic are required for boombot lane');
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY not found. Add it to your .env file.');
    process.exit(1);
  }

  const client = new Anthropic();
  const lane = opts.lane;
  const today = new Date().toISOString().split('T')[0];

  let userMessage, titleForPost;

  if (lane === 'matt') {
    titleForPost = opts.title;
    userMessage = `Write a full blog post with the title: "${titleForPost}"`;
  } else {
    titleForPost = opts.title || `${opts.topic}: A Complete Guide`;
    userMessage = `Target keyword: "${opts.keyword}"\nTopic: "${opts.topic}"\nWrite a comprehensive SEO-optimized post targeting this keyword. Include [META: description here] at the very top.`;
  }

  console.log(`\n🌲 Generating ${lane} post...\n`);
  console.log(`Title: ${titleForPost}`);
  console.log(`Calling Claude API (claude-sonnet-4-20250514)...\n`);

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: SYSTEM_PROMPTS[lane],
    messages: [{ role: 'user', content: userMessage }],
  });

  const rawMarkdown = message.content[0].text;

  // Extract meta description for boombot
  let metaDesc = '';
  let cleanMarkdown = rawMarkdown;
  if (lane === 'boombot') {
    const metaMatch = rawMarkdown.match(/\[META:\s*(.+?)\]/);
    if (metaMatch) {
      metaDesc = metaMatch[1].trim();
      cleanMarkdown = rawMarkdown.replace(/\[META:\s*.+?\]\n?/, '').trim();
    }
  }

  // Convert markdown to HTML
  const bodyHTML = marked.parse(cleanMarkdown);

  // Generate slug
  const slug = slugify(titleForPost);
  const postDir = path.join(ROOT, 'blog', lane, 'posts');
  fs.mkdirSync(postDir, { recursive: true });

  const postPath = path.join(postDir, `${slug}.html`);

  // Build HTML
  let html;
  if (lane === 'matt') {
    html = buildMattPostHTML({ title: titleForPost, date: today, slug, bodyHTML });
  } else {
    html = buildBoombotPostHTML({ title: titleForPost, metaDesc, date: today, slug, bodyHTML });
  }

  fs.writeFileSync(postPath, html);

  // Extract excerpt (first 150 chars of plain text)
  const plainText = cleanMarkdown.replace(/#{1,6}\s+/g, '').replace(/\*\*/g, '').replace(/\*/g, '').replace(/\n+/g, ' ').trim();
  const excerpt = plainText.substring(0, 150);

  // Update JSON index
  const entry = {
    title: titleForPost,
    slug,
    date: today,
    excerpt,
    url: `/blog/${lane}/posts/${slug}.html`,
  };
  updatePostIndex(lane, entry);

  const postUrl = `https://vibrationofawesome.com/blog/${lane}/posts/${slug}.html`;
  console.log(`✅ Post generated successfully!\n`);
  console.log(`   File: blog/${lane}/posts/${slug}.html`);
  console.log(`   URL:  ${postUrl}`);
  console.log(`   Index updated: _data/${lane}-posts.json\n`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
