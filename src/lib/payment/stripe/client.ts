/**
 * Server-only Stripe SDK client. Never import from Client Components.
 */

import Stripe from "stripe";

let stripeSingleton: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function getStripePublishableKey(): string {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? "";
}

export function getStripeWebhookSecret(): string {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";
}

export function getStripeBusinessPriceId(): string {
  return process.env.STRIPE_BUSINESS_PRICE_ID?.trim() ?? "";
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error("stripe_not_configured");
  }
  if (!stripeSingleton) {
    stripeSingleton = new Stripe(key, {
      apiVersion: "2026-06-24.dahlia",
      typescript: true,
      appInfo: { name: "Dalily AI", version: "0.1.0" },
    });
  }
  return stripeSingleton;
}

/** Convert major currency units (e.g. 20.00 USD) to Stripe minor units. */
export function toStripeAmount(amount: number, currency: string): number {
  const zeroDecimal = new Set([
    "bif",
    "clp",
    "djf",
    "gnf",
    "jpy",
    "kmf",
    "krw",
    "mga",
    "pyg",
    "rwf",
    "ugx",
    "vnd",
    "vuv",
    "xaf",
    "xof",
    "xpf",
  ]);
  const cur = currency.toLowerCase();
  if (zeroDecimal.has(cur)) return Math.round(amount);
  return Math.round(amount * 100);
}
