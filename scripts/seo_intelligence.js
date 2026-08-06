#!/usr/bin/env node
/**
 * seo_intelligence.js
 *
 * Low-cost SEO intelligence for VOA. Default run uses Google Search Console
 * and GA4 only. It does not call Anthropic, OpenAI, paid web-search, or rank-check
 * APIs. Raw API responses are cached under .cache/seo-intelligence/ and only a
 * small public-safe summary is written to static/_data/seo-intelligence.json.
 *
 * Required for live data:
 *   GA_CREDENTIALS_JSON or GOOGLE_SERVICE_ACCOUNT_JSON
 *   GA_PROPERTY_ID
 *   GSC_SITE_URL (optional; defaults to https://vibrationofawesome.com/)
 *
 * Usage:
 *   npm run seo:intelligence
 *   node scripts/seo_intelligence.js --days 28
 */

import crypto from "crypto";
import dotenv from "dotenv";
import fs from "fs";
import minimist from "minimist";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const BASE = "https://vibrationofawesome.com";
const CACHE_DIR = path.join(ROOT, ".cache", "seo-intelligence");
const REPORTS_DIR = path.join(ROOT, "reports");
const PUBLIC_SUMMARY = path.join(ROOT, "static", "_data", "seo-intelligence.json");
const LATEST_REPORT = path.join(REPORTS_DIR, "seo-intelligence-latest.md");

const argv = minimist(process.argv.slice(2), {
  string: ["days"],
  boolean: ["refresh"],
});

const WINDOW_DAYS = Math.max(7, parseInt(argv.days, 10) || 28);
const REFRESH_CACHE = Boolean(argv.refresh);
const GSC_SITE_URL = process.env.GSC_SITE_URL || process.env.SEARCH_CONSOLE_SITE_URL || `${BASE}/`;
const GA_PROPERTY_ID = process.env.GA_PROPERTY_ID || "";
const RUN_DATE = new Date().toISOString().slice(0, 10);

function isoDate(offsetDays) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

// Search Console usually trails by a couple of days; avoid asking for today.
const currentEnd = isoDate(-3);
const currentStart = isoDate(-WINDOW_DAYS - 2);
const previousEnd = isoDate(-WINDOW_DAYS - 3);
const previousStart = isoDate((WINDOW_DAYS * -2) - 2);

const PERIOD = {
  current: { startDate: currentStart, endDate: currentEnd },
  previous: { startDate: previousStart, endDate: previousEnd },
};

const fmt = (n) => Number.isFinite(Number(n)) ? Number(n) : 0;
const pct = (n) => `${(fmt(n) * 100).toFixed(1)}%`;

function ensureDirs() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(PUBLIC_SUMMARY), { recursive: true });
}

function readJson(rel, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
  } catch (_) {
    return fallback;
  }
}

