/**
 * Enterprise AI platform engine — flag-gated orchestration entry.
 */

import {
  isAiAnalyticsEnabled,
  isAiAssistantEnabled,
  isAiFraudEnabled,
  isAiModerationEnabled,
  isAiPlatformEnabled,
  isAiPricingEnabled,
  isAiTranslationEnabled,
} from "@/lib/config/feature-flags";
import {
  resolveFallbackLlmProviderId,
  resolveLlmProviderId,
  listRegisteredLlmProviders,
} from "@/domains/ai/providers";
import { runCustomerAssistant, runProviderAssistant } from "@/domains/ai/assistant/service";
import { estimatePriceRange } from "@/domains/ai/pricing/service";
import { translateText } from "@/domains/ai/translation/service";
import { analyzeEntityFraud } from "@/domains/ai/fraud/service";
import { recommendModeration } from "@/domains/ai/moderation/service";
import {
  summarizeArbitrary,
  summarizeConversation,
} from "@/domains/ai/analytics/summaries";
import { getMarketplaceInsightsOverview } from "@/domains/ai/analytics/insights";
import { queryKnowledge } from "@/domains/ai/knowledge/service";
import { suggestScheduleHints } from "@/domains/ai/scheduler/service";
import { getMatchingPublicApi } from "@/domains/ai/matching/service";
import type { AiPlatformHealthView } from "@/domains/ai/shared/types";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getAiPlatformStatus(): Promise<{
  enabled: boolean;
  providers: string[];
  primary: string;
  fallback: string;
  flags: AiPlatformHealthView["flags"];
}> {
  return {
    enabled: isAiPlatformEnabled(),
    providers: listRegisteredLlmProviders(),
    primary: resolveLlmProviderId(),
    fallback: resolveFallbackLlmProviderId(),
    flags: {
      assistant: isAiAssistantEnabled(),
      translation: isAiTranslationEnabled(),
      pricing: isAiPricingEnabled(),
      analytics: isAiAnalyticsEnabled(),
      fraud: isAiFraudEnabled(),
      moderation: isAiModerationEnabled(),
    },
  };
}

export async function getAiPlatformHealth(): Promise<AiPlatformHealthView> {
  const status = await getAiPlatformStatus();
  const usage = {
    requests: 0,
    errors: 0,
    avgLatencyMs: null as number | null,
    fallbacks: 0,
  };
  let openFraudAlerts = 0;
  let openModerationReports = 0;

  if (status.enabled) {
    try {
      const admin = createAdminClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = admin as any;
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: rows } = await client
        .from("ai_platform_usage")
        .select("success, latency_ms, fallback_used")
        .gte("created_at", since)
        .limit(2000);
      const list = (rows ?? []) as Array<{
        success: boolean;
        latency_ms: number | null;
        fallback_used: boolean;
      }>;
      usage.requests = list.length;
      usage.errors = list.filter((r) => !r.success).length;
      usage.fallbacks = list.filter((r) => r.fallback_used).length;
      const lat = list
        .map((r) => r.latency_ms)
        .filter((n): n is number => typeof n === "number");
      usage.avgLatencyMs = lat.length
        ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length)
        : null;

      const { count: fraudCount } = await client
        .from("fraud_events")
        .select("id", { count: "exact", head: true })
        .is("resolved_at", null)
        .limit(1);
      openFraudAlerts = fraudCount ?? 0;

      const { count: modCount } = await client
        .from("ai_moderation_reports")
        .select("id", { count: "exact", head: true })
        .eq("status", "open");
      openModerationReports = modCount ?? 0;
    } catch {
      /* soft */
    }
  }

  return {
    platformEnabled: status.enabled,
    primaryProvider: status.primary as AiPlatformHealthView["primaryProvider"],
    fallbackProvider: status.fallback as AiPlatformHealthView["fallbackProvider"],
    flags: status.flags,
    usage24h: usage,
    openFraudAlerts,
    openModerationReports,
  };
}

export const aiPlatformEngine = {
  getStatus: getAiPlatformStatus,
  getHealth: getAiPlatformHealth,
  runCustomerAssistant,
  runProviderAssistant,
  estimatePriceRange,
  translateText,
  analyzeEntityFraud,
  recommendModeration,
  summarizeConversation,
  summarizeArbitrary,
  getMarketplaceInsightsOverview,
  queryKnowledge,
  suggestScheduleHints,
  getMatchingPublicApi,
};
