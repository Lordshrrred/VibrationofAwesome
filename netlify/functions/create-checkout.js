// create-checkout.js
// Netlify Function: creates a Stripe Checkout Session.
//
// Supports two product types:
//   POST { product: "aura_premium", priceId, successUrl, cancelUrl }
//     → subscription session (existing AURA flow)
//
//   POST { product: "user_manual" }
//     → one-time payment session for the $17 ebook
//     Env vars: STRIPE_PRICE_ID_USER_MANUAL, SITE_URL
//
// Returns { url, sessionId }

const Stripe = require("stripe");
const STRIPE_API_VERSION = "2026-02-25.clover";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function isTruthy(value) {
  return typeof value === "string" && ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function sanitizePriceId(priceId) {
  if (typeof priceId !== "string") return "";
  const trimmed = priceId.trim();
  if (!trimmed || trimmed === "STRIPE_PRICE_ID_PLACEHOLDER") return "";
  return trimmed;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: "Stripe not configured" }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { product = "aura_premium", priceId, successUrl, cancelUrl, email } = body;
  const siteUrl = (process.env.SITE_URL || "https://vibrationofawesome.com").replace(/\/$/, "");
  const requestedPriceId = sanitizePriceId(priceId);
  const automaticTaxEnabled = isTruthy(process.env.STRIPE_ENABLE_AUTOMATIC_TAX || "false");

  try {
    const stripe = new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION });
    let session;
    const sessionBase = {
      billing_address_collection: "auto",
      allow_promotion_codes: true,
    };

    if (email && typeof email === "string") {
      sessionBase.customer_email = email.trim();
    }

    if (automaticTaxEnabled) {
      sessionBase.automatic_tax = { enabled: true };
      sessionBase.tax_id_collection = { enabled: true };
    }

    if (product === "user_manual") {
      // ── One-time ebook purchase ───────────────────────────────────────────
      const ebookPriceId = process.env.STRIPE_PRICE_ID_USER_MANUAL;
      if (!ebookPriceId) {
        return {
          statusCode: 503,
          headers: CORS,
          body: JSON.stringify({ error: "Ebook checkout not yet configured. Check back soon!" }),
        };
      }

      session = await stripe.checkout.sessions.create({
        ...sessionBase,
        mode: "payment",
        customer_creation: automaticTaxEnabled ? "always" : "if_required",
        line_items: [{ price: ebookPriceId, quantity: 1 }],
        success_url: successUrl || `${siteUrl}/field-guide/thank-you/?session_id={CHECKOUT_SESSION_ID}&purchased=true`,
        cancel_url: cancelUrl || `${siteUrl}/user-manual/`,
        metadata: { product: "user_manual" },
      });

    } else {
      // ── Subscription (AURA Premium ~ existing flow) ───────────────────────
      const resolvedPriceId =
        requestedPriceId ||
        process.env.STRIPE_PRICE_ID_AURA_PREMIUM ||
        process.env.STRIPE_PRICE_ID;
      if (!resolvedPriceId) {
        return {
          statusCode: 400,
          headers: CORS,
          body: JSON.stringify({ error: "priceId is required" }),
        };
      }

      session = await stripe.checkout.sessions.create({
        ...sessionBase,
        mode: "subscription",
        line_items: [{ price: resolvedPriceId, quantity: 1 }],
        success_url: successUrl || `${siteUrl}/aura/success/?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl || `${siteUrl}/aura/cancel/`,
        subscription_data: {
          metadata: { tier: "premium", product: "aura_premium" },
        },
        metadata: { product: "aura_premium" },
      });
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ url: session.url, sessionId: session.id }),
    };

  } catch (err) {
    console.error("create-checkout error:", err.message);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: "Failed to create checkout session", detail: err.message }),
    };
  }
};
