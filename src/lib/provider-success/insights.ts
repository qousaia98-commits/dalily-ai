import type { ManagedProvider } from "@/types/provider.types";
import type { BusinessVerificationView } from "@/lib/verification/queries";
import { hasConfiguredOpeningHours } from "@/lib/business/onboarding";
import type {
  DashboardKpis,
  PerformanceMetrics,
  ProfileMissingItem,
  ProviderInsight,
} from "@/lib/provider-success/types";

function hasLocalized(value: { ar?: string; en?: string } | null | undefined): boolean {
  if (!value) return false;
  return Boolean(value.ar?.trim() || value.en?.trim());
}

export function listProfileMissingItems(
  provider: ManagedProvider,
): ProfileMissingItem[] {
  const missing: ProfileMissingItem[] = [];
  if (!provider.avatarImageId) missing.push("logo");
  if (!provider.coverImageId) missing.push("cover");
  if (!hasLocalized(provider.about) || (provider.about?.ar?.trim().length ?? 0) < 40) {
    missing.push("description");
  }
  if (!hasConfiguredOpeningHours(provider)) missing.push("hours");
  if (!provider.phone?.trim()) missing.push("phone");
  if (!hasLocalized(provider.addressLine)) missing.push("address");
  if (provider.services.length === 0) missing.push("services");
  if (provider.gallery.length < 3) missing.push("gallery");
  if (provider.verificationStatus !== "verified") missing.push("verification");
  if (!provider.categoryId) missing.push("category");
  return missing;
}

export function buildProviderInsights(input: {
  provider: ManagedProvider;
  verification: BusinessVerificationView;
  kpis: DashboardKpis;
  performance: PerformanceMetrics;
  missing: ProfileMissingItem[];
  acceptingBookings: boolean;
}): ProviderInsight[] {
  void input.verification;
  void input.performance;
  const insights: ProviderInsight[] = [];

  if (input.kpis.profileCompletion < 85) {
    insights.push({ id: "complete_profile", impact: 95, href: "/business/profile" });
  }
  if (input.missing.includes("gallery")) {
    insights.push({ id: "upload_photos", impact: 88, href: "/business/media" });
  }
  if (input.missing.includes("verification")) {
    insights.push({ id: "verify_business", impact: 92, href: "/business/verification" });
  }
  if (
    input.kpis.responseTimeHours != null &&
    input.kpis.responseTimeHours > 6
  ) {
    insights.push({ id: "slow_response", impact: 80, href: "/business/messages" });
  }
  if (input.kpis.pendingBookingRequests > 0) {
    insights.push({
      id: "unread_bookings",
      impact: 97,
      href: "/business/bookings",
    });
  }
  if (input.kpis.unreadMessages > 0) {
    insights.push({ id: "unread_messages", impact: 94, href: "/business/messages" });
  }
  if (input.missing.includes("hours")) {
    insights.push({ id: "more_hours", impact: 70, href: "/business/profile" });
  }
  if (input.provider.services.length < 2) {
    insights.push({ id: "add_service", impact: 65, href: "/business/services" });
  }
  if (input.missing.includes("description")) {
    insights.push({ id: "improve_description", impact: 72, href: "/business/profile" });
  }
  if (!input.acceptingBookings) {
    insights.push({
      id: "enable_availability",
      impact: 85,
      href: "/business/availability",
    });
  }

  return insights.sort((a, b) => b.impact - a.impact);
}
