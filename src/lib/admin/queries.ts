import { createAdminClient } from "@/lib/supabase/admin";
import type {
  AppRole,
  LocalizedJson,
  ProviderStatus,
  UserStatus,
  VerificationStatus,
} from "@/types/database.types";

export type AdminDashboardStats = {
  totalProviders: number;
  activeProviders: number;
  pendingReviews: number;
  rejectedProviders: number;
  totalUsers: number;
  totalSearches: number;
  searchesToday: number;
  pendingPayments: number;
  pendingVerifications: number;
  recentRegistrations: number;
  recentApprovals: number;
  averageHealthScore: number;
};

export type AdminProviderItem = {
  id: string;
  slug: string;
  name: LocalizedJson;
  status: ProviderStatus;
  verificationStatus: string;
  cityId: string;
  cityName: LocalizedJson;
  categoryId: string;
  categoryName: LocalizedJson;
  ownerId: string;
  ownerEmail: string;
  ownerDisplayName: string | null;
  phone: string | null;
  planSlug: string;
  createdAt: string;
  ratingAvg: number;
  trustScore: number;
  profileCompleteness: number;
  responseTimeHours: number | null;
  updatedAt: string;
};

export type AdminProviderListResult = {
  items: AdminProviderItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdminUserItem = {
  id: string;
  email: string;
  status: UserStatus;
  displayName: string | null;
  roles: AppRole[];
  createdAt: string;
  hasProvider: boolean;
};

export type AdminUserListResult = {
  items: AdminUserItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type SearchAnalytics = {
  topProblems: { key: string; count: number }[];
  noResults: { query: string; count: number }[];
  byCity: { city: string; count: number }[];
  perDay: { date: string; count: number }[];
};

const DEFAULT_PAGE_SIZE = 20;

function startOfUtcDay(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const admin = createAdminClient();
  const todayStart = startOfUtcDay();
  const weekAgo = new Date();
  weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);

  const [
    providersResult,
    activeProvidersResult,
    pendingProvidersResult,
    pendingVerificationsResult,
    rejectedProvidersResult,
    usersResult,
    searchesResult,
    searchesTodayResult,
    pendingPaymentsResult,
    recentRegistrationsResult,
    recentApprovalsResult,
    healthRows,
  ] = await Promise.all([
    admin.from("providers").select("id", { count: "exact", head: true }).is("deleted_at", null),
    admin
      .from("providers")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .is("deleted_at", null),
    admin
      .from("providers")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_review")
      .is("deleted_at", null),
    admin
      .from("provider_verifications")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    admin
      .from("providers")
      .select("id", { count: "exact", head: true })
      .eq("verification_status", "rejected")
      .is("deleted_at", null),
    admin.from("users").select("id", { count: "exact", head: true }).is("deleted_at", null),
    admin.from("search_logs").select("id", { count: "exact", head: true }),
    admin
      .from("search_logs")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStart),
    admin
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("payment_status", "pending_review"),
    admin
      .from("providers")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .gte("created_at", weekAgo.toISOString()),
    admin
      .from("providers")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .is("deleted_at", null)
      .gte("updated_at", weekAgo.toISOString()),
    admin
      .from("providers")
      .select("profile_completeness")
      .is("deleted_at", null)
      .limit(500),
  ]);

  const completenessValues = (healthRows.data ?? []).map((row) => Number(row.profile_completeness) || 0);
  const averageHealthScore =
    completenessValues.length > 0
      ? Math.round(completenessValues.reduce((a, b) => a + b, 0) / completenessValues.length)
      : 0;

  return {
    totalProviders: providersResult.count ?? 0,
    activeProviders: activeProvidersResult.count ?? 0,
    pendingReviews: pendingProvidersResult.count ?? 0,
    rejectedProviders: rejectedProvidersResult.count ?? 0,
    totalUsers: usersResult.count ?? 0,
    totalSearches: searchesResult.count ?? 0,
    searchesToday: searchesTodayResult.count ?? 0,
    pendingPayments: pendingPaymentsResult.count ?? 0,
    pendingVerifications: pendingVerificationsResult.count ?? 0,
    recentRegistrations: recentRegistrationsResult.count ?? 0,
    recentApprovals: recentApprovalsResult.count ?? 0,
    averageHealthScore,
  };
}

