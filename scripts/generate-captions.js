#!/usr/bin/env node
/**
 * generate-captions.js ~ Platform-specific caption generator for vibrationofawesome.com
 *
 * Generates unique captions for syndication platforms using Claude.
 *
 * Exports: generateCaptions(post, client?)
 * CLI:     node scripts/generate-captions.js --lane [matt|boom] --slug <slug>
 */

import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import minimist from "minimist";

dotenv.config({ override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = path.resolve(__dirname, "..");

// Ordered list of platform labels ~ order matters for the section parser
const LABELS = [
  "FACEBOOK", "BLUESKY", "MASTODON", "PINTEREST",
  "DEVTO", "TUMBLR", "THREADS", "INSTAGRAM",
];

const SYSTEM_PROMPT = `You are a social media copywriter for vibrationofawesome.com.

The site serves spiritually awakening creators, neurodivergent entrepreneurs, musicians
learning AI, and abundance-minded outliers. Matt EarthStar is the creator ~ musician (EarthStar
rock/metal/electronic, Ruzindla EDM/psytrance), digital creator, 20-year internet marketing
veteran who runs a personal operating system called Forest Temple.

Write in a real, slightly eccentric voice - never corporate, never generic. Each caption must
be completely unique and tailored for that platform's culture and norms.

Never use the long dash character in your output. Use hyphens, commas, or restructure the sentence instead.

Return ONLY the labeled sections in exact order with no preamble or commentary.`;

const LEGACY_THREADS_INSTRUCTION = `THREADS: write an original compact mini-thread for Threads in one publishable text block under 500 chars total. Format exactly as "1/3 ...", blank line, "2/3 ...", blank line, "3/3 ...". It must feel like three connected thoughts, not a caption. Put the URL only in 3/3. Use zero hashtags unless one is genuinely useful.`;

const VOA_THREADS_INSTRUCTION = `THREADS: write an original native Threads mini-essay, usually 3 to 5 numbered parts in one publishable text block. Target 650-1000 chars total, with 1200 chars as a hard ceiling. Use the natural denominator for the chosen length, such as "1/4", "2/4", etc. The thread itself must feel complete without needing the link. Write in first person or direct observation only: never refer to Matt in third person, never mention "this article", "this post", "this write-up", or introduce the link like marketing copy. Each part should carry connected development, usually 1-3 short paragraphs rather than isolated quote-card fragments. Let section lengths vary naturally. Open with a strong human hook, build the thought through the middle, and end with a satisfying insight; place the URL only in the final part without "read more" energy. Keep it conversational, emotionally intelligent, specific, grounded, and slightly raw. Vary sentence rhythm and section openings. Avoid generic self-help language, fake profundity, repetitive syntax, "watch this video", guru cadence, and hashtags unless one is genuinely useful.`;

const THREADS_ANTI_PATTERNS = [
  { label: "Matt/Matty", regex: /\bmatty?\b/i },
  { label: "this article", regex: /\bthis article\b/i },
  { label: "this post", regex: /\bthis post\b/i },
  { label: "this write-up", regex: /\bthis write[- ]up\b/i },
  { label: "read more", regex: /\bread more\b/i },
  { label: "wrote about", regex: /\bwrote about\b/i },
  { label: "talks about", regex: /\btalks about\b/i },
  { label: "in this piece", regex: /\bin this piece\b/i },
  { label: "here's what", regex: /\bhere['’]s what\b/i },
];

// ── Parser ────────────────────────────────────────────────────────────────────

/**
 * Parse Claude's labeled-section response into a plain object keyed by lowercase platform name.
 * Handles Claude's tendency to wrap labels in markdown bold (**LABEL:**) and
 * separate sections with --- horizontal rules.
 */
function parseCaptions(text) {
  const result = {};

  // Label pattern: optional leading **, optional trailing **, colon, optional trailing whitespace/newlines
  // e.g. matches: "FACEBOOK:", "**FACEBOOK:**", "**FACEBOOK:** "
  function labelRe(label) {
    return new RegExp(`^\\*{0,2}\\s*${label}:\\s*\\*{0,2}\\s*`, "mi");
  }

  for (let i = 0; i < LABELS.length; i++) {
    const label = LABELS[i];
    const next  = LABELS[i + 1];

    // Use exec() so we get startM.index ~ reliable even if the string appears elsewhere
    const startM = labelRe(label).exec(text);
    if (!startM) { result[label.toLowerCase()] = ""; continue; }

    const start = startM.index + startM[0].length;
    let end = text.length;

    if (next) {
      const endM = labelRe(next).exec(text.slice(start));
      if (endM) end = start + endM.index;
    }

    result[label.toLowerCase()] = text
      .slice(start, end)
      .replace(/\s*\n?---+\n?\s*$/m, "")  // strip trailing --- separator
      .trim();
  }
  return result;
}

function splitThreadParts(text) {
  return String(text || "")
    .split(/\n\s*\n(?=\d+\/\d+\s)/)
    .map(part => part.trim())
    .filter(Boolean);
}

function stripThreadPrefix(part) {
  return part.replace(/^\d+\/\d+\s*/, "").trim();
}

function countSentences(text) {
  return (text.match(/[.!?](?:["')\]]+)?(?=\s|$)/g) || []).length;
}

function openingSignature(text) {
  return stripThreadPrefix(text)
    .replace(/https?:\/\/\S+/g, "")
    .toLowerCase()
    .match(/[a-z0-9']+/g)
    ?.slice(0, 2)
    .join(" ") || "";
}

function splitSentences(text) {
  return stripThreadPrefix(text)
    .replace(/https?:\/\/\S+/g, "")
    .split(/(?<=[.!?])\s+/)
    .map(sentence => sentence.trim())
    .filter(Boolean);
}

function paragraphCount(text) {
  return stripThreadPrefix(text)
    .split(/\n\s*\n/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean)
    .length;
}

function detectAntiPatterns(text) {
  return THREADS_ANTI_PATTERNS
    .filter(({ regex }) => regex.test(text))
    .map(({ label }) => label);
}

function standardDeviation(values) {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length;
  return Math.sqrt(variance);
}

export function analyzeThreadsCaption(text) {
  const parts = splitThreadParts(text);
  const totalChars = String(text || "").length;
  const numbering = parts.map(part => part.match(/^(\d+)\/(\d+)\s/)).filter(Boolean);
  const denominators = new Set(numbering.map(match => Number(match[2])));
  const sectionBodies = parts.map(part => stripThreadPrefix(part).replace(/https?:\/\/\S+/g, "").trim());
  const sectionLengths = sectionBodies.map(body => body.length);
  const sectionSentenceCounts = sectionBodies.map(body => countSentences(body));
  const sectionParagraphCounts = parts.map(paragraphCount);
  const thinSections = sectionBodies.filter(body => body.length < 90);
  const developedSections = sectionBodies.filter(body => countSentences(body) >= 2);
  const openings = parts.map(openingSignature).filter(Boolean);
  const repeatedOpenings = openings.length - new Set(openings).size;
  const allSentences = sectionBodies.flatMap(splitSentences);
  const sentenceLengths = allSentences.map(sentence => sentence.split(/\s+/).filter(Boolean).length);
  const averageSectionLength = sectionLengths.length
    ? Math.round(sectionLengths.reduce((sum, value) => sum + value, 0) / sectionLengths.length)
    : 0;
  const averageSentencesPerSection = sectionSentenceCounts.length
    ? Number((sectionSentenceCounts.reduce((sum, value) => sum + value, 0) / sectionSentenceCounts.length).toFixed(2))
    : 0;
  const multiThoughtSections = sectionSentenceCounts.filter(count => count >= 2).length;
  const oneLineSections = sectionParagraphCounts.filter((paragraphs, index) =>
    paragraphs <= 1 && sectionSentenceCounts[index] <= 1
  ).length;
  const sentenceRhythmVariance = Number(standardDeviation(sentenceLengths).toFixed(2));
  const paragraphVarianceScore = Number(standardDeviation(sectionParagraphCounts).toFixed(2));
  const conversationalDensityScore = Number((
    (averageSentencesPerSection * 0.45) +
    ((averageSectionLength / 100) * 0.35) +
    ((multiThoughtSections / Math.max(parts.length, 1)) * 2 * 0.20)
  ).toFixed(2));
  const antiPatterns = detectAntiPatterns(text);
  const issues = [];

  if (parts.length < 3 || parts.length > 5) issues.push("expected 3-5 numbered parts");
  if (numbering.length !== parts.length || denominators.size !== 1 || [...denominators][0] !== parts.length) {
    issues.push("inconsistent numbering");
  }
  if (totalChars < 600) issues.push("under 600 chars");
  if (totalChars > 1200) issues.push("over 1200 chars");
  if (thinSections.length > 0) issues.push(`${thinSections.length} thin section(s)`);
  if (developedSections.length < 2) issues.push("insufficient section development");
  if (repeatedOpenings > 0) issues.push("repeated section openings");
  if (antiPatterns.length > 0) issues.push(`anti-patterns: ${antiPatterns.join(", ")}`);
  if (oneLineSections > 1) issues.push("excessive one-line sections");
  if (averageSectionLength < 150) issues.push("low average section depth");
  if (conversationalDensityScore < 2.35) issues.push("low conversational density");
  if (sentenceRhythmVariance < 3 && allSentences.length >= 5) issues.push("repeated sentence rhythm");

  return {
    totalChars,
    partCount: parts.length,
    averageSectionLength,
    averageSentencesPerSection,
    thinSectionCount: thinSections.length,
    developedSectionCount: developedSections.length,
    oneLineSectionCount: oneLineSections,
    repeatedOpenings,
    antiPatterns,
    conversationalDensityScore,
    paragraphVarianceScore,
    sentenceRhythmVariance,
    issues,
    ok: issues.length === 0,
  };
}

function buildUserContent(post, postUrl, laneLabel, threadsInstruction = VOA_THREADS_INSTRUCTION) {
  return [
    `Title: ${post.title}`,
    `URL: ${postUrl}`,
    `Excerpt: ${(post.excerpt || "").slice(0, 300)}`,
    `Lane: ${laneLabel}`,
    `Tags: ${(post.tags || []).join(", ")}`,
    "",
    "Generate captions for each platform below. Follow every tone rule exactly.",
    "Include the URL naturally in each caption unless noted otherwise.",
    "",
    `FACEBOOK: conversational tone, 2-3 sentences, end with a genuine question to spark comments, include the URL`,
    `BLUESKY: punchy single thought or sentence, under 300 chars total including URL, zero hashtags`,
    `MASTODON: thoughtful and contextual, 2-3 sentences, end with 2-3 relevant #hashtags`,
    `PINTEREST: descriptive keyword-rich paragraph (good for search), end with 3-5 #hashtags, include URL`,
    `DEVTO: short compelling intro paragraph with a technical/AI-automation angle, suitable as a Dev.to article teaser, must mention AI or automation angle, end with URL`,
    `TUMBLR: creative, aesthetic, slightly poetic, 2-4 sentences, then 5-8 #hashtags on a new line separated from the caption`,
    threadsInstruction,
    `INSTAGRAM: write a visual-first Instagram caption. First line is the scroll-stopping hook (max 125 chars ~ make someone feel something, not just read something). Then 1-2 short sentences of supporting context. Do NOT include any URLs (Instagram captions do not support clickable links). End with 6-8 relevant #hashtags on a new line. Total caption before hashtags: under 300 chars. Match the emotional tone of the post ~ raw, honest, or cosmic depending on the content.`,
  ].join("\n");
}

async function reviseThreadsCaption(post, currentThread, analysis, anthropic, postUrl, laneLabel) {
  const msg = await anthropic.messages.create({
    model:      "claude-sonnet-4-6",
    max_tokens: 1200,
    system:     SYSTEM_PROMPT,
    messages:   [{
      role: "user",
      content: [
        `Title: ${post.title}`,
        `URL: ${postUrl}`,
        `Excerpt: ${(post.excerpt || "").slice(0, 300)}`,
        `Lane: ${laneLabel}`,
        `Tags: ${(post.tags || []).join(", ")}`,
        "",
        "Revise ONLY the Threads copy below.",
        `Current issues: ${analysis.issues.join(", ")}.`,
        `Detected anti-patterns: ${analysis.antiPatterns.join(", ") || "none"}.`,
        `Current metrics: avg section length ${analysis.averageSectionLength}, density ${analysis.conversationalDensityScore}, paragraph variance ${analysis.paragraphVarianceScore}, sentence rhythm variance ${analysis.sentenceRhythmVariance}.`,
        VOA_THREADS_INSTRUCTION,
        "Return exactly one labeled section in this form and nothing else:",
        "THREADS:",
        "",
        currentThread,
      ].join("\n"),
    }],
  });

  return parseCaptions(`${msg.content[0].text}\nINSTAGRAM:`).threads;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Generate platform-specific captions for a blog post.
 *
 * @param {object} post - { title, excerpt, url, tags, lane }
 * @param {Anthropic} [client] - Optional pre-created Anthropic client
 * @returns {Promise<object>} Captions keyed by platform (facebook, bluesky, mastodon, etc.)
 */
export async function generateCaptions(post, client) {
  const anthropic = client || new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const postUrl   = post.url.startsWith("http")
    ? post.url
    : `https://vibrationofawesome.com${post.url}`;
  const laneLabel = post.lane === "matt"
    ? "From the Forest Temple (raw personal blog by Matt EarthStar)"
    : "Boom Frequency (AI/creator-tools blog by Matty BoomBoom)";

  const userContent = buildUserContent(post, postUrl, laneLabel);

  const msg = await anthropic.messages.create({
    model:      "claude-sonnet-4-6",
    max_tokens: 2048,
    system:     SYSTEM_PROMPT,
    messages:   [{ role: "user", content: userContent }],
  });

  const captions = parseCaptions(msg.content[0].text);
  let threadsAnalysis = analyzeThreadsCaption(captions.threads);
  for (let attempt = 0; !threadsAnalysis.ok && attempt < 3; attempt++) {
    captions.threads = await reviseThreadsCaption(
      post,
      captions.threads,
      threadsAnalysis,
      anthropic,
      postUrl,
      laneLabel,
    );
    threadsAnalysis = analyzeThreadsCaption(captions.threads);
  }

  return captions;
}

// ── CLI entry point ───────────────────────────────────────────────────────────

const isCli = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isCli) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Error: ANTHROPIC_API_KEY not set."); process.exit(1);
  }

  const argv = minimist(process.argv.slice(2), { string: ["lane", "slug"], boolean: ["threads-preview"] });
  if (!argv.lane || !["matt", "boom"].includes(argv.lane) || !argv.slug) {
    console.error("Usage: node scripts/generate-captions.js --lane [matt|boom] --slug <post-slug>");
    process.exit(1);
  }

  const dataFile = path.join(ROOT, "static", "_data", `${argv.lane}-posts.json`);
  if (!fs.existsSync(dataFile)) { console.error(`No data file: ${dataFile}`); process.exit(1); }

  const posts = JSON.parse(fs.readFileSync(dataFile, "utf8"));
  let post  = posts.find(p => p.slug === argv.slug);
  if (!post && argv.lane === "boom") {
    const queueFile = path.join(ROOT, "static", "_data", "drip-queue.json");
    const draftFile = path.join(ROOT, "static", "blog", "boom", "drafts", `${argv.slug}.html`);
    const queue = fs.existsSync(queueFile)
      ? JSON.parse(fs.readFileSync(queueFile, "utf8"))
      : { queue: [] };
    const queued = (queue.queue || []).find(item => item.slug === argv.slug);
    if (queued && fs.existsSync(draftFile)) {
      const html = fs.readFileSync(draftFile, "utf8");
      const paragraph = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] || "";
      post = {
        title: queued.title,
        slug: queued.slug,
        excerpt: paragraph.replace(/<[^>]+>/g, "").trim().slice(0, 300),
        url: `/blog/boom/posts/${queued.slug}.html`,
        tags: [],
      };
    }
  }
  if (!post) { console.error(`Post "${argv.slug}" not found in ${dataFile}`); process.exit(1); }

  if (argv["threads-preview"]) {
    const previewPost = { ...post, lane: argv.lane };
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const postUrl = previewPost.url.startsWith("http")
      ? previewPost.url
      : `https://vibrationofawesome.com${previewPost.url}`;
    const laneLabel = previewPost.lane === "matt"
      ? "From the Forest Temple (raw personal blog by Matt EarthStar)"
      : "Boom Frequency (AI/creator-tools blog by Matty BoomBoom)";
    const legacyMsg = await anthropic.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 2048,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: "user", content: buildUserContent(previewPost, postUrl, laneLabel, LEGACY_THREADS_INSTRUCTION) }],
    });
    const currentVersion = parseCaptions(legacyMsg.content[0].text).threads;
    const upgradedVersion = (await generateCaptions(previewPost, anthropic)).threads;
    console.log(JSON.stringify({
      title: previewPost.title,
      current: {
        text: currentVersion,
        analysis: analyzeThreadsCaption(currentVersion),
      },
      upgraded: {
        text: upgradedVersion,
        analysis: analyzeThreadsCaption(upgradedVersion),
      },
    }, null, 2));
  } else {
    console.log(`\nGenerating captions for: ${post.title}\n`);
    const captions = await generateCaptions({ ...post, lane: argv.lane });
    console.log(JSON.stringify(captions, null, 2));
  }
}
