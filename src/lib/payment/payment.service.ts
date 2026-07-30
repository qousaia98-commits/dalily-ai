import { resolveAdapter } from "@/domains/payment/providers/registry";
import type { PaymentProvider } from "@/lib/payment/types";
import { getPaymentConfig } from "@/lib/payment/config";
import { isStripeConfigured } from "@/lib/payment/stripe/client";
import { StripePaymentProvider } from "@/lib/payment/providers/stripe.provider";

const stripeProvider = new StripePaymentProvider();

/**
 * Resolve active PaymentProvider via adapter registry.
 * Business code must use orchestration — never Stripe SDK.
 */
export function resolvePaymentProvider(): PaymentProvider {
  return resolveAdapter(getPaymentConfig().provider);
}

/** Narrow access for Stripe-only ops (portal, cancel renewal) — not business logic. */
export function getStripePaymentProvider(): StripePaymentProvider | null {
  if (getPaymentConfig().provider !== "stripe" || !isStripeConfigured()) {
    return null;
  }
  return stripeProvider;
}
