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
