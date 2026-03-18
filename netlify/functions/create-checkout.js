// create-checkout.js
// Netlify Function: creates a Stripe Checkout Session for AURA Premium.
// POST { priceId, successUrl, cancelUrl } -> { url }

const Stripe = require("stripe");

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Stripe not configured" }),
    };
  }

  try {
    const { priceId, successUrl, cancelUrl } = JSON.parse(event.body || "{}");

    if (!priceId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "priceId is required" }),
      };
    }

    const stripe = new Stripe(secretKey);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl || "https://vibrationofawesome.com/aura/success/?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: cancelUrl || "https://vibrationofawesome.com/aura/cancel/",
      subscription_data: {
        metadata: { tier: "premium" },
      },
      allow_promotion_codes: true,
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ url: session.url, sessionId: session.id }),
    };
  } catch (err) {
    console.error("create-checkout error:", err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to create checkout session", detail: err.message }),
    };
  }
};
