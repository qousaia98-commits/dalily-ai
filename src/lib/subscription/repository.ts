import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database, LocalizedJson } from "@/types/database.types";
import type { PlanFeatures, PlanSlug, SubscriptionPlanRow } from "@/lib/subscription/types";
import { listPaymentEvents } from "@/lib/payment/payment-events";

type PlanDbRow = Database["public"]["Tables"]["subscription_plans"]["Row"];
type SubscriptionDbRow = Database["public"]["Tables"]["subscriptions"]["Row"];

function mapPlan(row: PlanDbRow): SubscriptionPlanRow {
  return {
    id: row.id,
    slug: row.slug as PlanSlug,
    name: row.name as LocalizedJson,
    monthlyPriceUsd: Number(row.monthly_price_usd),
    yearlyPriceUsd: Number(row.yearly_price_usd),
    features: row.features as PlanFeatures,
    isActive: row.is_active,
  };
}

export async function listActivePlans(): Promise<SubscriptionPlanRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscription_plans")
    .select("*")
    .eq("is_active", true)
    .order("monthly_price_usd", { ascending: true });

  return (data ?? []).map(mapPlan);
}

export async function getPlanBySlug(slug: PlanSlug): Promise<SubscriptionPlanRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("subscription_plans")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  return data ? mapPlan(data) : null;
}

export async function getPlanById(planId: string): Promise<SubscriptionPlanRow | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("subscription_plans").select("*").eq("id", planId).maybeSingle();
  return data ? mapPlan(data) : null;
}

export async function getCurrentSubscription(providerId: string) {
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("subscriptions")
    .select("*")
    .eq("provider_id", providerId)
    .in("status", ["trial", "active", "pending_payment"])
    .order("created_at", { ascending: false });

  if (!rows?.length) return null;

  const planIds = [...new Set(rows.map((row) => row.plan_id))];
  const { data: plans } = await admin.from("subscription_plans").select("id, slug, name, features, monthly_price_usd, yearly_price_usd").in("id", planIds);
  const planById = new Map((plans ?? []).map((plan) => [plan.id, plan]));

  const tierOf = (planId: string) => {
    const slug = planById.get(planId)?.slug ?? "free";
    if (slug === "premium") return 3;
    if (slug === "pro") return 2;
    return 1;
  };

  const activeOrTrial = rows.filter((row) => row.status === "active" || row.status === "trial");
  const preferredPool = activeOrTrial.length > 0 ? activeOrTrial : rows;
  const preferred = [...preferredPool].sort((a, b) => tierOf(b.plan_id) - tierOf(a.plan_id))[0];

  const plan = preferred ? planById.get(preferred.plan_id) : null;
  const mapped = plan
    ? {
        id: preferred.id,
        providerId: preferred.provider_id,
        planId: preferred.plan_id,
        planSlug: (plan.slug ?? "free") as PlanSlug,
        planName: (plan.name as { en: string; ar: string }) ?? { en: "Free", ar: "مجاني" },
        features: (plan.features as PlanFeatures) ?? ({} as PlanFeatures),
        status: preferred.status,
        startsAt: preferred.starts_at,
        expiresAt: preferred.expires_at,
        autoRenew: preferred.auto_renew,
        monthlyPriceUsd: Number(plan.monthly_price_usd ?? 0),
        yearlyPriceUsd: Number(plan.yearly_price_usd ?? 0),
      }
    : null;

  return mapped;
}

export async function ensureFreeSubscription(providerId: string): Promise<void> {
  const existing = await getCurrentSubscription(providerId);
  if (existing) return;

  const freePlan = await getPlanBySlug("free");
  if (!freePlan) return;

  const admin = createAdminClient();
  await admin.from("subscriptions").insert({
    provider_id: providerId,
    plan_id: freePlan.id,
    status: "active",
    auto_renew: true,
  });
}

