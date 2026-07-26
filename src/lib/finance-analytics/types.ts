/** Sprint 6 Phase 6 — finance analytics types (read-only over existing payments). */

export type FinancePeriod =
  | "daily"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "yearly";

export type ChartPoint = {
  label: string;
  value: number;
  secondary?: number;
};

export type RevenueKpis = {
  today: number;
  thisWeek: number;
  thisMonth: number;
  thisYear: number;
  lifetime: number;
  mrr: number;
  arr: number;
  arpp: number;
  currency: string;
};

export type SubscriptionKpis = {
  activeBusiness: number;
  freeProviders: number;
  newSubscriptions: number;
  renewals: number;
  expiringSoon: number;
  cancelled: number;
  conversionRate: number;
  churnRate: number;
};

export type LeadPaymentKpis = {
  unlockedLeads: number;
  averageLeadPrice: number;
  totalLeadRevenue: number;
  byCategory: Array<{ label: string; value: number }>;
  byCountry: Array<{ label: string; value: number }>;
  byCity: Array<{ label: string; value: number }>;
  topPayingProviders: Array<{
    providerId: string;
    name: string;
    revenue: number;
    unlocks: number;
  }>;
};

export type RefundDisputeKpis = {
  refundCount: number;
  refundVolume: number;
  refundRate: number;
  partialRefunds: number;
  fullRefunds: number;
  openDisputes: number;
  wonDisputes: number;
  lostDisputes: number;
  averageResolutionHours: number;
  topRefundReasons: Array<{ reason: string; count: number }>;
};

export type ProviderFinanceRow = {
  providerId: string;
  name: string;
  billingMode: "free" | "business" | "unknown";
  revenue: number;
  spending: number;
  unlocks: number;
  lifetimeValue: number;
};

export type RecentFinanceItem = {
  id: string;
  kind: "payment" | "refund" | "subscription";
  label: string;
  amount: number;
  currency: string;
  status: string;
  at: string;
};

export type FinanceCharts = {
  dailyRevenue: ChartPoint[];
  monthlyRevenue: ChartPoint[];
  subscriptionGrowth: ChartPoint[];
  leadRevenue: ChartPoint[];
  refundTrend: ChartPoint[];
  mrrTrend: ChartPoint[];
  arrTrend: ChartPoint[];
};

export type FinanceDashboardSnapshot = {
  revenue: RevenueKpis;
  subscriptions: SubscriptionKpis;
  leads: LeadPaymentKpis;
  refunds: RefundDisputeKpis;
  charts: FinanceCharts;
  topProviders: ProviderFinanceRow[];
  recentTransactions: RecentFinanceItem[];
  recentRefunds: RecentFinanceItem[];
  recentSubscriptions: RecentFinanceItem[];
  computedAt: string;
  fromCache: boolean;
};

export type FinanceReportPayload = {
  period: FinancePeriod;
  from: string;
  to: string;
  revenue: RevenueKpis;
  subscriptions: SubscriptionKpis;
  leads: LeadPaymentKpis;
  refunds: RefundDisputeKpis;
  payments: Array<{
    id: string;
    reference: string;
    purpose: string;
    amount: number;
    refunded: number;
    net: number;
    currency: string;
    paidAt: string | null;
    providerId: string;
  }>;
  generatedAt: string;
};
