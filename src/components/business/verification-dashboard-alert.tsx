import type { ManagedProvider } from "@/types/provider.types";
import type { BusinessVerificationView } from "@/lib/verification/queries";
import {
  isVerificationAlertRelevant,
  resolveVerificationFeedback,
  resolveVerificationUiStatus,
} from "@/lib/verification/status";
import { VerificationStatusCard } from "@/components/business/verification-status-card";

type Props = {
  provider: ManagedProvider;
  verification: BusinessVerificationView;
};

/**
 * Prominent dashboard alert for verification status changes.
 * Only shown while relevant — never blocks workflows.
 */
export function VerificationDashboardAlert({ provider, verification }: Props) {
  const status = resolveVerificationUiStatus(provider, verification);
  if (!isVerificationAlertRelevant(status)) return null;

  const feedback = resolveVerificationFeedback(provider, verification);

  return (
    <VerificationStatusCard
      status={status}
      feedback={feedback}
      showAction
      href="/business/verification"
      className="shadow-sm"
    />
  );
}
