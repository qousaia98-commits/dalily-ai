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
import { computePublicTrustScorePct } from "@/lib/providers/public-trust-score";
import {
  parsePublicVisibility,
  type PublicVisibilityFlags,
} from "@/lib/providers/public-visibility";
import { getLocalizedText } from "@/types/domain.types";
import type { LocalizedJson } from "@/types/database.types";
import { getStoragePublicUrl } from "@/lib/providers/storage";

export type PublicProviderStats = {
  completedJobs: number;
  successRatePct: number | null;
  acceptanceRatePct: number | null;
  repeatCustomersPct: number | null;
  responseRatePct: number | null;
  avgResponseHours: number | null;
  profileCompletionPct: number;
  yearsOnDalily: number;
  reliabilityScorePct: number | null;
};

export type PublicServiceItem = {
  id: string;
  name: LocalizedJson;
  description: LocalizedJson | null;
  startingPrice: number | null;
  currency: string | null;
  estimatedResponseHours: number | null;
};

export type PortfolioItemKind = "gallery" | "before" | "after" | "video";

export type PublicPortfolioItem = {
  id: string;
  url: string;
  kind: PortfolioItemKind;
  caption: string | null;
};

export type PublicProviderTrustExtras = {
  workingHours: WorkingHour[];
  languages: string[];
  headline: string | null;
  displayName: string | null;
  experience: string | null;
  specializations: string[];
  skills: string[];
  certificates: string[];
  awards: string[];
  stats: PublicProviderStats;
  serviceCities: string[];
  serviceItems: PublicServiceItem[];
  portfolio: PublicPortfolioItem[];
  availabilityStatus: "available" | "limited" | "paused";
  publicTrustScorePct: number;
  visibility: PublicVisibilityFlags;
};

export type PublicProviderTrustProfile = PublicProviderProfile & PublicProviderTrustExtras;

function mapHours(
  rows: {
    day_of_week: number;
    opens_at: string | null;
    closes_at: string | null;
    is_closed: boolean;
  }[],
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
    .slice(0, 24);
}

function parseOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parsePublicMetadata(metadata: unknown): {
  languages: string[];
  headline: string | null;
  displayName: string | null;
  experience: string | null;
  specializations: string[];
  skills: string[];
  certificates: string[];
  awards: string[];
  serviceCities: string[];
  portfolioKinds: Record<string, PortfolioItemKind>;
  servicePricing: Record<
    string,
    { startingPrice?: number; currency?: string; etaHours?: number }
  >;
} {
  if (!metadata || typeof metadata !== "object") {
    return {
      languages: [],
      headline: null,
      displayName: null,
      experience: null,
      specializations: [],
      skills: [],
      certificates: [],
      awards: [],
      serviceCities: [],
      portfolioKinds: {},
      servicePricing: {},
    };
  }
  const m = metadata as Record<string, unknown>;
  const headline =
    parseOptionalString(m.public_headline) ?? parseOptionalString(m.headline);
  const displayName =
    parseOptionalString(m.display_name) ??
    parseOptionalString(m.public_display_name);

  const portfolioKinds: Record<string, PortfolioItemKind> = {};
  const rawKinds = m.portfolio_kinds;
  if (rawKinds && typeof rawKinds === "object") {
    for (const [k, v] of Object.entries(rawKinds as Record<string, unknown>)) {
      if (v === "gallery" || v === "before" || v === "after" || v === "video") {
        portfolioKinds[k] = v;
      }
    }
  }

  const servicePricing: Record<
    string,
    { startingPrice?: number; currency?: string; etaHours?: number }
  > = {};
  const rawPricing = m.service_pricing;
  if (rawPricing && typeof rawPricing === "object") {
    for (const [id, row] of Object.entries(
      rawPricing as Record<string, unknown>,
    )) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      servicePricing[id] = {
        startingPrice:
          typeof r.startingPrice === "number"
            ? r.startingPrice
            : typeof r.starting_price === "number"
              ? r.starting_price
              : undefined,
        currency:
          typeof r.currency === "string" ? r.currency : undefined,
        etaHours:
          typeof r.etaHours === "number"
            ? r.etaHours
            : typeof r.estimated_response_hours === "number"
              ? r.estimated_response_hours
              : undefined,
      };
    }
  }

  return {
    languages: parseStringList(m.languages ?? m.public_languages),
    headline,
    displayName,
    experience:
      parseOptionalString(m.experience) ??
      parseOptionalString(m.public_experience),
    specializations: parseStringList(
      m.specializations ?? m.public_specializations,
    ),
    skills: parseStringList(m.skills ?? m.public_skills),
    certificates: parseStringList(m.public_certificates ?? m.certificates),
    awards: parseStringList(m.public_awards ?? m.awards),
    serviceCities: parseStringList(m.service_cities ?? m.working_areas),
    portfolioKinds,
    servicePricing,
  };
}

