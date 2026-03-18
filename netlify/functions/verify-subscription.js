// verify-subscription.js
// Netlify Function: verifies a Stripe session or token and returns subscription status.
//
// POST { sessionId } -> first-time verification after checkout
//   Calls Stripe, checks subscription status, generates signed token.
//   Returns { valid, tier, token, email }
//
// POST { token, sessionId } -> subsequent checks (e.g. on page load)
//   Validates HMAC token, spot-checks Stripe for active subscription.
//   Returns { valid, tier }

const Stripe = require("stripe");
const crypto = require("crypto");

const FUNCTIONS_URL = "https://vibrationofawesome.netlify.app/.netlify/functions";

function generateToken(subscriptionId, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(subscriptionId)
    .digest("hex");
}

function verifyToken(token, subscriptionId, secret) {
  const expected = generateToken(subscriptionId, secret);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(token, "hex"),
      Buffer.from(expected, "hex")
    );
  } catch {
    return false;
  }
}

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
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ valid: false, error: "Stripe not configured" }),
    };
  }

  // Use webhook secret as signing key for tokens; fall back to a hash of the secret key
  const signingKey = webhookSecret || crypto.createHash("sha256").update(secretKey).digest("hex");

  try {
    const body = JSON.parse(event.body || "{}");
    const { sessionId, token, subscriptionId } = body;

    const stripe = new Stripe(secretKey);

    // --- Verify by token (subsequent visits) ---
    if (token && (subscriptionId || sessionId)) {
      // If we have subscriptionId directly in the request, use it.
      // Otherwise token alone is not enough -- require sessionId to look up.
      if (subscriptionId) {
        const tokenValid = verifyToken(token, subscriptionId, signingKey);
        if (!tokenValid) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ valid: false, tier: "free", reason: "invalid_token" }),
          };
        }

        // Spot-check subscription status with Stripe
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const active = subscription.status === "active" || subscription.status === "trialing";

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            valid: active,
            tier: active ? "premium" : "free",
            status: subscription.status,
          }),
        };
      }
    }

    // --- Verify by sessionId (first-time after checkout) ---
    if (!sessionId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ valid: false, error: "sessionId or (token + subscriptionId) required" }),
      };
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    if (session.payment_status !== "paid" && session.status !== "complete") {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ valid: false, tier: "free", reason: "payment_not_complete" }),
      };
    }

    const subscription = session.subscription;
    if (!subscription) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ valid: false, tier: "free", reason: "no_subscription" }),
      };
    }

    const active = subscription.status === "active" || subscription.status === "trialing";
    if (!active) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ valid: false, tier: "free", reason: "subscription_inactive", status: subscription.status }),
      };
    }

    // Generate signed token using the subscription ID
    const newToken = generateToken(subscription.id, signingKey);
    const email = session.customer_details?.email || session.customer_email || "";

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        valid: true,
        tier: "premium",
        token: newToken,
        subscriptionId: subscription.id,
        email,
        status: subscription.status,
      }),
    };
  } catch (err) {
    console.error("verify-subscription error:", err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ valid: false, error: "Verification failed", detail: err.message }),
    };
  }
};
