import { ManualPaymentProvider } from "@/lib/payment/providers/manual.provider";
import { StripePaymentProvider } from "@/lib/payment/providers/stripe.provider";
import type { PaymentProvider } from "@/lib/payment/types";
import { getPaymentConfig } from "@/lib/payment/config";
import { isStripeConfigured } from "@/lib/payment/stripe/client";

const manualProvider = new ManualPaymentProvider();
const stripeProvider = new StripePaymentProvider();

/**
 * Resolve active PaymentProvider. Business code must use orchestration,
 * not this function + Stripe SDK.
 */
export function resolvePaymentProvider(): PaymentProvider {
  const { provider } = getPaymentConfig();
  switch (provider) {
    case "manual":
      return manualProvider;
    case "shamcash":
      return manualProvider;
    case "stripe":
      if (isStripeConfigured()) {
        return stripeProvider;
      }
      return manualProvider;
    default:
      return manualProvider;
  }
}

/** Narrow access for Stripe-only ops (portal, cancel renewal) — not business logic. */
export function getStripePaymentProvider(): StripePaymentProvider | null {
  if (getPaymentConfig().provider !== "stripe" || !isStripeConfigured()) {
    return null;
  }
  return stripeProvider;
}
