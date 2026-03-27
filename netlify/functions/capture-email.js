// capture-email.js ~ Email capture + ebook token generation
// vibrationofawesome.com
//
// POST { email, source_page, cta_placement, blog_slug }
// Returns { success: true, token: "XXXXX", download_url: "/.netlify/functions/deliver-ebook?token=XXXXX" }
//
// ─────────────────────────────────────────────────────────────────────────────
// EMAIL PROVIDER — swap by changing PROVIDER env var:
//   PROVIDER=internal   (default — stores to Netlify function log, no external calls)
//   PROVIDER=convertkit (add CK_API_KEY + CK_FORM_ID)
//   PROVIDER=mailerlite (add ML_API_KEY + ML_GROUP_ID)
//   PROVIDER=beehiiv    (add BH_API_KEY + BH_PUB_ID)
// ─────────────────────────────────────────────────────────────────────────────
//
// Analytics events (returned for client-side dataLayer push):
//   ebook_optin_submit, ebook_optin_success

"use strict";

const crypto = require("crypto");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

// ── Token generation ──────────────────────────────────────────────────────────
function generateToken() {
  return crypto.randomBytes(24).toString("hex");
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ── Provider: internal (default) ─────────────────────────────────────────────
// No external calls — just logs the submission and returns the token.
// The token is added to VALID_EBOOK_TOKENS env var manually (or via CI).
// For production, swap to a real provider below.
async function saveInternal(email, meta, token) {
  // In serverless context we can't write to the filesystem reliably,
  // so we log to stdout (visible in Netlify function logs).
  console.log(JSON.stringify({
    event: "ebook_optin",
    email,
    token,
    timestamp: new Date().toISOString(),
    ...meta,
  }));
  // To persist: use Netlify Blobs, Supabase, or any DB here.
  return { ok: true };
}

// ── Provider: ConvertKit ──────────────────────────────────────────────────────
async function saveConvertKit(email, meta) {
  const resp = await fetch(
    `https://api.convertkit.com/v3/forms/${process.env.CK_FORM_ID}/subscribe`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.CK_API_KEY,
        email,
        fields: { source_page: meta.source_page, blog_slug: meta.blog_slug },
      }),
    }
  );
  if (!resp.ok) throw new Error(`ConvertKit: ${resp.status}`);
  return { ok: true };
}

// ── Provider: MailerLite ──────────────────────────────────────────────────────
async function saveMailerLite(email, meta) {
  const resp = await fetch("https://connect.mailerlite.com/api/subscribers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.ML_API_KEY}`,
    },
    body: JSON.stringify({
      email,
      groups: [process.env.ML_GROUP_ID],
      fields: { source_page: meta.source_page },
    }),
  });
  if (!resp.ok && resp.status !== 409) throw new Error(`MailerLite: ${resp.status}`);
  return { ok: true };
}

// ── Provider: Beehiiv ─────────────────────────────────────────────────────────
async function saveBeehiiv(email) {
  const resp = await fetch(
    `https://api.beehiiv.com/v2/publications/${process.env.BH_PUB_ID}/subscriptions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.BH_API_KEY}`,
      },
      body: JSON.stringify({ email, reactivate_existing: false, send_welcome_email: true }),
    }
  );
  if (!resp.ok) throw new Error(`Beehiiv: ${resp.status}`);
  return { ok: true };
}

// ── Main handler ──────────────────────────────────────────────────────────────
exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { email, source_page = "", cta_placement = "", blog_slug = "" } = body;

  if (!email || !isValidEmail(email)) {
    return {
      statusCode: 400,
      headers: CORS,
      body: JSON.stringify({ error: "Valid email address required" }),
    };
  }

  const token = generateToken();
  const meta  = { source_page, cta_placement, blog_slug };

  try {
    const provider = (process.env.PROVIDER || "internal").toLowerCase();
    if      (provider === "convertkit") await saveConvertKit(email, meta);
    else if (provider === "mailerlite") await saveMailerLite(email, meta);
    else if (provider === "beehiiv")    await saveBeehiiv(email);
    else                                await saveInternal(email, meta, token);
  } catch (err) {
    console.error("Provider error:", err.message);
    // Fall back to internal logging so signup never silently fails
    await saveInternal(email, meta, token).catch(() => {});
  }

  const downloadUrl = `/.netlify/functions/deliver-ebook?token=${token}&product=free`;

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({
      success: true,
      token,
      download_url: downloadUrl,
      analytics_events: ["ebook_optin_submit", "ebook_optin_success"],
    }),
  };
};
