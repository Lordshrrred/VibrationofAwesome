#!/usr/bin/env node
/**
 * seo-research.js ~ SEO keyword research tool for vibrationofawesome.com
 *
 * Generates 20 long-tail keyword variations for a given topic using Claude,
 * outputs a formatted terminal table, and appends results to topic-queue.json.
 *
 * Usage:
 *   node scripts/seo-research.js --topic "AI tools for musicians"
 */

import { createAnthropicClient } from "./lib/anthropic-client.js";
import minimist from "minimist";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { EARTHSTAR_NICHES, SEARCH_INTENTS, findNiche, getDefaultNiche } from "./content-niches.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = path.resolve(__dirname, "..");

// ── CLI ARGS ──
const argv = minimist(process.argv.slice(2), {
  string: ["topic", "niche"],
  boolean: ["all-niches"],
  alias: { t: "topic", n: "niche" },
});

if (!argv.topic && !argv.niche && !argv["all-niches"]) {
  console.error('Error: provide --topic "...", --niche "self-betrayal-avoidance", or --all-niches');
  process.exit(1);
}
if (!argv["all-niches"] && !process.env.ANTHROPIC_API_KEY) {
  console.error("Error: ANTHROPIC_API_KEY not set. Copy .env.example to .env and add your key.");
  process.exit(1);
}

const topic = argv.topic;

// ── HELPERS ──

/** Pad or truncate a string to exactly `len` characters */
function pad(str, len) {
  if (str.length >= len) return str.slice(0, len - 1) + "…";
  return str + " ".repeat(len - str.length);
}

/** Print the formatted terminal table */
function normalizeKeywordResearch(input) {
  if (Array.isArray(input)) {
    return SEARCH_INTENTS.reduce((acc, intent) => {
      acc[intent] = input.filter((kw) => kw.search_intent === intent);
      return acc;
    }, {});
  }
  const grouped = {};
  for (const intent of SEARCH_INTENTS) {
    grouped[intent] = Array.isArray(input && input[intent]) ? input[intent] : [];
  }
  return grouped;
}

function printTable(topic, groupedKeywords, date) {
  const divider = "━".repeat(60);
  console.log("\n" + divider);
  console.log("SEO RESEARCH: " + topic);
  console.log("Generated: " + date);
  console.log(divider + "\n");

  for (const intent of SEARCH_INTENTS) {
    console.log(intent.toUpperCase());
    const keywords = groupedKeywords[intent] || [];
    keywords.forEach((kw, i) => {
      const num     = String(i + 1).padStart(2, " ");
      const outline = Array.isArray(kw.h2_outline)
        ? kw.h2_outline.map((h) => "H2: " + h).join(" | ")
        : String(kw.h2_outline || "");

      console.log(num + ". " + kw.keyword);
      console.log("    Title:  " + (kw.suggested_title || ""));
      console.log("    Fit:    " + (kw.opportunity || ""));
      console.log("    Outline: " + outline);
      console.log("");
    });
    console.log("");
  }

  console.log(divider + "\n");
}

function buildSeedResearch(niche, date) {
  const grouped = {};
  for (const intent of SEARCH_INTENTS) {
    grouped[intent] = (niche.keywordResearch[intent] || []).map((keyword) => ({
      keyword,
      search_intent: intent,
      suggested_title: titleFromKeyword(keyword),
      opportunity: "Seeded low-competition/high-intent candidate from niche strategy.",
      h2_outline: [
        "The real pattern underneath this search",
        "What most advice gets wrong",
        "The grounded EarthStar move",
        "A simple next step",
      ],
    }));
  }
  return {
    date,
    niche: niche.slug,
    displayName: niche.displayName,
    coreProblem: niche.coreProblem,
    contentAngle: niche.contentAngle,
    keywordSeedPhrases: niche.keywordSeedPhrases,
    intents: grouped,
  };
}

function titleFromKeyword(keyword) {
  return String(keyword)
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function writeNicheResearchFile(research) {
  const dir = path.join(ROOT, "content-strategy", "keyword-research");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, research.niche + ".json");
  fs.writeFileSync(file, JSON.stringify(research, null, 2), "utf8");
  return file;
}

