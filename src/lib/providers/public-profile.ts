/**
 * Public trust profile — only fields safe to show before booking confirmation.
 * Never include phone, email, WhatsApp, exact address, GPS, documents, or revenue.
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicProviderById, type PublicProviderProfile } from "@/lib/providers/database";
import { fetchCompletedJobsByProviderIds } from "@/domains/matching";
import type { WorkingHour } from "@/types/provider.types";
import { getPublicVerificationSummary } from "@/lib/verification/public-summary";

export type PublicProviderStats = {
  completedJobs: number;
  successRatePct: number | null;
  repeatCustomersPct: number | null;
  responseRatePct: number | null;
  avgResponseHours: number | null;
  profileCompletionPct: number;
  yearsOnDalily: number;
};

export type PublicProviderTrustExtras = {
  workingHours: WorkingHour[];
  languages: string[];
  headline: string | null;
  displayName: string | null;
  certificates: string[];
  awards: string[];
  stats: PublicProviderStats;
  serviceCities: string[];
};

export type PublicProviderTrustProfile = PublicProviderProfile & PublicProviderTrustExtras;

function mapHours(
  rows: { day_of_week: number; opens_at: string | null; closes_at: string | null; is_closed: boolean }[],
): WorkingHour[] {
  const byDay = new Map(rows.map((r) => [r.day_of_week, r]));
  return Array.from({ length: 7 }, (_, day) => {
    const row = byDay.get(day);
    return {
      dayOfWeek: day,
      opensAt: row?.opens_at ?? null,
      closesAt: row?.closes_at ?? null,
      isClosed: row?.is_closed ?? false,
    };
  });
}

function parseStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => v.trim())
    .slice(0, 20);
}

function parsePublicMetadata(metadata: unknown): {
  languages: string[];
  headline: string | null;
  displayName: string | null;
  certificates: string[];
  awards: string[];
  serviceCities: string[];
} {
  if (!metadata || typeof metadata !== "object") {
    return {
      languages: [],
      headline: null,
      displayName: null,
      certificates: [],
      awards: [],
      serviceCities: [],
    };
  }
  const m = metadata as Record<string, unknown>;
  const headline =
    typeof m.public_headline === "string"
      ? m.public_headline.trim() || null
      : typeof m.headline === "string"
        ? m.headline.trim() || null
        : null;
  const displayName =
    typeof m.display_name === "string"
      ? m.display_name.trim() || null
      : typeof m.public_display_name === "string"
        ? m.public_display_name.trim() || null
        : null;

  return {
    languages: parseStringList(m.languages ?? m.public_languages),
    headline,
    displayName,
    certificates: parseStringList(m.public_certificates ?? m.certificates),
    awards: parseStringList(m.public_awards ?? m.awards),
    serviceCities: parseStringList(m.service_cities ?? m.working_areas),
  };
}

/**
 * Load the full public trust profile. Strips private contact/geo from the base profile.
 */
export async function getPublicProviderTrustProfile(
  providerId: string,
): Promise<PublicProviderTrustProfile | null> {
  const base = await getPublicProviderById(providerId);
  if (!base) return null;

  const supabase = await createClient();
  const admin = createAdminClient();

  const [hoursResult, metaResult, jobsMap, perfResult, reputationResult, verification] =
    await Promise.all([
      supabase
        .from("provider_working_hours")
        .select("day_of_week, opens_at, closes_at, is_closed")
        .eq("provider_id", providerId),
      supabase.from("providers").select("metadata, created_at").eq("id", providerId).maybeSingle(),
      fetchCompletedJobsByProviderIds([providerId]),
      admin
        .from("provider_performance_scores")
        .select("completion_rate, repeat_customer_rate, successful_jobs, avg_response_hours")
        .eq("provider_id", providerId)
        .maybeSingle(),
      admin
        .from("provider_reputation_cache")
        .select("response_rate")
        .eq("provider_id", providerId)
        .maybeSingle(),
      getPublicVerificationSummary(providerId),
    ]);

  const meta = parsePublicMetadata(metaResult.data?.metadata);
  const completedJobs =
    jobsMap.get(providerId) ??
    (perfResult.data?.successful_jobs != null
      ? Number(perfResult.data.successful_jobs)
      : 0);

  const created = new Date(metaResult.data?.created_at ?? base.memberSince);
  const yearsOnDalily = Number.isFinite(created.getTime())
    ? Math.max(0, new Date().getFullYear() - created.getFullYear())
    : 0;

  const successRate =
    perfResult.data?.completion_rate != null
      ? Math.round(Number(perfResult.data.completion_rate) * 100)
      : null;
  const repeatPct =
    perfResult.data?.repeat_customer_rate != null
      ? Math.round(Number(perfResult.data.repeat_customer_rate) * 100)
      : null;
  const responseRatePct =
    reputationResult.data?.response_rate != null
      ? Math.round(Number(reputationResult.data.response_rate) * 100)
      : null;

  const certificateLabels = [
    ...meta.certificates,
    ...(verification?.levels ?? [])
      .flatMap((l) => l.checks)
      .map((c) => c.nameEn || c.nameAr)
      .filter(Boolean),
  ].slice(0, 12);

  const awardLabels = [
    ...meta.awards,
    ...(verification?.isVerified ? ["verified"] : []),
  ].slice(0, 12);

  // Hard strip private fields even if base loader still carries them under legacy flags.
  return {
    ...base,
    phone: null,
    whatsapp: null,
    latitude: null,
    longitude: null,
    district: null,
    workingHours: mapHours(hoursResult.data ?? []),
    languages: meta.languages,
    headline: meta.headline,
    displayName: meta.displayName,
    certificates: certificateLabels,
    awards: awardLabels,
    serviceCities:
      meta.serviceCities.length > 0
        ? meta.serviceCities
        : base.citySlug
          ? [base.citySlug]
          : [],
    stats: {
      completedJobs,
      successRatePct: successRate,
      repeatCustomersPct: repeatPct,
      responseRatePct,
      avgResponseHours:
        perfResult.data?.avg_response_hours != null
          ? Number(perfResult.data.avg_response_hours)
          : base.responseTimeHours,
      profileCompletionPct: Math.min(100, Math.round(base.profileCompleteness)),
      yearsOnDalily,
    },
  };
}

/** JSON-safe public DTO for API responses (no private fields). */
export function toPublicProviderApiDto(
  profile: PublicProviderTrustProfile,
  locale: "en" | "ar",
) {
  const text = (v: { ar: string; en: string } | null | undefined) => {
    if (!v) return null;
    return locale === "ar" ? v.ar || v.en : v.en || v.ar;
  };

  return {
    id: profile.id,
    slug: profile.slug,
    businessName: text(profile.name),
    displayName: profile.displayName,
    headline: profile.headline,
    about: profile.about ? text(profile.about) : null,
    category: text(profile.categoryLabel),
    services: profile.services.map((s) => text(s)).filter(Boolean),
    gallery: profile.gallery,
    avatarImage: profile.avatarImage,
    coverImage: profile.coverImage,
    rating: profile.rating,
    reviewCount: profile.reviewCount,
    verified: profile.verified,
    workingArea: text(profile.city),
    serviceCities: profile.serviceCities,
    workingHours: profile.workingHours,
    languages: profile.languages,
    certificates: profile.certificates,
    awards: profile.awards,
    stats: profile.stats,
    memberSince: profile.memberSince,
  };
}
