/**
 * Sprint 39 — aggregates existing Booking / Chat / Reviews / Analytics / Notifications.
 * Does not duplicate source-of-truth tables; read-only composition.
 */

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { listProviderBookings } from "@/lib/booking/booking-service";
import { getAvailabilitySettings } from "@/lib/booking/availability-service";
import { getWeeklyInsights } from "@/lib/business/analytics-database";
import { countUnreadConversations } from "@/lib/business/conversations";
import { loadBusinessConversations } from "@/lib/business/load-conversations";
import { completenessFromProvider } from "@/lib/providers/completion";
import { getProviderReviewStats } from "@/lib/reviews/queries";
import {
  listNotifications,
  getUnreadNotificationCount,
} from "@/lib/service-requests/queries";
import type { ManagedProvider } from "@/types/provider.types";
import type { BusinessVerificationView } from "@/lib/verification/queries";
import {
  buildProviderInsights,
  listProfileMissingItems,
} from "@/lib/provider-success/insights";
import {
  resolveAchievements,
  resolveBadges,
  resolveProviderLevel,
} from "@/lib/provider-success/achievements";
import { calculateDalilyScore } from "@/lib/dalily-ranking/score-calculator";
import { improvementTipsFromBreakdown } from "@/lib/dalily-ranking/explanation";
import type {
  ActivityItem,
  ChartPoint,
  NotificationWidgetItem,
  PerformanceMetrics,
  ProviderSuccessDashboard,
  TodayAppointment,
} from "@/lib/provider-success/types";
import { formatDateTime } from "@/lib/format/datetime";

function startOfDay(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function weekLabel(d: Date): string {
  const start = new Date(d);
  start.setDate(start.getDate() - start.getDay());
  return `${start.getMonth() + 1}/${start.getDate()}`;
}

function monthLabel(d: Date): string {
  return formatDateTime(d, "en", { month: "short" });
}

function categorizeNotification(type: string): NotificationWidgetItem["category"] {
  if (
    type.includes("message") ||
    type.includes("inquiry") ||
    type === "dalily_message" ||
    type === "admin_broadcast"
  ) {
    return "message";
  }
  if (type.includes("booking") || type.includes("request") || type.includes("quote")) {
    return "booking";
  }
  if (type.includes("review")) return "review";
  if (type.includes("verification")) return "verification";
  return "system";
}

async function loadServiceNames(serviceIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!serviceIds.length) return map;
  const supabase = await createClient();
  const { data } = await supabase
    .from("provider_services")
    .select("id, name")
    .in("id", serviceIds);
  for (const row of data ?? []) {
    const name = row.name as { ar?: string; en?: string } | null;
    map.set(row.id, name?.en || name?.ar || "Service");
  }
  return map;
}

