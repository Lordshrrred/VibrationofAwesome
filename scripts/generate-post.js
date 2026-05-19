#!/usr/bin/env node
/**
 * generate-post.js ~ Dual-lane blog post generator for vibrationofawesome.com
 *
 * Usage:
 *   node scripts/generate-post.js --lane matt --title "My Post Title"
 *   node scripts/generate-post.js --lane boom --keyword "ai tools for musicians" --topic "AI music creation"
 */
import Anthropic from "@anthropic-ai/sdk";
import { marked } from "marked";
import minimist from "minimist";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { updateSitemap } from "./update-sitemap.js";
import { syndicatePost } from "./syndicate.js";
import { fetchNasaImages, fetchForestImages, fetchBoomImages } from "./select-image.js";
import { findNiche, getDefaultNiche, getNichePromptContext, EARTHSTAR_NICHES } from "./content-niches.js";
import { getNextCTA, detectContentType } from "./lib/policy.js";
import { getDifferentiationContext, getClusterContext, recordGeneration } from "./lib/generation-memory.js";
import { slugify, firstWords } from "./lib/utils.js";
import { buildBoomCtaInstruction, getBoomConversionTarget, normalizeBoomHtml } from "./lib/boom-format.js";

dotenv.config({ override: true });
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

// ── CLI ARGS ──
const argv = minimist(process.argv.slice(2), {
  string:  ["lane", "title", "keyword", "topic", "rant", "niche", "cluster"],
  boolean: ["skip-syndicate", "test-feeder-only", "draft"],
  alias:   { l: "lane", t: "title", k: "keyword", p: "topic", r: "rant", n: "niche", c: "cluster" },
});
const lane = argv.lane;
if (!lane || !["matt", "boom"].includes(lane)) {
  console.error('Error: --lane must be "matt" or "boom"'); process.exit(1);
}
if (lane === "matt" && !argv.title) {
  console.error('Error: Matt lane requires --title "Post Title"'); process.exit(1);
}
if (lane === "boom" && !argv.keyword) {
  console.error('Error: BoomBot lane requires --keyword "..."'); process.exit(1);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Error: ANTHROPIC_API_KEY not set. Copy .env.example to .env and add your key.");
  process.exit(1);
}

/*
  DRIP SCHEDULE ~ one post at a time, not bulk

  DRIP ROTATION

  Boom Frequency now rotates through the seven EarthStar content niches defined
  in scripts/content-niches.js. AI + Music + Creator Tools stays intact as the
  first niche, and the six additional EarthStar niches rotate alongside it.
  One post per run. Schedule externally or use generate-all-drafts.js.
*/

// ── SYSTEM PROMPTS ──
const MATT_SYSTEM = [
  "You are Matt EarthStar, writing for your personal blog \"From the Forest Temple.\"",
  "Matt is a musician (EarthStar rock/metal/electronic, Ruzindla EDM/psytrance),",
  "digital creator, Apple Tech Expert, and someone who has been grinding at internet",
  "marketing for 20 years. He organizes his life through a personal system called",
  "Forest Temple. His writing is raw, direct, and honest. No motivational fluff.",
  "No generic self-help hooks. He writes like he talks - real stories, real lessons,",
  "real frustration when warranted. His audience is spiritually awakening,",
  "purpose-driven, neurodivergent, HSP, and alternative abundance seekers.",
  "Never use the long dash character in your output. Use hyphens, commas, or restructure the sentence instead.",
  "Write a full blog post based on the given title. Return raw markdown only.",
].join("\n");

const BOOMBOT_SYSTEM = [
  "You are Matty BoomBoom, an AI writer for the blog \"Boom Frequency\" at",
  "vibrationofawesome.com. You are inspired by the spirit of Matt EarthStar ~ a musician,",
  "digital creator, and 20-year internet marketing veteran who is actively breaking out",
  "of the system and building a life on his own terms. Your job is to write",
  "SEO-optimized, genuinely helpful long-form posts targeting specific long-tail",
  "keywords. Your audience: spiritually awakening creators, people stuck in survival",
  "mode, neurodivergent entrepreneurs, musicians and artists learning AI tools, and",
  "abundance-minded outliers ready to reinvent themselves.",
  "Write in a voice that is helpful, slightly eccentric, and real ~ never corporate,",
  "never generic. Include H2 and H3 subheadings, a meta description on the first line",
  "(format: META: your description here).",
  "Return raw markdown only.",
  "Never use em dashes in your output. Use tildes, hyphens, commas, or restructure the sentence instead.",
  "",
  "You are Matty BoomBoom ~ the AI writing voice of Vibration of Awesome. Your audience: spiritually awakening, purpose-driven, neurodivergent, HSP, and alternative abundance seekers who are done with generic self-help. They are outliers. Write like one.",
  "",
  "Tone: sharp, direct, a little raw, no fluff, no toxic positivity. You're the friend who actually tells them the truth.",
  "",
  "WRITING RULES:",
  "- No em dashes ~ use tildes or restructure the sentence",
  "- No word \"misfits\"",
  "- No generic self-help hooks",
  "- No AI-sounding copy",
  "- Open every post by naming the reader's exact pain, problem, or predicament ~ make them feel seen in the first sentence",
  "- After the hook, use ONE of these transition types: continue the thought, quote an authority, ask a question, tell a vivid story, skeptical slant story, reporter style, social proof, or short Q&A rhythm",
  "- People buy on emotion first ~ write to create a feeling before introducing logic or facts",
  "- Use concrete specific language ~ never abstract (\"your car won't start at 11pm alone in a parking lot\" not \"car trouble is stressful\")",
  "- Plant at least one information gap per post ~ something unsaid that makes the reader need to keep going (\"there's one thing almost nobody does here ~ and it changes everything\")",
  "- Use Feel/Felt/Found once if there's reader resistance: \"I know how you feel, I felt the same way, what I found was...\"",
  "- End with a benefit-forward CTA ~ specific action tied to a specific outcome ~ no author bio, no \"thanks for reading\"",
  "- Write at 8th grade reading level, short paragraphs, one idea each",
  "- Never open with \"In today's world\" or \"In this article we will\"",
  "- Never end with \"I hope this helps\"",
  "- Do not write generic self-help",
  "- Avoid these phrases and ideas: \"you're not broken\", \"you're not behind\", \"just believe\", generic manifestation fluff, and generic hustle culture advice",
  "- Make every article grounded, human, specific, slightly contrarian, useful, and emotionally resonant",
  "- Use the provided niche context as the article's spine. Do not flatten every niche into AI tools or vague personal growth.",
].join("\n");