function resolveAvailability(
  accepting: boolean,
  hours: WorkingHour[],
): "available" | "limited" | "paused" {
  if (!accepting) return "paused";
  const openDays = hours.filter((h) => !h.isClosed && h.opensAt && h.closesAt);
  if (openDays.length === 0) return "limited";
  if (openDays.length >= 5) return "available";
  return "limited";
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

  const [
    hoursResult,
    metaResult,
    jobsMap,
    perfResult,
    reputationResult,
    verification,
    servicesResult,
    galleryRows,
    settingsResult,
  ] = await Promise.all([
    supabase
      .from("provider_working_hours")
      .select("day_of_week, opens_at, closes_at, is_closed")
      .eq("provider_id", providerId),
    supabase
      .from("providers")
      .select("metadata, created_at, updated_at, verification_status")
      .eq("id", providerId)
      .maybeSingle(),
    fetchCompletedJobsByProviderIds([providerId]),
    admin
      .from("provider_performance_scores")
      .select(
        "completion_rate, repeat_customer_rate, successful_jobs, avg_response_hours, acceptance_rate, cancellation_rate, performance_score",
      )
      .eq("provider_id", providerId)
      .maybeSingle(),
    admin
      .from("provider_reputation_cache")
      .select("response_rate")
      .eq("provider_id", providerId)
      .maybeSingle(),
    getPublicVerificationSummary(providerId),
    supabase
      .from("provider_services")
      .select("id, name, description, sort_order")
      .eq("provider_id", providerId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("sort_order"),
    supabase
      .from("images")
      .select("id, path, sort_order, is_featured")
      .eq("provider_id", providerId)
      .eq("kind", "gallery")
      .is("deleted_at", null)
      .order("sort_order"),
    supabase
      .from("provider_request_settings")
      .select("accepting_requests, vacation_mode")
      .eq("provider_id", providerId)
      .maybeSingle(),
  ]);

  const visibility = parsePublicVisibility(metaResult.data?.metadata);
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

  const updatedAt = metaResult.data?.updated_at
    ? new Date(metaResult.data.updated_at as string)
    : null;
  const daysSinceActivity =
    updatedAt && Number.isFinite(updatedAt.getTime())
      ? Math.floor((Date.now() - updatedAt.getTime()) / 86_400_000)
      : null;

  const successRate =
    perfResult.data?.completion_rate != null
      ? Math.round(Number(perfResult.data.completion_rate) * 100)
      : null;
  const acceptanceRatePct =
    perfResult.data?.acceptance_rate != null
      ? Math.round(Number(perfResult.data.acceptance_rate) * 100)
      : null;
  const repeatPct =
    perfResult.data?.repeat_customer_rate != null
      ? Math.round(Number(perfResult.data.repeat_customer_rate) * 100)
      : null;
  const responseRatePct =
    reputationResult.data?.response_rate != null
      ? Math.round(Number(reputationResult.data.response_rate) * 100)
      : null;
  const reliabilityScorePct =
    perfResult.data?.performance_score != null
      ? Math.round(Number(perfResult.data.performance_score) * 100)
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

  const workingHours = mapHours(hoursResult.data ?? []);
  const accepting =
    Boolean(settingsResult.data?.accepting_requests) &&
    !Boolean(settingsResult.data?.vacation_mode);

  const serviceItems: PublicServiceItem[] = (servicesResult.data ?? []).map(
    (row) => {
      const pricing = meta.servicePricing[row.id as string] ?? {};
      return {
        id: row.id as string,
        name: row.name as LocalizedJson,
        description: (row.description as LocalizedJson | null) ?? null,
        startingPrice: pricing.startingPrice ?? null,
        currency: pricing.currency ?? "SYP",
        estimatedResponseHours:
          pricing.etaHours ?? base.responseTimeHours ?? null,
      };
    },
  );

  const portfolio: PublicPortfolioItem[] = (galleryRows.data ?? [])
    .sort((a, b) => {
      if (Boolean(a.is_featured) !== Boolean(b.is_featured)) {
        return a.is_featured ? -1 : 1;
      }
      return (a.sort_order as number) - (b.sort_order as number);
    })
    .map((img) => {
      const url = getStoragePublicUrl(img.path as string);
      const kind =
        meta.portfolioKinds[img.id as string] ??
        meta.portfolioKinds[url] ??
        "gallery";
      return {
        id: img.id as string,
        url,
        kind,
        caption: null,
      };
    });

  const publicTrustScorePct = computePublicTrustScorePct({
    verified: base.verified,
    partiallyVerified:
      metaResult.data?.verification_status === "partially_verified",
    completedJobs,
    ratingAvg: base.rating,
    reviewCount: base.reviewCount,
    cancellationRate:
      perfResult.data?.cancellation_rate != null
        ? Number(perfResult.data.cancellation_rate)
        : null,
    responseRate:
      reputationResult.data?.response_rate != null
        ? Number(reputationResult.data.response_rate)
        : null,
    profileCompleteness: base.profileCompleteness,
    daysSinceActivity,
  });

  // Apply privacy flags — strip sections the provider chose to hide.
  const galleryUrls = visibility.showGallery
    ? portfolio.map((p) => p.url)
    : [];
  const visiblePortfolio = visibility.showGallery ? portfolio : [];
  const visibleLanguages = visibility.showLanguages ? meta.languages : [];
  const visibleCertificates = visibility.showCertificates
    ? certificateLabels
    : [];
  const visibleCities = visibility.showServiceArea
    ? meta.serviceCities.length > 0
      ? meta.serviceCities
      : base.citySlug
        ? [base.citySlug]
        : []
    : [];

  const stats: PublicProviderStats = {
    completedJobs: visibility.showCompletedJobs ? completedJobs : 0,
    successRatePct: visibility.showStatistics ? successRate : null,
    acceptanceRatePct: visibility.showStatistics ? acceptanceRatePct : null,
    repeatCustomersPct: visibility.showStatistics ? repeatPct : null,
    responseRatePct: visibility.showStatistics ? responseRatePct : null,
    avgResponseHours: visibility.showStatistics
      ? perfResult.data?.avg_response_hours != null
        ? Number(perfResult.data.avg_response_hours)
        : base.responseTimeHours
      : null,
    profileCompletionPct: visibility.showStatistics
      ? Math.min(100, Math.round(base.profileCompleteness))
      : 0,
    yearsOnDalily,
    reliabilityScorePct: visibility.showStatistics
      ? reliabilityScorePct
      : null,
  };

  return {
    ...base,
    phone: null,
    whatsapp: null,
    latitude: null,
    longitude: null,
    district: null,
    // Hide numeric internal trust_score from consumers of this DTO shape.
    trustScore: publicTrustScorePct,
    avatarImage: visibility.showLogo ? base.avatarImage : base.avatarImage,
    coverImage: base.coverImage,
    gallery: galleryUrls,
    workingHours,
    languages: visibleLanguages,
    headline: meta.headline,
    displayName: meta.displayName,
    experience: meta.experience,
    specializations: meta.specializations,
    skills: meta.skills,
    certificates: visibleCertificates,
    awards: awardLabels,
    serviceCities: visibleCities,
    serviceItems,
    portfolio: visiblePortfolio,
    availabilityStatus: resolveAvailability(accepting, workingHours),
    publicTrustScorePct,
    visibility,
    stats,
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
    experience: profile.experience,
    specializations: profile.specializations,
    skills: profile.skills,
    category: text(profile.categoryLabel),
    services: profile.serviceItems.map((s) => ({
      id: s.id,
      name: text(s.name),
      description: s.description ? text(s.description) : null,
      startingPrice: s.startingPrice,
      currency: s.currency,
      estimatedResponseHours: s.estimatedResponseHours,
    })),
    portfolio: profile.visibility.showGallery ? profile.portfolio : [],
    avatarImage: profile.avatarImage,
    coverImage: profile.coverImage,
    rating: profile.rating,
    reviewCount: profile.reviewCount,
    verified: profile.verified,
    publicTrustScorePct: profile.publicTrustScorePct,
    workingArea: profile.visibility.showServiceArea
      ? text(profile.city)
      : null,
    serviceCities: profile.serviceCities,
    workingHours: profile.workingHours,
    languages: profile.languages,
    certificates: profile.certificates,
    awards: profile.awards,
    stats: profile.visibility.showStatistics
      ? profile.stats
      : {
          completedJobs: profile.visibility.showCompletedJobs
            ? profile.stats.completedJobs
            : 0,
          successRatePct: null,
          acceptanceRatePct: null,
          repeatCustomersPct: null,
          responseRatePct: null,
          avgResponseHours: null,
          profileCompletionPct: 0,
          yearsOnDalily: profile.stats.yearsOnDalily,
          reliabilityScorePct: null,
        },
    availabilityStatus: profile.availabilityStatus,
    memberSince: profile.memberSince,
  };
}

export function localizeServiceName(
  name: LocalizedJson,
  locale: string,
): string {
  return getLocalizedText(name, locale as "ar" | "en");
}
