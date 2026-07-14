import { getTranslations } from "next-intl/server";
import { requireAdminUser } from "@/lib/auth/session";
import { getSearchAnalytics } from "@/lib/admin/queries";
import { AdminSearchAnalytics } from "@/components/admin/admin-search-analytics";

export default async function AdminSearchesPage() {
  await requireAdminUser();
  const t = await getTranslations("admin.searches");
  const data = await getSearchAnalytics();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
      </div>
      <AdminSearchAnalytics
        data={data}
        labels={{
          topProblems: t("topProblems"),
          noResults: t("noResults"),
          byCity: t("byCity"),
          perDay: t("perDay"),
          count: t("count"),
          empty: t("empty"),
        }}
      />
    </div>
  );
}