// ── TOPIC PILLARS & KEYWORD POOL ──────────────────────────────────────────────
// Reference list for CLI usage. Source of truth lives in scripts/content-niches.js.
// Usage: node scripts/generate-post.js --lane boom --niche "self-betrayal-avoidance" --keyword "<keyword>"
const TOPIC_PILLARS = Object.fromEntries(
  EARTHSTAR_NICHES.map((niche) => [niche.displayName, niche.keywordSeedPhrases])
);

// ── HELPERS ──

/** Build a list of existing posts for internal linking context */
function buildExistingPostsList() {
  const BASE = "https://vibrationofawesome.com";
  const lines = [];
  for (const l of ["boom", "matt"]) {
    const f = path.join(ROOT, "static", "_data", l + "-posts.json");
    if (!fs.existsSync(f)) continue;
    try {
      const posts = JSON.parse(fs.readFileSync(f, "utf8"));
      for (const p of (Array.isArray(posts) ? posts : [])) {
        if (p.title && p.url) lines.push("- " + p.title + " → " + BASE + p.url);
      }
    } catch (_) {}
  }
  return lines.join("\n");
}

/** Extract first real paragraph (skip headings/META/rules), truncate at 150 chars */
function extractExcerpt(markdown) {
  const lines = markdown.split("\n").filter((l) => l.trim() !== "");
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith("META:") || t.startsWith("#") || t.startsWith("---") || t.startsWith("***")) continue;
    return t.slice(0, 150);
  }
  return "";
}

/** Strip META: line from BoomBot output. Returns { metaDescription, cleanMarkdown } */
function stripMeta(markdown) {
  const lines = markdown.split("\n");
  let metaDescription = "";
  const cleanLines = [];
  for (const line of lines) {
    if (line.trim().startsWith("META:")) {
      metaDescription = line.replace(/^META:\s*/i, "").trim();
    } else {
      cleanLines.push(line);
    }
  }
  return { metaDescription, cleanMarkdown: cleanLines.join("\n") };
}