export async function getPaymentHistory(providerId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("*")
    .eq("provider_id", providerId)
    .order("created_at", { ascending: false })
    .limit(20);

  const subscriptionIds = [
    ...new Set((data ?? []).map((row) => row.subscription_id).filter(Boolean) as string[]),
  ];

  const planSlugByPaymentId = new Map<string, PlanSlug>();
  if (subscriptionIds.length > 0) {
    const admin = createAdminClient();
    const { data: subscriptions } = await admin
      .from("subscriptions")
      .select("id, plan_id")
      .in("id", subscriptionIds);
    const planIds = [...new Set((subscriptions ?? []).map((s) => s.plan_id))];
    const { data: plans } = await admin.from("subscription_plans").select("id, slug").in("id", planIds);
    const slugByPlanId = new Map((plans ?? []).map((p) => [p.id, p.slug as PlanSlug]));
    const planBySubId = new Map(
      (subscriptions ?? []).map((s) => [s.id, slugByPlanId.get(s.plan_id) ?? "pro"]),
    );
    for (const row of data ?? []) {
      if (row.subscription_id) {
        planSlugByPaymentId.set(row.id, planBySubId.get(row.subscription_id) ?? "pro");
      }
    }
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    amount: Number(row.amount),
    currency: row.currency,
    paymentStatus: row.payment_status,
    paymentProvider: row.payment_provider,
    paymentReference: row.payment_reference,
    receiptPath: row.receipt_path,
    receiptMimeType: row.receipt_mime_type,
    submittedAt: row.submitted_at,
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
    rejectedAt: row.rejected_at,
    rejectedBy: row.rejected_by,
    adminNote: row.admin_note,
    paidAt: row.paid_at,
    createdAt: row.created_at,
    planSlug: planSlugByPaymentId.get(row.id) ?? ("pro" as PlanSlug),
  }));
}

export async function getActivePlanSlugsByProviderIds(
  providerIds: string[],
): Promise<Map<string, PlanSlug>> {
  const map = new Map<string, PlanSlug>();
  if (providerIds.length === 0) return map;

  const admin = createAdminClient();
  const { data: subscriptions } = await admin
    .from("subscriptions")
    .select("provider_id, plan_id")
    .in("provider_id", providerIds)
    .in("status", ["trial", "active"]);

  const planIds = [...new Set((subscriptions ?? []).map((row) => row.plan_id))];
  const { data: plans } = await admin.from("subscription_plans").select("id, slug").in("id", planIds);
  const slugByPlanId = new Map((plans ?? []).map((plan) => [plan.id, plan.slug as PlanSlug]));

  const tierOf = (slug: PlanSlug) => {
    if (slug === "premium") return 3;
    if (slug === "pro") return 2;
    return 1;
  };

  for (const row of subscriptions ?? []) {
    const slug = slugByPlanId.get(row.plan_id) ?? "free";
    const current = map.get(row.provider_id);
    if (!current || tierOf(slug) > tierOf(current)) {
      map.set(row.provider_id, slug);
    }
  }

  for (const id of providerIds) {
    if (!map.has(id)) map.set(id, "free");
  }

  return map;
}

