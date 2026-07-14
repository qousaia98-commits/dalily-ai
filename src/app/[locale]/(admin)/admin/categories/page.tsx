import { getTranslations } from "next-intl/server";
import { AdminCategoryManager } from "@/components/admin/admin-category-manager";
import { getAllCategoriesForAdmin } from "@/lib/categories/queries";

export default async function AdminCategoriesPage() {
  const t = await getTranslations("admin.categories");
  const categories = await getAllCategoriesForAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
      </div>
      <AdminCategoryManager categories={categories} />
    </div>
  );
}
