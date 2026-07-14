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
  const validStatuses = ["draft", "pending_review", "active", "suspended", "archived"];
  const statusFilter = status && validStatuses.includes(status) ? status : undefined;

  const [result, cities, categories] = await Promise.all([
    listProvidersForAdmin({
      search: params.q,
      status: statusFilter,
      cityId: params.city,
      categoryId: params.category,
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

      <form className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
        <Input name="q" defaultValue={params.q ?? ""} placeholder={t("filters.search")} />
        <select
          name="status"
          defaultValue={params.status ?? ""}
          className="border-input flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
        >
          <option value="">{t("filters.allStatuses")}</option>
          {validStatuses.map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </select>
        <select
          name="city"
          defaultValue={params.city ?? ""}
          className="border-input flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
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
        >
          <option value="">{t("filters.allCategories")}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {getLocalizedField(category.name, locale)}
            </option>
          ))}
        </select>
        <Button type="submit">{t("filters.apply")}</Button>
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
          city: params.city,
          category: params.category,
        }}
        label={t("pagination", { total: result.total })}
      />
    </div>
  );
}
