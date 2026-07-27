/**
 * Public-safe reputation views — never include internal scores.
 */

import { createClient } from "@/lib/supabase/server";
import { publicTrustLevel } from "@/lib/reputation/levels";
import type { PublicTrustView, TrustLevel, ReputationTrend } from "@/lib/reputation/types";

export async function getPublicTrustView(
  providerId: string,
  locale: "en" | "ar" = "en",
): Promise<PublicTrustView | null> {
  const supabase = await createClient();

  const [{ data: cache }, { data: explanations }, { data: provider }] =
    await Promise.all([
      supabase
        .from("provider_reputation_cache")
        .select("trust_level, trend, quality_label")
        .eq("provider_id", providerId)
        .maybeSingle(),
      supabase
        .from("provider_reputation_explanations")
        .select("explanation_key, body, polarity, audience, locale, sort_order")
        .eq("provider_id", providerId)
        .eq("audience", "public")
        .eq("polarity", "positive")
        .eq("locale", locale)
        .order("sort_order", { ascending: true })
        .limit(3),
      supabase
        .from("providers")
        .select("verification_status")
        .eq("id", providerId)
        .maybeSingle(),
    ]);

  const rawLevel = (cache?.trust_level as TrustLevel | null) ?? null;
  const fromLabel = qualityLabelToLevel(cache?.quality_label ?? null);
  const level = publicTrustLevel(rawLevel ?? fromLabel ?? "new_provider");

  return {
    providerId,
    trustLevel: level,
    trend: ((cache?.trend as ReputationTrend) ?? "stable") as ReputationTrend,
    explanations: (explanations ?? []).map((e) => ({
      key: e.explanation_key ?? "note",
      body: e.body,
    })),
    verificationBadges:
      provider?.verification_status === "verified" ? ["verified"] : [],
  };
}

function qualityLabelToLevel(label: string | null): TrustLevel | null {
  if (!label) return null;
  switch (label) {
    case "Excellent":
      return "excellent";
    case "Very good":
      return "very_good";
    case "Good":
      return "good";
    case "Fair":
      return "developing";
    case "Needs improvement":
      return "needs_attention";
    default:
      return null;
  }
}