export async function listSubscriptionsForAdmin(params: {
  search?: string;
  status?: SubscriptionDbRow["status"] | "all";
  planSlug?: PlanSlug | "all";
  page?: number;
  pageSize?: number;
}) {
  const admin = createAdminClient();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = admin.from("subscriptions").select("*", { count: "exact" }).order("created_at", {
    ascending: false,
  });

  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }

  const { data, count, error } = await query.range(from, to);
  if (error || !data?.length) {
    return { items: [], total: count ?? 0, page, pageSize };
  }

  const providerIds = [...new Set(data.map((row) => row.provider_id))];
  const planIds = [...new Set(data.map((row) => row.plan_id))];

  const [{ data: providers }, { data: plans }] = await Promise.all([
    admin.from("providers").select("id, name, slug").in("id", providerIds),
    admin.from("subscription_plans").select("id, slug, name").in("id", planIds),
  ]);

  const providerById = new Map((providers ?? []).map((p) => [p.id, p]));
  const planById = new Map((plans ?? []).map((p) => [p.id, p]));

  let items = data.map((row) => {
    const provider = providerById.get(row.provider_id);
    const plan = planById.get(row.plan_id);
    return {
      id: row.id,
      providerId: row.provider_id,
      providerName: (provider?.name as LocalizedJson) ?? { en: "", ar: "" },
      planSlug: (plan?.slug ?? "free") as string,
      planName: (plan?.name as LocalizedJson) ?? { en: "", ar: "" },
      status: row.status,
      startsAt: row.starts_at,
      expiresAt: row.expires_at,
      autoRenew: row.auto_renew,
    };
  });

  if (params.planSlug && params.planSlug !== "all") {
    items = items.filter((item) => item.planSlug === params.planSlug);
  }

  const term = params.search?.trim().toLowerCase();
  if (term) {
    items = items.filter((item) => {
      const name = `${item.providerName.en} ${item.providerName.ar}`.toLowerCase();
      return name.includes(term) || item.planSlug.includes(term);
    });
  }

  return { items, total: count ?? items.length, page, pageSize };
}

export async function listPaymentsForAdmin(params: {
  status?: Database["public"]["Enums"]["payment_status"] | "all";
  page?: number;
  pageSize?: number;
}) {
  const admin = createAdminClient();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = admin.from("payments").select("*", { count: "exact" }).order("created_at", {
    ascending: false,
  });

  if (params.status && params.status !== "all") {
    query = query.eq("payment_status", params.status);
  }

  const { data, count, error } = await query.range(from, to);
  if (error || !data?.length) {
    return { items: [], total: count ?? 0, page, pageSize };
  }

  const providerIds = [...new Set(data.map((row) => row.provider_id))];
  const subscriptionIds = [
    ...new Set(data.map((row) => row.subscription_id).filter(Boolean) as string[]),
  ];

  const [{ data: providers }, { data: subscriptions }, { data: plans }] = await Promise.all([
    admin.from("providers").select("id, name, owner_id, phone, email").in("id", providerIds),
    subscriptionIds.length
      ? admin.from("subscriptions").select("id, plan_id").in("id", subscriptionIds)
      : Promise.resolve({ data: [] as { id: string; plan_id: string }[] }),
    admin.from("subscription_plans").select("id, slug, name"),
  ]);

  const ownerIds = [...new Set((providers ?? []).map((p) => p.owner_id))];
  const { data: profiles } =
    ownerIds.length > 0
      ? await admin.from("profiles").select("user_id, display_name").in("user_id", ownerIds)
      : { data: [] as { user_id: string; display_name: string | null }[] };

  const providerById = new Map((providers ?? []).map((p) => [p.id, p]));
  const profileByUserId = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  const planById = new Map((plans ?? []).map((p) => [p.id, p]));
  const subById = new Map((subscriptions ?? []).map((s) => [s.id, s]));

  return {
    items: data.map((row) => {
      const provider = providerById.get(row.provider_id);
      const sub = row.subscription_id ? subById.get(row.subscription_id) : null;
      const plan = sub ? planById.get(sub.plan_id) : null;
      const owner = provider ? profileByUserId.get(provider.owner_id) : null;
      return {
        id: row.id,
        providerId: row.provider_id,
        providerName: (provider?.name as LocalizedJson) ?? { en: "", ar: "" },
        ownerName: owner?.display_name ?? null,
        ownerId: provider?.owner_id ?? null,
        ownerEmail: provider?.email ?? null,
        phone: provider?.phone ?? null,
        subscriptionId: row.subscription_id,
        planSlug: (plan?.slug ?? "pro") as string,
        planName: (plan?.name as LocalizedJson) ?? { en: "PRO", ar: "PRO" },
        paymentProvider: row.payment_provider,
        paymentStatus: row.payment_status,
        paymentReference: row.payment_reference,
        receiptPath: row.receipt_path,
        amount: Number(row.amount),
        currency: row.currency,
        paidAt: row.paid_at,
        submittedAt: row.submitted_at,
        approvedAt: row.approved_at,
        rejectedAt: row.rejected_at,
        adminNote: row.admin_note,
        createdAt: row.created_at,
      };
    }),
    total: count ?? 0,
    page,
    pageSize,
  };
}

