// setup-stripe.js
// Creates AURA Premium product + $12/month price in Stripe,
// then writes the resulting Stripe IDs back to .env.
// Usage: node scripts/setup-stripe.js

import Stripe from "stripe";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { pathToFileURL as __voaPathToFileURL } from "node:url";
const STRIPE_API_VERSION = "2026-02-25.clover";
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

function isTruthy(value) {
  return typeof value === "string" && ["1", "true", "yes", "on"].includes(value.toLowerCase());
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
  const auraAmountDollars = Number(env.STRIPE_AURA_PREMIUM_AMOUNT || 12);
  const auraAmountCents = Math.round(auraAmountDollars * 100);
  const auraTaxCode = env.STRIPE_TAX_CODE_AURA_PREMIUM || "";
  const taxBehavior = env.STRIPE_TAX_BEHAVIOR || (isTruthy(env.STRIPE_ENABLE_AUTOMATIC_TAX || "false") ? "exclusive" : undefined);

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
  const stripe = new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION });

  // Check if product already exists
  let product;
  const existingProducts = await stripe.products.search({
    query: 'name:"AURA Premium" AND active:"true"',
  });

  if (existingProducts.data.length > 0) {
    product = existingProducts.data[0];
    console.log(`Product already exists: ${product.id} (${product.name})`);
    if (auraTaxCode && product.tax_code !== auraTaxCode) {
      product = await stripe.products.update(product.id, { tax_code: auraTaxCode });
      console.log(`Updated product tax code: ${auraTaxCode}`);
    }
  } else {
    const productPayload = {
      name: "AURA Premium",
      description: "Unlimited AURA conversations, deeper spiritual guidance, and priority responses.",
      metadata: { tier: "premium" },
    };
    if (auraTaxCode) {
      productPayload.tax_code = auraTaxCode;
    }
    product = await stripe.products.create(productPayload);
    console.log(`Product created: ${product.id} (${product.name})`);
  }

  // Check if the configured monthly price already exists for this product
  let price;
  const existingPrices = await stripe.prices.list({
    product: product.id,
    active: true,
    type: "recurring",
  });

  const matchingPrice = existingPrices.data.find(
    (p) =>
      p.unit_amount === auraAmountCents &&
      p.currency === "usd" &&
      p.recurring?.interval === "month" &&
      (!taxBehavior || p.tax_behavior === taxBehavior)
  );

  if (matchingPrice) {
    price = matchingPrice;
    console.log(`Price already exists: ${price.id} ($${(price.unit_amount / 100).toFixed(2)}/month)`);
  } else {
    const pricePayload = {
      product: product.id,
      unit_amount: auraAmountCents,
      currency: "usd",
      recurring: { interval: "month" },
      metadata: { tier: "premium" },
    };
    if (taxBehavior) {
      pricePayload.tax_behavior = taxBehavior;
    }
    price = await stripe.prices.create(pricePayload);
    console.log(`Price created: ${price.id} ($${(price.unit_amount / 100).toFixed(2)}/month)`);
  }

  // Save to .env
  updateEnvFile(ENV_PATH, "STRIPE_PRICE_ID", price.id);
  updateEnvFile(ENV_PATH, "STRIPE_PRICE_ID_AURA_PREMIUM", price.id);
  console.log(`\nSTRIPE_PRICE_ID and STRIPE_PRICE_ID_AURA_PREMIUM saved to .env: ${price.id}`);

  console.log("\n--- Setup Complete ---");
  console.log(`Product ID:  ${product.id}`);
  console.log(`Price ID:    ${price.id}`);
  console.log(`Amount:      $${(price.unit_amount / 100).toFixed(2)} / month`);
  console.log(`Tax code:    ${product.tax_code || "(dashboard default)"}`);
  console.log(`Tax mode:    ${price.tax_behavior || "(dashboard default)"}`);
  console.log(`\nNext steps:`);
  console.log("1. Add STRIPE_PUBLIC_KEY to .env (pk_test_...)");
  console.log("2. Set up a Stripe webhook at: https://dashboard.stripe.com/webhooks");
  console.log("3. Add STRIPE_WEBHOOK_SECRET to .env (whsec_...)");
  console.log("   Webhook URL: https://vibrationofawesome.vercel.app/api/stripe-webhook");
  console.log("   Events: checkout.session.completed, customer.subscription.deleted, customer.subscription.updated, invoice.payment_failed");
  console.log("4. If you want Stripe Tax, set STRIPE_ENABLE_AUTOMATIC_TAX=true and configure registrations/business address in Stripe Tax settings.\n");
}

// CLI-only guard: without this, merely `import`-ing this module (from a test,
// another script, or a syntax/load check) executes a real run with real side
// effects. See CLAUDE.md ~ every script with a top-level main() needs this.
const __voaIsCli = process.argv[1] && import.meta.url === __voaPathToFileURL(process.argv[1]).href;
if (__voaIsCli) {
  main().catch((err) => {
    console.error("Stripe setup failed:", err.message);
    process.exit(1);
  });
}
