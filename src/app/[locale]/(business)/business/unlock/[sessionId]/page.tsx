import { notFound, redirect } from "next/navigation";
import { requireAuthUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/database";
import { isUnlockDevBypassEnabled, isUnlockPaymentsV2Enabled, isUnlockV2Enabled } from "@/lib/config/feature-flags";
import { getUnlockSessionById } from "@/domains/unlock/session";
import { getActiveUnlockFeePayment } from "@/domains/payment/unlock-fee";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProviderUnlockPanel } from "@/components/business/provider-unlock-panel";
import { Link } from "@/lib/i18n/routing";
import { getTranslations } from "next-intl/server";
import { MarketplaceRealtimeBridge } from "@/components/marketplace/realtime-bridge";
import { MarkNavChannelSeen } from "@/components/shared/mark-nav-channel-seen";

type PageProps = { params: Promise<{ sessionId: string }> };

export default async function BusinessUnlockDetailPage({ params }: PageProps) {
  if (!isUnlockV2Enabled()) redirect("/business/opportunities");

  const { sessionId } = await params;
  const t = await getTranslations("unlockFlow.provider");
  const authUser = await requireAuthUser();
  const provider = await getOwnedProvider(authUser.id);
  if (!provider) notFound();

  const session = await getUnlockSessionById(sessionId);
  if (!session || session.providerId !== provider.id) notFound();

  const paymentsEnabled = isUnlockPaymentsV2Enabled();
  const initialPayment = paymentsEnabled
    ? await getActiveUnlockFeePayment(sessionId)
    : null;

  const admin = createAdminClient();
  const { data: request } = await admin
    .from("service_requests")
    .select("title, intent_text, description")
    .eq("id", session.serviceRequestId)
    .maybeSingle();

  const title =
    (request?.title as string) ||
    (request?.intent_text as string) ||
    (request?.description as string) ||
    session.serviceRequestId;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 animate-fade-in">
      <MarkNavChannelSeen channel="unlock" />
      <MarketplaceRealtimeBridge
        userId={authUser.id}
        providerId={provider.id}
        requestId={session.serviceRequestId}
      />
      <Link href="/business/unlock" className="text-sm text-muted-foreground underline">
        {t("back")}
      </Link>
      <ProviderUnlockPanel
        session={session}
        requestTitle={title}
        allowDevBypass={isUnlockDevBypassEnabled()}
        paymentsEnabled={paymentsEnabled}
        initialPayment={initialPayment}
      />
    </div>
  );
}
