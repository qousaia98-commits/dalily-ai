import { redirect } from "next/navigation";
import {
  listOffersForRequest,
  getActiveSelectionForRequest,
  listClarifications,
  loadOfferDecisionBoardForCustomer,
} from "@/domains/offer";
import {
  isCustomerIntentFlowV2Enabled,
  isMatchingV2Enabled,
  isOffersV2Enabled,
  isOfferDecisionEngineEnabled,
  isUnlockV2Enabled,
  isChatAuthV2Enabled,
} from "@/lib/config/feature-flags";
import { getAuthUser } from "@/lib/auth/session";
import { getRequestDetail } from "@/lib/service-requests/queries";
import { getMatchPoolSummaryForRequest } from "@/domains/matching";
import {
  getUnlockSessionForSelection,
  getReleasedContactForCustomer,
} from "@/domains/unlock";
import { createAdminClient } from "@/lib/supabase/admin";
import { WaitingRoom } from "@/components/customer/waiting-room";
import { MarketplaceRealtimeBridge } from "@/components/marketplace/realtime-bridge";
import {
  isAiEngineV7Enabled,
  isPredictiveEngineEnabled,
  isAiEngineV9Enabled,
  isEmergencyDispatchEnabled,
  isMultiServiceProjectsEnabled,
} from "@/lib/config/feature-flags";
import type { WaitTimeEstimate, PredictiveNotification } from "@/domains/forecast";
import type { AutomationSuggestion } from "@/lib/ai/automation/types";
import { EmergencyStatusPanel } from "@/components/customer/emergency-status";
import type { EmergencyDispatchView } from "@/lib/ai/dispatch/emergency";
import { ProjectDashboardPanel } from "@/components/customer/project-dashboard";
import type { ProjectDashboard } from "@/lib/projects";

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

  const decisionBoard =
    offersEnabled && isOfferDecisionEngineEnabled() && offers.length > 0
      ? await loadOfferDecisionBoardForCustomer({
          requestId,
          customerId: authUser.id,
          offers,
        })
      : null;

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

  let assistant = null;
  let waitEstimate: WaitTimeEstimate | null = null;
  let predictiveNotes: PredictiveNotification[] = [];
  let automationSuggestions: AutomationSuggestion[] = [];

  if (isAiEngineV7Enabled()) {
    const { buildCustomerAssistant } = await import("@/lib/ai/assistant/customer");
    assistant = await buildCustomerAssistant({
      serviceRequestId: request.id,
      customerId: authUser.id,
      intentText: request.intent_text || request.description || request.title,
      urgency: request.urgency,
      locationText: request.location_text,
      hasPhoto: (request.imagePaths?.length ?? 0) > 0,
      hasLocation: Boolean(request.city_id || request.location_text),
      offers,
      selectionOfferId: selection?.offerId ?? null,
      hasUnlock: Boolean(unlockSession || releasedContact),
      conversationId,
      isCompleted: ["completed", "confirmed", "reviewed"].includes(request.status),
      hoursSinceActivity: request.updated_at
        ? (Date.now() - new Date(request.updated_at).getTime()) / 3_600_000
        : null,
    });
  }

  if (isPredictiveEngineEnabled()) {
    const catSlug =
      assistant?.context.confirmedFacts.categorySlug ??
      null;
    let resolvedSlug = catSlug;
    if (!resolvedSlug && request.category_id) {
      const admin = createAdminClient();
      const { data: cat } = await admin
        .from("categories")
        .select("slug")
        .eq("id", request.category_id)
        .maybeSingle();
      resolvedSlug = (cat?.slug as string) ?? "electrical";
    }
    resolvedSlug = resolvedSlug || "electrical";

    const {
      estimateWaitTime,
      forecastDemand,
      detectMarketplaceBalances,
      buildCustomerPredictiveNotifications,
      persistPredictiveNotifications,
    } = await import("@/domains/forecast");

    waitEstimate = await estimateWaitTime({
      categorySlug: resolvedSlug,
      cityId: request.city_id,
    });

    const [demand, balances] = await Promise.all([
      forecastDemand({ horizonDays: 3, categories: [resolvedSlug] }),
      detectMarketplaceBalances(),
    ]);
    predictiveNotes = await persistPredictiveNotifications(
      buildCustomerPredictiveNotifications({
        demand,
        balances,
        categorySlug: resolvedSlug,
      }),
      { userId: authUser.id },
    );
  }

  if (isAiEngineV9Enabled()) {
    const { runCustomerAutomations } = await import(
      "@/lib/ai/automation/customer"
    );
    let categorySlug: string | null = null;
    if (request.category_id) {
      const admin = createAdminClient();
      const { data: cat } = await admin
        .from("categories")
        .select("slug")
        .eq("id", request.category_id)
        .maybeSingle();
      categorySlug = (cat?.slug as string) ?? null;
    }
    automationSuggestions = await runCustomerAutomations({
      userId: authUser.id,
      serviceRequestId: request.id,
      hasPhoto: (request.imagePaths?.length ?? 0) > 0,
      hasAddress: Boolean(request.city_id || request.location_text),
      hoursSinceActivity: request.updated_at
        ? (Date.now() - new Date(request.updated_at).getTime()) / 3_600_000
        : null,
      status: request.status,
      isCompleted: ["completed", "confirmed", "reviewed"].includes(
        request.status,
      ),
      hasReview: Boolean(request.review),
      categorySlug,
    });
  }

  let emergencyDispatch: EmergencyDispatchView | null = null;
  if (
    isEmergencyDispatchEnabled() &&
    request.urgency === "emergency"
  ) {
    const { getEmergencyDispatchView, activateEmergencyDispatch } = await import(
      "@/lib/ai/dispatch/emergency"
    );
    emergencyDispatch = await getEmergencyDispatchView(requestId);
    if (!emergencyDispatch) {
      await activateEmergencyDispatch({
        serviceRequestId: requestId,
        customerId: authUser.id,
      });
      emergencyDispatch = await getEmergencyDispatchView(requestId);
    }
  }

  let projectDash: ProjectDashboard | null = null;
  if (isMultiServiceProjectsEnabled() && request.urgency !== "emergency") {
    const { getProjectByRootRequest, getProjectDashboard } = await import(
      "@/lib/projects"
    );
    const linked = await getProjectByRootRequest(requestId);
    if (linked) {
      projectDash = await getProjectDashboard(linked.id, { refresh: true });
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6">
      <MarketplaceRealtimeBridge userId={authUser.id} requestId={requestId} />
      {emergencyDispatch ? (
        <div className="mb-4">
          <EmergencyStatusPanel dispatch={emergencyDispatch} />
        </div>
      ) : null}
      {projectDash ? (
        <div className="mb-4">
          <ProjectDashboardPanel project={projectDash} compact />
        </div>
      ) : null}
      <WaitingRoom
        request={request}
        state={state}
        matchSummary={matchSummary}
        offers={offers}
        selectionOfferId={selection?.offerId ?? null}
        clarificationsByOffer={clarificationsByOffer}
        decisionBoard={decisionBoard}
        unlockSession={unlockSession}
        releasedContact={releasedContact}
        conversationId={conversationId}
        assistant={assistant}
        waitEstimate={waitEstimate}
        predictiveNotifications={predictiveNotes}
        automationSuggestions={automationSuggestions}
      />
    </main>
  );
}
