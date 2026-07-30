/**
 * Provider adapter registry — business logic resolves adapters only.
 * Never import Stripe/PayPal SDKs from domain engines.
 */

import { ManualPaymentProvider } from "@/lib/payment/providers/manual.provider";
import { StripePaymentProvider } from "@/lib/payment/providers/stripe.provider";
import { StubPaymentProvider } from "@/lib/payment/providers/stub.provider";
import { WalletPaymentProvider } from "@/lib/payment/providers/wallet.provider";
import type { PaymentProvider } from "@/lib/payment/types";
import { getPaymentConfig } from "@/lib/payment/config";
import { isStripeConfigured } from "@/lib/payment/stripe/client";
import type { PaymentAdapterId } from "@/domains/payment/shared/types";

const manual = new ManualPaymentProvider();
const stripe = new StripePaymentProvider();
const wallet = new WalletPaymentProvider();

const stubs: Record<string, StubPaymentProvider> = {
  paypal: new StubPaymentProvider("paypal"),
  apple_pay: new StubPaymentProvider("apple_pay"),
  google_pay: new StubPaymentProvider("google_pay"),
  cash: new StubPaymentProvider("cash"),
  bank_transfer: new StubPaymentProvider("bank_transfer"),
  shamcash: new StubPaymentProvider("shamcash"),
  future_syria: new StubPaymentProvider("future_syria"),
  future_jordan: new StubPaymentProvider("future_jordan"),
  future_lebanon: new StubPaymentProvider("future_lebanon"),
};

export function resolveAdapter(id?: PaymentAdapterId | string | null): PaymentProvider {
  const key = (id ?? getPaymentConfig().provider ?? "manual").toLowerCase();
  switch (key) {
    case "stripe":
      return isStripeConfigured() ? stripe : manual;
    case "manual":
      return manual;
    case "wallet":
      return wallet;
    case "paypal":
    case "apple_pay":
    case "google_pay":
    case "cash":
    case "bank_transfer":
    case "shamcash":
    case "future_syria":
    case "future_jordan":
    case "future_lebanon":
      return stubs[key] ?? manual;
    default:
      return manual;
  }
}

export function listRegisteredAdapters(): PaymentAdapterId[] {
  return [
    "stripe",
    "paypal",
    "apple_pay",
    "google_pay",
    "cash",
    "bank_transfer",
    "wallet",
    "manual",
    "shamcash",
    "future_syria",
    "future_jordan",
    "future_lebanon",
  ];
}
