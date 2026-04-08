#!/usr/bin/env node

import dotenv from "dotenv";
import express from "express";
import open from "open";

dotenv.config({ override: true });

const APP_ID = process.env.PINTEREST_APP_ID;
const APP_SECRET = process.env.PINTEREST_APP_SECRET;
const PORT = 9877;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const SCOPES = [
  "boards:read",
  "boards:write",
  "pins:read",
  "pins:write",
  "user_accounts:read",
].join(",");

if (!APP_ID || !APP_SECRET) {
  console.error("Error: PINTEREST_APP_ID and PINTEREST_APP_SECRET must be set in .env");
  process.exit(1);
}

const state = Math.random().toString(36).slice(2);
const app = express();

let latest = {
  code: "",
  scopes: "",
  accessTokenPreview: "",
  refreshTokenPreview: "",
  accountType: "",
  accountName: "",
  boards: [],
  error: "",
};

function esc(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tokenPreview(value = "") {
  if (!value) return "";
  if (value.length < 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function authUrl() {
  return (
    "https://www.pinterest.com/oauth/" +
    `?client_id=${APP_ID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    "&response_type=code" +
    `&scope=${encodeURIComponent(SCOPES)}` +
    `&state=${state}`
  );
}

function layout(body, title = "Pinterest Standard Access Demo") {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <style>
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #07110e;
      color: #e8f4f0;
    }
    .wrap {
      max-width: 1040px;
      margin: 0 auto;
      padding: 2rem 1.25rem 4rem;
    }
    h1, h2, h3 { margin: 0 0 0.8rem; }
    p, li { line-height: 1.65; color: rgba(232,244,240,0.84); }
    a { color: #54f1ae; }
    .hero {
      padding: 1.5rem;
      border: 1px solid rgba(84,241,174,0.18);
      border-radius: 20px;
      background: linear-gradient(135deg, rgba(8,22,18,0.96), rgba(7,14,24,0.96));
      box-shadow: 0 20px 48px rgba(0,0,0,0.28);
      margin-bottom: 1.5rem;
    }
    .eyebrow {
      font-size: 0.78rem;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: #54f1ae;
      margin-bottom: 0.9rem;
      font-weight: 700;
    }
    .actions {
      display: flex;
      gap: 0.8rem;
      flex-wrap: wrap;
      margin-top: 1rem;
    }
    .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.9rem 1.15rem;
      border-radius: 12px;
      border: 1px solid rgba(84,241,174,0.28);
      text-decoration: none;
      color: #041110;
      background: linear-gradient(90deg, #54f1ae, #63c8ff);
      font-weight: 700;
      letter-spacing: 0.04em;
    }
    .button.secondary {
      color: #e8f4f0;
      background: rgba(84,241,174,0.08);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1rem;
      margin-top: 1rem;
    }
    .card {
      padding: 1rem 1.1rem;
      border-radius: 16px;
      border: 1px solid rgba(84,241,174,0.14);
      background: rgba(8,18,18,0.86);
    }
    code, pre {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      background: rgba(255,255,255,0.05);
      border-radius: 10px;
    }
    code { padding: 0.15rem 0.35rem; }
    pre {
      padding: 0.9rem 1rem;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .status-good { color: #54f1ae; }
    .status-bad { color: #ff7f9f; }
    ol { padding-left: 1.3rem; }
  </style>
</head>
<body>
  <div class="wrap">${body}</div>
</body>
</html>`;
}

function homepage() {
  const resultBlock = latest.code
    ? `
      <div class="card">
        <h3>Latest Result</h3>
        ${latest.error
          ? `<p class="status-bad"><strong>Error:</strong> ${esc(latest.error)}</p>`
          : `
            <p class="status-good"><strong>OAuth complete.</strong> Your callback, token exchange, and API data fetch all ran.</p>
            <p><strong>Code:</strong> <code>${esc(latest.code)}</code></p>
            <p><strong>Access token:</strong> <code>${esc(latest.accessTokenPreview)}</code></p>
            <p><strong>Refresh token:</strong> <code>${esc(latest.refreshTokenPreview)}</code></p>
            <p><strong>Granted scopes:</strong> ${esc(latest.scopes)}</p>
            <p><strong>Account:</strong> ${esc(latest.accountName)} (${esc(latest.accountType)})</p>
            <p><strong>Boards returned:</strong> ${latest.boards.length}</p>
          `}
      </div>
    `
    : "";

  return layout(`
    <div class="hero">
      <div class="eyebrow">Pinterest Approval Demo</div>
      <h1>Record this flow to satisfy Pinterest Standard Access review.</h1>
      <p>This local demo is built to show exactly what support asked for: OAuth login and consent, redirect back to your site, code capture, token exchange, and live API usage/results.</p>
      <div class="actions">
        <a class="button" href="/start">Start OAuth Demo</a>
        <a class="button secondary" href="${esc(authUrl())}">Copy Direct OAuth URL</a>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <h3>What Pinterest asked to see</h3>
        <ol>
          <li>Pinterest login page.</li>
          <li>Grant access to your app.</li>
          <li>Redirect back to your site with the code in the URL.</li>
          <li>Code exchanged for an access token.</li>
          <li>Live API usage and visible results.</li>
        </ol>
      </div>
      <div class="card">
        <h3>Redirect URI</h3>
        <p><code>${esc(REDIRECT_URI)}</code></p>
        <p>This must be registered in the Pinterest app settings before you record.</p>
      </div>
      <div class="card">
        <h3>Scopes</h3>
        <p><code>${esc(SCOPES)}</code></p>
      </div>
      <div class="card">
        <h3>Integration shown in this demo</h3>
        <p>After OAuth, the demo calls <code>/v5/user_account</code> and <code>/v5/boards</code> and renders the results like a simple Pinterest data dashboard.</p>
      </div>
      ${resultBlock}
    </div>
  `);
}

function resultPage() {
  return layout(`
    <div class="hero">
      <div class="eyebrow">Demo Complete</div>
      <h1>OAuth and API integration both completed.</h1>
      ${latest.error
        ? `<p class="status-bad"><strong>Error:</strong> ${esc(latest.error)}</p>`
        : `<p class="status-good"><strong>Success.</strong> This page proves the redirect happened, the code was captured, the token was exchanged, and the Pinterest API returned live data.</p>`}
      <div class="actions">
        <a class="button secondary" href="/">Back to Demo Home</a>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <h3>OAuth Callback</h3>
        <p><strong>Code from URL:</strong></p>
        <pre>${esc(latest.code || "(none)")}</pre>
      </div>
      <div class="card">
        <h3>Token Exchange</h3>
        <p><strong>Access token:</strong> <code>${esc(latest.accessTokenPreview || "(none)")}</code></p>
        <p><strong>Refresh token:</strong> <code>${esc(latest.refreshTokenPreview || "(none)")}</code></p>
        <p><strong>Scopes:</strong> ${esc(latest.scopes || "(none)")}</p>
      </div>
      <div class="card">
        <h3>User Account API</h3>
        <p><strong>Endpoint:</strong> <code>GET /v5/user_account</code></p>
        <p><strong>Name:</strong> ${esc(latest.accountName || "(none)")}</p>
        <p><strong>Type:</strong> ${esc(latest.accountType || "(none)")}</p>
      </div>
      <div class="card">
        <h3>Boards API</h3>
        <p><strong>Endpoint:</strong> <code>GET /v5/boards?page_size=10</code></p>
        <p><strong>Board count:</strong> ${latest.boards.length}</p>
        <pre>${esc(latest.boards.map((board) => `${board.id} ~ ${board.name}`).join("\n") || "(none)")}</pre>
      </div>
    </div>
  `, "Pinterest Demo Result");
}

async function pinterestJson(url, accessToken) {
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.message || data.error || JSON.stringify(data));
  }
  return data;
}

app.get("/", (_req, res) => {
  res.type("html").send(homepage());
});

app.get("/start", (_req, res) => {
  res.redirect(authUrl());
});

app.get("/callback", async (req, res) => {
  latest = {
    code: String(req.query.code || ""),
    scopes: "",
    accessTokenPreview: "",
    refreshTokenPreview: "",
    accountType: "",
    accountName: "",
    boards: [],
    error: "",
  };

  const error = String(req.query.error || "");
  const errorDescription = String(req.query.error_description || "");
  const returnedState = String(req.query.state || "");

  if (error) {
    latest.error = errorDescription || error;
    return res.type("html").send(resultPage());
  }

  if (!latest.code) {
    latest.error = "No code returned in the callback URL.";
    return res.type("html").send(resultPage());
  }

  if (returnedState !== state) {
    latest.error = "State mismatch. Restart the demo.";
    return res.type("html").send(resultPage());
  }

  try {
    const credentials = Buffer.from(`${APP_ID}:${APP_SECRET}`).toString("base64");
    const tokenResp = await fetch("https://api.pinterest.com/v5/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: latest.code,
        redirect_uri: REDIRECT_URI,
      }),
    });
    const tokenData = await tokenResp.json();
    if (!tokenResp.ok) {
      throw new Error(tokenData.message || tokenData.error || JSON.stringify(tokenData));
    }

    const accessToken = tokenData.access_token || "";
    const refreshToken = tokenData.refresh_token || "";
    latest.accessTokenPreview = tokenPreview(accessToken);
    latest.refreshTokenPreview = tokenPreview(refreshToken);
    latest.scopes = tokenData.scope || "";

    const userData = await pinterestJson("https://api.pinterest.com/v5/user_account", accessToken);
    latest.accountName = userData.username || userData.account_type || "Pinterest account";
    latest.accountType = userData.account_type || "";

    const boardsData = await pinterestJson("https://api.pinterest.com/v5/boards?page_size=10", accessToken);
    latest.boards = boardsData.items || [];
  } catch (err) {
    latest.error = err.message;
  }

  res.type("html").send(resultPage());
});

app.listen(PORT, async () => {
  console.log("\nPinterest Standard Access demo is ready.\n");
  console.log(`Open this in your browser: http://localhost:${PORT}`);
  console.log(`Registered redirect URI needed: ${REDIRECT_URI}`);
  console.log(`Scopes used: ${SCOPES}\n`);
  await open(`http://localhost:${PORT}`);
});
