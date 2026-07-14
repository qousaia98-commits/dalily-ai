export type PaymentProviderConfig = {
  provider: string;
  receiver: string;
  account: string;
};

export function getPaymentConfig(): PaymentProviderConfig {
  return {
    provider: process.env.PAYMENT_PROVIDER ?? "manual",
    receiver: process.env.PAYMENT_RECEIVER ?? "",
    account: process.env.PAYMENT_ACCOUNT ?? "",
  };
}
