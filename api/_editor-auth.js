// api/_editor-auth.js ~ Shared utilities for the VOA Post Studio editor backend
// Underscore prefix means Vercel does NOT expose this as an API route.

import crypto from "crypto";

const DEFAULT_ALLOWED_ORIGINS = [
  "https://vibrationofawesome.com",
  "https://www.vibrationofawesome.com",
  "https://vibrationofawesome.vercel.app",
  "http://localhost:8888",
  "http://localhost:8000",
  "http://localhost:1313",
];

function base64url(input) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function decodeBase64url(input) {
  const normalized = String(input || "").replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, "base64").toString("utf8");
}

function getAllowedOrigins() {
  const configured = String(process.env.EDITOR_ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  return configured.length ? configured : DEFAULT_ALLOWED_ORIGINS;
}

export function getCorsHeaders(origin) {
  const allowed = getAllowedOrigins();
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0] || "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

export function sendJson(res, statusCode, body, origin) {
  const headers = getCorsHeaders(origin);
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.status(statusCode).json(body);
}

function timingSafeEquals(a, b) {
  const la = Buffer.from(String(a || ""));
  const lb = Buffer.from(String(b || ""));
  if (la.length !== lb.length) return false;
  return crypto.timingSafeEqual(la, lb);
}

export function verifyPassword(password) {
  const configured = process.env.DASHBOARD_PASSWORD;
  if (!configured) throw new Error("DASHBOARD_PASSWORD is not configured on the backend.");
  return timingSafeEquals(password, configured);
}

function getSessionSecret() {
  return process.env.EDITOR_SESSION_SECRET || process.env.DASHBOARD_PASSWORD || "";
}

export function signSession(payload = {}) {
  const secret = getSessionSecret();
  if (!secret) throw new Error("EDITOR_SESSION_SECRET or DASHBOARD_PASSWORD is required.");
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify({ sub: "voa-post-studio", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 43200, ...payload }));
  const sig = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${header}.${body}.${sig}`;
}

export function verifySessionToken(token) {
  const secret = getSessionSecret();
  if (!secret) throw new Error("EDITOR_SESSION_SECRET or DASHBOARD_PASSWORD is required.");
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("Invalid session token.");
  const [header, body, signature] = parts;
  const expected = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  if (!timingSafeEquals(signature, expected)) throw new Error("Session signature mismatch.");
  const payload = JSON.parse(decodeBase64url(body));
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) throw new Error("Session expired.");
  return payload;
}

export function getBearerToken(req) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function assertEditablePath(filePath) {
  const value = String(filePath || "").trim();
  if (!value) throw new Error("Missing file path.");
  if (value.includes("..")) throw new Error("Relative traversal is not allowed.");
  if (!value.startsWith("static/blog/matt/posts/")) throw new Error("Only Forest Temple post files can be edited through this endpoint.");
  if (!/\.html$/i.test(value)) throw new Error("Only HTML post files are supported.");
  return value;
}

async function githubRequest(path, options = {}) {
  const repo = process.env.GITHUB_EDITOR_REPO || "Lordshrrred/VibrationofAwesome";
  const token = process.env.GITHUB_EDITOR_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_EDITOR_TOKEN is not configured on the backend.");
  const response = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...options,
    headers: { "Accept": "application/vnd.github+json", "Authorization": `Bearer ${token}`, "User-Agent": "VOA-Post-Studio-Backend", ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `GitHub request failed (${response.status})`);
  return data;
}

export async function saveFileToGitHub(filePath, html, message) {
  const branch = process.env.GITHUB_EDITOR_BRANCH || "main";
  const safePath = assertEditablePath(filePath);
  const encodedPath = safePath.split("/").map(encodeURIComponent).join("/");
  const existing = await githubRequest(`/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`);
  const payload = await githubRequest(`/contents/${encodedPath}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, content: Buffer.from(String(html || ""), "utf8").toString("base64"), sha: existing.sha, branch }),
  });
  return { branch, path: safePath, sha: payload?.content?.sha || existing.sha, commitUrl: payload?.commit?.html_url || null, htmlUrl: payload?.content?.html_url || null, downloadUrl: payload?.content?.download_url || null };
}
