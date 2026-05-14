// api/stripe-webhook.js ~ Stripe webhook receiver
// Webhook URL: https://[your-vercel-project].vercel.app/api/stripe-webhook
// Events: checkout.session.completed, customer.subscription.deleted,
//         customer.subscription.updated, invoice.payment_failed

import Stripe from "stripe";

const STRIPE_API_VERSION = "2026-02-25.clover";

// Vercel parses the body by default — disable so we can get the raw bytes
// needed for Stripe signature verification.
export const config = {
  api: { bodyParser: false },
};

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey || !webhookSecret) {
    console.error("stripe-webhook: missing env vars");
    return res.status(500).send("Webhook not configured");
  }

  const stripe = new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION });
  const signature = req.headers["stripe-signature"];
  const rawBody = await getRawBody(req);

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`Stripe event: ${stripeEvent.type} [${stripeEvent.id}]`);

  switch (stripeEvent.type) {
    case "checkout.session.completed": {
      const session = stripeEvent.data.object;
      console.log(`Checkout complete: email=${session.customer_details?.email}, subscription=${session.subscription}`);
      break;
    }
    case "customer.subscription.deleted": {
      console.log(`Subscription cancelled: ${stripeEvent.data.object.id}`);
      break;
    }
    case "customer.subscription.updated": {
      const sub = stripeEvent.data.object;
      console.log(`Subscription updated: ${sub.id}, status=${sub.status}`);
      break;
    }
    case "invoice.payment_failed": {
      const inv = stripeEvent.data.object;
      console.log(`Payment failed: customer=${inv.customer}, subscription=${inv.subscription}`);
      break;
    }
    default:
      console.log(`Unhandled event: ${stripeEvent.type}`);
  }

  return res.status(200).json({ received: true });
}
