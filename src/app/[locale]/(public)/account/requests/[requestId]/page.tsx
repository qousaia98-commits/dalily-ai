import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/lib/i18n/routing";
import { getAuthUser } from "@/lib/auth/session";
import { getRequestDetail } from "@/lib/service-requests/queries";
import { RequestWorkflowPanel } from "@/components/marketplace/request-workflow-panel";

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

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-8 sm:px-6 animate-fade-in">
      <p className="sr-only">{t("title")}</p>
      <RequestWorkflowPanel request={request} viewer="customer" userId={authUser.id} />
    </div>
  );
}
