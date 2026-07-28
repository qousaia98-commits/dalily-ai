import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireAuthUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/database";
import { getProviderVisibleRequestDetail } from "@/lib/service-requests/queries";
import { RequestWorkflowPanel } from "@/components/marketplace/request-workflow-panel";
import {
  acceptServiceRequestAction,
  rejectServiceRequestAction,
} from "@/actions/service-request.actions";
import { PendingRequestActions } from "@/components/business/pending-request-actions";
import { isOffersV2Enabled } from "@/lib/config/feature-flags";
import { canAccessFullChat } from "@/domains/chat";
import { createAdminClient } from "@/lib/supabase/admin";
import { isChatAuthV2Enabled } from "@/lib/config/feature-flags";

type PageProps = { params: Promise<{ requestId: string }> };

export default async function BusinessRequestDetailPage({ params }: PageProps) {
  const { requestId } = await params;
  const t = await getTranslations("business.requests");
  const authUser = await requireAuthUser();
  const provider = await getOwnedProvider(authUser.id);
  if (!provider) notFound();

  // Marketplace v2: never gate on service_requests.provider_id (intentionally null).
  const request = await getProviderVisibleRequestDetail(requestId, provider.id);
  if (!request) notFound();

  const marketplaceNative =
    isOffersV2Enabled() && (request.lifecycle_version ?? 1) >= 2;

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
    <div className="mx-auto w-full max-w-4xl space-y-4 overflow-x-hidden animate-fade-in px-1">
      <p className="sr-only">{t("title")}</p>
      {request.status === "pending" && !marketplaceNative ? (
        <PendingRequestActions
          requestId={request.id}
          acceptAction={acceptServiceRequestAction}
          rejectAction={rejectServiceRequestAction}
        />
      ) : null}
      <RequestWorkflowPanel
        request={requestForPanel}
        viewer="business"
        userId={authUser.id}
        providerId={provider.id}
        legacyQuotesEnabled={!marketplaceNative}
        chatAuthorized={chatAuthorized}
      />
    </div>
  );
}
