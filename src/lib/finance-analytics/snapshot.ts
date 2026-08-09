/**
 * Sprint 6 Phase 6 — finance analytics snapshot (read-only over existing data).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getBillingSettings } from "@/lib/monetization/settings";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import type {
  ChartPoint,
  FinanceCharts,
  FinanceDashboardSnapshot,
  FinancePeriod,
  FinanceReportPayload,
  LeadPaymentKpis,
  ProviderFinanceRow,
  RecentFinanceItem,
  RefundDisputeKpis,
  RevenueKpis,
  SubscriptionKpis,
} from "./types";

const CACHE_KEY = "finance_dashboard_v1";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function usdAmount(amount: number, currency: string | null | undefined): number {
  return String(currency ?? "USD").toUpperCase() === "USD" ? Number(amount) || 0 : 0;
}

function startOfUtcDay(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

function periodBounds(period: FinancePeriod): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to);
  switch (period) {
    case "daily":
      return { from: startOfUtcDay(to), to };
    case "weekly":
      from.setUTCDate(from.getUTCDate() - 7);
      return { from, to };
    case "monthly":
      from.setUTCMonth(from.getUTCMonth() - 1);
      return { from, to };
    case "quarterly":
      from.setUTCMonth(from.getUTCMonth() - 3);
      return { from, to };
    case "yearly":
      from.setUTCFullYear(from.getUTCFullYear() - 1);
      return { from, to };
    default:
      return { from: startOfUtcDay(to), to };
  }
}

function localizedName(name: unknown): string {
  if (!name || typeof name !== "object") return "Provider";
  const n = name as { en?: string; ar?: string };
  return n.en || n.ar || "Provider";
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

async function readCache(): Promise<FinanceDashboardSnapshot | null> {
  try {
    const { data } = await db()
      .from("finance_analytics_cache")
      .select("payload, expires_at, computed_at")
      .eq("cache_key", CACHE_KEY)
      .maybeSingle();
    if (!data) return null;
    if (new Date(data.expires_at).getTime() < Date.now()) return null;
    const payload = data.payload as FinanceDashboardSnapshot;
    return { ...payload, fromCache: true, computedAt: String(data.computed_at) };
  } catch {
    return null;
  }
}

async function writeCache(
  snapshot: FinanceDashboardSnapshot,
  actorUserId?: string | null,
): Promise<void> {
  const expires = new Date(Date.now() + CACHE_TTL_MS).toISOString();
  try {
    await db().from("finance_analytics_cache").upsert(
      {
        cache_key: CACHE_KEY,
        payload: { ...snapshot, fromCache: false },
        computed_at: snapshot.computedAt,
        expires_at: expires,
        computed_by: actorUserId ?? null,
      },
      { onConflict: "cache_key" },
    );
    void emitAiLearningEvent({
      eventType: "finance_cache_refreshed",
      metadata: { anonymized: true },
    });
  } catch {
    // soft — views may not exist yet
  }
}

type PaidRow = {
  id: string;
  provider_id: string;
  purpose: string;
  currency: string;
  amount: number;
  refunded_amount: number | null;
  payment_reference: string | null;
  paid_at: string | null;
  created_at: string;
};

export async function computeFinanceDashboardSnapshot(input?: {
  forceRefresh?: boolean;
  actorUserId?: string | null;
}): Promise<FinanceDashboardSnapshot> {
  if (!input?.forceRefresh) {
    const cached = await readCache();
    if (cached) return cached;
  }

  const settings = await getBillingSettings();
  const businessPrice = settings.businessPriceUsd || 5;

  const now = new Date();
  const todayStart = startOfUtcDay(now);
  const weekStart = addDays(todayStart, -6);
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthAgo = addDays(todayStart, -30);
  const in7Days = addDays(todayStart, 7);

  const [
    paymentsRes,
    plansRes,
    refundsRes,
    disputesRes,
    bizPayRes,
    leadPayRes,
  ] = await Promise.all([
    db()
      .from("payments")
      .select(
        "id, provider_id, purpose, currency, amount, refunded_amount, payment_reference, paid_at, created_at, payment_status",
      )
      .eq("payment_status", "paid")
      .order("paid_at", { ascending: false })
      .limit(8000),
    db()
      .from("provider_monetization_plans")
      .select(
        "provider_id, billing_mode, status, business_started_at, business_expires_at, updated_at",
      )
      .limit(5000),
    db()
      .from("refund_requests")
      .select(
        "id, refund_amount, currency, status, refund_type, reason, completed_at, created_at, original_amount",
      )
      .order("created_at", { ascending: false })
      .limit(3000),
    db()
      .from("payment_disputes")
      .select("id, status, amount, currency, reason, opened_at, closed_at")
      .order("opened_at", { ascending: false })
      .limit(1000),
    db()
      .from("business_subscription_payments")
      .select("id, provider_id, renewal, activated_at, created_at, payment_id")
      .order("created_at", { ascending: false })
      .limit(2000),
    db()
      .from("lead_unlock_payments")
      .select(
        "id, provider_id, ai_price_usd, unlock_granted, unlocked_at, currency, payment_id",
      )
      .eq("unlock_granted", true)
      .order("unlocked_at", { ascending: false })
      .limit(4000),
  ]);

  const payments = ((paymentsRes.data ?? []) as Array<PaidRow & { payment_status: string }>);
  const plans = (plansRes.data ?? []) as Array<{
    provider_id: string;
    billing_mode: string;
    status: string;
    business_started_at: string | null;
    business_expires_at: string | null;
    updated_at: string;
  }>;
  const refunds = (refundsRes.data ?? []) as Array<{
    id: string;
    refund_amount: number;
    currency: string;
    status: string;
    refund_type: string;
    reason: string;
    completed_at: string | null;
    created_at: string;
    original_amount: number;
  }>;
  const disputes = (disputesRes.data ?? []) as Array<{
    id: string;
    status: string;
    amount: number | null;
    currency: string;
    reason: string | null;
    opened_at: string;
    closed_at: string | null;
  }>;
  const bizPays = (bizPayRes.data ?? []) as Array<{
    id: string;
    provider_id: string;
    renewal: boolean;
    activated_at: string | null;
    created_at: string;
    payment_id: string;
  }>;
  const leadPays = (leadPayRes.data ?? []) as Array<{
    id: string;
    provider_id: string;
    ai_price_usd: number | null;
    unlock_granted: boolean;
    unlocked_at: string | null;
    currency: string;
    payment_id: string;
  }>;

  // Provider names + geo for lead breakdown
  const providerIds = [
    ...new Set([
      ...payments.map((p) => p.provider_id),
      ...leadPays.map((p) => p.provider_id),
      ...plans.map((p) => p.provider_id),
    ]),
  ].filter(Boolean);

  const providerMeta = new Map<
    string,
    { name: string; cityId: string | null; categoryId: string | null }
  >();
  if (providerIds.length) {
    const { data: providers } = await db()
      .from("providers")
      .select("id, name, city_id, category_id")
      .in("id", providerIds.slice(0, 2000));
    for (const p of providers ?? []) {
      providerMeta.set(String(p.id), {
        name: localizedName(p.name),
        cityId: p.city_id ? String(p.city_id) : null,
        categoryId: p.category_id ? String(p.category_id) : null,
      });
    }
  }

  const cityIds = [
    ...new Set(
      [...providerMeta.values()].map((p) => p.cityId).filter(Boolean) as string[],
    ),
  ];
  const categoryIds = [
    ...new Set(
      [...providerMeta.values()]
        .map((p) => p.categoryId)
        .filter(Boolean) as string[],
    ),
  ];

  const cityLabel = new Map<string, { city: string; country: string }>();
  if (cityIds.length) {
    const { data: cities } = await db()
      .from("cities")
      .select("id, name, country_code")
      .in("id", cityIds);
    for (const c of cities ?? []) {
      cityLabel.set(String(c.id), {
        city: localizedName(c.name),
        country: String(c.country_code ?? "SY"),
      });
    }
  }

  const categoryLabel = new Map<string, string>();
  if (categoryIds.length) {
    const { data: cats } = await db()
      .from("categories")
      .select("id, name")
      .in("id", categoryIds);
    for (const c of cats ?? []) {
      categoryLabel.set(String(c.id), localizedName(c.name));
    }
  }

  let today = 0;
  let thisWeek = 0;
  let thisMonth = 0;
  let thisYear = 0;
  let lifetime = 0;
  let lifetimeRefunded = 0;

  const dailyMap = new Map<string, number>();
  const monthlyMap = new Map<string, number>();
  const leadDaily = new Map<string, number>();
  const providerRevenue = new Map<string, number>();
  const providerUnlocks = new Map<string, number>();

  for (const p of payments) {
    const gross = usdAmount(p.amount, p.currency);
    const refunded = usdAmount(p.refunded_amount ?? 0, p.currency);
    const net = gross - refunded;
    const ts = p.paid_at || p.created_at;
    const t = new Date(ts).getTime();

    lifetime += gross;
    lifetimeRefunded += refunded;

    if (t >= todayStart.getTime()) today += net;
    if (t >= weekStart.getTime()) thisWeek += net;
    if (t >= monthStart.getTime()) thisMonth += net;
    if (t >= yearStart.getTime()) thisYear += net;

    const dk = dayKey(ts);
    const mk = monthKey(ts);
    dailyMap.set(dk, (dailyMap.get(dk) ?? 0) + net);
    monthlyMap.set(mk, (monthlyMap.get(mk) ?? 0) + net);

    providerRevenue.set(
      p.provider_id,
      (providerRevenue.get(p.provider_id) ?? 0) + net,
    );

    if (p.purpose === "unlock_fee" || p.purpose === "lead_unlock") {
      leadDaily.set(dk, (leadDaily.get(dk) ?? 0) + net);
      providerUnlocks.set(
        p.provider_id,
        (providerUnlocks.get(p.provider_id) ?? 0) + 1,
      );
    }
  }

  const activeBusiness = plans.filter(
    (p) => p.billing_mode === "business" && p.status === "active",
  ).length;
  const freeProviders = plans.filter((p) => p.billing_mode === "free").length;
  const totalPlans = plans.length || 1;
  const mrr = round2(activeBusiness * businessPrice);
  const arr = round2(mrr * 12);
  const payingProviders = new Set(
    payments.filter((p) => usdAmount(p.amount, p.currency) > 0).map((p) => p.provider_id),
  ).size;
  const arpp = payingProviders > 0 ? round2((lifetime - lifetimeRefunded) / payingProviders) : 0;

  const revenue: RevenueKpis = {
    today: round2(today),
    thisWeek: round2(thisWeek),
    thisMonth: round2(thisMonth),
    thisYear: round2(thisYear),
    lifetime: round2(lifetime - lifetimeRefunded),
    mrr,
    arr,
    arpp,
    currency: "USD",
  };

  const newSubscriptions = bizPays.filter((b) => {
    const at = b.activated_at || b.created_at;
    return !b.renewal && new Date(at).getTime() >= monthAgo.getTime();
  }).length;
  const renewals = bizPays.filter((b) => {
    const at = b.activated_at || b.created_at;
    return b.renewal && new Date(at).getTime() >= monthAgo.getTime();
  }).length;
  const expiringSoon = plans.filter((p) => {
    if (p.billing_mode !== "business" || !p.business_expires_at) return false;
    const exp = new Date(p.business_expires_at).getTime();
    return exp >= now.getTime() && exp <= in7Days.getTime();
  }).length;
  const cancelled = plans.filter((p) => p.status === "cancelled").length;
  const conversionRate = round2((activeBusiness / totalPlans) * 100);
  const churnRate = round2(
    (cancelled / Math.max(1, activeBusiness + cancelled)) * 100,
  );

  const subscriptions: SubscriptionKpis = {
    activeBusiness,
    freeProviders,
    newSubscriptions,
    renewals,
    expiringSoon,
    cancelled,
    conversionRate,
    churnRate,
  };

  // Lead KPIs
  let leadRevenue = 0;
  let leadCount = 0;
  const byCategory = new Map<string, number>();
  const byCountry = new Map<string, number>();
  const byCity = new Map<string, number>();
  const leadProviderRev = new Map<string, { revenue: number; unlocks: number }>();

  for (const lp of leadPays) {
    const price = Number(lp.ai_price_usd ?? 0);
    leadRevenue += price;
    leadCount += 1;
    const meta = providerMeta.get(lp.provider_id);
    const cat = meta?.categoryId
      ? categoryLabel.get(meta.categoryId) ?? "Other"
      : "Other";
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + price);
    if (meta?.cityId) {
      const city = cityLabel.get(meta.cityId);
      if (city) {
        byCity.set(city.city, (byCity.get(city.city) ?? 0) + price);
        byCountry.set(city.country, (byCountry.get(city.country) ?? 0) + price);
      }
    }
    const prev = leadProviderRev.get(lp.provider_id) ?? {
      revenue: 0,
      unlocks: 0,
    };
    prev.revenue += price;
    prev.unlocks += 1;
    leadProviderRev.set(lp.provider_id, prev);
  }

  // Fallback lead revenue from payments if lead_unlock_payments empty
  if (leadCount === 0) {
    for (const p of payments) {
      if (p.purpose === "unlock_fee" || p.purpose === "lead_unlock") {
        const net =
          usdAmount(p.amount, p.currency) -
          usdAmount(p.refunded_amount ?? 0, p.currency);
        leadRevenue += net;
        leadCount += 1;
      }
    }
  }

  const topPayingProviders = [...leadProviderRev.entries()]
    .map(([providerId, v]) => ({
      providerId,
      name: providerMeta.get(providerId)?.name ?? "Provider",
      revenue: round2(v.revenue),
      unlocks: v.unlocks,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const leads: LeadPaymentKpis = {
    unlockedLeads: leadCount,
    averageLeadPrice: leadCount ? round2(leadRevenue / leadCount) : 0,
    totalLeadRevenue: round2(leadRevenue),
    byCategory: [...byCategory.entries()]
      .map(([label, value]) => ({ label, value: round2(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12),
    byCountry: [...byCountry.entries()]
      .map(([label, value]) => ({ label, value: round2(value) }))
      .sort((a, b) => b.value - a.value),
    byCity: [...byCity.entries()]
      .map(([label, value]) => ({ label, value: round2(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12),
    topPayingProviders,
  };

  // Refunds & disputes
  const succeededRefunds = refunds.filter((r) => r.status === "succeeded");
  const refundVolume = round2(
    succeededRefunds.reduce(
      (s, r) => s + usdAmount(r.refund_amount, r.currency),
      0,
    ),
  );
  const paidGross = lifetime || 1;
  const refundRate = round2((refundVolume / paidGross) * 100);
  const partialRefunds = succeededRefunds.filter(
    (r) => r.refund_type === "partial",
  ).length;
  const fullRefunds = succeededRefunds.filter(
    (r) => r.refund_type === "full" || r.refund_type === "manual",
  ).length;

  const reasonCounts = new Map<string, number>();
  for (const r of succeededRefunds) {
    const key = (r.reason || "unspecified").trim().slice(0, 80) || "unspecified";
    reasonCounts.set(key, (reasonCounts.get(key) ?? 0) + 1);
  }

  const openDisputes = disputes.filter((d) =>
    ["opened", "evidence_requested", "evidence_submitted", "under_review"].includes(
      d.status,
    ),
  ).length;
  const wonDisputes = disputes.filter((d) => d.status === "won").length;
  const lostDisputes = disputes.filter((d) => d.status === "lost").length;

  let resolutionSum = 0;
  let resolutionN = 0;
  for (const d of disputes) {
    if (d.closed_at && d.opened_at) {
      resolutionSum +=
        (new Date(d.closed_at).getTime() - new Date(d.opened_at).getTime()) /
        36e5;
      resolutionN += 1;
    }
  }

  const refundsKpis: RefundDisputeKpis = {
    refundCount: succeededRefunds.length,
    refundVolume,
    refundRate,
    partialRefunds,
    fullRefunds,
    openDisputes,
    wonDisputes,
    lostDisputes,
    averageResolutionHours: resolutionN
      ? round2(resolutionSum / resolutionN)
      : 0,
    topRefundReasons: [...reasonCounts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
  };

  // Charts
  const last30: ChartPoint[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = addDays(todayStart, -i);
    const key = d.toISOString().slice(0, 10);
    last30.push({
      label: key.slice(5),
      value: round2(dailyMap.get(key) ?? 0),
    });
  }

  const last12Months: ChartPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = d.toISOString().slice(0, 7);
    last12Months.push({
      label: key,
      value: round2(monthlyMap.get(key) ?? 0),
    });
  }

  const subGrowth: ChartPoint[] = [];
  const mrrTrend: ChartPoint[] = [];
  const arrTrend: ChartPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = d.toISOString().slice(0, 7);
    const monthEnd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
    const activeAt = plans.filter((p) => {
      if (p.billing_mode !== "business") return false;
      const started = p.business_started_at
        ? new Date(p.business_started_at).getTime()
        : 0;
      const expired = p.business_expires_at
        ? new Date(p.business_expires_at).getTime()
        : Infinity;
      return started < monthEnd.getTime() && expired >= d.getTime();
    }).length;
    const monthMrr = round2(activeAt * businessPrice);
    subGrowth.push({ label: key, value: activeAt });
    mrrTrend.push({ label: key, value: monthMrr });
    arrTrend.push({ label: key, value: round2(monthMrr * 12) });
  }

  const leadRev30: ChartPoint[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = addDays(todayStart, -i);
    const key = d.toISOString().slice(0, 10);
    leadRev30.push({
      label: key.slice(5),
      value: round2(leadDaily.get(key) ?? 0),
    });
  }

  const refundDaily = new Map<string, number>();
  for (const r of succeededRefunds) {
    const ts = r.completed_at || r.created_at;
    const key = dayKey(ts);
    refundDaily.set(
      key,
      (refundDaily.get(key) ?? 0) + usdAmount(r.refund_amount, r.currency),
    );
  }
  const refundTrend: ChartPoint[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = addDays(todayStart, -i);
    const key = d.toISOString().slice(0, 10);
    refundTrend.push({
      label: key.slice(5),
      value: round2(refundDaily.get(key) ?? 0),
    });
  }

  const charts: FinanceCharts = {
    dailyRevenue: last30,
    monthlyRevenue: last12Months,
    subscriptionGrowth: subGrowth,
    leadRevenue: leadRev30,
    refundTrend,
    mrrTrend,
    arrTrend,
  };

  // Provider analytics
  const planMode = new Map(
    plans.map((p) => [p.provider_id, p.billing_mode as "free" | "business"]),
  );
  const topProviders: ProviderFinanceRow[] = [...providerRevenue.entries()]
    .map(([providerId, revenueAmt]) => {
      const unlocks = providerUnlocks.get(providerId) ?? 0;
      const mode = planMode.get(providerId) ?? "unknown";
      return {
        providerId,
        name: providerMeta.get(providerId)?.name ?? "Provider",
        billingMode: mode as ProviderFinanceRow["billingMode"],
        revenue: round2(revenueAmt),
        spending: round2(revenueAmt),
        unlocks,
        lifetimeValue: round2(revenueAmt),
      };
    })
    .sort((a, b) => b.lifetimeValue - a.lifetimeValue)
    .slice(0, 15);

  const recentTransactions: RecentFinanceItem[] = payments.slice(0, 12).map((p) => ({
    id: p.id,
    kind: "payment" as const,
    label: `${p.purpose} · ${p.payment_reference ?? p.id.slice(0, 8)}`,
    amount: usdAmount(p.amount, p.currency),
    currency: p.currency || "USD",
    status: "paid",
    at: p.paid_at || p.created_at,
  }));

  const recentRefunds: RecentFinanceItem[] = refunds.slice(0, 10).map((r) => ({
    id: r.id,
    kind: "refund" as const,
    label: r.reason?.slice(0, 60) || r.refund_type,
    amount: usdAmount(r.refund_amount, r.currency),
    currency: r.currency || "USD",
    status: r.status,
    at: r.completed_at || r.created_at,
  }));

  const recentSubscriptions: RecentFinanceItem[] = bizPays.slice(0, 10).map((b) => ({
    id: b.id,
    kind: "subscription" as const,
    label: b.renewal ? "Renewal" : "New Business plan",
    amount: businessPrice,
    currency: "USD",
    status: b.activated_at ? "activated" : "pending",
    at: b.activated_at || b.created_at,
  }));

  const snapshot: FinanceDashboardSnapshot = {
    revenue,
    subscriptions,
    leads,
    refunds: refundsKpis,
    charts,
    topProviders,
    recentTransactions,
    recentRefunds,
    recentSubscriptions,
    computedAt: new Date().toISOString(),
    fromCache: false,
  };

  await writeCache(snapshot, input?.actorUserId);
  return snapshot;
}

export async function buildFinanceReport(
  period: FinancePeriod,
): Promise<FinanceReportPayload> {
  const { from, to } = periodBounds(period);
  const snapshot = await computeFinanceDashboardSnapshot({ forceRefresh: false });

  const { data } = await db()
    .from("payments")
    .select(
      "id, provider_id, purpose, currency, amount, refunded_amount, payment_reference, paid_at, created_at, payment_status",
    )
    .eq("payment_status", "paid")
    .gte("paid_at", from.toISOString())
    .lte("paid_at", to.toISOString())
    .order("paid_at", { ascending: false })
    .limit(2000);

  const payments = ((data ?? []) as PaidRow[]).map((p) => {
    const amount = usdAmount(p.amount, p.currency);
    const refunded = usdAmount(p.refunded_amount ?? 0, p.currency);
    return {
      id: p.id,
      reference: p.payment_reference ?? p.id,
      purpose: p.purpose,
      amount,
      refunded,
      net: round2(amount - refunded),
      currency: p.currency || "USD",
      paidAt: p.paid_at,
      providerId: p.provider_id,
    };
  });

  return {
    period,
    from: from.toISOString(),
    to: to.toISOString(),
    revenue: snapshot.revenue,
    subscriptions: snapshot.subscriptions,
    leads: snapshot.leads,
    refunds: snapshot.refunds,
    payments,
    generatedAt: new Date().toISOString(),
  };
}

export function financeReportToCsv(report: FinanceReportPayload): string {
  const lines: string[] = [];
  lines.push("section,metric,value");
  lines.push(`meta,period,${report.period}`);
  lines.push(`meta,from,${report.from}`);
  lines.push(`meta,to,${report.to}`);
  lines.push(`meta,generatedAt,${report.generatedAt}`);
  lines.push(`revenue,today,${report.revenue.today}`);
  lines.push(`revenue,thisWeek,${report.revenue.thisWeek}`);
  lines.push(`revenue,thisMonth,${report.revenue.thisMonth}`);
  lines.push(`revenue,thisYear,${report.revenue.thisYear}`);
  lines.push(`revenue,lifetime,${report.revenue.lifetime}`);
  lines.push(`revenue,mrr,${report.revenue.mrr}`);
  lines.push(`revenue,arr,${report.revenue.arr}`);
  lines.push(`revenue,arpp,${report.revenue.arpp}`);
  lines.push(`subscriptions,activeBusiness,${report.subscriptions.activeBusiness}`);
  lines.push(`subscriptions,conversionRate,${report.subscriptions.conversionRate}`);
  lines.push(`subscriptions,churnRate,${report.subscriptions.churnRate}`);
  lines.push(`leads,unlocked,${report.leads.unlockedLeads}`);
  lines.push(`leads,totalRevenue,${report.leads.totalLeadRevenue}`);
  lines.push(`leads,avgPrice,${report.leads.averageLeadPrice}`);
  lines.push(`refunds,count,${report.refunds.refundCount}`);
  lines.push(`refunds,volume,${report.refunds.refundVolume}`);
  lines.push(`refunds,rate,${report.refunds.refundRate}`);
  lines.push("");
  lines.push("payment_id,reference,purpose,amount,refunded,net,currency,paid_at,provider_id");
  for (const p of report.payments) {
    lines.push(
      [
        p.id,
        csvEscape(p.reference),
        p.purpose,
        p.amount,
        p.refunded,
        p.net,
        p.currency,
        p.paidAt ?? "",
        p.providerId,
      ].join(","),
    );
  }
  return lines.join("\n");
}

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export async function financeReportToPdf(
  report: FinanceReportPayload,
): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text("Dalily Finance Report", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor("#444");
    doc.text(`Period: ${report.period}`);
    doc.text(`From: ${report.from}`);
    doc.text(`To: ${report.to}`);
    doc.text(`Generated: ${report.generatedAt}`);
    doc.moveDown();
    doc.fillColor("#000").fontSize(13).text("Revenue");
    doc.fontSize(10);
    doc.text(`Lifetime (net): $${report.revenue.lifetime}`);
    doc.text(`This month: $${report.revenue.thisMonth}`);
    doc.text(`MRR: $${report.revenue.mrr} · ARR: $${report.revenue.arr}`);
    doc.text(`ARPP: $${report.revenue.arpp}`);
    doc.moveDown();
    doc.fontSize(13).text("Subscriptions");
    doc.fontSize(10);
    doc.text(`Active Business: ${report.subscriptions.activeBusiness}`);
    doc.text(`Conversion: ${report.subscriptions.conversionRate}%`);
    doc.text(`Churn: ${report.subscriptions.churnRate}%`);
    doc.moveDown();
    doc.fontSize(13).text("Lead payments");
    doc.fontSize(10);
    doc.text(`Unlocked: ${report.leads.unlockedLeads}`);
    doc.text(`Revenue: $${report.leads.totalLeadRevenue}`);
    doc.text(`Avg price: $${report.leads.averageLeadPrice}`);
    doc.moveDown();
    doc.fontSize(13).text("Refunds & disputes");
    doc.fontSize(10);
    doc.text(`Refunds: ${report.refunds.refundCount} ($${report.refunds.refundVolume})`);
    doc.text(`Refund rate: ${report.refunds.refundRate}%`);
    doc.text(
      `Disputes open/won/lost: ${report.refunds.openDisputes}/${report.refunds.wonDisputes}/${report.refunds.lostDisputes}`,
    );
    doc.moveDown();
    doc.fontSize(13).text(`Payments in period (${report.payments.length})`);
    doc.fontSize(9);
    for (const p of report.payments.slice(0, 40)) {
      doc.text(
        `${p.paidAt?.slice(0, 10) ?? "—"}  ${p.purpose}  $${p.net}  ${p.reference}`,
      );
    }
    if (report.payments.length > 40) {
      doc.text(`… and ${report.payments.length - 40} more`);
    }
    doc.end();
  });
}
