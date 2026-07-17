import { getLocale, getTranslations } from "next-intl/server";
import { requireAdminUser } from "@/lib/auth/session";
import { listProvidersForAdmin } from "@/lib/admin/queries";
import { getAdminCategories, getAdminCities } from "@/lib/admin/reference-data";
import { AdminProviderTable } from "@/components/admin/admin-provider-table";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getLocalizedField } from "@/types/provider.types";
import type { ProviderStatus } from "@/types/database.types";

type PageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    plan?: string;
    sort?: string;
    city?: string;
    category?: string;
    page?: string;
  }>;
};

export default async function AdminProvidersPage({ searchParams }: PageProps) {
  await requireAdminUser();
  const t = await getTranslations("admin.providers");
  const locale = await getLocale();
  const params = await searchParams;

  const page = Number(params.page ?? "1") || 1;
  const status = params.status as ProviderStatus | undefined;
  const validStatuses = [
    "draft",
    "pending_review",
    "changes_requested",
    "active",
    "suspended",
    "archived",
  ];
  const statusFilter = status && validStatuses.includes(status) ? status : undefined;
  const plan =
    params.plan === "starter" || params.plan === "pro" || params.plan === "premium"
      ? params.plan
      : undefined;
  const sort = params.sort === "oldest" ? "oldest" : "newest";

  const [result, cities, categories] = await Promise.all([
    listProvidersForAdmin({
      search: params.q,
      status: statusFilter,
      verificationStatus: params.status === "rejected" ? "rejected" : undefined,
      cityId: params.city,
      categoryId: params.category,
      plan,
      sort,
      page,
    }),
    getAdminCities(),
    getAdminCategories(),
  ]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
      </div>

      <form className="grid gap-3 rounded-3xl border border-[#E8ECF2] bg-card p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder={t("filters.search")}
          className="xl:col-span-2"
          aria-label={t("filters.search")}
        />
        <select
          name="status"
          defaultValue={params.status ?? ""}
          className="border-input flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
          aria-label={t("filters.allStatuses")}
        >
          <option value="">{t("filters.allStatuses")}</option>
          <option value="pending_review">{t("status.pending_review")}</option>
          <option value="active">{t("status.active")}</option>
          <option value="rejected">{t("filters.rejected")}</option>
          <option value="changes_requested">{t("status.changes_requested")}</option>
          <option value="draft">{t("status.draft")}</option>
          <option value="suspended">{t("status.suspended")}</option>
          <option value="archived">{t("status.archived")}</option>
        </select>
        <select
          name="plan"
          defaultValue={params.plan ?? ""}
          className="border-input flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
          aria-label={t("filters.allPlans")}
        >
          <option value="">{t("filters.allPlans")}</option>
          <option value="starter">{t("filters.planStarter")}</option>
          <option value="pro">{t("filters.planPro")}</option>
          <option value="premium">{t("filters.planPremium")}</option>
        </select>
        <select
          name="sort"
          defaultValue={sort}
          className="border-input flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
          aria-label={t("filters.sort")}
        >
          <option value="newest">{t("filters.newest")}</option>
          <option value="oldest">{t("filters.oldest")}</option>
        </select>
        <select
          name="city"
          defaultValue={params.city ?? ""}
          className="border-input flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
          aria-label={t("filters.allCities")}
        >
          <option value="">{t("filters.allCities")}</option>
          {cities.map((city) => (
            <option key={city.id} value={city.id}>
              {getLocalizedField(city.name, locale)}
            </option>
          ))}
        </select>
        <select
          name="category"
          defaultValue={params.category ?? ""}
          className="border-input flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
          aria-label={t("filters.allCategories")}
        >
          <option value="">{t("filters.allCategories")}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {getLocalizedField(category.name, locale)}
            </option>
          ))}
        </select>
        <Button type="submit" className="xl:col-span-6 sm:col-span-2">
          {t("filters.apply")}
        </Button>
      </form>

      <AdminProviderTable items={result.items} />
      <AdminPagination
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        basePath="/admin/providers"
        searchParams={{
          q: params.q,
          status: params.status,
          plan: params.plan,
          sort: params.sort,
          city: params.city,
          category: params.category,
        }}
        label={t("pagination", { total: result.total })}
      />
    </div>
  );
}