/** Build complete post HTML. Uses string array join to avoid template-literal/quoting issues. */
function buildHtml(lane, title, dateStr, bodyHtml, slug, metaDescription, heroImageUrl, cta) {
  const isMatt      = lane === "matt";
  const accent      = isMatt ? "#ffb300" : "#00e5ff";
  const accentLight = isMatt ? "#ffe082" : "#b2f5ff";
  const accentDark  = isMatt ? "#c67c00" : "#0097a7";
  const fontFamily  = isMatt ? "Lora, Georgia, serif" : "Space Grotesk, Inter, sans-serif";
  const gfBase      = "https://fonts.googleapis.com";
  const gfStatic    = "https://fonts.gstatic.com";
  const googleFont  = isMatt
    ? '<link rel="preconnect" href="' + gfBase + '">'
      + '<link rel="preconnect" href="' + gfStatic + '" crossorigin>'
      + '<link href="' + gfBase + '/css2?family=Cinzel+Decorative:wght@400;700&family=Lora:ital,wght@0,400;0,600;0,700;1,400&family=Rajdhani:wght@400;500;700&display=swap" rel="stylesheet">'
    : '<link rel="preconnect" href="' + gfBase + '">'
      + '<link rel="preconnect" href="' + gfStatic + '" crossorigin>'
      + '<link href="' + gfBase + '/css2?family=Cinzel+Decorative:wght@400;700&family=Rajdhani:wght@400;500;700&family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet">';

  const laneName    = isMatt ? "From the Forest Temple" : "Boom Frequency";
  const byline      = isMatt ? "by Matt EarthStar" : "by Matty BoomBoom (AI)";
  const badge       = isMatt ? "FOREST TEMPLE" : "BOOM FREQUENCY";
  const displayDate = new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const socialImageUrl = heroImageUrl || (isMatt
    ? "https://vibrationofawesome.com/personal-photos/forest/forest-14-hoh-rainforest.webp"
    : "https://vibrationofawesome.com/images/StarLogo.png");
  const socialImageWidth = heroImageUrl ? "1200" : (isMatt ? "1536" : "1072");
  const socialImageHeight = heroImageUrl ? "630" : (isMatt ? "2049" : "960");

  // Parse hex accent colour to RGB for the stars canvas
  const hexClean = accent.replace("#", "");
  const accentR  = parseInt(hexClean.slice(0, 2), 16);
  const accentG  = parseInt(hexClean.slice(2, 4), 16);
  const accentB  = parseInt(hexClean.slice(4, 6), 16);
  const footerLogoRest = isMatt ? "rgba(34,192,106,0.84)" : "rgba(112,182,196,0.72)";
  const footerLogoHover = isMatt ? "#7ef2a3" : "#00e5ff";
  const footerTaglineColor = isMatt ? "rgba(245,234,216,0.78)" : "rgba(207,246,255,0.76)";

  const metaContent = metaDescription
    ? metaDescription.replace(/"/g, "&quot;")
    : title + " ~ " + laneName + " at Vibration of Awesome";
  const yearNow = new Date().getFullYear();

  // Build HTML as array of strings, joined at the end
  const H = [];
  H.push("<!DOCTYPE html>");
  H.push('<html lang="en">');
  H.push("<head>");
  H.push('  <meta charset="UTF-8">');
  H.push('  <meta name="viewport" content="width=device-width, initial-scale=1.0">');
  H.push("  <title>" + title + " | " + laneName + " | Vibration of Awesome</title>");
  H.push('  <meta name="description" content="' + metaContent + '">');
  const postUrl = "https://vibrationofawesome.com/blog/" + lane + "/posts/" + slug + ".html";
  const datePublished = new Date(dateStr).toISOString();
  const authorName = isMatt ? "Matt EarthStar" : "Matty BoomBoom";
  H.push('  <link rel="canonical" href="' + postUrl + '">');
  H.push('  <meta name="robots" content="index, follow">');
  H.push('  <meta name="theme-color" content="' + accent + '">');
  if (heroImageUrl) {
    H.push('  <link rel="preload" as="image" fetchpriority="high" href="' + heroImageUrl + '">');
  }
  H.push("  <!-- Open Graph -->");
  H.push('  <meta property="og:type" content="article">');
  H.push('  <meta property="og:site_name" content="Vibration of Awesome">');
  H.push('  <meta property="og:title" content="' + title + '">');
  H.push('  <meta property="og:description" content="' + metaContent + '">');
  H.push('  <meta property="og:url" content="' + postUrl + '">');
  H.push('  <meta property="og:image" content="' + socialImageUrl + '">');
  H.push('  <meta property="og:image:width" content="' + socialImageWidth + '">');
  H.push('  <meta property="og:image:height" content="' + socialImageHeight + '">');
  H.push("  <!-- Twitter / X Cards -->");
  H.push('  <meta name="twitter:card" content="summary_large_image">');
  H.push('  <meta name="twitter:title" content="' + title + '">');
  H.push('  <meta name="twitter:description" content="' + metaContent + '">');
  H.push('  <meta name="twitter:image" content="' + socialImageUrl + '">');
  H.push("  <!-- Structured Data -->");
  H.push('  <script type="application/ld+json">');
  H.push('  {"@context":"https://schema.org","@type":"BlogPosting","headline":"' + title.replace(/"/g, '\\"') + '","description":"' + metaContent.replace(/"/g, '\\"') + '","url":"' + postUrl + '","datePublished":"' + datePublished + '","author":{"@type":"Person","name":"' + authorName + '","url":"https://vibrationofawesome.com"},"publisher":{"@type":"Organization","name":"Vibration of Awesome","url":"https://vibrationofawesome.com"},"image":"' + socialImageUrl + '","mainEntityOfPage":{"@type":"WebPage","@id":"' + postUrl + '"}}');
  H.push("  </script>");
  H.push("  " + googleFont);
  H.push("  <!-- Google Analytics GA4 -->");
  H.push('  <script async src="https://www.googletagmanager.com/gtag/js?id=G-G5HF0WKZT9"></script>');
  H.push("  <script>");
  H.push("    window.dataLayer = window.dataLayer || [];");
  H.push("    function gtag(){dataLayer.push(arguments);}");
  H.push('    gtag("js", new Date());');
  H.push('    gtag("config", "G-G5HF0WKZT9");');
  H.push("  </script>");
  H.push("  <style>");
  H.push("    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }");
  H.push("    :root {");
  H.push("      --bg: #020a0a; --surface: #060f10; --surface2: #0b1a1c;");
  H.push("      --accent: " + accent + "; --accent-light: " + accentLight + "; --accent-dark: " + accentDark + ";");
  H.push("      --text: #e8f4f0; --text-muted: #7a9e9a; --border: rgba(255,255,255,0.06);");
  H.push("    }");
  H.push("    html { scroll-behavior: smooth; }");
  H.push("    body { background: var(--bg); color: var(--text); font-family: " + fontFamily + "; font-size: 18px; line-height: 1.75; min-height: 100vh; overflow-x: hidden; }");
  H.push("    #stars-canvas { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; pointer-events: none; }");
  H.push("    .site-wrapper { position: relative; z-index: 1; display: flex; flex-direction: column; min-height: 100vh; }");
  H.push("    .container { max-width: 760px; margin: 0 auto; padding: 0 1.5rem; width: 100%; }");
  H.push("    .site-header { border-bottom: 1px solid var(--border); background: rgba(2,10,10,0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); padding: 1rem 0; position: sticky; top: 0; z-index: 100; }");
  H.push("    .site-header .container { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }");
  H.push("    .voa-logo { font-family: Space Grotesk, sans-serif; font-weight: 700; font-size: 1rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text); text-decoration: none; opacity: 0.9; transition: opacity 0.2s; }");
  H.push("    .voa-logo span { color: var(--accent); }");
  H.push("    .voa-logo:hover { opacity: 1; }");
  H.push("    .header-blog-name { font-size: 0.8rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); opacity: 0.8; }");
  if (isMatt) {
    H.push("    .breadcrumb { padding: 0.75rem 0; font-size: 0.82rem; color: var(--text-muted); }");
    H.push("    .breadcrumb a { color: var(--text-muted); text-decoration: none; transition: color 0.2s; }");
    H.push("    .breadcrumb a:hover { color: var(--accent); }");
    H.push("    .breadcrumb .sep { margin: 0 0.4rem; opacity: 0.4; }");
  }
  if (!isMatt && heroImageUrl) {
    H.push("    .post-header { position:relative; z-index:1; overflow:hidden; min-height:31rem; display:flex; align-items:flex-end; padding:12rem 4rem 4rem; border-bottom:1px solid rgba(0,229,255,0.16); background-color:#020a0a; background: linear-gradient(to bottom, rgba(2,10,8,0.55) 0%, rgba(2,10,8,0.82) 62%, #020a0a 100%), url('" + heroImageUrl + "') center/cover no-repeat; }");
    H.push("    .post-header-inner { max-width:760px; margin:0 auto; padding:0 1.5rem; width:100%; }");
    H.push("    .post-header > *:not(.ev-art) { position:relative; z-index:1; }");
    H.push("    .ev-art { position:absolute; inset:0; z-index:0; opacity:0.35; pointer-events:none; }");
  } else if (!isMatt) {
    H.push("    .post-header { position:relative; overflow:hidden; min-height:31rem; display:flex; align-items:flex-end; padding:12rem 4rem 4rem; border-bottom:1px solid rgba(0,229,255,0.16); }");
    H.push("    .post-header-inner { max-width:760px; margin:0 auto; padding:0 1.5rem; }");
    H.push("    .post-header > *:not(.ev-art) { position:relative; z-index:1; }");
    H.push("    .ev-art { position:absolute; inset:0; z-index:0; opacity:0.35; pointer-events:none; }");
  } else {
    H.push("    .post-header { padding: 2.5rem 0 2rem; border-bottom: 1px solid var(--border); }");
  }
  H.push("    .lane-badge { display: inline-block; font-family: Space Grotesk, sans-serif; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: var(--accent); border: 1px solid var(--accent); border-radius: 2px; padding: 0.2em 0.6em; margin-bottom: 1.2rem; }");
  H.push("    .post-title { font-size: clamp(1.8rem, 4vw, 2.6rem); font-weight: 700; line-height: 1.2; color: var(--text); margin-bottom: 1rem; }");
  H.push("    .post-meta { font-size: 0.85rem; color: var(--text-muted); display: flex; gap: 1rem; flex-wrap: wrap; align-items: center; }");
  H.push("    .post-meta .author { color: var(--accent-light); }");
  H.push("    .post-body { padding: 2.5rem 0 3rem; flex: 1; }");
  H.push("    .post-body p { margin-bottom: 1.4em; }");
  H.push("    .post-body h2 { font-size: 1.5rem; font-weight: 700; color: var(--accent-light); margin: 2.5rem 0 0.8rem; padding-bottom: 0.3rem; border-bottom: 1px solid var(--border); }");
  H.push("    .post-body h3 { font-size: 1.2rem; font-weight: 600; color: var(--text); margin: 1.8rem 0 0.6rem; }");
  H.push("    .post-body h4, .post-body h5, .post-body h6 { font-size: 1.05rem; font-weight: 600; color: var(--text-muted); margin: 1.4rem 0 0.5rem; }");
  H.push("    .post-body a { color: var(--accent); text-decoration: underline; text-underline-offset: 3px; transition: color 0.2s; }");
  H.push("    .post-body a:hover { color: var(--accent-light); }");
  H.push("    .post-body ul, .post-body ol { margin: 0.8em 0 1.4em 1.6em; }");
  H.push("    .post-body li { margin-bottom: 0.4em; }");
  H.push("    .post-body blockquote { border-left: 3px solid var(--accent); padding: 0.6em 1.2em; margin: 1.5em 0; color: var(--text-muted); font-style: italic; background: var(--surface2); border-radius: 0 4px 4px 0; }");
  H.push("    .post-body code { background: var(--surface2); color: var(--accent-light); padding: 0.15em 0.4em; border-radius: 3px; font-size: 0.88em; font-family: JetBrains Mono, Fira Code, monospace; }");
  H.push("    .post-body pre { background: var(--surface2); border: 1px solid var(--border); border-radius: 6px; padding: 1.2em; overflow-x: auto; margin: 1.5em 0; }");
  H.push("    .post-body pre code { background: none; padding: 0; color: var(--text); }");
  H.push("    .post-body hr { border: none; border-top: 1px solid var(--border); margin: 2.5em 0; }");
  H.push("    .post-body strong { color: var(--accent-light); font-weight: 600; }");
  H.push("    .post-body em { font-style: italic; }");
  if (isMatt) {
    H.push("    .nasa-img-wrap { margin: 2.8rem -1rem; overflow: hidden; border-radius: 3px; }");
    H.push("    .nasa-img-wrap img { display: block; width: 100%; height: 300px; object-fit: cover; filter: brightness(0.82) saturate(1.15); box-shadow: 0 0 50px rgba(" + accentR + "," + accentG + "," + accentB + ",0.18), 0 6px 30px rgba(0,0,0,0.6); transition: filter 0.4s; }");
    H.push("    .nasa-img-wrap img:hover { filter: brightness(0.92) saturate(1.2); }");
    H.push("    @media (max-width: 600px) { .nasa-img-wrap { margin: 2rem -0.5rem; } .nasa-img-wrap img { height: 200px; } }");
    H.push("    .post-cta { background: var(--surface2); border: 1px solid var(--accent-dark); border-radius: 8px; padding: 2rem; margin: 2rem 0; text-align: center; }");
    H.push("    .post-cta h3 { color: var(--accent); font-size: 1.1rem; margin-bottom: 0.6rem; }");
    H.push("    .post-cta p { color: var(--text-muted); font-size: 0.95rem; margin: 0 0 1.2rem; }");
    H.push("    .post-cta a { display: inline-block; background: var(--accent); color: #020a0a !important; font-family: Space Grotesk, sans-serif; font-weight: 700; font-size: 0.9rem; letter-spacing: 0.06em; text-transform: uppercase; padding: 0.7em 1.6em; border-radius: 4px; text-decoration: none !important; border-bottom: none !important; transition: opacity 0.2s, transform 0.15s; }");
    H.push("    .post-cta a:hover { opacity: 0.85; transform: translateY(-1px); }");
  }
  H.push("    .header-nav { display: flex; align-items: center; gap: 0.2rem; }");
  H.push("    .header-nav a { font-family: 'Rajdhani', sans-serif; font-size: 0.75rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(232,244,240,0.52); text-decoration: none; padding: 0.3rem 0.55rem; border-radius: 4px; transition: color 0.2s, background 0.2s; white-space: nowrap; }");
  H.push("    .header-nav a:hover { color: var(--text); background: rgba(255,255,255,0.04); }");
  H.push("    .header-nav .header-nav-guide { color: rgba(201,168,76,0.7); border: 1px solid rgba(201,168,76,0.14); }");
  H.push("    .header-nav .header-nav-guide:hover { color: #c9a84c; background: rgba(201,168,76,0.06); border-color: rgba(201,168,76,0.3); }");
  H.push("    .header-nav .header-nav-ai { color: rgba(0,229,204,0.75); border: 1px solid rgba(0,229,204,0.16); }");
  H.push("    .header-nav .header-nav-ai:hover { color: #00e5cc; background: rgba(0,229,204,0.06); border-color: rgba(0,229,204,0.32); }");
  H.push("    .header-nav .header-nav-aura { color: rgba(0,229,204,0.6); border: 1px solid rgba(0,229,204,0.1); }");
  H.push("    .header-nav .header-nav-aura:hover { color: #00e5cc; background: rgba(0,229,204,0.05); }");
  H.push("    @media (max-width: 640px) { .header-nav .header-nav-ai, .header-nav .header-nav-guide { display: inline-flex; } .header-nav .header-nav-aura, .header-nav .header-nav-blog { display: none; } }");
  H.push("    .site-footer { border-top: 1px solid var(--border); padding: 2rem 0; text-align: center; font-size: 0.82rem; color: var(--text-muted); }");
  H.push("    .site-footer p { margin: 0; }");
  H.push("    .site-footer a { color: var(--accent); text-decoration: none; }");
  H.push("    .site-footer a:hover { text-decoration: underline; }");
  H.push("    .site-footer .footer-meta { font-family: 'Rajdhani', sans-serif; font-size: 0.76rem; line-height: 1.7; letter-spacing: 0.14em; font-weight: 600; }");
  H.push("    .site-footer .footer-meta a { font-weight: 600; }");
  H.push("    .site-footer .footer-brand { margin-top: " + (isMatt ? "1.05rem" : "0.9rem") + "; display: flex; flex-direction: column; align-items: center; gap: " + (isMatt ? "0.56rem" : "0.36rem") + "; }");
  H.push("    .site-footer .footer-logo { font-family: 'Cinzel Decorative', serif; font-size: 1.18rem; letter-spacing: 0.08em; color: " + footerLogoRest + "; text-decoration: none; text-shadow: 0 0 18px rgba(" + accentR + "," + accentG + "," + accentB + ",0.12); transition: color 0.22s ease, text-shadow 0.22s ease, transform 0.22s ease, border-color 0.22s ease; border-bottom: 1px solid transparent; padding-bottom: 0.08rem; }");
  H.push("    .site-footer .footer-logo span { font-size: 0.82em; opacity: 0.92; }");
  H.push("    .site-footer a.footer-logo:hover { color: " + footerLogoHover + "; text-shadow: 0 0 24px rgba(" + accentR + "," + accentG + "," + accentB + ",0.24); text-decoration: none !important; transform: translateY(-1px); border-bottom-color: rgba(" + accentR + "," + accentG + "," + accentB + ",0.75); }");
  H.push("    .site-footer .footer-tagline { font-family: " + fontFamily + "; font-style: italic; font-size: 0.98rem; letter-spacing: 0.01em; color: " + footerTaglineColor + "; font-weight: " + (isMatt ? "600" : "400") + "; }");
  H.push("    footer, .site-footer { text-align: center; width: 100%; }");
  H.push("    footer .footer-meta, .site-footer .footer-meta { display: block; width: 100%; margin-left: auto; margin-right: auto; text-align: center; }");
  H.push("    footer .footer-brand, .site-footer .footer-brand { margin-left: auto; margin-right: auto; text-align: center; }");
  H.push("    footer .footer-meta a, .site-footer .footer-meta a { color: var(--accent, var(--cyan, var(--amber, #00e5ff))) !important; text-decoration: none; border-bottom: 1px solid rgba(" + accentR + "," + accentG + "," + accentB + ",0.28); }");
  H.push("    footer .footer-meta a:hover, .site-footer .footer-meta a:hover { color: var(--accent-light, var(--cyan, var(--amber, #7ef2ff))) !important; border-bottom-color: currentColor; }");
  if (!isMatt) {
    H.push("    @media (max-width: 768px) { body { font-size: 16px; } .post-header { padding: 10rem 1.5rem 3rem; } }");
  } else {
    H.push("    @media (max-width: 600px) { body { font-size: 16px; } .post-header { padding: 1.8rem 0 1.4rem; } }");
  }
  H.push("  </style>");
  H.push("</head>");
  H.push("<body>");
  H.push("");
  H.push('<canvas id="stars-canvas" aria-hidden="true"></canvas>');
  H.push("");
  H.push('<div class="site-wrapper">');
  H.push("  <header class=\"site-header\">");
  H.push("    <div class=\"container\">");
  H.push('      <a href="/" class="voa-logo">Vibration<span>of</span>Awesome</a>');
  H.push('      <nav class="header-nav" aria-label="Site navigation">');
  H.push('        <a href="/field-guide/" class="header-nav-guide">Field Guide ✦</a>');
  H.push('        <a href="/ai-engine/" class="header-nav-ai">AI Engine</a>');
  H.push('        <a href="/aura/" class="header-nav-aura">AURA ✦</a>');
  H.push('        <a href="/blog/" class="header-nav-blog">Blog</a>');
  H.push("      </nav>");
  H.push("    </div>");
  H.push("  </header>");
  H.push("  <main>");
  if (isMatt) {
    // Matt posts: existing layout ~ header inside container (unchanged)
    H.push("    <div class=\"container\">");
    H.push('      <nav class="breadcrumb" aria-label="Breadcrumb">');
    H.push('        <a href="/">Home</a><span class="sep">&#8250;</span>');
    H.push('        <a href="/blog/">Blog</a><span class="sep">&#8250;</span>');
    H.push('        <a href="/blog/' + lane + '/">' + laneName + '</a><span class="sep">&#8250;</span>');
    H.push("        <span>" + title + "</span>");
    H.push("      </nav>");
    H.push("      <header class=\"post-header\">");
    H.push('        <div class="lane-badge">' + badge + "</div>");
    H.push('        <h1 class="post-title">' + title + "</h1>");
    H.push("        <div class=\"post-meta\">");
    H.push('          <span class="author">' + byline + "</span>");
    H.push("          <span>&middot;</span>");
    H.push('          <time datetime="' + dateStr + '">' + displayDate + "</time>");
    H.push("        </div>");
    H.push("      </header>");
    H.push("      <article class=\"post-body\">");
    H.push("        " + bodyHtml);
    H.push('        <div class="post-cta">');
    H.push("          <h3>Explore More at Vibration of Awesome</h3>");
    H.push("          <p>Music, AI tools, digital creation, and the weird beautiful intersection of all three.</p>");
    H.push('          <a href="' + (cta ? cta.url : "https://vibrationofawesome.com/field-guide/") + '">' + (cta ? cta.text : "Start with the Field Guide") + '</a>');
    H.push("        </div>");
    H.push('        <div style="height:2rem;"></div>');
    H.push('        <div class="voa-photo-rotator" data-folder="matt" data-mode="signature"></div>');
    H.push('        <script src="/js/photo-rotator.js"><\/script>');
    H.push('        <div style="height:2rem;"></div>');
    H.push('        <div class="voa-ebook-cta" data-placement="end-of-post" data-blog-slug="' + slug + '"></div>');
    H.push('        <script src="/js/ebook-cta.js"><\/script>');
    H.push('        <div data-art-store-whisper data-blog-slug="' + slug + '"></div>');
    H.push('        <script src="/js/art-store-whisper.js"><\/script>');
    H.push("      </article>");
    H.push("    </div>");
  } else {
    // Boom posts: no breadcrumb; header breaks out of container for full-viewport hero
    H.push("    <header class=\"post-header\">");
    H.push('      <div class="post-header-inner">');
    H.push('        <div class="lane-badge">' + badge + "</div>");
    H.push('        <h1 class="post-title">' + title + "</h1>");
    H.push("        <div class=\"post-meta\">");
    H.push('          <span class="author">' + byline + "</span>");
    H.push("          <span>&middot;</span>");
    H.push('          <time datetime="' + dateStr + '">' + displayDate + "</time>");
    H.push("        </div>");
    H.push("      </div>");
    H.push("    </header>");
    H.push("    <div class=\"container\">");
    H.push("      <article class=\"post-body\">");
    H.push("        " + bodyHtml);
    H.push('        <div style="height:1rem;"></div>');
    H.push('        <div class="voa-photo-rotator" data-folder="boombot" data-mode="signature"></div>');
    H.push('        <script src="/js/photo-rotator.js"><\/script>');
    H.push('        <div style="height:1rem;"></div>');
    // AI Engine nudge for creator/AI content type posts
    const isAIContent = cta && cta.primary === 'ai-engine';
    if (isAIContent) {
      H.push('        <div data-ai-nudge data-blog-slug="' + slug + '"></div>');
      H.push('        <script src="/js/ai-engine-nudge.js" defer><\/script>');
    }
    H.push('        <div data-ebook-cta data-placement="end-of-post" data-blog-slug="' + slug + '"></div>');
    H.push('        <script src="/js/ebook-cta.js"><\/script>');
    H.push('        <div data-art-store-whisper data-blog-slug="' + slug + '"></div>');
    H.push('        <script src="/js/art-store-whisper.js"><\/script>');
    H.push("      </article>");
    H.push("    </div>");
  }
  H.push('    <footer class="site-footer">');
  H.push('      <div class="container">');
  if (isMatt) {
    H.push('        <p class="footer-meta">&copy; ' + yearNow + ' <a href="https://vibrationofawesome.com">Vibration of Awesome</a> &nbsp;&middot;&nbsp; <a href="/blog/matt/">Forest Temple</a> &nbsp;&middot;&nbsp; <a href="/blog/">All Posts</a></p>');
  } else {
    H.push('        <p class="footer-meta">&copy; ' + yearNow + ' <a href="https://vibrationofawesome.com">Vibration of Awesome</a> &nbsp;&middot;&nbsp; <a href="/blog/boom/">Boom Frequency</a> &nbsp;&middot;&nbsp; <a href="/blog/">All Posts</a></p>');
  }
  H.push('        <div class="footer-brand">');
  H.push('          <a href="https://vibrationofawesome.com" class="footer-logo">Vibration <span>of</span> Awesome</a>');
  H.push('          <div class="footer-tagline">Empower Thyself. Empower the Earth.</div>');
  H.push('        </div>');
  H.push('      </div>');
  H.push('    </footer>');
  H.push("  </main>");
  H.push("</div>");
  H.push("<script>");
  H.push("(function() {");
  H.push('  var canvas = document.getElementById("stars-canvas");');
  H.push('  var ctx = canvas.getContext("2d");');
  H.push("  var stars = [];");
  H.push("  var STAR_COUNT = 160;");
  H.push("  var AR = " + accentR + ", AG = " + accentG + ", AB = " + accentB + ";");
  H.push("  function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }");
  H.push("  function initStars() {");
  H.push("    stars = [];");
  H.push("    for (var i = 0; i < STAR_COUNT; i++) {");
  H.push("      stars.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height,");
  H.push("        r: Math.random() * 1.2 + 0.2, speed: Math.random() * 0.15 + 0.03,");
  H.push("        opacity: Math.random() * 0.6 + 0.2, pulse: Math.random() * Math.PI * 2,");
  H.push("        pulseSpeed: Math.random() * 0.008 + 0.003, isAccent: Math.random() < 0.04 });");
  H.push("    }");
  H.push("  }");
  H.push("  function draw() {");
  H.push("    ctx.clearRect(0, 0, canvas.width, canvas.height);");
  H.push("    for (var i = 0; i < stars.length; i++) {");
  H.push("      var s = stars[i];");
  H.push("      s.pulse += s.pulseSpeed;");
  H.push("      var op = s.opacity * (0.7 + 0.3 * Math.sin(s.pulse));");
  H.push("      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);");
  H.push('      if (s.isAccent) { ctx.fillStyle = "rgba(" + AR + "," + AG + "," + AB + "," + op + ")"; }');
  H.push('      else { ctx.fillStyle = "rgba(255,255,255," + op + ")"; }');
  H.push("      ctx.fill();");
  H.push("      s.y += s.speed;");
  H.push("      if (s.y > canvas.height + 2) { s.y = -2; s.x = Math.random() * canvas.width; }");
  H.push("    }");
  H.push("    requestAnimationFrame(draw);");
  H.push("  }");
  H.push('  window.addEventListener("resize", function() { resize(); initStars(); });');
  H.push("  resize(); initStars(); draw();");
  H.push("})();");
  H.push("<\/script>");
  H.push('  <script src="/js/announcement-bar.js"><\/script>');
  if (!isMatt) {
    H.push('  <script src="/js/earthstar-visual.js"><\/script>');
  }
  H.push('<script src="/js/voa-nav.js" defer></script>');H.push("</body>");
  H.push("</html>");
  return H.join("\n");
}

// ── INLINE IMAGE INJECTION ────────────────────────────────────────────────────

/**
 * Inject NASA APOD images into post body HTML at ~25%, 50%, 75% positions.
 * Splits on </p> boundaries and inserts image blocks between paragraphs.
 * @param {string} html   - Rendered post body HTML
 * @param {Array}  images - Array of { url, title } from fetchNasaImages
 * @returns {string}      - HTML with images injected
 */
function injectNasaImages(html, images) {
  if (!images || images.length === 0) return html;

  // Split into paragraph chunks at </p> boundaries
  const chunks = html.split("</p>").filter(function(c) { return c.trim() !== ""; });
  const total  = chunks.length;
  if (total < 4) return html; // Too short ~ skip injection

  // Target positions: after ~25%, 50%, 75% of paragraphs
  const positions = [
    Math.max(1, Math.floor(total * 0.25)),
    Math.max(2, Math.floor(total * 0.50)),
    Math.max(3, Math.floor(total * 0.75)),
  ];

  // Build image HTML blocks
  function imgBlock(img) {
    return '<div class="nasa-img-wrap">'
      + '<img src="' + img.url + '" alt="' + (img.title || "NASA astronomy image") + '" loading="lazy">'
      + '</div>';
  }

  // Insert images working backwards so indices stay valid
  for (let i = images.length - 1; i >= 0; i--) {
    const pos = positions[i];
    if (pos === undefined || pos >= total) continue;
    chunks.splice(pos, 0, imgBlock(images[i]));
  }

  return chunks.join("</p>") + "</p>";
}

// ── FEEDER TRIGGER ────────────────────────────────────────────────────────────
/**
 * Ping the VOA_Feeder repo via GitHub repository_dispatch.
 * Fires when VOA_FEEDER_TRIGGER_TOKEN is set in the environment.
 * In CI (GitHub Actions) the token is injected via secrets; locally via .env.
 * Wrapped in try/catch ~ a feeder failure never breaks the main publish.
 */
async function triggerFeeder(postUrl, postTitle, keyword, sourceMeta = {}) {
  const token = process.env.VOA_FEEDER_TRIGGER_TOKEN;
  if (!token) {
    console.log("  [feeder] VOA_FEEDER_TRIGGER_TOKEN not set ~ skipping feeder trigger");
    return;
  }
  try {
    const resp = await fetch(
      "https://api.github.com/repos/Lordshrrred/VOA_Feeder/dispatches",
      {
        method:  "POST",
        headers: {
          Authorization:  `token ${token}`,
          Accept:         "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event_type:     "voa-post-published",
          client_payload: {
            voa_post_url:     postUrl,
            voa_post_title:   postTitle,
            voa_post_keyword: keyword || "",
            voa_post_slug:    sourceMeta.slug || "",
            voa_post_lane:    sourceMeta.lane || "",
            voa_post_excerpt: sourceMeta.excerpt || "",
            voa_post_tags:    Array.isArray(sourceMeta.tags) ? sourceMeta.tags.join(", ") : (sourceMeta.tags || ""),
            voa_post_category: sourceMeta.category || "",
            voa_post_source_text: sourceMeta.sourceText || "",
          },
        }),
      }
    );
    if (resp.status === 204) {
      console.log("  [feeder] ✓ Feeder repo triggered (voa-post-published)");
    } else {
      const body = await resp.text();
      console.warn(`  [feeder] ✗ Feeder trigger returned HTTP ${resp.status}: ${body}`);
    }
  } catch (err) {
    console.warn(`  [feeder] ✗ Feeder trigger failed: ${err.message}`);
  }
}

// ── MAIN ──
async function main() {
  // ── TEST FEEDER ONLY ──────────────────────────────────────────────────────
  // When --test-feeder-only is set: skip ALL content generation, file writes,
  // JSON index updates, and syndication. Only fire the feeder trigger with a
  // dummy payload so we can confirm the GitHub repository_dispatch is wired up.
  // No files are created or modified. Safe to run anytime.
  if (argv["test-feeder-only"]) {
    console.log("\n[--test-feeder-only] Skipping all content generation.");
    console.log("[--test-feeder-only] Firing feeder trigger with dummy payload...\n");
    await triggerFeeder(
      "https://vibrationofawesome.com/blog/boom/posts/test-post",
      "TEST ~ Do Not Publish",
      "test keyword do not publish",
      { slug: "test-post", lane: "boom" }
    );
    console.log("\n[--test-feeder-only] Done. No files written, no posts created.");
    return;
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let postTitle, userMessage, systemPrompt;
  const requestedNiche = lane === "boom" && argv.niche ? findNiche(argv.niche) : null;
  if (lane === "boom" && argv.niche && !requestedNiche) {
    console.error('Error: Unknown --niche "' + argv.niche + '". Available niches: ' + EARTHSTAR_NICHES.map((n) => n.slug).join(", "));
    process.exit(1);
  }
  const selectedNiche = lane === "boom"
    ? (requestedNiche || findNiche(argv.topic) || getDefaultNiche())
    : null;

  // Load rant file if provided via --rant path/to/rant.txt
  let rantText = "";
  if (argv.rant) {
    const rantPath = path.resolve(argv.rant);
    if (fs.existsSync(rantPath)) {
      rantText = fs.readFileSync(rantPath, "utf8").trim();
      console.log("Rant file loaded: " + rantPath + " (" + rantText.length + " chars)\n");
    } else {
      console.warn("Warning: --rant file not found: " + rantPath);
    }
  }

  const rantInstruction = rantText
    ? [
        "",
        "---",
        "VOICE CONTEXT ~ RAW NOTES FROM MATT (use to shape the post's voice, angles, and opinions):",
        rantText,
        "---",
        "Draw from these raw thoughts to give the post authentic opinions, specific observations,",
        "and real energy. Translate the honesty into Matty BoomBoom's voice without losing the edge.",
        "The rant is the source material ~ the post is the refined version.",
      ].join("\n")
    : "";

  // Build internal-linking context from existing published posts
  const existingPosts = buildExistingPostsList();
  const internalLinkingInstruction = existingPosts
    ? [
        "",
        "---",
        "INTERNAL LINKING: The following posts already exist on vibrationofawesome.com.",
        "Where 2–3 of them are genuinely relevant to what you're writing, naturally weave",
        "in a contextual hyperlink using Markdown: [anchor text](full URL).",
        "Only link where it truly fits the flow ~ never force it, never link the same post twice.",
        existingPosts,
        "---",
      ].join("\n")
    : "";

  // Determine content-type-aware CTA for this post
  const ctaNicheSlug   = selectedNiche ? selectedNiche.slug : undefined;
  const ctaContentType = detectContentType({ lane, niche: ctaNicheSlug, tags: ctaNicheSlug ? [ctaNicheSlug] : [] });
  const selectedCTA    = lane === "boom"
    ? getBoomConversionTarget({ title: argv.title, keyword: argv.keyword, niche: ctaNicheSlug })
    : getNextCTA(lane, ctaContentType);
  const ctaInstruction = lane === "boom"
    ? buildBoomCtaInstruction(selectedCTA)
    : `\n---\nCTA: End the post with a single benefit-forward call-to-action that feels natural to the content. Link text: "${selectedCTA.text}". URL: ${selectedCTA.url}. Do not add author bio or generic sign-off.\n---`;
  console.log("[CTA] " + selectedCTA.id + " ~ " + selectedCTA.url);

  // Load generation memory to build semantic differentiation context
  const clusterKey = argv.cluster || (selectedNiche ? selectedNiche.slug : null);
  const differentiationContext = getDifferentiationContext(ctaNicheSlug, 10) || "";
  const clusterContext         = getClusterContext(clusterKey) || "";
  if (differentiationContext) console.log("[memory] Differentiation context loaded (recent patterns will be avoided).");
  if (clusterContext)         console.log("[cluster] Cluster context loaded: " + clusterKey);

  if (lane === "matt") {
    postTitle    = argv.title;
    systemPrompt = MATT_SYSTEM;
    userMessage  = [
      "Write a full blog post with the title: \"" + argv.title + "\"",
      rantInstruction,
      internalLinkingInstruction,
      clusterContext,
      differentiationContext,
      ctaInstruction,
    ].join("\n");
  } else {
    postTitle    = argv.keyword;
    systemPrompt = BOOMBOT_SYSTEM;
    const nicheContext = getNichePromptContext(selectedNiche);
    const topicContext = argv.topic || selectedNiche.displayName;
    const titleLine = argv.title
      ? "Use this exact H1 title: \"" + argv.title + "\""
      : "Make the H1 title compelling and include the keyword naturally.";
    userMessage  = [
      "Write a long-form SEO blog post targeting the long-tail keyword: \"" + argv.keyword + "\"",
      "Broader topic context: \"" + topicContext + "\"",
      nicheContext,
      titleLine,
      rantInstruction,
      internalLinkingInstruction,
      clusterContext,
      differentiationContext,
      ctaInstruction,
    ].join("\n");
  }

  console.log("\nGenerating " + (lane === "matt" ? "Forest Temple" : "Boom Frequency") + " post...");
  console.log("Title/Keyword: " + postTitle + "\n");
  if (selectedNiche) console.log("Niche: " + selectedNiche.displayName + " (" + selectedNiche.slug + ")\n");

  let markdown;
  try {
    const message = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });
    markdown = message.content[0].text;
    console.log("Claude response received. Processing...\n");
  } catch (err) {
    console.error("Error calling Claude API:");
    if (err.status === 401) console.error("  -> Invalid API key. Check ANTHROPIC_API_KEY in your .env file.");
    else if (err.status === 429) console.error("  -> Rate limited. Wait a moment and try again.");
    else console.error(" ", err.message);
    process.exit(1);
  }

  // Strip META line for BoomBot
  let metaDescription = "";
  let cleanMarkdown   = markdown;
  if (lane === "boom") {
    const result    = stripMeta(markdown);
    metaDescription = result.metaDescription;
    cleanMarkdown   = result.cleanMarkdown;
  }

  // Extract H1 title from generated content, then remove it from the body
  const h1Match = cleanMarkdown.match(/^#\s+(.+)$/m);
  if (h1Match) postTitle = h1Match[1].trim();
  const bodyMarkdown = cleanMarkdown.replace(/^#\s+.+$/m, "").trim();

  // Matt keeps inline forest photos. Boom uses one NASA/space hero plus the
  // floating EarthStar vector body system, so no inline body images are added.
  let bodyHtml = marked.parse(bodyMarkdown);
  let inlineImages = [];
  if (lane === "matt") {
    console.log("Selecting 3 forest images for inline art...");
    inlineImages = fetchForestImages(3);
    if (inlineImages.length > 0) {
      bodyHtml = injectNasaImages(bodyHtml, inlineImages);
      console.log("Forest images injected: " + inlineImages.map(function(i) { return i.title || path.basename(i.url); }).join(", "));
    } else {
      console.warn("No forest images found ~ post will have no inline images.");
    }
  } else {
    console.log("Selecting 1 NASA image for Boom hero art...");
    inlineImages = await fetchNasaImages(1);
    if (inlineImages.length === 0) {
      console.warn("NASA hero unavailable ~ falling back to local boom image.");
      inlineImages = fetchBoomImages(1);
    }
    if (inlineImages.length > 0) {
      console.log("Boom hero image selected: " + inlineImages.map(function(i) { return i.title || path.basename(i.url); }).join(", "));
    } else {
      console.warn("No boom images found ~ post will rely on the vector body system.");
    }
  }
  // Deduplicate slug: if a file with this slug already exists in posts/ or drafts/,
  // append -2, -3 etc. rather than silently overwriting it with different content.
  const baseSlug = slugify(postTitle);
  let slug = baseSlug;
  {
    const postsDir  = path.join(ROOT, "static", "blog", lane, "posts");
    const draftsDir = path.join(ROOT, "static", "blog", lane, "drafts");
    let attempt = 1;
    while (
      fs.existsSync(path.join(postsDir,  slug + ".html")) ||
      fs.existsSync(path.join(draftsDir, slug + ".html"))
    ) {
      attempt++;
      slug = `${baseSlug}-${attempt}`;
    }
    if (slug !== baseSlug) {
      console.warn(`[slug] "${baseSlug}" already exists ~ using "${slug}" to avoid overwriting existing content.`);
    }
  }

  // Record generation into rolling memory registry for future differentiation
  recordGeneration({
    slug,
    title:        postTitle,
    niche:        selectedNiche ? selectedNiche.slug : null,
    cluster:      clusterKey,
    markdownBody: bodyMarkdown,
  });
  console.log("[memory] Generation recorded to generation-memory.json.");

  // In --draft mode: save to drafts/, skip JSON index, sitemap, syndication, feeder
  const isDraft   = !!argv.draft && lane === "boom";
  const outputSub = isDraft ? "drafts" : "posts";
  const outputDir = path.join(ROOT, "static", "blog", lane, outputSub);
  const outputFile = path.join(outputDir, slug + ".html");
  const dataDir   = path.join(ROOT, "static", "_data");
  const dataFile  = path.join(dataDir, lane + "-posts.json");

  fs.mkdirSync(outputDir, { recursive: true });

  const dateStr = new Date().toISOString();
  const heroImageUrl = (inlineImages && inlineImages.length > 0) ? inlineImages[0].url : null;
  let outputHtml = buildHtml(lane, postTitle, dateStr, bodyHtml, slug, metaDescription, heroImageUrl, selectedCTA);
  if (lane === "boom") {
    outputHtml = normalizeBoomHtml(outputHtml, { slug, title: postTitle, keyword: argv.keyword, niche: ctaNicheSlug });
  }
  fs.writeFileSync(outputFile, outputHtml, "utf8");
  console.log((isDraft ? "[DRAFT] " : "") + "Post saved: /blog/" + lane + "/" + outputSub + "/" + slug + ".html");

  if (!isDraft) {
    // Update the JSON post index
    fs.mkdirSync(dataDir, { recursive: true });
    let posts = [];
    if (fs.existsSync(dataFile)) {
      try { posts = JSON.parse(fs.readFileSync(dataFile, "utf8")); if (!Array.isArray(posts)) posts = []; }
      catch (_) { posts = []; }
    }
    posts.unshift({
      title:   postTitle,
      slug,
      date:    dateStr,
      excerpt: extractExcerpt(bodyMarkdown),
      url:     "/blog/" + lane + "/posts/" + slug + ".html",
      tags:    selectedNiche ? [selectedNiche.slug] : [],
      niche:   selectedNiche ? selectedNiche.slug : undefined,
      cluster: clusterKey || undefined,
    });
    fs.writeFileSync(dataFile, JSON.stringify(posts, null, 2), "utf8");
    console.log("JSON index updated: static/_data/" + lane + "-posts.json");

    // Always regenerate sitemap after adding a post
    updateSitemap();

    // ── Syndication ──
    // Boom Frequency (boom): auto-syndicate immediately after generation.
    // Forest Temple (matt): manual only ~ run the command printed below when ready.
    if (lane === "boom" && !argv["skip-syndicate"]) {
      console.log("\nStarting auto-syndication...");
      const syndicateArgs = [
        "scripts/syndicate.js",
        "--lane",  lane,
        "--slug",  slug,
      ];
      if (argv.keyword) syndicateArgs.push("--keyword", argv.keyword);

      const result = spawnSync("node", syndicateArgs, { stdio: "inherit", cwd: ROOT });
      if (result.error) console.error("Syndication spawn error:", result.error.message);
      else if (result.status !== 0) console.warn(`Syndication exited with code ${result.status}`);
    } else if (lane === "boom" && argv["skip-syndicate"]) {
      console.log("\n[syndication skipped ~ --skip-syndicate flag set]");
      console.log("  Syndicate manually when ready:");
      console.log("  node scripts/syndicate.js --lane " + lane + " --slug " + slug);
    } else {
      // Matt / Forest Temple ~ never auto-syndicate
      console.log("\nForest Temple post ready. Syndicate manually when you're ready:");
      console.log("  node scripts/syndicate.js --lane matt --slug " + slug);
    }

    // Fire feeder trigger for every successfully published Boom post
    if (lane === "boom") {
      const fullPostUrl = "https://vibrationofawesome.com/blog/boom/posts/" + slug + ".html";
      await triggerFeeder(fullPostUrl, postTitle, argv.keyword, {
        slug,
        lane,
        excerpt: extractExcerpt(bodyMarkdown),
        tags: selectedNiche ? [selectedNiche.slug] : [],
        category: selectedNiche ? selectedNiche.displayName : (argv.topic || ""),
        sourceText: firstWords(bodyMarkdown, 700),
      });
    }
  } else {
    console.log("\n[DRAFT] Not indexed, not syndicated, feeder not triggered.");
    console.log("  Publish via drip: node scripts/activate-drip.js");
    console.log("  Publish single:   node scripts/drip-publish.js --slug " + slug);
  }
}

main();