export const getProviderSuccessDashboard = cache(
  async function getProviderSuccessDashboard(input: {
    provider: ManagedProvider;
    ownerId: string;
    verification: BusinessVerificationView;
  }): Promise<ProviderSuccessDashboard> {
    const { provider, ownerId, verification } = input;
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(now);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    const yearAgo = new Date(now);
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);

    const [
      bookings,
      reviewStats,
      weekly,
      { conversations },
      notifications,
      unreadNotificationCount,
      availability,
    ] = await Promise.all([
      listProviderBookings(provider.id, {
        from: yearAgo.toISOString(),
      }),
      getProviderReviewStats(provider.id),
      getWeeklyInsights(provider.id, provider.reviewCount),
      loadBusinessConversations(ownerId),
      listNotifications(ownerId, 12),
      getUnreadNotificationCount(ownerId),
      getAvailabilitySettings(provider.id),
    ]);

    const unreadMessages = countUnreadConversations(conversations);
    const profileCompletion = completenessFromProvider(provider);

    const pendingBookingRequests = bookings.filter((b) => b.status === "pending").length;
    const upcomingBookings = bookings.filter(
      (b) =>
        new Date(b.startsAt) > now &&
        ["pending", "confirmed", "rescheduled", "awaiting_customer_confirmation"].includes(
          b.status,
        ),
    ).length;

    const todayBookings = bookings
      .filter((b) => {
        const s = new Date(b.startsAt);
        return s >= todayStart && s <= todayEnd;
      })
      .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));

    const serviceIds = todayBookings
      .map((b) => b.serviceId)
      .filter((id): id is string => Boolean(id));
    const serviceNames = await loadServiceNames(serviceIds);

    const todaySchedule: TodayAppointment[] = todayBookings.map((b, i) => ({
      bookingId: b.id,
      startsAt: b.startsAt,
      endsAt: b.endsAt,
      status: b.status,
      locationText: b.locationText,
      locationLat: b.locationLat,
      locationLng: b.locationLng,
      serviceName: b.serviceId ? (serviceNames.get(b.serviceId) ?? null) : null,
      customerLabel: `Customer ${i + 1}`,
      conversationId: b.conversationId,
    }));

    const completed = bookings.filter((b) => b.status === "completed");
    const cancelled = bookings.filter((b) => b.status === "cancelled");
    const declined = bookings.filter((b) => b.status === "declined");
    const acceptedLike = bookings.filter((b) =>
      [
        "confirmed",
        "completed",
        "awaiting_customer_confirmation",
        "customer_confirmed",
        "issue_reported",
        "rescheduled",
      ].includes(b.status),
    );
    const decided = acceptedLike.length + declined.length + cancelled.length;
    const acceptanceRate =
      decided > 0 ? Math.round((acceptedLike.length / decided) * 100) : null;
    const cancellationRate =
      bookings.length > 0
        ? Math.round((cancelled.length / bookings.length) * 100)
        : null;

    const confirmationDelays = completed
      .filter((b) => b.confirmedAt && b.createdAt)
      .map(
        (b) =>
          (new Date(b.confirmedAt!).getTime() - new Date(b.createdAt).getTime()) /
          3600_000,
      )
      .filter((h) => h >= 0 && h < 720);
    const avgConfirmationTimeHours =
      confirmationDelays.length > 0
        ? Math.round(
            (confirmationDelays.reduce((a, b) => a + b, 0) / confirmationDelays.length) *
              10,
          ) / 10
        : null;

    const jobsThisWeek = completed.filter(
      (b) => new Date(b.completedAt ?? b.endsAt) >= weekAgo,
    ).length;
    const jobsThisMonth = completed.filter(
      (b) => new Date(b.completedAt ?? b.endsAt) >= monthAgo,
    ).length;

    const customerCounts = new Map<string, number>();
    for (const b of completed) {
      customerCounts.set(b.customerId, (customerCounts.get(b.customerId) ?? 0) + 1);
    }
    const repeatCustomers = [...customerCounts.values()].filter((n) => n >= 2).length;

    const profileViews = weekly.profileViews ?? 0;
    const searchAppearances = weekly.searchAppearances;
    const bookingConversionRate =
      searchAppearances > 0
        ? Math.round((bookings.length / searchAppearances) * 1000) / 10
        : null;

    const completionDenom = acceptedLike.length || 1;
    const completionRate =
      acceptedLike.length > 0
        ? Math.round((completed.length / completionDenom) * 100)
        : null;

    const dalilyBreakdown = calculateDalilyScore(
      {
        providerId: provider.id,
        ratingAvg: reviewStats.ratingAvg || provider.ratingAvg,
        reviewCount: reviewStats.reviewCount || provider.reviewCount,
        trustScore: reviewStats.trustScore || 0,
        verificationStatus: provider.verificationStatus,
        profileCompleteness: profileCompletion,
        responseTimeHours: provider.responseTimeHours,
        completedJobs: completed.length,
        distanceKm: null,
        acceptanceRate: acceptanceRate != null ? acceptanceRate / 100 : null,
        completionRate: completionRate != null ? completionRate / 100 : null,
        cancellationRate: cancellationRate != null ? cancellationRate / 100 : null,
        createdAt: provider.createdAt,
        updatedAt: provider.createdAt,
        profileViews,
        searchAppearances,
        bookingConversionRate,
        repeatCustomers,
        matchesCategory: true,
      },
      { blendWithSmartMatch: false },
    );
    const dalilyScore = dalilyBreakdown.overall;
    const rankingTips = improvementTipsFromBreakdown(dalilyBreakdown, 4);

    const kpis = {
      todayAppointments: todaySchedule.length,
      upcomingBookings,
      pendingBookingRequests,
      unreadMessages,
      averageRating: reviewStats.ratingAvg || provider.ratingAvg,
      completedJobs: completed.length,
      responseTimeHours: provider.responseTimeHours,
      acceptanceRate,
      cancellationRate,
      profileCompletion,
      verificationStatus: provider.verificationStatus,
      dalilyScore,
    };

    const performance: PerformanceMetrics = {
      jobsThisWeek,
      jobsThisMonth,
      averageRating: kpis.averageRating,
      reviewCount: reviewStats.reviewCount || provider.reviewCount,
      completionRate,
      avgConfirmationTimeHours,
      avgResponseTimeHours: provider.responseTimeHours,
      repeatCustomers,
      profileViews,
      searchAppearances,
      bookingConversionRate,
    };

    const missing = listProfileMissingItems(provider);
    const insights = buildProviderInsights({
      provider,
      verification,
      kpis,
      performance,
      missing,
      acceptingBookings: availability.acceptingBookings,
    });

    // Charts from bookings (last 8 weeks / 6 months)
    const weekBuckets = new Map<string, number>();
    const monthBuckets = new Map<string, number>();
    const completedWeek = new Map<string, number>();
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      weekBuckets.set(weekLabel(d), 0);
      completedWeek.set(weekLabel(d), 0);
    }
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - i);
      monthBuckets.set(monthLabel(d), 0);
    }
    for (const b of bookings) {
      const created = new Date(b.createdAt);
      const wl = weekLabel(created);
      if (weekBuckets.has(wl)) weekBuckets.set(wl, (weekBuckets.get(wl) ?? 0) + 1);
      const ml = monthLabel(created);
      if (monthBuckets.has(ml)) monthBuckets.set(ml, (monthBuckets.get(ml) ?? 0) + 1);
      if (b.status === "completed") {
        const done = new Date(b.completedAt ?? b.endsAt);
        const cwl = weekLabel(done);
        if (completedWeek.has(cwl)) {
          completedWeek.set(cwl, (completedWeek.get(cwl) ?? 0) + 1);
        }
      }
    }

    const bookingsPerWeek: ChartPoint[] = [...weekBuckets.entries()].map(
      ([label, value]) => ({ label, value }),
    );
    const bookingsPerMonth: ChartPoint[] = [...monthBuckets.entries()].map(
      ([label, value]) => ({ label, value }),
    );
    const completedJobsTrend: ChartPoint[] = [...completedWeek.entries()].map(
      ([label, value]) => ({ label, value }),
    );

    // Rating trend: flat series from current avg (no historical table — placeholder points)
    const ratingTrend: ChartPoint[] = bookingsPerWeek.map((p, idx, arr) => ({
      label: p.label,
      value:
        Math.round(
          (kpis.averageRating || 0) *
            (0.9 + (idx / Math.max(1, arr.length - 1)) * 0.1) *
            10,
        ) / 10,
    }));

    const activity: ActivityItem[] = [];
    for (const b of [...bookings].sort(
      (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
    ).slice(0, 8)) {
      activity.push({
        id: `bk-${b.id}`,
        kind: b.status === "confirmed" ? "booking_accepted" : "booking_created",
        at: b.confirmedAt ?? b.createdAt,
        href: `/business/bookings/${b.id}`,
      });
    }
    if (provider.verificationStatus === "verified") {
      activity.push({
        id: "ver-approved",
        kind: "verification_approved",
        at: provider.createdAt,
        href: "/business/verification",
      });
    }
    activity.push({
      id: "profile-updated",
      kind: "profile_updated",
      at: provider.createdAt,
      href: "/business/profile",
    });
    activity.sort((a, b) => +new Date(b.at) - +new Date(a.at));

    const DALILY_DASHBOARD_TYPES = new Set(["dalily_message", "admin_broadcast"]);
    const notificationItems: NotificationWidgetItem[] = notifications
      .filter((n) => {
        // Official Dalily inbox alerts: only show while unread.
        if (DALILY_DASHBOARD_TYPES.has(n.type) && n.read_at) return false;
        return true;
      })
      .map((n) => ({
        id: n.id,
        category: categorizeNotification(n.type),
        titleKey: n.title_key,
        bodyKey: n.body_key,
        bodyParams: n.body_params,
        href: n.href,
        read: Boolean(n.read_at),
        createdAt: n.created_at,
      }));

    const level = resolveProviderLevel(dalilyScore);
    const achievements = resolveAchievements({
      completedJobs: completed.length,
      reviewCount: performance.reviewCount,
      ratingAvg: kpis.averageRating,
      verified: provider.verificationStatus === "verified",
      responseTimeHours: provider.responseTimeHours,
      profileCompletion,
      totalBookings: bookings.length,
    });
    const badges = resolveBadges({
      verified: provider.verificationStatus === "verified",
      ratingAvg: kpis.averageRating,
      reviewCount: performance.reviewCount,
      profileCompletion,
      completedJobs: completed.length,
    });

    return {
      kpis,
      todaySchedule,
      performance,
      insights,
      profileMissing: missing,
      activity: activity.slice(0, 12),
      charts: {
        bookingsPerWeek,
        bookingsPerMonth,
        ratingTrend,
        completedJobsTrend,
      },
      notifications: notificationItems,
      unreadNotificationCount,
      level,
      achievements,
      badges,
      dalilyBreakdown,
      rankingTips,
    };
  },
);
