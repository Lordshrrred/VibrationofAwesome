#!/usr/bin/env node
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import minimist from "minimist";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BASE = "https://vibrationofawesome.com";
const ASSETS_FILE = path.join(ROOT, "static/_data/authority-assets.json");
const HUBS_FILE = path.join(ROOT, "static/_data/authority-hubs.json");
const SITEMAP_FILE = path.join(ROOT, "static/sitemap.xml");
const STATUS_FILE = path.join(ROOT, "static/_data/experience-syndication.json");
const CACHE_FILE = path.join(ROOT, "data/ops/experience-companion-cache.json");

const argv = minimist(process.argv.slice(2), {
  boolean: ["write", "json", "verify-live"],
});

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (_) { return fallback; }
}

function absoluteUrl(pathname) {
  return String(pathname || "").startsWith("http") ? pathname : `${BASE}${pathname}`;
}

function canonicalPath(asset) {
  const raw = asset.canonical || "/";
  if (raw.startsWith("http")) return new URL(raw).pathname;
  return raw;
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

function localCanonicalStatus(asset) {
  const p = canonicalPath(asset).replace(/^\/+/, "");
  const html = path.join(ROOT, "static", p, "index.html");
  return fs.existsSync(html) ? 200 : 404;
}

function schemaPresent(asset) {
  const p = canonicalPath(asset).replace(/^\/+/, "");
  const html = path.join(ROOT, "static", p, "index.html");
  if (!fs.existsSync(html)) return false;
  return /application\/ld\+json/.test(fs.readFileSync(html, "utf8"));
}

async function liveStatus(asset) {
  if (!argv["verify-live"]) return localCanonicalStatus(asset);
  try {
    const resp = await fetch(absoluteUrl(asset.canonical), { method: "HEAD", redirect: "follow" });
    return resp.status;
  } catch (_) {
    return 0;
  }
}

function loadExisting() {
  const existing = readJson(STATUS_FILE, null);
  const campaigns = Array.isArray(existing?.campaigns) ? existing.campaigns : [];
  return new Map(campaigns.map(c => [c.id, c]));
}

function cacheStatus() {
  const cache = readJson(CACHE_FILE, {});
  return cache && typeof cache === "object" ? cache : {};
}

async function buildStatus() {
  const assetsPayload = readJson(ASSETS_FILE, { assets: [] });
  const hubsPayload = readJson(HUBS_FILE, { hubs: [] });
  const assets = Array.isArray(assetsPayload) ? assetsPayload : assetsPayload.assets || [];
  const hubs = Array.isArray(hubsPayload) ? hubsPayload : hubsPayload.hubs || [];
  const hubMap = new Map(hubs.map(h => [h.slug, h]));
  const sitemap = fs.existsSync(SITEMAP_FILE) ? fs.readFileSync(SITEMAP_FILE, "utf8") : "";
  const existing = loadExisting();
  const cache = cacheStatus();
  const liveExperiences = assets.filter(asset => asset.experience && asset.canonical && canonicalPath(asset).startsWith("/tools/"));

  const campaigns = [];
  for (const asset of liveExperiences) {
    const id = asset.id || asset.slug;
    const canonical = absoluteUrl(asset.canonical);
    const hash = sourceHash(asset);
    const old = existing.get(id) || {};
    const completedForHash = old.sourceHash === hash && old.status === "complete";
    const localStatus = localCanonicalStatus(asset);
    const status = await liveStatus(asset);
    const inSitemap = sitemap.includes(canonical);
    const hasSchema = schemaPresent(asset);
    const cacheRow = cache[id] || {};
    const cachedAssets = Object.values(cacheRow.platforms || {}).filter(Boolean).length;

    let campaignStatus = old.status || "queued";
    if (completedForHash) campaignStatus = "complete";
    else if (status !== 200 || !inSitemap || !hasSchema) campaignStatus = "blocked";
    else if (!old.status || old.sourceHash !== hash) campaignStatus = "queued";

    campaigns.push({
      id,
      title: asset.title,
      canonical,
      path: canonicalPath(asset),
      hub: asset.hub || null,
      hubTitle: hubMap.get(asset.hub)?.title || asset.hub || null,
      primaryPurpose: asset.experience?.primaryPurpose || asset.description || "",
      sourceHash: hash,
      status: campaignStatus,
      canonicalStatus: status,
      localCanonicalStatus: localStatus,
      inSitemap,
      schemaPresent: hasSchema,
      queuedAt: old.queuedAt || new Date().toISOString(),
      lastAttemptAt: old.lastAttemptAt || null,
      completedAt: completedForHash ? old.completedAt || null : null,
      nextScheduledAt: old.nextScheduledAt || null,
      platforms: old.platforms || {},
      cachedCompanionAssets: cachedAssets,
      estimatedClaudeSpendUsd: old.estimatedClaudeSpendUsd || cacheRow.estimatedClaudeSpendUsd || 0,
      inboundBlogRecommendations: 0,
      currentExternalBacklinkCoverage: Object.values(old.platforms || {}).filter(p => p.status === "success").length,
      dedicatedCompanionContent: cachedAssets > 0,
      orphanedFromBacklinkEngine: campaignStatus === "queued" && Object.keys(old.platforms || {}).length === 0,
    });
  }

  const queued = campaigns.filter(c => c.status === "queued");
  if (queued[0] && !queued[0].nextScheduledAt) queued[0].nextScheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  return {
    generatedAt: new Date().toISOString(),
    cadence: {
      maxCampaignsPerDay: 1,
      allocation: "Fresh blog posts first; historical blog catch-up second; one queued experience campaign per daily slot.",
      automaticEnqueueRules: [
        "authority metadata contains a published experience",
        "canonical route returns 200",
        "canonical appears in sitemap",
        "schema is present",
        "source hash has not already completed an equivalent campaign",
      ],
    },
    summary: {
      liveExperiences: campaigns.length,
      queued: campaigns.filter(c => c.status === "queued").length,
      inProgress: campaigns.filter(c => c.status === "in_progress").length,
      complete: campaigns.filter(c => c.status === "complete").length,
      blocked: campaigns.filter(c => c.status === "blocked").length,
      failedPlatformRetries: campaigns.reduce((sum, c) => sum + Object.values(c.platforms || {}).filter(p => p.status === "failed").length, 0),
      cachedCompanionAssets: campaigns.reduce((sum, c) => sum + c.cachedCompanionAssets, 0),
      estimatedClaudeSpendUsd: campaigns.reduce((sum, c) => sum + (Number(c.estimatedClaudeSpendUsd) || 0), 0),
      nextExperienceScheduled: queued[0]?.title || null,
      nextExperienceScheduledAt: queued[0]?.nextScheduledAt || null,
    },
    campaigns,
  };
}

const status = await buildStatus();
if (argv.write) {
  fs.writeFileSync(STATUS_FILE, `${JSON.stringify(status, null, 2)}\n`, "utf8");
  console.log(`Wrote ${path.relative(ROOT, STATUS_FILE)}`);
}
if (argv.json || !argv.write) console.log(JSON.stringify(status, null, 2));
