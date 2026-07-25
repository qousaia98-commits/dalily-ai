import { redirect } from "next/navigation";
import { isCustomerIntentFlowV2Enabled } from "@/lib/config/feature-flags";
import { getAuthUser } from "@/lib/auth/session";
import { getRequestDetail } from "@/lib/service-requests/queries";
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

  // Offers arrive in Sprint 4; matching in Sprint 3 — empty is expected and honest.
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6">
      <WaitingRoom request={request} state="empty" />
    </main>
  );
}
