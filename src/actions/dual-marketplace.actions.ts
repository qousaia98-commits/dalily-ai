"use server";

import { getAuthUser } from "@/lib/auth/session";
import { isDualMarketplaceEnabled } from "@/lib/config/feature-flags";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import { recommendMarketplacePath } from "@/lib/marketplace/dual/recommend-path";
import type { MarketplacePath } from "@/lib/marketplace/dual/types";
import type { AiLearningEventType } from "@/lib/ai/learning/types";

export async function getMarketplacePathRecommendationAction(intentText: string) {
  if (!isDualMarketplaceEnabled()) {
    return null;
  }
  return recommendMarketplacePath(intentText);
}

export async function recordDualMarketplaceChoiceAction(input: {
  path: MarketplacePath;
  recommendedPath: MarketplacePath | null;
  intentText?: string;
  serviceRequestId?: string | null;
}): Promise<{ ok: boolean }> {
  if (!isDualMarketplaceEnabled()) return { ok: false };

  const authUser = await getAuthUser();
  const accepted =
    input.recommendedPath != null && input.recommendedPath === input.path;

  const events: Array<{
    eventType: AiLearningEventType;
    metadata: Record<string, unknown>;
  }> = [
    {
      eventType: "marketplace_mode_chosen",
      metadata: {
        path: input.path,
        recommendedPath: input.recommendedPath,
        acceptedRecommendation: accepted,
      },
    },
    {
      eventType:
        input.path === "publish"
          ? "request_published"
          : "provider_contacted_directly",
      metadata: { path: input.path },
    },
  ];

  if (input.recommendedPath) {
    events.push({
      eventType: accepted
        ? "ai_path_recommendation_accepted"
        : "ai_path_recommendation_ignored",
      metadata: {
        recommended: input.recommendedPath,
        chosen: input.path,
      },
    });
  }

  for (const e of events) {
    void emitAiLearningEvent({
      eventType: e.eventType,
      customerId: authUser?.id ?? null,
      serviceRequestId: input.serviceRequestId ?? null,
      metadata: {
        ...e.metadata,
        intentLength: input.intentText?.trim().length ?? 0,
      },
    });
  }

  return { ok: true };
}
