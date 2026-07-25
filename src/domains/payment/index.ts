/**
 * SAD Payment domain facade (Sprint 0).
 * Will be correlated to unlock fees in Sprint 6 — no behavior change now.
 */

export const PAYMENT_DOMAIN = {
  service: "payment",
  owns: ["payment_intents", "charges", "refunds_metadata"],
  impl: ["src/lib/payment"],
  status: "facade",
} as const;

export type { CreatePaymentInput, VerifyPaymentInput, PaymentProvider } from "@/lib/payment/types";
