import { notFound, redirect } from "next/navigation";
import { requireAuthUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/database";
import {
  isUnlockDevBypassEnabled,
  isUnlockPaymentsV2Enabled,
  isUnlockV2Enabled,
  isProviderMonetizationEnabled,
} from "@/lib/config/feature-flags";
import { getUnlockSessionById } from "@/domains/unlock/session";
import { getActiveUnlockFeePayment } from "@/domains/payment/unlock-fee";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProviderUnlockPanel } from "@/components/business/provider-unlock-panel";
import { Link } from "@/lib/i18n/routing";
import { getTranslations } from "next-intl/server";
import { MarketplaceRealtimeBridge } from "@/components/marketplace/realtime-bridge";
import { MarkNavChannelSeen } from "@/components/shared/mark-nav-channel-seen";
import {
  ensureMonthlyUsage,
  ensureProviderMonetizationPlan,
} from "@/lib/monetization";

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
  const monetizationEnabled = isProviderMonetizationEnabled();
  const initialPayment = paymentsEnabled
    ? await getActiveUnlockFeePayment(sessionId)
    : null;

  let includedRemaining = 0;
  let pricingQuote: {
    estimatedProjectValueUsd: number | null;
    estimatedDurationHours: number | null;
    potentialRevenueUsd: number | null;
  } | null = null;

  if (monetizationEnabled) {
    const plan = await ensureProviderMonetizationPlan(provider.id);
    if (plan.billingMode === "business" && plan.status === "active") {
      const usage = await ensureMonthlyUsage(provider.id);
      includedRemaining = usage.remaining;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any;
    const { data: hist } = await admin
      .from("lead_pricing_history")
      .select(
        "estimated_project_value_usd, estimated_duration_hours, potential_revenue_usd",
      )
      .eq("unlock_session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (hist) {
      pricingQuote = {
        estimatedProjectValueUsd: hist.estimated_project_value_usd
          ? Number(hist.estimated_project_value_usd)
          : null,
        estimatedDurationHours: hist.estimated_duration_hours
          ? Number(hist.estimated_duration_hours)
          : null,
        potentialRevenueUsd: hist.potential_revenue_usd
          ? Number(hist.potential_revenue_usd)
          : null,
      };
    } else {
      const { data: byReq } = await admin
        .from("lead_pricing_history")
        .select(
          "estimated_project_value_usd, estimated_duration_hours, potential_revenue_usd",
        )
        .eq("service_request_id", session.serviceRequestId)
        .eq("provider_id", provider.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (byReq) {
        pricingQuote = {
          estimatedProjectValueUsd: byReq.estimated_project_value_usd
            ? Number(byReq.estimated_project_value_usd)
            : null,
          estimatedDurationHours: byReq.estimated_duration_hours
            ? Number(byReq.estimated_duration_hours)
            : null,
          potentialRevenueUsd: byReq.potential_revenue_usd
            ? Number(byReq.potential_revenue_usd)
            : null,
        };
      }
    }
  }

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
        monetizationEnabled={monetizationEnabled}
        includedRemaining={includedRemaining}
        pricingQuote={pricingQuote}
      />
    </div>
  );
}
