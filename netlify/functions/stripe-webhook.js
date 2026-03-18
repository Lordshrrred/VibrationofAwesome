// stripe-webhook.js
// Netlify Function: receives and verifies Stripe webhook events.
// Configure in Stripe Dashboard:
//   URL: https://vibrationofawesome.netlify.app/.netlify/functions/stripe-webhook
//   Events: checkout.session.completed, customer.subscription.deleted,
//            customer.subscription.updated, invoice.payment_failed

const Stripe = require("stripe");

exports.handler = async (event) => {
  // Stripe requires the raw body for signature verification.
  // Netlify provides event.body as a raw string (not parsed).
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey || !webhookSecret) {
    console.error("stripe-webhook: missing env vars");
    return { statusCode: 500, body: "Webhook not configured" };
  }

  const stripe = new Stripe(secretKey);
  const signature = event.headers["stripe-signature"];

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  console.log(`Received Stripe event: ${stripeEvent.type} [${stripeEvent.id}]`);

  switch (stripeEvent.type) {
    case "checkout.session.completed": {
      const session = stripeEvent.data.object;
      const email = session.customer_details?.email || session.customer_email;
      const customerId = session.customer;
      const subscriptionId = session.subscription;

      console.log(`Checkout complete: email=${email}, customer=${customerId}, subscription=${subscriptionId}`);
      // Token generation happens in verify-subscription via Stripe lookup.
      // No separate storage needed -- Stripe is the source of truth.
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = stripeEvent.data.object;
      console.log(`Subscription cancelled: ${subscription.id}, customer=${subscription.customer}`);
      // Tokens become invalid automatically -- verify-subscription checks Stripe status live.
      break;
    }

    case "customer.subscription.updated": {
      const subscription = stripeEvent.data.object;
      console.log(`Subscription updated: ${subscription.id}, status=${subscription.status}`);
      break;
    }

    case "invoice.payment_failed": {
      const invoice = stripeEvent.data.object;
      console.log(`Payment failed: customer=${invoice.customer}, subscription=${invoice.subscription}`);
      break;
    }

    default:
      console.log(`Unhandled event type: ${stripeEvent.type}`);
  }

  // Acknowledge receipt to Stripe (must respond within 30s)
  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
