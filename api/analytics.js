// api/analytics.js ~ GA4 analytics proxy for VOA dashboard
// GET ?metric=overview|toppages|sources|sources_detail|realtime|geo|devices
// GET ?range=30d|90d|180d|365d|alltime  (default: 30d)
// Env: GA_CREDENTIALS_JSON, GA_PROPERTY_ID

import crypto from "crypto";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
}

function base64url(str) {
  return Buffer.from(str).toString("base64").replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
}

function makeJWT(credentials) {
  const now = Math.floor(Date.now() / 1000);
  const header  = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({ iss: credentials.client_email, scope: "https://www.googleapis.com/auth/analytics.readonly", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const sigInput = `${header}.${payload}`;
  const sign = crypto.createSign("SHA256");
  sign.update(sigInput);
  return `${sigInput}.${sign.sign(credentials.private_key, "base64").replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_")}`;
}

async function getAccessToken(credentials) {
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${makeJWT(credentials)}`,
  });
  const data = await resp.json();
  if (!data.access_token) throw new Error(`OAuth failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function gaReport(token, pid, body) {
  const resp = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${pid}:runReport`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (data.error) throw new Error(`GA4: ${data.error.message}`);
  return data;
}

async function gaRealtime(token, pid, body) {
  const resp = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${pid}:runRealtimeReport`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (data.error) throw new Error(`GA4 realtime: ${data.error.message}`);
  return data;
}

function parseRows(report) {
  if (!report?.rows) return [];
  const dims = (report.dimensionHeaders || []).map(h => h.name);
  const mets = (report.metricHeaders  || []).map(h => h.name);
  return report.rows.map(row => {
    const obj = {};
    (row.dimensionValues || []).forEach((v, i) => { obj[dims[i]] = v.value; });
    (row.metricValues   || []).forEach((v, i) => { obj[mets[i]] = v.value; });
    return obj;
  });
}

const fmt  = n => parseInt(n || 0, 10);
const fmtF = n => parseFloat(n || 0);

// Date range mapping
const RANGE_MAP = {
  "30d":    "30daysAgo",
  "90d":    "90daysAgo",
  "180d":   "180daysAgo",
  "365d":   "365daysAgo",
  "alltime":"2020-01-01",
};

async function getOverview(token, pid, startDate) {
  const dr = [{ startDate, endDate: "today" }];
  const [totals, daily] = await Promise.all([
    gaReport(token, pid, { dateRanges: dr, metrics: [{ name: "screenPageViews" }, { name: "sessions" }, { name: "averageSessionDuration" }, { name: "bounceRate" }, { name: "newUsers" }, { name: "totalUsers" }] }),
    gaReport(token, pid, { dateRanges: dr, dimensions: [{ name: "date" }], metrics: [{ name: "screenPageViews" }], orderBys: [{ dimension: { dimensionName: "date" } }] }),
  ]);
  const mv = totals.rows?.[0]?.metricValues || [];
  return { pageviews: fmt(mv[0]?.value), sessions: fmt(mv[1]?.value), avgSessionDur: fmtF(mv[2]?.value), bounceRate: fmtF(mv[3]?.value), newUsers: fmt(mv[4]?.value), totalUsers: fmt(mv[5]?.value), returningUsers: Math.max(0, fmt(mv[5]?.value) - fmt(mv[4]?.value)), daily: parseRows(daily).map(r => ({ date: r.date, pageviews: fmt(r.screenPageViews) })) };
}

async function getTopPages(token, pid, startDate) {
  const r = await gaReport(token, pid, { dateRanges: [{ startDate, endDate: "today" }], dimensions: [{ name: "pagePath" }], metrics: [{ name: "screenPageViews" }, { name: "averageSessionDuration" }, { name: "bounceRate" }], orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }], limit: 20 });
  return parseRows(r).map(row => ({ path: row.pagePath, pageviews: fmt(row.screenPageViews), avgTime: fmtF(row.averageSessionDuration), bounceRate: fmtF(row.bounceRate) }));
}

async function getSources(token, pid, startDate) {
  const r = await gaReport(token, pid, { dateRanges: [{ startDate, endDate: "today" }], dimensions: [{ name: "sessionDefaultChannelGroup" }], metrics: [{ name: "sessions" }], orderBys: [{ metric: { metricName: "sessions" }, desc: true }] });
  const rows = parseRows(r);
  const total = rows.reduce((s, row) => s + fmt(row.sessions), 0);
  return rows.map(row => ({ channel: row.sessionDefaultChannelGroup || "Unknown", sessions: fmt(row.sessions), pct: total > 0 ? Math.round((fmt(row.sessions) / total) * 100) : 0 }));
}

// Breaks "Direct" open into actual sources — tells you what's really in that bucket
async function getSourcesDetail(token, pid, startDate) {
  const r = await gaReport(token, pid, { dateRanges: [{ startDate, endDate: "today" }], dimensions: [{ name: "sessionSource" }, { name: "sessionMedium" }], metrics: [{ name: "sessions" }], orderBys: [{ metric: { metricName: "sessions" }, desc: true }], limit: 25 });
  const rows = parseRows(r);
  const total = rows.reduce((s, row) => s + fmt(row.sessions), 0);
  return rows.map(row => ({
    source: row.sessionSource || "(not set)",
    medium: row.sessionMedium || "(not set)",
    sessions: fmt(row.sessions),
    pct: total > 0 ? Math.round((fmt(row.sessions) / total) * 100) : 0,
  }));
}

async function getRealtime(token, pid) {
  const r = await gaRealtime(token, pid, { dimensions: [{ name: "unifiedScreenName" }, { name: "country" }, { name: "deviceCategory" }], metrics: [{ name: "activeUsers" }] });
  const rows = parseRows(r);
  const activeUsers = rows.reduce((s, row) => s + fmt(row.activeUsers), 0);
  const byPage = {}, byCountry = {};
  for (const row of rows) {
    byPage[row.unifiedScreenName || "/"] = (byPage[row.unifiedScreenName || "/"] || 0) + fmt(row.activeUsers);
    byCountry[row.country || "Unknown"] = (byCountry[row.country || "Unknown"] || 0) + fmt(row.activeUsers);
  }
  return { activeUsers, pages: Object.entries(byPage).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([page,users])=>({page,users})), countries: Object.entries(byCountry).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([country,users])=>({country,users})) };
}

