// api/verify-subscription.js ~ Stripe subscription status verifier
// POST { sessionId }              → first-time check after checkout
// POST { token, subscriptionId }  → recurring check (once/day from client)

import Stripe from "stripe";
import crypto from "crypto";

const STRIPE_API_VERSION = "2026-02-25.clover";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
}

function generateToken(subscriptionId, secret) {
  return crypto.createHmac("sha256", secret).update(subscriptionId).digest("hex");
}

function verifyToken(token, subscriptionId, secret) {
  const expected = generateToken(subscriptionId, secret);
  try {
    return crypto.timingSafeEqual(Buffer.from(token, "hex"), Buffer.from(expected, "hex"));
  } catch { return false; }
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return res.status(500).json({ valid: false, error: "Stripe not configured" });

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signingKey = webhookSecret || crypto.createHash("sha256").update(secretKey).digest("hex");

  try {
    const { sessionId, token, subscriptionId } = req.body || {};
    const stripe = new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION });

    if (token && subscriptionId) {
      if (!verifyToken(token, subscriptionId, signingKey)) {
        return res.status(200).json({ valid: false, tier: "free", reason: "invalid_token" });
      }
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const active = subscription.status === "active" || subscription.status === "trialing";
      return res.status(200).json({ valid: active, tier: active ? "premium" : "free", status: subscription.status });
    }

    if (!sessionId) {
      return res.status(400).json({ valid: false, error: "sessionId or (token + subscriptionId) required" });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["subscription", "customer"] });

    if (session.payment_status !== "paid" && session.status !== "complete") {
      return res.status(200).json({ valid: false, tier: "free", reason: "payment_not_complete" });
    }

    const subscription = session.subscription;
    if (!subscription) return res.status(200).json({ valid: false, tier: "free", reason: "no_subscription" });

    const active = subscription.status === "active" || subscription.status === "trialing";
    if (!active) return res.status(200).json({ valid: false, tier: "free", reason: "subscription_inactive", status: subscription.status });

    const newToken = generateToken(subscription.id, signingKey);
    const email = session.customer_details?.email || session.customer_email || session.customer?.email || "";

    return res.status(200).json({
      valid: true, tier: "premium",
      token: newToken, subscriptionId: subscription.id,
      email, status: subscription.status,
    });

  } catch (err) {
    console.error("verify-subscription error:", err.message);
    return res.status(500).json({ valid: false, error: "Verification failed", detail: err.message });
  }
}