export async function listProvidersForAdmin(params: {
  search?: string;
  status?: ProviderStatus;
  verificationStatus?: VerificationStatus;
  cityId?: string;
  categoryId?: string;
  plan?: "starter" | "pro" | "premium";
  sort?: "newest" | "oldest";
  page?: number;
  pageSize?: number;
}): Promise<AdminProviderListResult> {
  const admin = createAdminClient();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const ascending = params.sort === "oldest";

  let query = admin
    .from("providers")
    .select(
      "id, slug, name, status, verification_status, city_id, category_id, owner_id, phone, email, created_at, rating_avg, trust_score, profile_completeness, response_time_hours, updated_at",
      { count: "exact" },
    )
    .is("deleted_at", null)
    .order("created_at", { ascending });

  if (params.status) query = query.eq("status", params.status);
  if (params.verificationStatus) {
    query = query.eq("verification_status", params.verificationStatus);
  }
  if (params.cityId) query = query.eq("city_id", params.cityId);
  if (params.categoryId) query = query.eq("category_id", params.categoryId);

  const term = params.search?.trim();
  if (term) {
    const pattern = `%${term}%`;
    const ownerIdsFromSearch = new Set<string>();

    const [{ data: emailMatches }, { data: profileMatches }] = await Promise.all([
      admin.from("users").select("id").ilike("email", pattern).limit(50),
      admin.from("profiles").select("user_id").ilike("display_name", pattern).limit(50),
    ]);
    for (const row of emailMatches ?? []) ownerIdsFromSearch.add(row.id);
    for (const row of profileMatches ?? []) ownerIdsFromSearch.add(row.user_id);

    const filters = [
      `slug.ilike.${pattern}`,
      `name->>en.ilike.${pattern}`,
      `name->>ar.ilike.${pattern}`,
      `phone.ilike.${pattern}`,
      `email.ilike.${pattern}`,
    ];

    if (/^[0-9a-f-]{36}$/i.test(term)) {
      filters.push(`id.eq.${term}`);
    }
    if (ownerIdsFromSearch.size > 0) {
      filters.push(`owner_id.in.(${[...ownerIdsFromSearch].join(",")})`);
    }

    query = query.or(filters.join(","));
  }

  if (params.plan) {
    const wantedSlug =
      params.plan === "starter" ? "free" : params.plan === "premium" ? "premium" : "pro";
    const { data: planRow } = await admin
      .from("subscription_plans")
      .select("id")
      .eq("slug", wantedSlug)
      .maybeSingle();

    if (planRow?.id) {
      const { data: planSubs } = await admin
        .from("subscriptions")
        .select("provider_id")
        .eq("plan_id", planRow.id)
        .eq("status", "active");
      const ids = [...new Set((planSubs ?? []).map((s) => s.provider_id))];
      if (ids.length === 0) {
        return { items: [], total: 0, page, pageSize };
      }
      query = query.in("id", ids);
    } else if (wantedSlug === "free") {
      // No free plan row: treat as providers without an active paid sub (handled after fetch)
    }
  }

  const { data: providers, count, error } = await query.range(from, to);
  if (error || !providers?.length) {
    return { items: [], total: count ?? 0, page, pageSize };
  }

  const cityIds = [...new Set(providers.map((p) => p.city_id))];
  const categoryIds = [...new Set(providers.map((p) => p.category_id))];
  const ownerIds = [...new Set(providers.map((p) => p.owner_id))];
  const providerIds = providers.map((p) => p.id);

  const [
    { data: cities },
    { data: categories },
    { data: users },
    { data: profiles },
    { data: subscriptions },
  ] = await Promise.all([
    admin.from("cities").select("id, name").in("id", cityIds),
    admin.from("categories").select("id, name").in("id", categoryIds),
    admin.from("users").select("id, email").in("id", ownerIds),
    admin.from("profiles").select("user_id, display_name").in("user_id", ownerIds),
    admin
      .from("subscriptions")
      .select("provider_id, plan_id, status")
      .in("provider_id", providerIds)
      .eq("status", "active"),
  ]);

  const planIds = [...new Set((subscriptions ?? []).map((s) => s.plan_id))];
  const { data: plans } = planIds.length
    ? await admin.from("subscription_plans").select("id, slug").in("id", planIds)
    : { data: [] as { id: string; slug: string }[] };

  const slugByPlanId = new Map((plans ?? []).map((p) => [p.id, p.slug]));
  const planByProvider = new Map<string, string>();
  for (const sub of subscriptions ?? []) {
    planByProvider.set(sub.provider_id, slugByPlanId.get(sub.plan_id) ?? "free");
  }

  const cityById = new Map((cities ?? []).map((c) => [c.id, c.name as LocalizedJson]));
  const categoryById = new Map((categories ?? []).map((c) => [c.id, c.name as LocalizedJson]));
  const emailById = new Map((users ?? []).map((u) => [u.id, u.email]));
  const nameById = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name]));

  const items: AdminProviderItem[] = providers.map((provider) => ({
    id: provider.id,
    slug: provider.slug,
    name: provider.name as LocalizedJson,
    status: provider.status as ProviderStatus,
    verificationStatus: provider.verification_status,
    cityId: provider.city_id,
    cityName: cityById.get(provider.city_id) ?? { ar: "", en: "" },
    categoryId: provider.category_id,
    categoryName: categoryById.get(provider.category_id) ?? { ar: "", en: "" },
    ownerId: provider.owner_id,
    ownerEmail: emailById.get(provider.owner_id) ?? "",
    ownerDisplayName: nameById.get(provider.owner_id) ?? null,
    phone: provider.phone,
    planSlug: planByProvider.get(provider.id) ?? "free",
    createdAt: provider.created_at,
    ratingAvg: Number(provider.rating_avg) || 0,
    trustScore: Number(provider.trust_score) || 0,
    profileCompleteness: Number(provider.profile_completeness) || 0,
    responseTimeHours: provider.response_time_hours,
    updatedAt: provider.updated_at,
  }));

  return { items, total: count ?? items.length, page, pageSize };
}

