#!/usr/bin/env node
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import minimist from "minimist";
import dotenv from "dotenv";
import { createAnthropicClient } from "./lib/anthropic-client.js";
import { buildExperienceSyndicationSet } from "./lib/experience-syndication.js";
import { postToBlogger, postToDevTo, postToTumblr, postToWordPressDirect } from "./syndicate.js";

import { pathToFileURL as __voaPathToFileURL } from "node:url";
dotenv.config({ override: true });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BASE = "https://vibrationofawesome.com";
const ASSETS_FILE = path.join(ROOT, "static/_data/authority-assets.json");
const STATUS_FILE = path.join(ROOT, "static/_data/experience-syndication.json");
const CACHE_FILE = path.join(ROOT, "data/ops/experience-companion-cache.json");
const MODEL = process.env.EXPERIENCE_COMPANION_MODEL || process.env.SYNDICATION_COMPANION_MODEL || "claude-haiku-4-5-20251001";

const argv = minimist(process.argv.slice(2), {
  boolean: ["execute", "force", "json", "simulate-retry"],
  string: ["experience", "platforms"],
  default: { platforms: "" },
});

const DEFAULT_NEW_CAMPAIGN_PLATFORMS = ["wordpress_earthstar"];

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (_) { return fallback; }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function absoluteUrl(pathname) {
  return String(pathname || "").startsWith("http") ? pathname : `${BASE}${pathname}`;
}

function sourceHash(asset) {
  return crypto.createHash("sha256").update(JSON.stringify({
    id: asset.id || asset.slug,
    title: asset.title,
    canonical: asset.canonical,
    description: asset.description,
    experience: asset.experience || {},
  })).digest("hex").slice(0, 16);
}

function assetById(id) {
  const payload = readJson(ASSETS_FILE, { assets: [] });
  const assets = Array.isArray(payload) ? payload : payload.assets || [];
  return assets.find(asset => (asset.id || asset.slug) === id);
}

function getQueuedCampaign(status) {
  const campaigns = Array.isArray(status.campaigns) ? status.campaigns : [];
  if (argv.experience) return campaigns.find(c => c.id === argv.experience);
  const retry = campaigns.find(c =>
    c.status === "in_progress" &&
    c.canonicalStatus === 200 &&
    c.inSitemap &&
    c.schemaPresent &&
    failedPlatforms(c).length > 0
  );
  if (retry) return retry;
  return campaigns.find(c => c.status === "queued" && c.canonicalStatus === 200 && c.inSitemap && c.schemaPresent);
}

function failedPlatforms(campaign) {
  return Object.entries(campaign?.platforms || {})
    .filter(([, row]) => row?.status === "failed")
    .map(([platform]) => platform);
}

function loadCache() {
  return readJson(CACHE_FILE, {});
}

function cacheKey(asset, platform) {
  return `${sourceHash(asset)}:${platform}:v1`;
}

async function generateLongForm(asset, platform, deterministic) {
  if (!process.env.ANTHROPIC_API_KEY) {
    const text = deterministic[platform] || deterministic.wordpress || deterministic.blogger;
    return {
      title: `${asset.title}: A Practical Companion`,
      excerpt: asset.description || asset.experience?.primaryPurpose || "",
      html: text.split(/\n{2,}/).map(p => `<p>${p.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`).join("\n"),
      generatedBy: "deterministic-fallback",
      model: null,
      estimatedCostUsd: 0,
    };
  }

  const anthropic = createAnthropicClient({ label: "experience-syndication" });
  const canonical = absoluteUrl(asset.canonical);
  const purpose = asset.experience?.primaryPurpose || asset.description || "";
  const outcome = asset.experience?.practicalOutcome || asset.experience?.emotionalOutcome || "";
  const prompt = `Write a useful standalone companion article for this Vibration of Awesome interactive experience.

EXPERIENCE: ${asset.title}
URL: ${canonical}
PURPOSE: ${purpose}
OUTCOME: ${outcome}

Destination: ${platform}

Format exactly:
TITLE: [distinct title]
EXCERPT: [one sentence]

[clean HTML article body]

Requirements:
- 700-950 words
- original companion article, not thin promo copy
- include exactly one natural HTML backlink to ${canonical}
- do not use the raw URL as anchor text
- voice: grounded, human, reflective, useful, never generic SaaS copy
- HTML only in the body: p, h2, h3, blockquote, strong, em, ul, ol, li, a`;

  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2600,
    system: "You write useful companion articles for Vibration of Awesome tools. Be concrete, human, and grounded.",
    messages: [{ role: "user", content: prompt }],
  });
  const text = msg.content?.find(p => p.type === "text")?.text || "";
  if (!text.trim()) throw new Error("Claude returned no companion article text");
  const title = text.match(/^TITLE:\s*(.+)$/m)?.[1]?.trim() || `${asset.title}: A Practical Companion`;
  const excerpt = text.match(/^EXCERPT:\s*(.+)$/m)?.[1]?.trim() || purpose.slice(0, 160);
  const html = text.replace(/^TITLE:\s*.+$/m, "").replace(/^EXCERPT:\s*.+$/m, "").trim();
  return {
    title,
    excerpt,
    html,
    generatedBy: "claude",
    model: MODEL,
    estimatedCostUsd: 0.01,
  };
}