async function getGeo(token, pid, startDate) {
  const dr = [{ startDate, endDate: "today" }];
  const [cr, cir] = await Promise.all([
    gaReport(token, pid, { dateRanges: dr, dimensions: [{ name: "country" }], metrics: [{ name: "sessions" }], orderBys: [{ metric: { metricName: "sessions" }, desc: true }], limit: 20 }),
    gaReport(token, pid, { dateRanges: dr, dimensions: [{ name: "city" }],    metrics: [{ name: "sessions" }], orderBys: [{ metric: { metricName: "sessions" }, desc: true }], limit: 10 }),
  ]);
  return { countries: parseRows(cr).map(r=>({country:r.country,sessions:fmt(r.sessions)})), cities: parseRows(cir).map(r=>({city:r.city,sessions:fmt(r.sessions)})) };
}

async function getDevices(token, pid, startDate) {
  const dr = [{ startDate, endDate: "today" }];
  const [dr_, br, or_] = await Promise.all([
    gaReport(token, pid, { dateRanges: dr, dimensions: [{ name: "deviceCategory" }], metrics: [{ name: "sessions" }], orderBys: [{ metric: { metricName: "sessions" }, desc: true }] }),
    gaReport(token, pid, { dateRanges: dr, dimensions: [{ name: "browser" }],         metrics: [{ name: "sessions" }], orderBys: [{ metric: { metricName: "sessions" }, desc: true }], limit: 5 }),
    gaReport(token, pid, { dateRanges: dr, dimensions: [{ name: "operatingSystem" }], metrics: [{ name: "sessions" }], orderBys: [{ metric: { metricName: "sessions" }, desc: true }], limit: 5 }),
  ]);
  return { devices: parseRows(dr_).map(r=>({device:r.deviceCategory,sessions:fmt(r.sessions)})), browsers: parseRows(br).map(r=>({browser:r.browser,sessions:fmt(r.sessions)})), os: parseRows(or_).map(r=>({os:r.operatingSystem,sessions:fmt(r.sessions)})) };
}