function cleanUrl(value) {
  return String(value || "")
    .replace(/^https:\/\/www\.vibrationofawesome\.com/i, BASE)
    .replace(/^http:\/\/vibrationofawesome\.com/i, BASE)
    .replace(/\/index\.html(?=([?#]|$))/gi, "/")
    .replace(/\.html(?=([?#]|$))/gi, "");
}

function toPath(urlOrPath) {
  const cleaned = cleanUrl(urlOrPath);
  if (!cleaned) return "/";
  try {
    const u = new URL(cleaned, BASE);
    return u.pathname || "/";
  } catch (_) {
    return cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
  }
}

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function loadCredentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GA_CREDENTIALS_JSON;
  if (raw) return JSON.parse(raw);
  const file = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (file && fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  return null;
}

function makeJWT(credentials, scopes) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({
    iss: credentials.client_email,
    scope: scopes.join(" "),
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const input = `${header}.${payload}`;
  const signer = crypto.createSign("SHA256");
  signer.update(input);
  signer.end();
  const signature = signer.sign(credentials.private_key, "base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${input}.${signature}`;
}

async function getAccessToken(credentials, scopes) {
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: makeJWT(credentials, scopes),
    }),
  });
  const data = await resp.json();
  if (!data.access_token) throw new Error(`Google OAuth failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

function cacheKey(prefix, body) {
  const hash = crypto.createHash("sha256").update(JSON.stringify(body)).digest("hex").slice(0, 16);
  return path.join(CACHE_DIR, `${prefix}-${hash}.json`);
}

async function cachedJson(prefix, body, fetcher) {
  const file = cacheKey(prefix, body);
  if (!REFRESH_CACHE && fs.existsSync(file)) {
    return { data: JSON.parse(fs.readFileSync(file, "utf8")), cached: true };
  }
  const data = await fetcher();
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
  return { data, cached: false };
}

async function gscSearchAnalytics(token, body) {
  const { data, cached } = await cachedJson(`gsc-${body.startDate}-${body.endDate}`, body, async () => {
    const resp = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_SITE_URL)}/searchAnalytics/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await resp.json();
    if (json.error) throw new Error(`Search Console: ${json.error.message}`);
    return json;
  });
  return { rows: data.rows || [], cached };
}

async function gaRunReport(token, body) {
  const { data, cached } = await cachedJson(`ga4-${body.dateRanges?.[0]?.startDate || "range"}-${body.dateRanges?.[0]?.endDate || "end"}`, body, async () => {
    const resp = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${GA_PROPERTY_ID}:runReport`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await resp.json();
    if (json.error) throw new Error(`GA4: ${json.error.message}`);
    return json;
  });
  return { rows: parseGaRows(data), cached };
}

function parseGaRows(report) {
  const dims = (report.dimensionHeaders || []).map((h) => h.name);
  const mets = (report.metricHeaders || []).map((h) => h.name);
  return (report.rows || []).map((row) => {
    const obj = {};
    (row.dimensionValues || []).forEach((v, i) => { obj[dims[i]] = v.value; });
    (row.metricValues || []).forEach((v, i) => { obj[mets[i]] = v.value; });
    return obj;
  });
}

function gscRowsToObjects(rows) {
  return rows.map((row) => {
    const keys = row.keys || [];
    return {
      query: keys.length > 1 ? keys[0] : null,
      page: cleanUrl(keys.length > 1 ? keys[1] : keys[0]),
      clicks: fmt(row.clicks),
      impressions: fmt(row.impressions),
      ctr: fmt(row.ctr),
      position: fmt(row.position),
    };
  });
}

function byPath(rows, key = "page") {
  const map = new Map();
  for (const row of rows) {
    const p = toPath(row[key]);
    if (!map.has(p)) map.set(p, []);
    map.get(p).push(row);
  }
  return map;
}

function titleForPath(pathname, posts, assets) {
  const post = posts.find((p) => toPath(p.url) === pathname || toPath(`/blog/${p.lane}/posts/${p.slug}`) === pathname);
  if (post) return post.title;
  const asset = assets.find((a) => toPath(a.canonical) === pathname);
  if (asset) return asset.title;
  if (pathname === "/") return "Home";
  return pathname;
}

function loadLocalContext() {
  const boom = readJson("static/_data/boom-posts.json", []).map((p) => ({ ...p, lane: "boom" }));
  const matt = readJson("static/_data/matt-posts.json", []).map((p) => ({ ...p, lane: "matt" }));
  const authorityAssets = readJson("static/_data/authority-assets.json", []);
  const authorityHubs = readJson("static/_data/authority-hubs.json", []);
  return {
    posts: [...boom, ...matt],
    assets: Array.isArray(authorityAssets) ? authorityAssets : authorityAssets.assets || [],
    hubs: Array.isArray(authorityHubs) ? authorityHubs : authorityHubs.hubs || [],
    syndicationResults: readJson("static/_data/syndication-results.json", []),
    syndicationHealth: readJson("static/_data/syndication-health.json", null),
  };
}

function classify(data, context) {
  const byLanding = new Map();
  for (const row of data.gsc.current.queryPage) {
    const p = toPath(row.page);
    if (!byLanding.has(p)) byLanding.set(p, { path: p, clicks: 0, impressions: 0, weightedPos: 0, queries: [] });
    const item = byLanding.get(p);
    item.clicks += row.clicks;
    item.impressions += row.impressions;
    item.weightedPos += row.position * Math.max(1, row.impressions);
    item.queries.push(row);
  }
  for (const item of byLanding.values()) {
    item.position = item.impressions ? item.weightedPos / item.impressions : 0;
    item.ctr = item.impressions ? item.clicks / item.impressions : 0;
    item.title = titleForPath(item.path, context.posts, context.assets);
    item.topQueries = item.queries.sort((a, b) => b.impressions - a.impressions).slice(0, 5);
  }

  const gaByPath = new Map(data.ga.current.landingPages.map((row) => [toPath(row.landingPagePlusQueryString || row.pagePath || row.pageLocation), row]));
  const gscByPath = [...byLanding.values()];
  const titleText = new Set(context.posts.map((p) => `${p.title} ${p.slug}`.toLowerCase()));

  const nearPageOne = data.gsc.current.queryPage
    .filter((r) => r.impressions >= 20 && r.position >= 8 && r.position <= 20 && toPath(r.page))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 12)
    .map((r) => ({ ...r, path: toPath(r.page), action: "Improve content coverage, strengthen internal links, and review title/snippet alignment." }));

  const ctrOpportunities = data.gsc.current.queryPage
    .filter((r) => r.impressions >= 30 && r.position <= 8 && r.ctr < 0.03)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 12)
    .map((r) => ({ ...r, path: toPath(r.page), action: "Review title/meta promise and make the opening answer match search intent faster." }));

  const engagementRows = [...gaByPath.entries()].map(([path, row]) => ({
    path,
    title: titleForPath(path, context.posts, context.assets),
    sessions: fmt(row.sessions),
    activeUsers: fmt(row.activeUsers),
    engagedSessions: fmt(row.engagedSessions),
    engagementRate: fmt(row.engagementRate),
    avgEngagementTime: fmt(row.averageSessionDuration || row.averageEngagementTime),
    views: fmt(row.screenPageViews),
  }));

  const engagementWinners = engagementRows
    .filter((r) => r.sessions >= 3 && r.engagementRate >= 0.55)
    .sort((a, b) => (b.sessions * b.engagementRate) - (a.sessions * a.engagementRate))
    .slice(0, 10)
    .map((r) => ({ ...r, action: "Strengthen internal linking toward this page and expand the surrounding topic cluster." }));

  const weakEngagement = engagementRows
    .filter((r) => r.sessions >= 3 && r.engagementRate > 0 && r.engagementRate < 0.4)
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 10)
    .map((r) => ({ ...r, action: "Check intent mismatch, improve the opening answer, and reduce filler before the useful answer." }));

  const hiddenQueries = data.gsc.current.queryPage
    .filter((r) => r.impressions >= 10 && ![...titleText].some((t) => t.includes(String(r.query || "").toLowerCase())))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 12)
    .map((r) => ({ ...r, path: toPath(r.page), action: "Improve the existing page if intent matches; create supporting content only if the intent is distinct." }));

  const queryOwners = new Map();
  for (const row of data.gsc.current.queryPage) {
    if (!row.query || row.impressions < 5) continue;
    const key = row.query.toLowerCase();
    if (!queryOwners.has(key)) queryOwners.set(key, new Map());
    queryOwners.get(key).set(toPath(row.page), (queryOwners.get(key).get(toPath(row.page)) || 0) + row.impressions);
  }
  const cannibalization = [...queryOwners.entries()]
    .filter(([, pages]) => pages.size > 1)
    .map(([query, pages]) => ({
      query,
      pages: [...pages.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([path, impressions]) => ({ path, impressions })),
      action: "Investigate page ownership only; do not merge or redirect automatically.",
    }))
    .sort((a, b) => b.pages.reduce((s, p) => s + p.impressions, 0) - a.pages.reduce((s, p) => s + p.impressions, 0))
    .slice(0, 10);

  const authorityPaths = new Set([
    "/hubs/",
    "/tools/",
    "/tools/digital-attention-audit/",
    ...context.hubs.map((h) => `/hubs/${h.slug}/`),
    ...context.assets.map((a) => toPath(a.canonical)),
  ]);
  const authorityPerformance = engagementRows
    .filter((r) => authorityPaths.has(r.path))
    .sort((a, b) => b.sessions - a.sessions);

  const topLandingPages = gscByPath
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
    .slice(0, 15);

  const topQueries = data.gsc.current.queryPage
    .reduce((acc, row) => {
      const key = row.query || "(unknown)";
      if (!acc.has(key)) acc.set(key, { query: key, clicks: 0, impressions: 0, weightedPos: 0 });
      const item = acc.get(key);
      item.clicks += row.clicks;
      item.impressions += row.impressions;
      item.weightedPos += row.position * Math.max(1, row.impressions);
      return acc;
    }, new Map());
  const topRealQueries = [...topQueries.values()].map((q) => ({
    ...q,
    position: q.impressions ? q.weightedPos / q.impressions : 0,
    ctr: q.impressions ? q.clicks / q.impressions : 0,
  })).sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions).slice(0, 15);

  const topActions = [
    ...nearPageOne.slice(0, 2).map((o) => `Improve "${o.query}" on ${o.path}; it is close to page one at avg position ${o.position.toFixed(1)}.`),
    ...ctrOpportunities.slice(0, 1).map((o) => `Rewrite title/meta promise for ${o.path}; impressions are meaningful but CTR is ${pct(o.ctr)}.`),
    ...engagementWinners.slice(0, 1).map((o) => `Send more internal links to ${o.path}; organic engagement is strong.`),
    ...weakEngagement.slice(0, 1).map((o) => `Review ${o.path}; organic sessions exist but engagement is weak.`),
  ].slice(0, 5);

  return {
    topLandingPages,
    topRealQueries,
    nearPageOne,
    ctrOpportunities,
    engagementWinners,
    weakEngagement,
    hiddenQueries,
    cannibalization,
    authorityPerformance,
    topActions,
  };
}