export async function countPaymentsByStatus() {
  const admin = createAdminClient();
  const statuses = ["pending_review", "paid", "rejected"] as const;
  const counts: Record<string, number> = {
    pending_review: 0,
    paid: 0,
    rejected: 0,
    all: 0,
  };

  const { count: allCount } = await admin
    .from("payments")
    .select("*", { count: "exact", head: true });
  counts.all = allCount ?? 0;

  await Promise.all(
    statuses.map(async (status) => {
      const { count } = await admin
        .from("payments")
        .select("*", { count: "exact", head: true })
        .eq("payment_status", status);
      counts[status] = count ?? 0;
    }),
  );

  return counts;
}

export async function getPaymentDetailForAdmin(paymentId: string) {
  const admin = createAdminClient();
  const { data: row } = await admin.from("payments").select("*").eq("id", paymentId).maybeSingle();
  if (!row) return null;

  const { data: provider } = await admin
    .from("providers")
    .select("id, name, owner_id, phone, email")
    .eq("id", row.provider_id)
    .maybeSingle();

  let ownerEmail: string | null = null;
  let ownerName: string | null = null;

  if (provider?.owner_id) {
    const [{ data: profile }, authUser] = await Promise.all([
      admin.from("profiles").select("display_name").eq("user_id", provider.owner_id).maybeSingle(),
      admin.auth.admin.getUserById(provider.owner_id),
    ]);
    ownerName = profile?.display_name ?? null;
    ownerEmail = authUser.data.user?.email ?? null;
  }

  let planSlug = "pro";
  let planName: LocalizedJson = { en: "PRO", ar: "PRO" };
  if (row.subscription_id) {
    const { data: sub } = await admin
      .from("subscriptions")
      .select("plan_id")
      .eq("id", row.subscription_id)
      .maybeSingle();
    if (sub) {
      const plan = await getPlanById(sub.plan_id);
      if (plan) {
        planSlug = plan.slug;
        planName = plan.name;
      }
    }
  }

  let receiptUrl: string | null = null;
  if (row.receipt_path) {
    const { data: signed } = await admin.storage
      .from("payment-receipts")
      .createSignedUrl(row.receipt_path, 3600);
    receiptUrl = signed?.signedUrl ?? null;
  }

  const events = await listPaymentEvents(paymentId);

  return {
    id: row.id,
    providerId: row.provider_id,
    providerName: (provider?.name as LocalizedJson) ?? { en: "", ar: "" },
    ownerName,
    ownerEmail: ownerEmail ?? provider?.email ?? null,
    phone: provider?.phone ?? null,
    planSlug,
    planName,
    amount: Number(row.amount),
    currency: row.currency,
    paymentReference: row.payment_reference,
    paymentStatus: row.payment_status,
    receiptPath: row.receipt_path,
    receiptMimeType: row.receipt_mime_type,
    receiptUrl,
    adminNote: row.admin_note,
    submittedAt: row.submitted_at,
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
    rejectedAt: row.rejected_at,
    rejectedBy: row.rejected_by,
    paidAt: row.paid_at,
    createdAt: row.created_at,
    events,
  };
}

function generateInvoiceNumber(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `DAL-${y}${m}-${rand}`;
}

export async function createInvoiceForPayment(
  paymentId: string,
  providerId: string,
  amount: number,
  currency: string,
) {
  const admin = createAdminClient();
  await admin.from("invoices").insert({
    provider_id: providerId,
    payment_id: paymentId,
    invoice_number: generateInvoiceNumber(),
    subtotal: amount,
    total: amount,
    currency,
    status: "paid",
  });
}