// ── MailerLite handler (consolidated here to stay within Vercel 12-function limit) ──
async function getMailerLite() {
  const key = process.env.MAILERLITE_API_KEY;
  if (!key) throw new Error("MAILERLITE_API_KEY not set");
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json" };
  const [subResp, campaignResp, groupsResp] = await Promise.all([
    fetch("https://connect.mailerlite.com/api/subscribers?filter[status]=active&limit=1", { headers }),
    fetch("https://connect.mailerlite.com/api/campaigns?filter[status]=sent&sort=sent_at&direction=desc&limit=3", { headers }),
    fetch("https://connect.mailerlite.com/api/groups?limit=25", { headers }),
  ]);
  const [subData, campaignData, groupsData] = await Promise.all([subResp.json(), campaignResp.json(), groupsResp.json()]);
  return {
    totalSubscribers: subData.meta?.total ?? 0,
    campaigns: (campaignData.data || []).map(c => ({
      name:      c.name || "(unnamed)",
      sentAt:    c.scheduled_at || c.sent_at || null,
      sentCount: c.emails_count || 0,
      openRate:  c.stats?.open_rate?.float  ?? null,
      clickRate: c.stats?.click_rate?.float ?? null,
    })),
    groups: (groupsData.data || []).map(g => ({
      name:   g.name,
      active: g.active_count  ?? g.total_subscribers ?? 0,
      total:  g.total         ?? g.active_count ?? 0,
    })),
  };
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const metric    = req.query?.metric || "overview";
  const rangeKey  = req.query?.range  || "30d";
  const startDate = RANGE_MAP[rangeKey] || "30daysAgo";

  // MailerLite doesn't need GA credentials
  if (metric === "mailerlite") {
    try { return res.status(200).json(await getMailerLite()); }
    catch (err) { console.error("[mailerlite]", err.message); return res.status(500).json({ error: err.message }); }
  }

  const credJson    = process.env.GA_CREDENTIALS_JSON;
  const propertyId  = process.env.GA_PROPERTY_ID;
  if (!credJson || !propertyId) {
    return res.status(503).json({ error: "GA_CREDENTIALS_JSON and GA_PROPERTY_ID must be set in Vercel environment variables." });
  }

  try {
    const credentials = JSON.parse(credJson);
    const token = await getAccessToken(credentials);
    const handlers = {
      overview:       (t, p) => getOverview(t, p, startDate),
      toppages:       (t, p) => getTopPages(t, p, startDate),
      sources:        (t, p) => getSources(t, p, startDate),
      sources_detail: (t, p) => getSourcesDetail(t, p, startDate),
      realtime:       (t, p) => getRealtime(t, p),
      geo:            (t, p) => getGeo(t, p, startDate),
      devices:        (t, p) => getDevices(t, p, startDate),
    };
    if (!handlers[metric]) return res.status(400).json({ error: `Unknown metric: ${metric}. Valid: overview|toppages|sources|sources_detail|realtime|geo|devices|mailerlite` });
    return res.status(200).json(await handlers[metric](token, propertyId));
  } catch (err) {
    console.error("[analytics]", err.message);
    return res.status(500).json({ error: err.message });
  }
}