function mdTable(rows, columns) {
  if (!rows.length) return "_None found in this run._\n";
  const header = `| ${columns.map((c) => c.label).join(" | ")} |`;
  const sep = `| ${columns.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${columns.map((c) => String(c.value(row)).replace(/\|/g, "\\|")).join(" | ")} |`);
  return [header, sep, ...body].join("\n") + "\n";
}

function buildReport(payload) {
  const { status, data, context, opportunities, apiRequests, limitations } = payload;
  const lines = [];
  lines.push(`# SEO Intelligence Report ~ ${RUN_DATE}`);
  lines.push("");
  lines.push("Default source: Google Search Console + GA4. No Anthropic, OpenAI, paid web-search, or rank-check API calls are made by this report.");
  lines.push("");
  lines.push("## Data Freshness and Connections");
  lines.push("");
  lines.push(`- Period: ${PERIOD.current.startDate} to ${PERIOD.current.endDate}`);
  lines.push(`- Comparison: ${PERIOD.previous.startDate} to ${PERIOD.previous.endDate}`);
  lines.push(`- Search Console: ${status.gsc.ok ? "connected" : `not available (${status.gsc.message})`}`);
  lines.push(`- GA4: ${status.ga.ok ? "connected" : `not available (${status.ga.message})`}`);
  lines.push(`- API requests attempted this run: ${apiRequests.attempted}`);
  lines.push(`- Cache hits: ${apiRequests.cached}`);
  lines.push("");

  lines.push("## Top Organic Landing Pages");
  lines.push("");
  lines.push(mdTable(opportunities.topLandingPages, [
    { label: "Page", value: (r) => r.path },
    { label: "Clicks", value: (r) => r.clicks },
    { label: "Impressions", value: (r) => r.impressions },
    { label: "CTR", value: (r) => pct(r.ctr) },
    { label: "Avg Pos", value: (r) => r.position.toFixed(1) },
  ]));

  lines.push("## Top Real Search Queries");
  lines.push("");
  lines.push(mdTable(opportunities.topRealQueries, [
    { label: "Query", value: (r) => r.query },
    { label: "Clicks", value: (r) => r.clicks },
    { label: "Impressions", value: (r) => r.impressions },
    { label: "CTR", value: (r) => pct(r.ctr) },
    { label: "Avg Pos", value: (r) => r.position.toFixed(1) },
  ]));

  lines.push("## Near-Page-One Opportunities");
  lines.push("");
  lines.push(mdTable(opportunities.nearPageOne, [
    { label: "Query", value: (r) => r.query },
    { label: "Page", value: (r) => r.path },
    { label: "Impr.", value: (r) => r.impressions },
    { label: "Avg Pos", value: (r) => r.position.toFixed(1) },
    { label: "Suggested action", value: (r) => r.action },
  ]));

  lines.push("## CTR Opportunities");
  lines.push("");
  lines.push(mdTable(opportunities.ctrOpportunities, [
    { label: "Query", value: (r) => r.query },
    { label: "Page", value: (r) => r.path },
    { label: "Impr.", value: (r) => r.impressions },
    { label: "CTR", value: (r) => pct(r.ctr) },
    { label: "Suggested action", value: (r) => r.action },
  ]));

  lines.push("## Engagement Winners");
  lines.push("");
  lines.push(mdTable(opportunities.engagementWinners, [
    { label: "Page", value: (r) => r.path },
    { label: "Sessions", value: (r) => r.sessions },
    { label: "Engagement", value: (r) => pct(r.engagementRate) },
    { label: "Suggested action", value: (r) => r.action },
  ]));

  lines.push("## Traffic but Weak Engagement");
  lines.push("");
  lines.push(mdTable(opportunities.weakEngagement, [
    { label: "Page", value: (r) => r.path },
    { label: "Sessions", value: (r) => r.sessions },
    { label: "Engagement", value: (r) => pct(r.engagementRate) },
    { label: "Suggested action", value: (r) => r.action },
  ]));

  lines.push("## Hidden-Query Discoveries");
  lines.push("");
  lines.push(mdTable(opportunities.hiddenQueries, [
    { label: "Query", value: (r) => r.query },
    { label: "Page", value: (r) => r.path },
    { label: "Impr.", value: (r) => r.impressions },
    { label: "Suggested action", value: (r) => r.action },
  ]));

  lines.push("## Possible Cannibalization");
  lines.push("");
  lines.push(mdTable(opportunities.cannibalization, [
    { label: "Query", value: (r) => r.query },
    { label: "Pages receiving impressions", value: (r) => r.pages.map((p) => `${p.path} (${p.impressions})`).join("; ") },
    { label: "Suggested action", value: (r) => r.action },
  ]));

  lines.push("## Authority Asset Performance");
  lines.push("");
  lines.push(mdTable(opportunities.authorityPerformance, [
    { label: "Asset", value: (r) => r.path },
    { label: "Sessions", value: (r) => r.sessions },
    { label: "Engagement", value: (r) => pct(r.engagementRate) },
  ]));

  lines.push("## Top Five Prioritized Actions");
  lines.push("");
  if (opportunities.topActions.length) {
    opportunities.topActions.forEach((a, i) => lines.push(`${i + 1}. ${a}`));
  } else if (status.gsc.ok && status.ga.ok) {
    lines.push("1. Search Console and GA4 are connected, but no rows yet cross the opportunity thresholds ~ traffic is still very early-stage. Rerun after more data accumulates.");
  } else {
    lines.push("1. Connect Search Console and GA4 credentials, then rerun the report.");
  }
  lines.push("");

  lines.push("## Existing Operational Context");
  lines.push("");
  lines.push(`- Published posts indexed locally: ${context.posts.length}`);
  lines.push(`- Authority assets indexed locally: ${context.assets.length}`);
  lines.push(`- Syndication result records available: ${Array.isArray(context.syndicationResults) ? context.syndicationResults.length : 0}`);
  if (context.syndicationHealth?.lastUpdated) lines.push(`- Syndication health last updated: ${context.syndicationHealth.lastUpdated}`);
  lines.push("");

  lines.push("## Data Limitations");
  lines.push("");
  lines.push("- Search Console and GA4 use different measurement systems; clicks and sessions will not match exactly.");
  lines.push("- Search Console may omit low-volume queries for privacy and internal thresholds.");
  lines.push("- Current implementation uses cached raw responses under `.cache/seo-intelligence/`; use `--refresh` to force a new pull.");
  for (const item of limitations) lines.push(`- ${item}`);
  lines.push("");
  return lines.join("\n");
}

