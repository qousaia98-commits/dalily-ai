/**
 * Admin AI Platform overview — aggregates existing centers.
 */

import { getAiPlatformHealth } from "@/domains/ai/engine/platform-engine";
import { getMarketplaceInsightsOverview } from "@/domains/ai/analytics/insights";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isAiOpsEnabled,
  isAiPlatformEnabled,
  isFraudDetectionEnabled,
  isForecastEngineEnabled,
  isAiDynamicPricingEnabled,
  isSmartMatchingEngineEnabled,
  isAiMarketplaceIntelligenceEnabled,
} from "@/lib/config/feature-flags";

export type AiAdminCenterOverview = {
  health: Awaited<ReturnType<typeof getAiPlatformHealth>>;
  insights: Awaited<ReturnType<typeof getMarketplaceInsightsOverview>>;
  linkedCenters: Array<{ id: string; href: string; enabled: boolean }>;
  recentUsage: Array<{
    feature: string;
    providerId: string;
    success: boolean;
    latencyMs: number | null;
    createdAt: string;
  }>;
  recentModeration: Array<{
    id: string;
    riskLevel: string;
    suggestedAction: string;
    status: string;
    createdAt: string;
  }>;
};

export async function getAiAdminCenterOverview(): Promise<AiAdminCenterOverview> {
  const health = await getAiPlatformHealth();
  const insights = await getMarketplaceInsightsOverview();

  const linkedCenters = [
    { id: "ai-ops", href: "/admin/ai-ops", enabled: isAiOpsEnabled() },
    { id: "fraud", href: "/admin/fraud", enabled: isFraudDetectionEnabled() },
    {
      id: "forecast",
      href: "/admin/forecast",
      enabled: isForecastEngineEnabled(),
    },
    {
      id: "pricing",
      href: "/admin/pricing",
      enabled: isAiDynamicPricingEnabled(),
    },
    {
      id: "matching",
      href: "/admin/matching",
      enabled: isSmartMatchingEngineEnabled(),
    },
    {
      id: "marketplace",
      href: "/admin/marketplace-intelligence",
      enabled: isAiMarketplaceIntelligenceEnabled(),
    },
    {
      id: "predictions",
      href: "/admin/ai-predictions",
      enabled: isAiPlatformEnabled(),
    },
    {
      id: "automation",
      href: "/admin/ai-automation",
      enabled: isAiPlatformEnabled(),
    },
  ];

  const recentUsage: AiAdminCenterOverview["recentUsage"] = [];
  const recentModeration: AiAdminCenterOverview["recentModeration"] = [];

  if (isAiPlatformEnabled()) {
    try {
      const admin = createAdminClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = admin as any;
      const { data: usage } = await client
        .from("ai_platform_usage")
        .select("feature, provider_id, success, latency_ms, created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      for (const row of (usage ?? []) as Array<Record<string, unknown>>) {
        recentUsage.push({
          feature: String(row.feature),
          providerId: String(row.provider_id),
          success: Boolean(row.success),
          latencyMs: row.latency_ms != null ? Number(row.latency_ms) : null,
          createdAt: String(row.created_at),
        });
      }

      const { data: mods } = await client
        .from("ai_moderation_reports")
        .select("id, risk_level, suggested_action, status, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      for (const row of (mods ?? []) as Array<Record<string, unknown>>) {
        recentModeration.push({
          id: String(row.id),
          riskLevel: String(row.risk_level),
          suggestedAction: String(row.suggested_action),
          status: String(row.status),
          createdAt: String(row.created_at),
        });
      }
    } catch {
      /* soft */
    }
  }

  return { health, insights, linkedCenters, recentUsage, recentModeration };
}