async function getOrCreateAsset(cache, asset, platform, deterministic) {
  const id = asset.id || asset.slug;
  const key = cacheKey(asset, platform);
  cache[id] = cache[id] || { platforms: {} };
  const existing = cache[id].platforms?.[platform];
  if (existing?.cacheKey === key && !argv.force) {
    return { companion: existing, reused: true };
  }

  let companion;
  if (platform === "blogger" || platform === "wordpress_earthstar") {
    companion = await generateLongForm(asset, platform, deterministic);
  } else {
    companion = {
      title: asset.title,
      excerpt: asset.description || asset.experience?.primaryPurpose || "",
      html: deterministic[platform] || deterministic.socialSnippet,
      generatedBy: "deterministic",
      model: null,
      estimatedCostUsd: 0,
    };
  }
  companion.cacheKey = key;
  companion.platform = platform;
  companion.sourceUrl = absoluteUrl(asset.canonical);
  companion.generatedAt = new Date().toISOString();
  cache[id].platforms[platform] = companion;
  cache[id].estimatedClaudeSpendUsd = Object.values(cache[id].platforms).reduce((sum, row) => sum + (Number(row.estimatedCostUsd) || 0), 0);
  writeJson(CACHE_FILE, cache);
  return { companion, reused: false };
}

async function postPlatform(asset, platform, companion, execute) {
  const canonical = absoluteUrl(asset.canonical);
  if (!execute) return { status: "prepared", url: null, postId: null, error: null };
  if (platform === "blogger") {
    const r = await postToBlogger(companion.title, companion.html);
    return { status: "success", url: r.postUrl, postId: r.postId, error: null };
  }
  if (platform === "wordpress_earthstar") {
    const r = await postToWordPressDirect({ ...companion, slug: `${asset.id || asset.slug}-experience-companion` });
    return { status: "success", url: r.postUrl, postId: r.postId, error: null };
  }
  if (platform === "tumblr_voa") {
    const r = await postToTumblr(companion.html, ["VibrationOfAwesome", "InteractiveTools"], "VOA", canonical, asset.title);
    return { status: "success", url: r.postUrl, postId: r.postId, error: null };
  }
  if (platform === "devto") {
    const r = await postToDevTo(companion.title, companion.html, canonical, ["tools", "productivity", "wellbeing"], "primary");
    return { status: "success", url: r.postUrl, postId: r.postId, error: null };
  }
  return { status: "prepared", url: null, postId: null, error: "preparation-only platform" };
}

async function verifyBacklink(url, canonical) {
  if (!url) return { ok: false, status: 0, canonicalLinkPresent: false };
  try {
    const resp = await fetch(url, { redirect: "follow" });
    const text = await resp.text();
    return { ok: resp.ok, status: resp.status, canonicalLinkPresent: text.includes(canonical) };
  } catch (err) {
    return { ok: false, status: 0, canonicalLinkPresent: false, error: err.message };
  }
}