export async function listUsersForAdmin(params: {
  search?: string;
  roleFilter?: "all" | "business" | "admin";
  page?: number;
  pageSize?: number;
}): Promise<AdminUserListResult> {
  const admin = createAdminClient();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;

  const term = params.search?.trim().toLowerCase();

  const { data: users } = await admin
    .from("users")
    .select("id, email, status, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (!users?.length) {
    return { items: [], total: 0, page, pageSize };
  }

  const userIds = users.map((u) => u.id);

  const [{ data: profiles }, { data: roles }, { data: providers }] = await Promise.all([
    admin.from("profiles").select("user_id, display_name").in("user_id", userIds),
    admin.from("user_roles").select("user_id, role").in("user_id", userIds).is("revoked_at", null),
    admin.from("providers").select("owner_id").in("owner_id", userIds).is("deleted_at", null),
  ]);

  const displayById = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name]));
  const rolesByUser = new Map<string, AppRole[]>();
  for (const row of roles ?? []) {
    const list = rolesByUser.get(row.user_id) ?? [];
    list.push(row.role as AppRole);
    rolesByUser.set(row.user_id, list);
  }
  const providerOwners = new Set((providers ?? []).map((p) => p.owner_id));

  let items: AdminUserItem[] = users.map((user) => ({
    id: user.id,
    email: user.email,
    status: user.status as UserStatus,
    displayName: displayById.get(user.id) ?? null,
    roles: rolesByUser.get(user.id) ?? ["user"],
    createdAt: user.created_at,
    hasProvider: providerOwners.has(user.id),
  }));

  if (params.roleFilter === "business") {
    items = items.filter((u) => u.roles.includes("business") || u.hasProvider);
  } else if (params.roleFilter === "admin") {
    items = items.filter((u) => u.roles.includes("admin"));
  }

  if (term) {
    items = items.filter(
      (u) =>
        u.email.toLowerCase().includes(term) ||
        (u.displayName?.toLowerCase().includes(term) ?? false),
    );
  }

  const total = items.length;
  const from = (page - 1) * pageSize;
  items = items.slice(from, from + pageSize);

  return { items, total, page, pageSize };
}

