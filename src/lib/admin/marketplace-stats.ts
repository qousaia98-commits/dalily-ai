import { createAdminClient } from "@/lib/supabase/admin";

export type MarketplaceStats = {
  totalRequests: number;
  acceptanceRate: number;
  quoteAcceptanceRate: number;
  completionRate: number;
  disputeRate: number;
  averageResponseHours: number | null;
  averageCompletionHours: number | null;
  averageRating: number | null;
  topBusinesses: Array<{ providerId: string; name: string; count: number }>;
  mostActiveCustomers: Array<{ userId: string; name: string; count: number }>;
  daily: Array<{ day: string; count: number }>;
  monthly: Array<{ month: string; count: number }>;
};

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

export async function getMarketplaceStats(): Promise<MarketplaceStats> {
  try {
    const admin = createAdminClient();
    const { data: requests } = await admin
      .from("service_requests")
      .select(
        "id, status, provider_id, customer_id, response_time_seconds, completion_time_seconds, created_at, quote_accepted_at, quoted_at",
      );

    const rows = requests ?? [];
    const total = rows.length;
    const accepted = rows.filter((r) =>
      [
        "accepted",
        "quoted",
        "quote_accepted",
        "quote_declined",
        "in_progress",
        "completed_by_business",
        "completed",
        "disputed",
        "reviewed",
      ].includes(r.status),
    ).length;
    const quoted = rows.filter(
      (r) => Boolean(r.quoted_at) || ["quoted", "quote_accepted", "quote_declined"].includes(r.status),
    ).length;
    const quoteAccepted = rows.filter((r) => Boolean(r.quote_accepted_at)).length;
    const completed = rows.filter((r) => ["completed", "reviewed"].includes(r.status)).length;
    const disputed = rows.filter((r) => r.status === "disputed").length;

    const responseTimes = rows
      .map((r) => r.response_time_seconds)
      .filter((v): v is number => typeof v === "number" && v >= 0);
    const completionTimes = rows
      .map((r) => r.completion_time_seconds)
      .filter((v): v is number => typeof v === "number" && v >= 0);

    const avg = (vals: number[]) =>
      vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length / 3600 : null;

    const { data: reviews } = await admin.from("service_reviews").select("rating");
    const ratings = (reviews ?? []).map((r) => r.rating as number);
    const averageRating = ratings.length
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null;

    const byProvider = new Map<string, number>();
    const byCustomer = new Map<string, number>();
    for (const r of rows) {
      byProvider.set(r.provider_id, (byProvider.get(r.provider_id) ?? 0) + 1);
      byCustomer.set(r.customer_id, (byCustomer.get(r.customer_id) ?? 0) + 1);
    }

    const topProviderIds = [...byProvider.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const topCustomerIds = [...byCustomer.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const providerIds = topProviderIds.map(([id]) => id);
    const customerIds = topCustomerIds.map(([id]) => id);

    const [{ data: providers }, { data: profiles }] = await Promise.all([
      providerIds.length
        ? admin.from("providers").select("id, name").in("id", providerIds)
        : Promise.resolve({ data: [] }),
      customerIds.length
        ? admin.from("profiles").select("user_id, display_name").in("user_id", customerIds)
        : Promise.resolve({ data: [] }),
    ]);

    const providerName = new Map(
      (providers ?? []).map((p) => [
        p.id,
        typeof p.name === "object" && p.name
          ? ((p.name as { en?: string }).en ?? "Business")
          : "Business",
      ]),
    );
    const customerName = new Map(
      (profiles ?? []).map((p) => [p.user_id, p.display_name as string]),
    );

    const dailyMap = new Map<string, number>();
    const monthlyMap = new Map<string, number>();
    for (const r of rows) {
      const d = new Date(r.created_at);
      const day = d.toISOString().slice(0, 10);
      const month = d.toISOString().slice(0, 7);
      dailyMap.set(day, (dailyMap.get(day) ?? 0) + 1);
      monthlyMap.set(month, (monthlyMap.get(month) ?? 0) + 1);
    }

    return {
      totalRequests: total,
      acceptanceRate: pct(accepted, total),
      quoteAcceptanceRate: pct(quoteAccepted, Math.max(quoted, 1)),
      completionRate: pct(completed, Math.max(accepted, 1)),
      disputeRate: pct(disputed, Math.max(accepted, 1)),
      averageResponseHours: avg(responseTimes),
      averageCompletionHours: avg(completionTimes),
      averageRating,
      topBusinesses: topProviderIds.map(([id, count]) => ({
        providerId: id,
        name: providerName.get(id) ?? "Business",
        count,
      })),
      mostActiveCustomers: topCustomerIds.map(([id, count]) => ({
        userId: id,
        name: customerName.get(id) ?? "Customer",
        count,
      })),
      daily: [...dailyMap.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-14)
        .map(([day, count]) => ({ day, count })),
      monthly: [...monthlyMap.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-6)
        .map(([month, count]) => ({ month, count })),
    };
  } catch {
    return {
      totalRequests: 0,
      acceptanceRate: 0,
      quoteAcceptanceRate: 0,
      completionRate: 0,
      disputeRate: 0,
      averageResponseHours: null,
      averageCompletionHours: null,
      averageRating: null,
      topBusinesses: [],
      mostActiveCustomers: [],
      daily: [],
      monthly: [],
    };
  }
}
