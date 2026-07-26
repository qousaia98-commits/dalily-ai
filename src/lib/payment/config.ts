export type PaymentProviderConfig = {
  provider: string;
  /** Account holder name */
  receiver: string;
  /** IBAN / account number */
  account: string;
  /** Optional SWIFT / BIC */
  swift: string;
  /** Optional bank name */
  bankName: string;
};

export function getPaymentConfig(): PaymentProviderConfig {
  return {
    provider: process.env.PAYMENT_PROVIDER ?? "manual",
    receiver: process.env.PAYMENT_RECEIVER ?? "",
    account: process.env.PAYMENT_ACCOUNT ?? process.env.PAYMENT_IBAN ?? "",
    swift: process.env.PAYMENT_SWIFT ?? "",
    bankName: process.env.PAYMENT_BANK_NAME ?? "",
  };
}

/** Closed beta: paid upgrades must not show empty bank details (manual).
 * Stripe is configured when the secret key is present.
 */
export function isPaymentConfigured(
  config: PaymentProviderConfig = getPaymentConfig(),
): boolean {
  if (config.provider === "stripe") {
    return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
  }
  return Boolean(config.receiver.trim() && config.account.trim());
}

export function isStripePaymentActive(
  config: PaymentProviderConfig = getPaymentConfig(),
): boolean {
  return (
    config.provider === "stripe" &&
    Boolean(process.env.STRIPE_SECRET_KEY?.trim())
  );
}
