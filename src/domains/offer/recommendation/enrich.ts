/**
 * Enrich marketplace offers with decision signals (server-side only).
 */

import type { MarketplaceOfferView } from "@/domains/offer/types";
import type { OfferDecisionSignals } from "./types";
import { signalsFromOfferAndPerf } from "./engine";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function enrichOfferDecisionSignals(
  offers: MarketplaceOfferView[],
): Promise<Map<string, OfferDecisionSignals>> {
  const map = new Map<string, OfferDecisionSignals>();
  if (offers.length === 0) return map;

  const providerIds = [...new Set(offers.map((o) => o.providerId))];
  const admin = createAdminClient();
  const supabase = await createClient();

  const [perfRes, providersRes, galleryCounts, settingsRes] = await Promise.all([
    admin
      .from("provider_performance_scores")
      .select(
        "provider_id, acceptance_rate, cancellation_rate, avg_response_hours, repeat_customer_rate, successful_jobs",
      )
      .in("provider_id", providerIds),
    supabase
      .from("providers")
      .select("id, profile_completeness, updated_at, verification_status, is_featured, status")
      .in("id", providerIds),
    supabase
      .from("images")
      .select("provider_id")
      .in("provider_id", providerIds)
      .eq("kind", "gallery")
      .is("deleted_at", null),
    supabase
      .from("provider_request_settings")
      .select("provider_id, accepting_requests, vacation_mode")
      .in("provider_id", providerIds),
  ]);

  const perfById = new Map(
    (perfRes.data ?? []).map((p) => [p.provider_id as string, p]),
  );
  const providerById = new Map(
    (providersRes.data ?? []).map((p) => [p.id as string, p]),
  );
  const galleryById = new Map<string, number>();
  for (const row of galleryCounts.data ?? []) {
    const id = row.provider_id as string;
    galleryById.set(id, (galleryById.get(id) ?? 0) + 1);
  }
  const settingsById = new Map(
    (settingsRes.data ?? []).map((s) => [s.provider_id as string, s]),
  );

  for (const offer of offers) {
    const perf = perfById.get(offer.providerId) ?? null;
    const provider = providerById.get(offer.providerId);
    const settings = settingsById.get(offer.providerId);
    const availableNow =
      Boolean(settings?.accepting_requests) && !Boolean(settings?.vacation_mode);

    // Suspended/archived providers stay listed but are not treated as available.
    const statusOk =
      !provider?.status || provider.status === "active";

    map.set(
      offer.id,
      signalsFromOfferAndPerf(offer, perf, {
        profileCompleteness:
          provider?.profile_completeness != null
            ? Number(provider.profile_completeness)
            : 60,
        portfolioSize: galleryById.get(offer.providerId) ?? 0,
        availableNow: statusOk && (settings ? availableNow : true),
        updatedAt: (provider?.updated_at as string | null) ?? null,
        featured: Boolean(provider?.is_featured),
      }),
    );
  }

  return map;
}
