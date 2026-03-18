// setup-stripe.js
// Creates AURA Premium product + $12/month price in Stripe,
// then writes STRIPE_PRICE_ID back to .env.
// Usage: node scripts/setup-stripe.js

import Stripe from "stripe";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ENV_PATH = path.join(ROOT, ".env");

// Load .env manually (dotenv may not be installed globally)
function loadEnv(envPath) {
  if (!fs.existsSync(envPath)) return {};
  const raw = fs.readFileSync(envPath, "utf8");
  const vars = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    vars[key] = val;
  }
  return vars;
}

function updateEnvFile(envPath, key, value) {
  let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(content)) {
    content = content.replace(re, `${key}=${value}`);
  } else {
    content += `\n${key}=${value}\n`;
  }
  fs.writeFileSync(envPath, content, "utf8");
}

async function main() {
  const env = loadEnv(ENV_PATH);
  const secretKey = env.STRIPE_SECRET_KEY;

  if (!secretKey || secretKey.startsWith("sk_test_...") || secretKey === "your_stripe_secret_key") {
    console.error("\nERROR: STRIPE_SECRET_KEY not set in .env");
    console.error("Add your Stripe secret key (test mode): sk_test_...");
    console.error("Find it at: https://dashboard.stripe.com/test/apikeys\n");
    process.exit(1);
  }

  if (!secretKey.startsWith("sk_")) {
    console.error("ERROR: STRIPE_SECRET_KEY must start with sk_ (use test key: sk_test_...)");
    process.exit(1);
  }

  console.log("\nConnecting to Stripe...");
  const stripe = new Stripe(secretKey);

  // Check if product already exists
  let product;
  const existingProducts = await stripe.products.search({
    query: 'name:"AURA Premium" AND active:"true"',
  });

  if (existingProducts.data.length > 0) {
    product = existingProducts.data[0];
    console.log(`Product already exists: ${product.id} (${product.name})`);
  } else {
    product = await stripe.products.create({
      name: "AURA Premium",
      description: "Unlimited AURA conversations, deeper spiritual guidance, and priority responses.",
      metadata: { tier: "premium" },
    });
    console.log(`Product created: ${product.id} (${product.name})`);
  }

  // Check if $12/month price already exists for this product
  let price;
  const existingPrices = await stripe.prices.list({
    product: product.id,
    active: true,
    type: "recurring",
  });

  const matchingPrice = existingPrices.data.find(
    (p) => p.unit_amount === 1200 && p.currency === "usd" && p.recurring?.interval === "month"
  );

  if (matchingPrice) {
    price = matchingPrice;
    console.log(`Price already exists: ${price.id} ($${(price.unit_amount / 100).toFixed(2)}/month)`);
  } else {
    price = await stripe.prices.create({
      product: product.id,
      unit_amount: 1200,
      currency: "usd",
      recurring: { interval: "month" },
      metadata: { tier: "premium" },
    });
    console.log(`Price created: ${price.id} ($${(price.unit_amount / 100).toFixed(2)}/month)`);
  }

  // Save to .env
  updateEnvFile(ENV_PATH, "STRIPE_PRICE_ID", price.id);
  console.log(`\nSTRIPE_PRICE_ID saved to .env: ${price.id}`);

  console.log("\n--- Setup Complete ---");
  console.log(`Product ID:  ${product.id}`);
  console.log(`Price ID:    ${price.id}`);
  console.log(`Amount:      $12.00 / month`);
  console.log(`\nNext steps:`);
  console.log("1. Add STRIPE_PUBLIC_KEY to .env (pk_test_...)");
  console.log("2. Set up Stripe webhook pointing to your Netlify function");
  console.log("3. Add STRIPE_WEBHOOK_SECRET to .env (whsec_...)");
  console.log("   Webhook URL: https://vibrationofawesome.netlify.app/.netlify/functions/stripe-webhook");
  console.log("   Events: checkout.session.completed, customer.subscription.deleted\n");
}

main().catch((err) => {
  console.error("Stripe setup failed:", err.message);
  process.exit(1);
});
