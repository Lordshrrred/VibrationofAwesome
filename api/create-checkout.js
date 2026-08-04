// api/create-checkout.js ~ Stripe Checkout session creator
// POST { product, priceId?, successUrl?, cancelUrl?, email? }
// product: "aura_premium" (subscription)

import Stripe from "stripe";

const STRIPE_API_VERSION = "2026-02-25.clover";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
}

function sanitizePriceId(priceId) {
  if (typeof priceId !== "string") return "";
  const trimmed = priceId.trim();
  if (!trimmed || trimmed === "STRIPE_PRICE_ID_PLACEHOLDER") return "";
  return trimmed;
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return res.status(500).json({ error: "Stripe not configured" });

  const { product = "aura_premium", priceId, successUrl, cancelUrl, email } = req.body || {};
  const siteUrl = (process.env.SITE_URL || "https://vibrationofawesome.com").replace(/\/$/, "");
  const requestedPriceId = sanitizePriceId(priceId);
  const automaticTax = String(process.env.STRIPE_ENABLE_AUTOMATIC_TAX || "").toLowerCase() === "true";

  try {
    const stripe = new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION });

    const sessionBase = {
      billing_address_collection: "auto",
      allow_promotion_codes: true,
      ...(email ? { customer_email: String(email).trim() } : {}),
      ...(automaticTax ? { automatic_tax: { enabled: true }, tax_id_collection: { enabled: true } } : {}),
    };

    let session;

    if (product === "user_manual") {
      return res.status(410).json({ error: "The User Manual product is not available." });
    } else {
      const resolvedPriceId = requestedPriceId || process.env.STRIPE_PRICE_ID_AURA_PREMIUM || process.env.STRIPE_PRICE_ID;
      if (!resolvedPriceId) return res.status(400).json({ error: "STRIPE_PRICE_ID_AURA_PREMIUM is not configured." });

      session = await stripe.checkout.sessions.create({
        ...sessionBase,
        mode: "subscription",
        line_items: [{ price: resolvedPriceId, quantity: 1 }],
        success_url: successUrl || `${siteUrl}/aura/success/?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl || `${siteUrl}/aura/cancel/`,
        subscription_data: { metadata: { tier: "premium", product: "aura_premium" } },
        metadata: { product: "aura_premium" },
      });
    }

    return res.status(200).json({ url: session.url, sessionId: session.id });

  } catch (err) {
    console.error("create-checkout error:", err.message);
    return res.status(500).json({ error: "Failed to create checkout session", detail: err.message });
  }
}
