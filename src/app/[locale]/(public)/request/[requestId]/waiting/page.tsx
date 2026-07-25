import { redirect } from "next/navigation";
import {
  isCustomerIntentFlowV2Enabled,
  isMatchingV2Enabled,
  isOffersV2Enabled,
  isUnlockV2Enabled,
  isChatAuthV2Enabled,
} from "@/lib/config/feature-flags";
import { getAuthUser } from "@/lib/auth/session";
import { getRequestDetail } from "@/lib/service-requests/queries";
import { getMatchPoolSummaryForRequest } from "@/domains/matching/queries";
import {
  listOffersForRequest,
  getActiveSelectionForRequest,
  listClarifications,
} from "@/domains/offer";
import {
  getUnlockSessionForSelection,
  getReleasedContactForCustomer,
} from "@/domains/unlock";
import { createAdminClient } from "@/lib/supabase/admin";
import { WaitingRoom } from "@/components/customer/waiting-room";
import { MarketplaceRealtimeBridge } from "@/components/marketplace/realtime-bridge";

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

  const offersEnabled = isOffersV2Enabled();
  const offers = offersEnabled
    ? await listOffersForRequest(requestId, { customerId: authUser.id })
    : [];
  const selection = offersEnabled
    ? await getActiveSelectionForRequest(requestId)
    : null;

  const clarificationsByOffer: Record<string, Awaited<ReturnType<typeof listClarifications>>> =
    {};
  if (offersEnabled) {
    await Promise.all(
      offers.map(async (o) => {
        clarificationsByOffer[o.id] = await listClarifications(o.id);
      }),
    );
  }

  const unlockEnabled = isUnlockV2Enabled();
  const unlockSession =
    unlockEnabled && selection?.id
      ? await getUnlockSessionForSelection(selection.id)
      : null;
  const releasedContact = unlockEnabled
    ? await getReleasedContactForCustomer({
        customerId: authUser.id,
        serviceRequestId: requestId,
      })
    : null;

  let conversationId: string | null = request.conversationId ?? null;
  if (isChatAuthV2Enabled() && releasedContact && !conversationId) {
    const admin = createAdminClient();
    const { data: conv } = await admin
      .from("conversations")
      .select("id")
      .eq("service_request_id", requestId)
      .maybeSingle();
    conversationId = (conv?.id as string) ?? null;
  }

  const state =
    offers.length > 0 ||
    (matchSummary && matchSummary.assignedCount > 0) ||
    unlockSession ||
    releasedContact
      ? "ready"
      : "empty";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6">
      <MarketplaceRealtimeBridge userId={authUser.id} requestId={requestId} />
      <WaitingRoom
        request={request}
        state={state}
        matchSummary={matchSummary}
        offers={offers}
        selectionOfferId={selection?.offerId ?? null}
        clarificationsByOffer={clarificationsByOffer}
        unlockSession={unlockSession}
        releasedContact={releasedContact}
        conversationId={conversationId}
      />
    </main>
  );
}
