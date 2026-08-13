/**
 * Moderation recommendations — never auto-enforce.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  isAiModerationEnabled,
  isAiPlatformEnabled,
} from "@/lib/config/feature-flags";
import { completeWithFallback } from "@/domains/ai/providers";
import { scrubAiText } from "@/lib/ai/privacy/scrub";
import type { AiModerationView } from "@/domains/ai/shared/types";

export async function recommendModeration(input: {
  targetType:
    | "message"
    | "review"
    | "image"
    | "description"
    | "portfolio"
    | "offer"
    | "profile"
    | "other";
  targetId?: string | null;
  text: string;
  actorUserId?: string | null;
  persist?: boolean;
}): Promise<AiModerationView | null> {
  if (!isAiPlatformEnabled() || !isAiModerationEnabled()) return null;

  const scrubbed = scrubAiText(input.text).slice(0, 2000);
  const result = await completeWithFallback({
    feature: "moderation",
    actorUserId: input.actorUserId,
    jsonMode: true,
    messages: [
      {
        role: "system",
        content:
          'Analyze for hate, spam, scam, harassment, illegal content. Respond JSON: {"riskLevel":"low|medium|high|critical","categories":[],"reasons":[],"suggestedAction":"allow|review|hide|escalate","confidence":0-1}. Recommendations only — never ban.',
      },
      {
        role: "user",
        content: JSON.stringify({
          targetType: input.targetType,
          text: scrubbed,
        }),
      },
    ],
  });

  let view: AiModerationView = {
    riskLevel: "low",
    categories: [],
    reasons: ["Unable to analyze — default allow with review"],
    suggestedAction: "review",
    confidence: 0.3,
    neverAutoEnforce: true,
  };

  if (result.ok) {
    try {
      const parsed = JSON.parse(result.content) as Partial<AiModerationView>;
      view = {
        riskLevel: (parsed.riskLevel as AiModerationView["riskLevel"]) ?? "low",
        categories: Array.isArray(parsed.categories)
          ? parsed.categories.map(String)
          : [],
        reasons: Array.isArray(parsed.reasons) ? parsed.reasons.map(String) : [],
        suggestedAction:
          (parsed.suggestedAction as AiModerationView["suggestedAction"]) ??
          "review",
        confidence:
          typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
        neverAutoEnforce: true,
      };
    } catch {
      /* keep default */
    }
  }

  if (input.persist !== false) {
    try {
      const admin = createAdminClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any).from("ai_moderation_reports").insert({
        target_type: input.targetType,
        target_id: input.targetId ?? null,
        risk_level: view.riskLevel,
        categories: view.categories,
        reasons: view.reasons,
        suggested_action: view.suggestedAction,
        confidence: view.confidence,
        provider_id: result.ok ? result.providerId : "none",
        actor_user_id: input.actorUserId ?? null,
      });
    } catch {
      /* soft */
    }
  }

  return view;
}
