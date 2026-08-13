/**
 * Sprint 6 Phase 3 — Stripe integration invariants (static checks).
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
let failed = 0;

function ok(msg) {
  console.log(`✓ ${msg}`);
}
function fail(msg) {
  console.error(`✗ ${msg}`);
  failed += 1;
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

console.log("══ Stripe integration invariants ══\n");

if (exists("src/lib/payment/providers/stripe.provider.ts")) {
  const src = read("src/lib/payment/providers/stripe.provider.ts");
  if (src.includes("StripePaymentProviderStub")) {
    fail("Stub still present — expected real StripePaymentProvider");
  } else if (src.includes("class StripePaymentProvider")) {
    ok("Real StripePaymentProvider present");
  } else {
    fail("StripePaymentProvider class missing");
  }
  if (src.includes("paymentIntents.create") && src.includes("checkout.sessions.create")) {
    ok("PaymentIntent + Checkout Session create paths");
  } else {
    fail("Missing PaymentIntent or Checkout Session");
  }
} else {
  fail("stripe.provider.ts missing");
}

if (exists("src/app/api/webhooks/stripe/route.ts")) {
  const route = read("src/app/api/webhooks/stripe/route.ts");
  if (route.includes("constructEvent") || route.includes("webhooks.constructEvent")) {
    ok("Stripe webhook signature verification");
  } else {
    fail("Webhook route missing signature verification");
  }
} else {
  fail("Stripe webhook route missing");
}

if (exists("src/lib/payment/stripe/webhooks.ts")) {
  const wh = read("src/lib/payment/stripe/webhooks.ts");
  const needed = [
    "payment_intent.succeeded",
    "payment_intent.payment_failed",
    "checkout.session.completed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "invoice.paid",
    "invoice.payment_failed",
    "charge.refunded",
    "refund.updated",
    "charge.dispute.created",
    "charge.dispute.updated",
    "charge.dispute.closed",
  ];
  for (const e of needed) {
    if (wh.includes(e)) ok(`Handles ${e}`);
    else fail(`Missing handler for ${e}`);
  }
} else {
  fail("stripe/webhooks.ts missing");
}

const pkg = JSON.parse(read("package.json"));
if (pkg.dependencies?.stripe) ok(`stripe dependency: ${pkg.dependencies.stripe}`);
else fail("stripe npm package missing");
if (pkg.dependencies?.["@stripe/stripe-js"]) ok("@stripe/stripe-js present");
else fail("@stripe/stripe-js missing");
if (pkg.dependencies?.["@stripe/react-stripe-js"]) ok("@stripe/react-stripe-js present");
else fail("@stripe/react-stripe-js missing");

const types = read("src/lib/payment/types.ts");
if (
  types.includes("createPayment") &&
  types.includes("verifyPayment") &&
  types.includes("cancelPayment") &&
  types.includes("refund")
) {
  ok("PaymentProvider interface unchanged (core methods)");
} else {
  fail("PaymentProvider interface methods missing");
}

if (exists("supabase/migrations/archive/20260727030000_sprint6_stripe_integration.sql")) {
  ok("Stripe migration present");
} else {
  fail("Stripe migration missing");
}

// Business modules must not import stripe SDK directly
const businessGlobs = [
  "src/actions/monetization.actions.ts",
  "src/lib/monetization/plans.ts",
  "src/domains/unlock",
];
for (const rel of businessGlobs) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) continue;
  const walk = (p) => {
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      for (const f of fs.readdirSync(p)) walk(path.join(p, f));
      return;
    }
    if (!p.endsWith(".ts") && !p.endsWith(".tsx")) return;
    const body = fs.readFileSync(p, "utf8");
    if (/from ["']stripe["']/.test(body) || /from ["']@stripe\//.test(body)) {
      fail(`Business file imports Stripe SDK: ${path.relative(root, p)}`);
    }
  };
  walk(full);
}
ok("Spot-check: monetization/unlock do not import Stripe SDK");

console.log("");
if (failed > 0) {
  console.error(`FAILED: ${failed} check(s)`);
  process.exit(1);
}
console.log("All Stripe invariants passed.");
