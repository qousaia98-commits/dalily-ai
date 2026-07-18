import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireAuthUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/queries";
import { getRequestDetail } from "@/lib/service-requests/queries";
import { RequestWorkflowPanel } from "@/components/marketplace/request-workflow-panel";
import {
  acceptServiceRequestAction,
  rejectServiceRequestAction,
} from "@/actions/service-request.actions";
import { PendingRequestActions } from "@/components/business/pending-request-actions";

type PageProps = { params: Promise<{ requestId: string }> };

export default async function BusinessRequestDetailPage({ params }: PageProps) {
  const { requestId } = await params;
  const t = await getTranslations("business.requests");
  const authUser = await requireAuthUser();
  const provider = await getOwnedProvider(authUser.id);
  if (!provider) notFound();

  const request = await getRequestDetail(requestId);
  if (!request || request.provider_id !== provider.id) notFound();

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 overflow-x-hidden animate-fade-in px-1">
      <p className="sr-only">{t("title")}</p>
      {request.status === "pending" ? (
        <PendingRequestActions
          requestId={request.id}
          acceptAction={acceptServiceRequestAction}
          rejectAction={rejectServiceRequestAction}
        />
      ) : null}
      <RequestWorkflowPanel
        request={request}
        viewer="business"
        userId={authUser.id}
        providerId={provider.id}
      />
    </div>
  );
}