function emptyData() {
  return {
    gsc: { current: { queryPage: [] }, previous: { queryPage: [] } },
    ga: { current: { landingPages: [], events: [] }, previous: { landingPages: [] } },
  };
}

function writeOutputs(report, opportunities, status, apiRequests) {
  fs.writeFileSync(LATEST_REPORT, report, "utf8");
  fs.writeFileSync(path.join(REPORTS_DIR, `seo-intelligence-${RUN_DATE}.md`), report, "utf8");

  const gscTotals = opportunities.topLandingPages.reduce((sum, row) => ({
    clicks: sum.clicks + fmt(row.clicks),
    impressions: sum.impressions + fmt(row.impressions),
    weightedPos: sum.weightedPos + (fmt(row.position) * Math.max(1, fmt(row.impressions))),
  }), { clicks: 0, impressions: 0, weightedPos: 0 });
  const gaTotals = opportunities.engagementWinners
    .concat(opportunities.weakEngagement)
    .reduce((sum, row) => ({
      sessions: sum.sessions + fmt(row.sessions),
      activeUsers: sum.activeUsers + fmt(row.activeUsers),
      engagedSessions: sum.engagedSessions + fmt(row.engagedSessions),
    }), { sessions: 0, activeUsers: 0, engagedSessions: 0 });

  const summary = {
    generatedAt: new Date().toISOString(),
    period: PERIOD,
    status,
    apiRequests,
    report: "/reports/seo-intelligence-latest.md",
    summary: {
      searchConsole: {
        clicks: gscTotals.clicks,
        impressions: gscTotals.impressions,
        ctr: gscTotals.impressions ? gscTotals.clicks / gscTotals.impressions : null,
        averagePosition: gscTotals.impressions ? gscTotals.weightedPos / gscTotals.impressions : null,
        rowCount: opportunities.topLandingPages.length,
      },
      ga4: {
        organicSessions: gaTotals.sessions,
        activeUsers: gaTotals.activeUsers,
        engagedSessions: gaTotals.engagedSessions,
        engagementRate: gaTotals.sessions ? gaTotals.engagedSessions / gaTotals.sessions : null,
        rowCount: opportunities.engagementWinners.length + opportunities.weakEngagement.length,
      },
    },
    topQueries: opportunities.topRealQueries.slice(0, 8).map((row) => ({
      query: row.query,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    })),
    topLandingPages: opportunities.topLandingPages.slice(0, 8).map((row) => ({
      title: row.title,
      path: row.path,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
      topQueries: (row.topQueries || []).slice(0, 3).map((q) => ({
        query: q.query,
        clicks: q.clicks,
        impressions: q.impressions,
        ctr: q.ctr,
        position: q.position,
      })),
    })),
    ctrOpportunities: opportunities.ctrOpportunities.slice(0, 8),
    engagementWinners: opportunities.engagementWinners.slice(0, 8),
    weakEngagement: opportunities.weakEngagement.slice(0, 8),
    topOpportunities: [
      ...opportunities.nearPageOne.slice(0, 2).map((o) => ({ type: "near_page_one", label: o.query, page: o.path, metric: `avg position ${o.position.toFixed(1)}` })),
      ...opportunities.ctrOpportunities.slice(0, 1).map((o) => ({ type: "ctr", label: o.query, page: o.path, metric: `CTR ${pct(o.ctr)}` })),
      ...opportunities.engagementWinners.slice(0, 1).map((o) => ({ type: "engagement_winner", label: o.title, page: o.path, metric: `${o.sessions} organic sessions` })),
    ].slice(0, 3),
    counts: {
      nearPageOne: opportunities.nearPageOne.length,
      ctr: opportunities.ctrOpportunities.length,
      engagementWinners: opportunities.engagementWinners.length,
      weakEngagement: opportunities.weakEngagement.length,
      hiddenQueries: opportunities.hiddenQueries.length,
      cannibalization: opportunities.cannibalization.length,
    },
  };
  fs.writeFileSync(PUBLIC_SUMMARY, JSON.stringify(summary, null, 2), "utf8");
}

