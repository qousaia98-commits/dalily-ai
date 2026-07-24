/**
 * Unread badge counts for Admin Control Center — pending items after lastSeen watermark.
 */

import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ADMIN_SEEN_COOKIE,
  parseAdminSeenCookie,
  type AdminNavBadgeCounts,
  type AdminSeenMap,
} from "@/lib/admin/badge-ack";

async function safeCount(
  query: PromiseLike<{ count: number | null; error: unknown }>,
): Promise<number> {
  try {
    const { count, error } = await query;
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function readAdminSeenMap(): Promise<AdminSeenMap> {
  const jar = await cookies();
  return parseAdminSeenCookie(jar.get(ADMIN_SEEN_COOKIE)?.value);
}

function sinceFilter(seenAt: string | undefined): string | null {
  return seenAt && !Number.isNaN(Date.parse(seenAt)) ? seenAt : null;
}

export async function getAdminUnreadBadgeCounts(
  seenMap?: AdminSeenMap,
): Promise<AdminNavBadgeCounts> {
  const seen = seenMap ?? (await readAdminSeenMap());
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  const businessesSince = sinceFilter(seen.businesses);
  const paymentsSince = sinceFilter(seen.payments);
  const issuesSince = sinceFilter(seen.issues);
  const verificationSince = sinceFilter(seen.verification);
  const reviewsSince = sinceFilter(seen.reviews);
  const auditSince = sinceFilter(seen.audit);
  const subscriptionsSince = sinceFilter(seen.subscriptions);
  const bookingsSince = sinceFilter(seen.bookings);
  const broadcastsSince = sinceFilter(seen.broadcasts);
  const messagesSince = sinceFilter(seen.messages);

  let pendingProviders = admin
    .from("providers")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending_review")
    .is("deleted_at", null);
  let changesProviders = admin
    .from("providers")
    .select("id", { count: "exact", head: true })
    .eq("status", "changes_requested")
    .is("deleted_at", null);
  let pendingPayments = admin
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("payment_status", "pending_review");
  let openIssues = db
    .from("booking_issue_reports")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .in("moderation_status", ["open", "in_progress"]);
  let pendingVerification = admin
    .from("provider_verifications")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  let pendingReviews = admin
    .from("service_reviews")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .is("deleted_at", null);
  let pendingSubs = admin
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("payment_status", "pending_review");

  if (businessesSince) {
    pendingProviders = pendingProviders.gte("created_at", businessesSince);
    changesProviders = changesProviders.gte("updated_at", businessesSince);
  }
  if (paymentsSince) pendingPayments = pendingPayments.gte("created_at", paymentsSince);
  if (issuesSince) openIssues = openIssues.gte("created_at", issuesSince);
  if (verificationSince) {
    pendingVerification = pendingVerification.gte("created_at", verificationSince);
  }
  if (reviewsSince) pendingReviews = pendingReviews.gte("created_at", reviewsSince);
  if (subscriptionsSince) pendingSubs = pendingSubs.gte("created_at", subscriptionsSince);

  const [
    pendingCount,
    changesCount,
    paymentsCount,
    issuesCount,
    verificationCount,
    reviewsCount,
    subscriptionsCount,
    auditCount,
    bookingsCount,
    broadcastsCount,
    messagesCount,
  ] = await Promise.all([
    safeCount(pendingProviders),
    safeCount(changesProviders),
    safeCount(pendingPayments),
    safeCount(openIssues),
    safeCount(pendingVerification),
    safeCount(pendingReviews),
    safeCount(pendingSubs),
    (async () => {
      if (!auditSince) return 0;
      return safeCount(
        admin.from("audit_logs").select("id", { count: "exact", head: true }).gte("created_at", auditSince),
      );
    })(),
    (async () => {
      let q = db
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .eq("status", "pending");
      if (bookingsSince) q = q.gte("created_at", bookingsSince);
      return safeCount(q);
    })(),
    (async () => {
      if (!broadcastsSince) return 0;
      return safeCount(
        db
          .from("admin_broadcasts")
          .select("id", { count: "exact", head: true })
          .is("deleted_at", null)
          .gte("created_at", broadcastsSince),
      );
    })(),
    (async () => {
      try {
        const { getAuthUser } = await import("@/lib/auth/session");
        const user = await getAuthUser();
        if (!user) return 0;
        let q = admin
          .from("marketplace_notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .is("read_at", null);
        if (messagesSince) q = q.gte("created_at", messagesSince);
        return safeCount(q);
      } catch {
        return 0;
      }
    })(),
  ]);

  const businesses = pendingCount + changesCount;

  return {
    businesses,
    approvals: businesses,
    payments: paymentsCount,
    issues: issuesCount,
    verification: verificationCount,
    reviews: reviewsCount,
    subscriptions: subscriptionsCount,
    audit: auditCount,
    bookings: bookingsCount,
    broadcasts: broadcastsCount,
    messages: messagesCount,
  };
}
