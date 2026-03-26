/*
  REQUIRED ENVIRONMENT VARIABLES — add to Netlify:

  GA_CREDENTIALS_JSON — paste the entire contents
  of your Google service account JSON file as a
  single line string (minify it or paste as-is)

  GA_PROPERTY_ID — your GA4 property ID
  (found in GA4 → Admin → Property Settings)
  looks like: 123456789

  To set up:
  1. console.cloud.google.com → new project
  2. Enable Google Analytics Data API
  3. IAM & Admin → Service Accounts → create
  4. Download JSON key file (type: service_account)
  5. GA4 → Admin → Property Access Management
  6. Add the service account email as Viewer
  7. Add both vars to Netlify → Site settings → Environment variables
  8. Redeploy from Netlify dashboard
*/

const crypto = require('crypto');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

// ── JWT / OAuth helpers ───────────────────────────────────────────────────────

function base64url(str) {
  return Buffer.from(str).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function makeJWT(credentials) {
  const now = Math.floor(Date.now() / 1000);
  const header  = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    iss:   credentials.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  }));
  const sigInput = `${header}.${payload}`;
  const sign = crypto.createSign('SHA256');
  sign.update(sigInput);
  const sig = sign.sign(credentials.private_key, 'base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${sigInput}.${sig}`;
}

async function getAccessToken(credentials) {
  const jwt = makeJWT(credentials);
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const data = await resp.json();
  if (!data.access_token) {
    throw new Error(`OAuth token exchange failed: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

// ── GA4 API wrappers ──────────────────────────────────────────────────────────

async function gaRunReport(token, propertyId, body) {
  const resp = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    }
  );
  const data = await resp.json();
  if (data.error) throw new Error(`GA4 runReport error: ${data.error.message}`);
  return data;
}

async function gaRunRealtime(token, propertyId, body) {
  const resp = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runRealtimeReport`,
    {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    }
  );
  const data = await resp.json();
  if (data.error) throw new Error(`GA4 runRealtimeReport error: ${data.error.message}`);
  return data;
}

/** Flatten a GA4 report into an array of plain objects */
function parseRows(report) {
  if (!report || !report.rows) return [];
  const dims = (report.dimensionHeaders || []).map(h => h.name);
  const mets  = (report.metricHeaders  || []).map(h => h.name);
  return report.rows.map(row => {
    const obj = {};
    (row.dimensionValues || []).forEach((v, i) => { obj[dims[i]] = v.value; });
    (row.metricValues    || []).forEach((v, i) => { obj[mets[i]]  = v.value; });
    return obj;
  });
}

function fmt(n) { return parseInt(n || 0, 10); }
function fmtF(n) { return parseFloat(n || 0); }

// ── Metric handlers ───────────────────────────────────────────────────────────

async function getOverview(token, pid) {
  const [totalsReport, dailyReport] = await Promise.all([
    gaRunReport(token, pid, {
      dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
      metrics: [
        { name: 'screenPageViews' },
        { name: 'sessions' },
        { name: 'averageSessionDuration' },
        { name: 'bounceRate' },
        { name: 'newUsers' },
        { name: 'totalUsers' },
      ],
    }),
    gaRunReport(token, pid, {
      dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'date' }],
      metrics:    [{ name: 'screenPageViews' }],
      orderBys:   [{ dimension: { dimensionName: 'date' } }],
    }),
  ]);

  const mv = totalsReport.rows?.[0]?.metricValues || [];
  const pageviews        = fmt(mv[0]?.value);
  const sessions         = fmt(mv[1]?.value);
  const avgSessionDur    = fmtF(mv[2]?.value);
  const bounceRate       = fmtF(mv[3]?.value);
  const newUsers         = fmt(mv[4]?.value);
  const totalUsers       = fmt(mv[5]?.value);
  const returningUsers   = Math.max(0, totalUsers - newUsers);

  const daily = parseRows(dailyReport).map(r => ({
    date:      r.date,                           // "YYYYMMDD"
    pageviews: fmt(r.screenPageViews),
  }));

  return { pageviews, sessions, avgSessionDur, bounceRate, newUsers, totalUsers, returningUsers, daily };
}

async function getTopPages(token, pid) {
  const report = await gaRunReport(token, pid, {
    dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'pagePath' }],
    metrics:    [
      { name: 'screenPageViews' },
      { name: 'averageSessionDuration' },
      { name: 'bounceRate' },
    ],
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit: 20,
  });
  return parseRows(report).map(r => ({
    path:       r.pagePath,
    pageviews:  fmt(r.screenPageViews),
    avgTime:    fmtF(r.averageSessionDuration),
    bounceRate: fmtF(r.bounceRate),
  }));
}