async function main() {
  const status = readJson(STATUS_FILE, { campaigns: [] });
  const campaign = getQueuedCampaign(status);
  if (!campaign) {
    console.log("No eligible experience campaign queued.");
    return;
  }
  const asset = assetById(campaign.id);
  if (!asset) throw new Error(`Authority asset not found: ${campaign.id}`);
  const deterministic = buildExperienceSyndicationSet(asset);
  const cache = loadCache();
  const requestedPlatforms = String(argv.platforms || "").split(",").map(s => s.trim()).filter(Boolean);
  const retryPlatforms = failedPlatforms(campaign);
  const platforms = requestedPlatforms.length
    ? requestedPlatforms
    : (retryPlatforms.length ? retryPlatforms : DEFAULT_NEW_CAMPAIGN_PLATFORMS);
  const platformResults = {};
  let generated = 0;
  let reused = 0;

  for (const platform of platforms) {
    const { companion, reused: wasReused } = await getOrCreateAsset(cache, asset, platform, deterministic);
    if (wasReused) reused++; else generated++;
    if (argv["simulate-retry"]) {
      platformResults[platform] = { status: "cache_reused", url: null, cacheReused: true, generatedBy: companion.generatedBy };
      continue;
    }
    try {
      const result = await postPlatform(asset, platform, companion, argv.execute);
      const verification = result.url ? await verifyBacklink(result.url, absoluteUrl(asset.canonical)) : null;
      platformResults[platform] = { ...result, cacheReused: wasReused, generatedBy: companion.generatedBy, verification };
    } catch (err) {
      platformResults[platform] = { status: "failed", url: null, postId: null, error: err.message, cacheReused: wasReused, generatedBy: companion.generatedBy };
    }
  }

  if (argv["simulate-retry"]) {
    const output = { experience: campaign.id, execute: false, generated, reused, platforms: platformResults };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  const mergedPlatforms = { ...(campaign.platforms || {}), ...platformResults };
  const hasFailed = Object.values(mergedPlatforms).some(r => r.status === "failed");
  const successfulCount = Object.values(mergedPlatforms).filter(p => p.status === "success").length;
  const idx = status.campaigns.findIndex(c => c.id === campaign.id);
  const next = {
    ...campaign,
    status: hasFailed ? "in_progress" : (argv.execute ? "complete" : "queued"),
    lastAttemptAt: new Date().toISOString(),
    completedAt: argv.execute && !hasFailed ? new Date().toISOString() : campaign.completedAt || null,
    platforms: mergedPlatforms,
    cachedCompanionAssets: Object.keys((loadCache()[campaign.id] || {}).platforms || {}).length,
    dedicatedCompanionContent: true,
    currentExternalBacklinkCoverage: successfulCount,
    estimatedClaudeSpendUsd: (loadCache()[campaign.id] || {}).estimatedClaudeSpendUsd || campaign.estimatedClaudeSpendUsd || 0,
    orphanedFromBacklinkEngine: successfulCount === 0,
    boundedTest: argv.execute ? { ranAt: new Date().toISOString(), platforms, generated, reused } : campaign.boundedTest || null,
  };
  if (idx >= 0) status.campaigns[idx] = next;
  status.generatedAt = new Date().toISOString();
  status.summary = {
    ...(status.summary || {}),
    queued: status.campaigns.filter(c => c.status === "queued").length,
    inProgress: status.campaigns.filter(c => c.status === "in_progress").length,
    complete: status.campaigns.filter(c => c.status === "complete").length,
    failedPlatformRetries: status.campaigns.reduce((sum, c) => sum + Object.values(c.platforms || {}).filter(p => p.status === "failed").length, 0),
    cachedCompanionAssets: status.campaigns.reduce((sum, c) => sum + (c.cachedCompanionAssets || 0), 0),
    estimatedClaudeSpendUsd: status.campaigns.reduce((sum, c) => sum + (Number(c.estimatedClaudeSpendUsd) || 0), 0),
    nextExperienceScheduled: status.campaigns.find(c => c.status === "queued")?.title || null,
  };
  writeJson(STATUS_FILE, status);

  const output = { experience: campaign.id, execute: argv.execute, generated, reused, platforms: platformResults };
  console.log(JSON.stringify(output, null, 2));
}

// CLI-only guard: without this, merely `import`-ing this module (from a test,
// another script, or a syntax/load check) executes a real run with real side
// effects. See CLAUDE.md ~ every script with a top-level main() needs this.
const __voaIsCli = process.argv[1] && import.meta.url === __voaPathToFileURL(process.argv[1]).href;
if (__voaIsCli) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
