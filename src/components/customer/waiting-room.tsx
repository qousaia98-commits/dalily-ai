import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ServiceRequestDetail } from "@/lib/service-requests/types";
import type { MatchPoolSummary } from "@/domains/matching";
import type { MarketplaceOfferView, OfferClarificationView } from "@/domains/offer/types";
import type { PublicOfferDecisionBoard } from "@/domains/offer/recommendation";
import type { ReleasedContact, UnlockSessionView } from "@/domains/unlock/types";
import { CustomerOfferBoard } from "@/components/customer/customer-offer-board";
import { CustomerUnlockStatus } from "@/components/customer/customer-unlock-status";
import { CustomerAssistantPanel } from "@/components/assistant/customer-assistant-panel";
import type { CustomerAssistantView } from "@/lib/ai/assistant/types";
import {
  WaitTimeCard,
  PredictiveNotificationsList,
} from "@/components/predictive/predictive-widgets";
import type {
  WaitTimeEstimate,
  PredictiveNotification,
} from "@/domains/forecast";
import { AutomationSuggestionsList } from "@/components/automation/automation-widgets";
import type { AutomationSuggestion } from "@/lib/ai/automation/types";
import { WorkflowSwitchHint } from "@/components/customer/workflow-switch-hint";
import { isDualMarketplaceEnabled } from "@/lib/config/feature-flags";
import {
  EmptyOffersIllustration,
  RequestPublishedIllustration,
} from "@/components/illustrations";
import { GeometricPattern } from "@/components/brand/geometric-pattern";
import { WaitingRoomSkeleton } from "@/components/shared/skeletons";

export async function WaitingRoom({
  request,
  state,
  matchSummary = null,
  offers = [],
  selectionOfferId = null,
  clarificationsByOffer = {},
  decisionBoard = null,
  unlockSession = null,
  releasedContact = null,
  conversationId = null,
  assistant = null,
  waitEstimate = null,
  predictiveNotifications = [],
  automationSuggestions = [],
}: {
  request: ServiceRequestDetail | null;
  state: "loading" | "ready" | "empty" | "error";
  matchSummary?: MatchPoolSummary | null;
  offers?: MarketplaceOfferView[];
  selectionOfferId?: string | null;
  clarificationsByOffer?: Record<string, OfferClarificationView[]>;
  decisionBoard?: PublicOfferDecisionBoard | null;
  unlockSession?: UnlockSessionView | null;
  releasedContact?: ReleasedContact | null;
  conversationId?: string | null;
  assistant?: CustomerAssistantView | null;
  waitEstimate?: WaitTimeEstimate | null;
  predictiveNotifications?: PredictiveNotification[];
  automationSuggestions?: AutomationSuggestion[];
}) {
  const t = await getTranslations("intentFlow.waiting");

  if (state === "loading") {
    return <WaitingRoomSkeleton label={t("loading")} />;
  }

  if (state === "error" || !request) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-12 text-center">
        <h1 className="text-xl font-semibold">{t("errorTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("errorBody")}</p>
        <Button asChild>
          <Link href="/request/new">{t("startNew")}</Link>
        </Button>
      </div>
    );
  }

  const assignedCount = matchSummary?.assignedCount ?? 0;
  const matchingRan = Boolean(matchSummary);
  const insufficient =
    matchingRan &&
    (assignedCount === 0 || matchSummary?.status === "insufficient_supply");
  const hasOffers = offers.length > 0;

  return (
    <div className="mx-auto max-w-lg space-y-6 py-10">
      <div className="space-y-3 text-center">
        <div className="mx-auto size-28">
          <RequestPublishedIllustration />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        {t("trustNotBroadcast")}
      </div>

      {assistant ? (
        <CustomerAssistantPanel
          view={assistant}
          serviceRequestId={request.id}
        />
      ) : null}

      {waitEstimate ? <WaitTimeCard estimate={waitEstimate} /> : null}
      {predictiveNotifications.length > 0 ? (
        <PredictiveNotificationsList items={predictiveNotifications} />
      ) : null}
      {automationSuggestions.length > 0 ? (
        <AutomationSuggestionsList items={automationSuggestions} />
      ) : null}

      {(!hasOffers || insufficient) && isDualMarketplaceEnabled() ? (
        <WorkflowSwitchHint from="publish" />
      ) : null}

      <CustomerUnlockStatus
        session={unlockSession}
        contact={releasedContact}
        conversationId={conversationId}
      />

      {hasOffers ? (
        <CustomerOfferBoard
          offers={offers}
          selectionOfferId={selectionOfferId}
          clarificationsByOffer={clarificationsByOffer}
          decisionBoard={decisionBoard}
        />
      ) : assignedCount > 0 ? (
        <div className="rounded-2xl border border-border px-5 py-8 text-center">
          <Bell className="mx-auto mb-3 size-8 text-muted-foreground" aria-hidden />
          <p className="font-medium">
            {t("matchedTitle", { count: assignedCount })}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{t("matchedBody")}</p>
        </div>
      ) : !unlockSession && !releasedContact ? (
        <div className="relative overflow-hidden rounded-2xl border border-dashed border-border px-5 py-10 text-center">
          <GeometricPattern
            className="absolute inset-0 size-full"
            opacity={0.05}
            density="sparse"
          />
          <div className="relative space-y-3">
            <div className="mx-auto size-28">
              <EmptyOffersIllustration />
            </div>
            <p className="font-medium">
              {insufficient ? t("undersupplyTitle") : t("emptyTitle")}
            </p>
            <p className="text-sm text-muted-foreground">
              {insufficient ? t("undersupplyBody") : t("emptyBody")}
            </p>
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-border/60 px-4 py-3 text-sm">
        <p className="font-medium text-foreground">{t("requestLabel")}</p>
        <p className="mt-1 text-muted-foreground">{request.intent_text || request.description}</p>
        {request.urgency === "emergency" && (
          <p className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
            {t("emergencyBadge")}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild variant="outline" className="flex-1">
          <Link href="/account/requests">{t("myRequests")}</Link>
        </Button>
        <Button asChild className="flex-1">
          <Link href="/request/new">{t("startNew")}</Link>
        </Button>
      </div>
    </div>
  );
}