async function getSources(token, pid) {
  const report = await gaRunReport(token, pid, {
    dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'sessionDefaultChannelGroup' }],
    metrics:    [{ name: 'sessions' }],
    orderBys:   [{ metric: { metricName: 'sessions' }, desc: true }],
  });
  const rows  = parseRows(report);
  const total = rows.reduce((s, r) => s + fmt(r.sessions), 0);
  return rows.map(r => ({
    channel:  r.sessionDefaultChannelGroup || 'Unknown',
    sessions: fmt(r.sessions),
    pct:      total > 0 ? Math.round((fmt(r.sessions) / total) * 100) : 0,
  }));
}

async function getRealtime(token, pid) {
  const report = await gaRunRealtime(token, pid, {
    dimensions: [
      { name: 'unifiedScreenName' },
      { name: 'country' },
      { name: 'deviceCategory' },
    ],
    metrics: [{ name: 'activeUsers' }],
  });

  const rows = parseRows(report);
  const activeUsers = rows.reduce((s, r) => s + fmt(r.activeUsers), 0);

  const byPage    = {};
  const byCountry = {};
  for (const r of rows) {
    const p = r.unifiedScreenName || '/';
    const c = r.country           || 'Unknown';
    byPage[p]    = (byPage[p]    || 0) + fmt(r.activeUsers);
    byCountry[c] = (byCountry[c] || 0) + fmt(r.activeUsers);
  }

  return {
    activeUsers,
    pages: Object.entries(byPage)
      .sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([page, users]) => ({ page, users })),
    countries: Object.entries(byCountry)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([country, users]) => ({ country, users })),
  };
}

async function getGeo(token, pid) {
  const [countryReport, cityReport] = await Promise.all([
    gaRunReport(token, pid, {
      dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'country' }],
      metrics:    [{ name: 'sessions' }],
      orderBys:   [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 20,
    }),
    gaRunReport(token, pid, {
      dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'city' }],
      metrics:    [{ name: 'sessions' }],
      orderBys:   [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 10,
    }),
  ]);
  return {
    countries: parseRows(countryReport).map(r => ({ country: r.country, sessions: fmt(r.sessions) })),
    cities:    parseRows(cityReport).map(r => ({ city: r.city, sessions: fmt(r.sessions) })),
  };
}

async function getDevices(token, pid) {
  const [deviceReport, browserReport, osReport] = await Promise.all([
    gaRunReport(token, pid, {
      dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'deviceCategory' }],
      metrics:    [{ name: 'sessions' }],
      orderBys:   [{ metric: { metricName: 'sessions' }, desc: true }],
    }),
    gaRunReport(token, pid, {
      dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'browser' }],
      metrics:    [{ name: 'sessions' }],
      orderBys:   [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 5,
    }),
    gaRunReport(token, pid, {
      dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'operatingSystem' }],
      metrics:    [{ name: 'sessions' }],
      orderBys:   [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 5,
    }),
  ]);
  return {
    devices:  parseRows(deviceReport).map(r => ({ device: r.deviceCategory, sessions: fmt(r.sessions) })),
    browsers: parseRows(browserReport).map(r => ({ browser: r.browser, sessions: fmt(r.sessions) })),
    os:       parseRows(osReport).map(r => ({ os: r.operatingSystem, sessions: fmt(r.sessions) })),
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const metric = (event.queryStringParameters || {}).metric || 'overview';

  try {
    const credJson    = process.env.GA_CREDENTIALS_JSON;
    const propertyId  = process.env.GA_PROPERTY_ID;

    if (!credJson || !propertyId) {
      return {
        statusCode: 503,
        headers:    CORS_HEADERS,
        body:       JSON.stringify({
          error: 'GA_CREDENTIALS_JSON and GA_PROPERTY_ID must be set in Netlify environment variables. See setup instructions in netlify/functions/analytics.js.',
        }),
      };
    }

    const credentials = JSON.parse(credJson);
    const token       = await getAccessToken(credentials);

    let data;
    switch (metric) {
      case 'overview':  data = await getOverview(token, propertyId);  break;
      case 'toppages':  data = await getTopPages(token, propertyId);  break;
      case 'sources':   data = await getSources(token, propertyId);   break;
      case 'realtime':  data = await getRealtime(token, propertyId);  break;
      case 'geo':       data = await getGeo(token, propertyId);       break;
      case 'devices':   data = await getDevices(token, propertyId);   break;
      default:
        return {
          statusCode: 400,
          headers:    CORS_HEADERS,
          body:       JSON.stringify({ error: `Unknown metric: ${metric}. Valid: overview|toppages|sources|realtime|geo|devices` }),
        };
    }

    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(data) };

  } catch (err) {
    console.error('[analytics fn]', err);
    return {
      statusCode: 500,
      headers:    CORS_HEADERS,
      body:       JSON.stringify({ error: err.message || 'Internal server error' }),
    };
  }
};
