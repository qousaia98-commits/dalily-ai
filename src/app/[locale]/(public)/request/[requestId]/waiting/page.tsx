import { redirect } from "next/navigation";
import { isCustomerIntentFlowV2Enabled, isMatchingV2Enabled } from "@/lib/config/feature-flags";
import { getAuthUser } from "@/lib/auth/session";
import { getRequestDetail } from "@/lib/service-requests/queries";
import { getMatchPoolSummaryForRequest } from "@/domains/matching/queries";
import { WaitingRoom } from "@/components/customer/waiting-room";

export default async function RequestWaitingPage({
  params,
}: {
  params: Promise<{ locale: string; requestId: string }>;
}) {
  if (!isCustomerIntentFlowV2Enabled()) {
    redirect("/");
  }

  const { requestId } = await params;
  const authUser = await getAuthUser();
  if (!authUser) {
    redirect(`/login?redirect=${encodeURIComponent(`/request/${requestId}/waiting`)}`);
  }

  const request = await getRequestDetail(requestId);
  if (!request || request.customer_id !== authUser.id) {
    return <WaitingRoom request={null} state="error" />;
  }

  const matchSummary = isMatchingV2Enabled()
    ? await getMatchPoolSummaryForRequest(requestId)
    : null;

  // Offers arrive in Sprint 4 — matching summary is honest progress, not fake offers.
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6">
      <WaitingRoom
        request={request}
        state={matchSummary && matchSummary.assignedCount > 0 ? "ready" : "empty"}
        matchSummary={matchSummary}
      />
    </main>
  );
}