export async function getSearchAnalytics(): Promise<SearchAnalytics> {
  const admin = createAdminClient();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

  const { data: logs } = await admin
    .from("search_logs")
    .select("query_text, normalized_query, problem_id, city_slug, result_count, created_at")
    .gte("created_at", thirtyDaysAgo.toISOString())
    .order("created_at", { ascending: false })
    .limit(5000);

  if (!logs?.length) {
    return { topProblems: [], noResults: [], byCity: [], perDay: [] };
  }

  const problemCounts = new Map<string, number>();
  const noResultCounts = new Map<string, number>();
  const cityCounts = new Map<string, number>();
  const dayCounts = new Map<string, number>();

  for (const log of logs) {
    const problemKey = log.problem_id ?? log.normalized_query ?? log.query_text;
    if (problemKey) {
      problemCounts.set(problemKey, (problemCounts.get(problemKey) ?? 0) + 1);
    }

    if (log.result_count === 0) {
      const q = log.normalized_query ?? log.query_text;
      noResultCounts.set(q, (noResultCounts.get(q) ?? 0) + 1);
    }

    if (log.city_slug) {
      cityCounts.set(log.city_slug, (cityCounts.get(log.city_slug) ?? 0) + 1);
    }

    const day = log.created_at.slice(0, 10);
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
  }

  const sortDesc = (a: { count: number }, b: { count: number }) => b.count - a.count;

  return {
    topProblems: [...problemCounts.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort(sortDesc)
      .slice(0, 10),
    noResults: [...noResultCounts.entries()]
      .map(([query, count]) => ({ query, count }))
      .sort(sortDesc)
      .slice(0, 10),
    byCity: [...cityCounts.entries()]
      .map(([city, count]) => ({ city, count }))
      .sort(sortDesc)
      .slice(0, 10),
    perDay: [...dayCounts.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export type AdminVerificationListParams = {
  search?: string;
  status?: import("@/types/database.types").ProviderVerificationStatus | "all";
  page?: number;
  pageSize?: number;
};

export type AdminVerificationListResult = {
  items: import("@/lib/verification/queries").AdminVerificationItem[];
  total: number;
  page: number;
  pageSize: number;
};

export async function listVerificationsForAdmin(
  params: AdminVerificationListParams,
): Promise<AdminVerificationListResult> {
  const { listVerificationsForAdmin: list } = await import("@/lib/verification/queries");
  return list(params);
}

export type AdminProviderOpenPayment = {
  id: string;
  planSlug: string;
  amount: number;
  currency: string;
  paymentReference: string;
  paymentStatus: string;
  receiptUrl: string | null;
  receiptMimeType: string | null;
  submittedAt: string | null;
  createdAt: string;
};

export type AdminProviderReview = {
  id: string;
  slug: string;
  name: LocalizedJson;
  about: LocalizedJson | null;
  status: ProviderStatus;
  verificationStatus: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  cityId: string;
  categoryId: string;
  cityName: LocalizedJson;
  categoryName: LocalizedJson;
  ownerEmail: string;
  ownerDisplayName: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  gallery: Array<{ id: string; url: string }>;
  services: Array<{ id: string; name: LocalizedJson }>;
  createdAt: string;
  profileCompleteness: number;
  currentPlanSlug: string;
  openPayment: AdminProviderOpenPayment | null;
  adminReviewNote: string | null;
  changesRequestedAt: string | null;
  hoursConfigured: boolean;
  idDocuments: {
    idFrontUrl: string | null;
    idBackUrl: string | null;
    selfieUrl: string | null;
    status: string | null;
  };
  checklist: import("@/lib/admin/control-center").ReviewChecklist;
};

/** Admin-only: load any non-deleted provider by id (ignores public status filters). */
export async function getProviderForAdminReview(
  providerId: string,
): Promise<AdminProviderReview | null> {
  const admin = createAdminClient();
  const { getStoragePublicUrl } = await import("@/lib/providers/storage");
  const { PAYMENT_RECEIPTS_BUCKET } = await import("@/lib/payment/receipt-storage");
  const { PROVIDER_VERIFICATION_BUCKET } = await import("@/lib/verification/storage");
  const { getCurrentSubscription } = await import("@/lib/subscription/repository");
  const { buildReviewChecklist } = await import("@/lib/admin/control-center");
  const { isVerificationComplete } = await import("@/lib/verification/queries");

  const { data: provider, error } = await admin
    .from("providers")
    .select("*")
    .eq("id", providerId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !provider) return null;

  const [
    { data: city },
    { data: category },
    { data: owner },
    { data: profile },
    { data: images },
    { data: services },
    { data: hours },
    { data: verification },
    subscription,
    { data: paymentRows },
  ] = await Promise.all([
    admin.from("cities").select("id, name").eq("id", provider.city_id).maybeSingle(),
    admin.from("categories").select("id, name").eq("id", provider.category_id).maybeSingle(),
    admin.from("users").select("id, email").eq("id", provider.owner_id).maybeSingle(),
    admin
      .from("profiles")
      .select("user_id, display_name")
      .eq("user_id", provider.owner_id)
      .maybeSingle(),
    admin.from("images").select("*").eq("provider_id", provider.id).is("deleted_at", null),
    admin
      .from("provider_services")
      .select("id, name")
      .eq("provider_id", provider.id)
      .is("deleted_at", null)
      .order("sort_order"),
    admin.from("provider_working_hours").select("id, is_closed, opens_at, closes_at").eq("provider_id", provider.id),
    admin.from("provider_verifications").select("*").eq("provider_id", provider.id).maybeSingle(),
    getCurrentSubscription(provider.id),
    admin
      .from("payments")
      .select("*")
      .eq("provider_id", provider.id)
      .in("payment_status", ["pending", "pending_review"])
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const imageRows = images ?? [];
  const avatar = imageRows.find((image) => image.id === provider.avatar_image_id);
  const cover = imageRows.find((image) => image.id === provider.cover_image_id);
  const gallery = imageRows
    .filter((image) => image.kind === "gallery")
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((image) => ({ id: image.id, url: getStoragePublicUrl(image.path) }));

  const hoursConfigured = (hours ?? []).filter(
    (h) => h.is_closed || (h.opens_at && h.closes_at),
  ).length >= 5;

  async function signVerificationPath(path: string | null): Promise<string | null> {
    if (!path) return null;
    const { data } = await admin.storage
      .from(PROVIDER_VERIFICATION_BUCKET)
      .createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  }

  const [idFrontUrl, idBackUrl, selfieUrl] = await Promise.all([
    signVerificationPath(verification?.id_front_url ?? null),
    signVerificationPath(verification?.id_back_url ?? null),
    signVerificationPath(verification?.selfie_url ?? null),
  ]);

  const openPaymentRow = paymentRows?.[0] ?? null;
  let openPayment: AdminProviderOpenPayment | null = null;

  if (openPaymentRow) {
    let planSlug = "pro";
    if (openPaymentRow.subscription_id) {
      const { data: sub } = await admin
        .from("subscriptions")
        .select("plan_id")
        .eq("id", openPaymentRow.subscription_id)
        .maybeSingle();
      if (sub?.plan_id) {
        const { data: plan } = await admin
          .from("subscription_plans")
          .select("slug")
          .eq("id", sub.plan_id)
          .maybeSingle();
        planSlug = plan?.slug ?? "pro";
      }
    }

    let receiptUrl: string | null = null;
    if (openPaymentRow.receipt_path) {
      const { data } = await admin.storage
        .from(PAYMENT_RECEIPTS_BUCKET)
        .createSignedUrl(openPaymentRow.receipt_path, 3600);
      receiptUrl = data?.signedUrl ?? null;
    }

    openPayment = {
      id: openPaymentRow.id,
      planSlug,
      amount: Number(openPaymentRow.amount),
      currency: openPaymentRow.currency,
      paymentReference: openPaymentRow.payment_reference,
      paymentStatus: openPaymentRow.payment_status,
      receiptUrl,
      receiptMimeType: openPaymentRow.receipt_mime_type,
      submittedAt: openPaymentRow.submitted_at,
      createdAt: openPaymentRow.created_at,
    };
  }

  const avatarUrl = avatar ? getStoragePublicUrl(avatar.path) : null;
  const coverUrl = cover ? getStoragePublicUrl(cover.path) : null;
  const hasIdDocument = isVerificationComplete(verification ?? null);

  const checklist = buildReviewChecklist({
    name: provider.name as LocalizedJson,
    about: provider.about as LocalizedJson | null,
    phone: provider.phone,
    cityId: provider.city_id,
    categoryId: provider.category_id,
    avatarUrl,
    coverUrl,
    galleryCount: gallery.length,
    hoursConfigured,
    hasIdDocument,
  });

  return {
    id: provider.id,
    slug: provider.slug,
    name: provider.name as LocalizedJson,
    about: provider.about as LocalizedJson | null,
    status: provider.status as ProviderStatus,
    verificationStatus: provider.verification_status,
    phone: provider.phone,
    whatsapp: provider.whatsapp,
    email: provider.email,
    website: provider.website,
    cityId: provider.city_id,
    categoryId: provider.category_id,
    cityName: (city?.name as LocalizedJson) ?? { ar: "", en: "" },
    categoryName: (category?.name as LocalizedJson) ?? { ar: "", en: "" },
    ownerEmail: owner?.email ?? "",
    ownerDisplayName: profile?.display_name ?? null,
    avatarUrl,
    coverUrl,
    gallery,
    services: (services ?? []).map((service) => ({
      id: service.id,
      name: service.name as LocalizedJson,
    })),
    createdAt: provider.created_at,
    profileCompleteness: provider.profile_completeness,
    currentPlanSlug: subscription?.planSlug ?? "free",
    openPayment,
    adminReviewNote: provider.admin_review_note ?? null,
    changesRequestedAt: provider.changes_requested_at ?? null,
    hoursConfigured,
    idDocuments: {
      idFrontUrl,
      idBackUrl,
      selfieUrl,
      status: verification?.status ?? null,
    },
    checklist,
  };
}
