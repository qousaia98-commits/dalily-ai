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
  if (config.provider === "shamcash") {
    return isChamCashConfigured();
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

/**
 * Cham Cash (apisyria.com) — Syria-only e-wallet rail. Dormant until both
 * the account address and API key are set; the registry falls back to the
 * manual rail until then, same as Stripe without a secret key.
 */
export function getChamCashAccountAddress(): string {
  return process.env.CHAM_CASH_ACCOUNT_ADDRESS?.trim() ?? "";
}

export function getChamCashApiKey(): string {
  return process.env.CHAM_CASH_API_KEY?.trim() ?? "";
}

export function getChamCashApiBaseUrl(): string {
  return process.env.CHAM_CASH_API_BASE_URL?.trim() || "https://apisyria.com/api";
}

export function isChamCashConfigured(): boolean {
  return Boolean(getChamCashAccountAddress() && getChamCashApiKey());
}
