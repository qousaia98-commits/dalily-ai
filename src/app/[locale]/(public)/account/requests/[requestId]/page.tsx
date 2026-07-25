import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/lib/i18n/routing";
import { getAuthUser } from "@/lib/auth/session";
import { getRequestDetail } from "@/lib/service-requests/queries";
import { RequestWorkflowPanel } from "@/components/marketplace/request-workflow-panel";
import { isOffersV2Enabled } from "@/lib/config/feature-flags";
import {
  listOffersForRequest,
  getActiveSelectionForRequest,
  listClarifications,
} from "@/domains/offer";
import { CustomerOfferBoard } from "@/components/customer/customer-offer-board";
import { canAccessFullChat } from "@/domains/chat/authz";
import { createAdminClient } from "@/lib/supabase/admin";
import { isChatAuthV2Enabled } from "@/lib/config/feature-flags";

type PageProps = { params: Promise<{ requestId: string }> };

export default async function CustomerRequestDetailPage({ params }: PageProps) {
  const { requestId } = await params;
  const t = await getTranslations("marketplace.myRequests");
  const locale = await getLocale();
  const authUser = await getAuthUser();
  if (!authUser) {
    redirect({ href: "/login", locale });
    return null;
  }

  const request = await getRequestDetail(requestId);
  if (!request || request.customer_id !== authUser.id) notFound();

  const marketplaceNative =
    isOffersV2Enabled() && (request.lifecycle_version ?? 1) >= 2;

  const offers = marketplaceNative
    ? await listOffersForRequest(requestId, { customerId: authUser.id })
    : [];
  const selection = marketplaceNative
    ? await getActiveSelectionForRequest(requestId)
    : null;
  const clarificationsByOffer: Record<string, Awaited<ReturnType<typeof listClarifications>>> =
    {};
  if (marketplaceNative) {
    await Promise.all(
      offers.map(async (o) => {
        clarificationsByOffer[o.id] = await listClarifications(o.id);
      }),
    );
  }

  // Ensure conversationId for unlocked marketplace requests
  let requestForPanel = request;
  if (isChatAuthV2Enabled() && !request.conversationId) {
    const admin = createAdminClient();
    const { data: conv } = await admin
      .from("conversations")
      .select("id")
      .eq("service_request_id", requestId)
      .maybeSingle();
    if (conv?.id) {
      requestForPanel = { ...request, conversationId: conv.id as string };
    }
  }

  const chatAuthorized = await canAccessFullChat({
    serviceRequestId: requestForPanel.id,
    status: requestForPanel.status,
    lifecycleVersion: requestForPanel.lifecycle_version ?? 1,
  });

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-8 sm:px-6 animate-fade-in">
      <p className="sr-only">{t("title")}</p>
      {marketplaceNative && offers.length > 0 ? (
        <CustomerOfferBoard
          offers={offers}
          selectionOfferId={selection?.offerId ?? null}
          clarificationsByOffer={clarificationsByOffer}
        />
      ) : null}
      <RequestWorkflowPanel
        request={requestForPanel}
        viewer="customer"
        userId={authUser.id}
        legacyQuotesEnabled={!marketplaceNative}
        chatAuthorized={chatAuthorized}
      />
    </div>
  );
}
