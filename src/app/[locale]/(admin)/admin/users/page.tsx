import { getTranslations } from "next-intl/server";
import { requireAdminUser } from "@/lib/auth/session";
import { listUsersForAdmin } from "@/lib/admin/queries";
import { AdminUserTable } from "@/components/admin/admin-user-table";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type PageProps = {
  searchParams: Promise<{
    q?: string;
    role?: string;
    page?: string;
  }>;
};

export default async function AdminUsersPage({ searchParams }: PageProps) {
  await requireAdminUser();
  const t = await getTranslations("admin.users");
  const params = await searchParams;
  const page = Number(params.page ?? "1") || 1;
  const roleOptions = ["all", "business", "admin"] as const;
  const roleFilter =
    params.role && roleOptions.includes(params.role as (typeof roleOptions)[number])
      ? (params.role as "all" | "business" | "admin")
      : "all";

  const result = await listUsersForAdmin({
    search: params.q,
    roleFilter,
    page,
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
      </div>

      <form className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-3">
        <Input name="q" defaultValue={params.q ?? ""} placeholder={t("filters.search")} />
        <select
          name="role"
          defaultValue={roleFilter}
          className="border-input flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
        >
          {roleOptions.map((role) => (
            <option key={role} value={role}>
              {t(`filters.${role}`)}
            </option>
          ))}
        </select>
        <Button type="submit">{t("filters.apply")}</Button>
      </form>

      <AdminUserTable items={result.items} />
      <AdminPagination
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        basePath="/admin/users"
        searchParams={{ q: params.q, role: params.role ?? roleFilter }}
        label={t("pagination", { total: result.total })}
      />
    </div>
  );
}