async function main() {
  ensureDirs();
  const context = loadLocalContext();
  const credentials = loadCredentials();
  const data = emptyData();
  const status = {
    gsc: { ok: false, message: "not attempted" },
    ga: { ok: false, message: "not attempted" },
  };
  const limitations = [];
  const apiRequests = { attempted: 0, cached: 0 };

  if (!credentials) {
    status.gsc.message = "missing GA_CREDENTIALS_JSON or GOOGLE_SERVICE_ACCOUNT_JSON";
    status.ga.message = "missing GA_CREDENTIALS_JSON or GOOGLE_SERVICE_ACCOUNT_JSON";
    limitations.push("No Google service-account credentials were available, so this run produced structure and local context only.");
  } else {
    try {
      const gscToken = await getAccessToken(credentials, ["https://www.googleapis.com/auth/webmasters.readonly"]);
      const baseBody = { rowLimit: 25000, searchType: "web", dataState: "final" };
      const bodies = [
        { ...baseBody, ...PERIOD.current, dimensions: ["query", "page"] },
        { ...baseBody, ...PERIOD.previous, dimensions: ["query", "page"] },
      ];
      for (const [idx, body] of bodies.entries()) {
        apiRequests.attempted++;
        const res = await gscSearchAnalytics(gscToken, body);
        if (res.cached) apiRequests.cached++;
        const rows = gscRowsToObjects(res.rows);
        if (idx === 0) data.gsc.current.queryPage = rows;
        else data.gsc.previous.queryPage = rows;
      }
      status.gsc = { ok: true, message: `${data.gsc.current.queryPage.length} current query-page rows` };
    } catch (err) {
      status.gsc = { ok: false, message: err.message };
      limitations.push(`Search Console unavailable: ${err.message}`);
    }

    if (!GA_PROPERTY_ID) {
      status.ga = { ok: false, message: "missing GA_PROPERTY_ID" };
      limitations.push("GA_PROPERTY_ID is missing, so organic landing-page behavior was not pulled.");
    } else {
      try {
        const gaToken = await getAccessToken(credentials, ["https://www.googleapis.com/auth/analytics.readonly"]);
        const organicFilter = {
          filter: {
            fieldName: "sessionDefaultChannelGroup",
            stringFilter: { matchType: "EXACT", value: "Organic Search" },
          },
        };
        const metricNames = ["sessions", "activeUsers", "newUsers", "engagedSessions", "engagementRate", "averageSessionDuration", "screenPageViews"];
        const bodies = [
          {
            dateRanges: [PERIOD.current],
            dimensions: [{ name: "landingPagePlusQueryString" }, { name: "sessionDefaultChannelGroup" }],
            metrics: metricNames.map((name) => ({ name })),
            dimensionFilter: organicFilter,
            orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
            limit: 250,
          },
          {
            dateRanges: [PERIOD.previous],
            dimensions: [{ name: "landingPagePlusQueryString" }, { name: "sessionDefaultChannelGroup" }],
            metrics: metricNames.map((name) => ({ name })),
            dimensionFilter: organicFilter,
            orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
            limit: 250,
          },
          {
            dateRanges: [PERIOD.current],
            dimensions: [{ name: "eventName" }, { name: "pagePath" }],
            metrics: [{ name: "eventCount" }],
            dimensionFilter: {
              filter: {
                fieldName: "eventName",
                inListFilter: { values: ["digital_attention_audit_start", "digital_attention_audit_complete", "authority_resource_click", "related_article_click"] },
              },
            },
            limit: 250,
          },
        ];
        for (const [idx, body] of bodies.entries()) {
          apiRequests.attempted++;
          const res = await gaRunReport(gaToken, body);
          if (res.cached) apiRequests.cached++;
          if (idx === 0) data.ga.current.landingPages = res.rows;
          else if (idx === 1) data.ga.previous.landingPages = res.rows;
          else data.ga.current.events = res.rows;
        }
        status.ga = { ok: true, message: `${data.ga.current.landingPages.length} current organic landing-page rows` };
      } catch (err) {
        status.ga = { ok: false, message: err.message };
        limitations.push(`GA4 unavailable: ${err.message}`);
      }
    }
  }

  const opportunities = classify(data, context);
  const report = buildReport({ status, data, context, opportunities, apiRequests, limitations });
  writeOutputs(report, opportunities, status, apiRequests);

  console.log(`[seo-intelligence] Report written to ${path.relative(ROOT, LATEST_REPORT)}`);
  console.log(`[seo-intelligence] Public summary written to ${path.relative(ROOT, PUBLIC_SUMMARY)}`);
  console.log(`SEO_SUMMARY gsc=${status.gsc.ok ? "ok" : "missing"} ga=${status.ga.ok ? "ok" : "missing"} opportunities=${opportunities.topActions.length} requests=${apiRequests.attempted} cached=${apiRequests.cached}`);
}

// CLI-only guard: without this, simply `import`-ing this module (e.g. from a
// test, another script, or a syntax/load check) unconditionally executes a real
// report run ~ 5 live Search Console/GA4 API calls that also overwrite
// reports/seo-intelligence-latest.md. Mirrors the isCli guard already used in
// syndicate.js and retry-failed-syndication.js.
const isCli = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isCli) {
  main().catch((err) => {
    console.error("[seo-intelligence] Fatal:", err.message);
    process.exit(1);
  });
}
