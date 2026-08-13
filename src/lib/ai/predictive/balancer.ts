/**
 * Demand / supply balancer — detect imbalance and recommend actions.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.types";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import type { BalanceAction, BalanceSeverity, MarketplaceBalance } from "./types";

function severityFromRatio(ratio: number): BalanceSeverity {
  // ratio = open_requests / max(1, available_providers)
  if (ratio >= 4) return "critical_shortage";
  if (ratio >= 2) return "shortage";
  if (ratio >= 1.3) return "mild";
  if (ratio <= 0.35) return "oversupply";
  return "balanced";
}

function actionsFor(severity: BalanceSeverity): BalanceAction[] {
  switch (severity) {
    case "critical_shortage":
      return ["expand_radius", "increase_pool", "priority_dispatch", "public_marketplace", "notify_providers"];
    case "shortage":
      return ["expand_radius", "increase_pool", "notify_providers"];
    case "mild":
      return ["expand_radius", "notify_providers"];
    case "oversupply":
      return ["throttle_intake"];
    default:
      return [];
  }
}

export async function detectMarketplaceBalances(): Promise<MarketplaceBalance[]> {
  const balances: MarketplaceBalance[] = [];

  try {
    const admin = createAdminClient();

    const { data: openReqs } = await admin
      .from("service_requests")
      .select("id, city_id, category_id")
      .eq("status", "pending")
      .eq("lifecycle_version", 2)
      .limit(2000);

    const [{ data: providers }, { data: cats }, { data: settings }] = await Promise.all([
      admin
        .from("providers")
        .select("id, city_id, status")
        .is("deleted_at", null)
        .limit(3000),
      admin.from("categories").select("id, slug").limit(500),
      admin
        .from("provider_request_settings")
        .select("provider_id, accepting_requests, vacation_mode")
        .limit(3000),
    ]);

    const catMap = new Map(
      (cats ?? []).map((c) => [c.id as string, (c.slug as string) || "unknown"]),
    );
    const settingsMap = new Map(
      (settings ?? []).map((s) => [
        s.provider_id as string,
        {
          accepting: s.accepting_requests !== false && !s.vacation_mode,
        },
      ]),
    );

    const reqByCat = new Map<string, { count: number; cityId: string | null }>();
    for (const r of openReqs ?? []) {
      const slug = catMap.get(r.category_id as string) ?? "unknown";
      const cur = reqByCat.get(slug) ?? {
        count: 0,
        cityId: (r.city_id as string | null) ?? null,
      };
      cur.count += 1;
      reqByCat.set(slug, cur);
    }

    const providerCount = (providers ?? []).filter((p) => {
      const st = String(p.status ?? "");
      if (["draft", "rejected", "suspended", "deleted"].includes(st)) return false;
      const s = settingsMap.get(p.id as string);
      return s ? s.accepting : true;
    }).length;

    // Without provider↔category join, use proportional share of accepting providers
    const catCount = Math.max(1, reqByCat.size);
    const providersPerCat = Math.max(1, Math.round(providerCount / catCount));

    for (const [categorySlug, info] of reqByCat) {
      const availableProviders = providersPerCat;
      const ratio = info.count / Math.max(1, availableProviders);
      const severity = severityFromRatio(ratio);
      const recommendedActions = actionsFor(severity);

      const explanationEn =
        severity === "balanced"
          ? `${categorySlug}: demand and supply look balanced.`
          : severity.includes("shortage")
            ? `${categorySlug}: ${info.count} open requests vs ~${availableProviders} available providers — ${severity.replace("_", " ")}.`
            : `${categorySlug}: more provider capacity than open requests.`;

      const explanationAr =
        severity === "balanced"
          ? `${categorySlug}: الطلب والعرض متوازنان تقريباً.`
          : severity.includes("shortage")
            ? `${categorySlug}: ${info.count} طلبات مفتوحة مقابل ~${availableProviders} مزوّد — نقص في العرض.`
            : `${categorySlug}: سعة مزوّدين أعلى من الطلب المفتوح.`;

      balances.push({
        categorySlug,
        cityId: info.cityId,
        openRequests: info.count,
        availableProviders,
        imbalanceRatio: Math.round(ratio * 100) / 100,
        severity,
        recommendedActions,
        explanationEn,
        explanationAr,
      });
    }

    // Persist snapshots
    try {
      const rows = balances.map((b) => ({
        category_slug: b.categorySlug,
        city_id: b.cityId,
        open_requests: b.openRequests,
        available_providers: b.availableProviders,
        imbalance_ratio: b.imbalanceRatio,
        severity: b.severity,
        recommended_actions: b.recommendedActions as unknown as Json,
      }));
      if (rows.length) {
        await admin.from("ai_marketplace_balances").insert(rows as never);
      }
    } catch {
      // best-effort
    }

    for (const b of balances.filter((x) => x.recommendedActions.length > 0)) {
      void emitAiLearningEvent({
        eventType: "balance_action_recommended",
        metadata: {
          categorySlug: b.categorySlug,
          severity: b.severity,
          actions: b.recommendedActions,
        },
      });
    }
  } catch {
    // empty
  }

  return balances.sort((a, b) => b.imbalanceRatio - a.imbalanceRatio);
}
