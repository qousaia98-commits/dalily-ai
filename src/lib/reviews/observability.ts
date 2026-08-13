/**
 * Review observability events → search learning / analytics pipeline.
 */

import { getAuthUser } from "@/lib/auth/session";
import { logLearningEvent } from "@/lib/search/learning";

export type ReviewObservabilityEvent =
  | "review_submitted"
  | "review_edited"
  | "review_flagged"
  | "review_approved"
  | "review_hidden"
  | "provider_responded"
  | "ai_analysis_completed"
  | "media_uploaded"
  | "media_moderation_hook";

export async function trackReviewEvent(
  event: ReviewObservabilityEvent,
  metadata: Record<string, unknown> & { providerId?: string | null; reviewId?: string },
): Promise<void> {
  try {
    const user = await getAuthUser();
    await logLearningEvent({
      eventType:
        event === "review_submitted" || event === "review_edited"
          ? "review_submitted"
          : "provider_clicked",
      providerId: (metadata.providerId as string | null | undefined) ?? null,
      customerId: user?.id ?? null,
      metadata: {
        source: "reviews_reputation",
        reviewEvent: event,
        ...metadata,
      },
    });
  } catch {
    // never block review flow on analytics
  }
}