function saveTopicQueue(topicName, groupedKeywords, date, niche) {
  const dataDir  = path.join(ROOT, "static", "_data");
  const dataFile = path.join(dataDir, "topic-queue.json");

  fs.mkdirSync(dataDir, { recursive: true });

  let queue = [];
  if (fs.existsSync(dataFile)) {
    try {
      queue = JSON.parse(fs.readFileSync(dataFile, "utf8"));
      if (!Array.isArray(queue)) queue = [];
    } catch (_) {
      queue = [];
    }
  }

  queue.push({
    date,
    topic: topicName,
    niche: niche ? niche.slug : undefined,
    keywords: groupedKeywords,
  });
  fs.writeFileSync(dataFile, JSON.stringify(queue, null, 2), "utf8");
}

async function researchWithClaude(client, topicName, niche) {
  const nicheContext = niche
    ? [
        "Niche: " + niche.displayName,
        "Core problem: " + niche.coreProblem,
        "Audience pain: " + niche.audiencePain,
        "Content angle: " + niche.contentAngle,
        "Seed phrases: " + niche.keywordSeedPhrases.join(", "),
      ].join("\n")
    : "";

  const message = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 4096,
    system: [{
      type: "text",
      text: [
        "You are an SEO strategist for vibrationofawesome.com.",
        "The site targets spiritually awakening creators, neurodivergent entrepreneurs,",
        "AI-curious creators, and EarthStar-aligned outliers who want grounded, useful work.",
        "Return only valid JSON. No markdown fences, no commentary.",
      ].join(" "),
      cache_control: { type: "ephemeral" },
    }],
    messages: [{
      role: "user",
      content: [
        "Generate long-tail keyword research for this topic: " + topicName,
        nicheContext,
        "",
        "Group keywords by these exact search intent keys:",
        SEARCH_INTENTS.join(", "),
        "",
        "For each intent, return 4 low-competition/high-intent blog topic candidates.",
        "Each candidate must have these fields:",
        "  keyword         (string)",
        "  search_intent   (one of the exact intent keys)",
        "  suggested_title (string)",
        "  opportunity     (string explaining why it is low-competition or high-intent)",
        "  h2_outline      (array of 4-5 H2 heading strings)",
        "",
        "Return one JSON object where each key is an intent and each value is an array.",
      ].join("\n"),
    }],
  });

  const raw = message.content[0].text.trim();
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
  return normalizeKeywordResearch(JSON.parse(cleaned));
}

// ── MAIN ──
async function main() {
  const today  = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  if (argv["all-niches"]) {
    for (const niche of EARTHSTAR_NICHES) {
      const research = buildSeedResearch(niche, today);
      const file = writeNicheResearchFile(research);
      console.log("Seed keyword research saved: " + path.relative(ROOT, file));
    }
    return;
  }

  const client = createAnthropicClient({ label: "seo-research" });

  const selectedNiche = argv.niche ? findNiche(argv.niche) : findNiche(topic);
  if (argv.niche && !selectedNiche) {
    console.error('Error: Unknown --niche "' + argv.niche + '". Available niches: ' + EARTHSTAR_NICHES.map((n) => n.slug).join(", "));
    process.exit(1);
  }
  const topicName = topic || selectedNiche.displayName;

  console.log("\nResearching topic: \"" + topicName + "\"");
  if (selectedNiche) console.log("Niche: " + selectedNiche.displayName + " (" + selectedNiche.slug + ")");
  console.log("Calling Claude for grouped long-tail keyword research...\n");

  let groupedKeywords;
  try {
    groupedKeywords = await researchWithClaude(client, topicName, selectedNiche || getDefaultNiche());
  } catch (err) {
    console.error("Error calling Claude API or parsing JSON: " + err.message);
    process.exit(1);
  }

  printTable(topicName, groupedKeywords, today);
  saveTopicQueue(topicName, groupedKeywords, today, selectedNiche);
  if (selectedNiche) {
    const file = writeNicheResearchFile({
      date: today,
      niche: selectedNiche.slug,
      displayName: selectedNiche.displayName,
      coreProblem: selectedNiche.coreProblem,
      contentAngle: selectedNiche.contentAngle,
      keywordSeedPhrases: selectedNiche.keywordSeedPhrases,
      intents: groupedKeywords,
    });
    console.log("Research saved to " + path.relative(ROOT, file));
  }
  console.log("Research appended to static/_data/topic-queue.json");
}

main();
