import { ManualPaymentProvider } from "@/lib/payment/providers/manual.provider";
import type { PaymentProvider } from "@/lib/payment/types";
import { getPaymentConfig } from "@/lib/payment/config";

const manualProvider = new ManualPaymentProvider();

export function resolvePaymentProvider(): PaymentProvider {
  const { provider } = getPaymentConfig();
  switch (provider) {
    case "manual":
      return manualProvider;
    case "shamcash":
      // ShamCashPaymentProvider will be registered here without changing subscription logic.
      return manualProvider;
    default:
      return manualProvider;
  }
}
