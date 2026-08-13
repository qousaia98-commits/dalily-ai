import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/auth/roles";
import { isAdminMigrationV2Enabled } from "@/lib/config/feature-flags";
import { listCellPolicies } from "@/domains/admin/cell-policies";
import { createAdminClient } from "@/lib/supabase/admin";
import { CellPoliciesPanel } from "@/components/admin/cell-policies-panel";

export default async function AdminCellsPage() {
  if (!isAdminMigrationV2Enabled()) redirect("/admin/marketplace");

  const authUser = await requireAdminUser();
  if (!isPlatformAdmin(authUser.roles)) redirect("/admin");

  const t = await getTranslations("admin.cells");
  const admin = createAdminClient();
  const [policies, { data: cities }, { data: categories }] = await Promise.all([
    listCellPolicies(100),
    admin.from("cities").select("id, name").order("name").limit(100),
    admin.from("categories").select("id, name").order("name").limit(100),
  ]);

  const cityOptions = (cities ?? []).map((c) => ({
    id: c.id as string,
    label:
      typeof c.name === "object" && c.name
        ? String((c.name as { en?: string; ar?: string }).en || (c.name as { ar?: string }).ar || c.id)
        : String(c.name ?? c.id),
  }));
  const categoryOptions = (categories ?? []).map((c) => ({
    id: c.id as string,
    label:
      typeof c.name === "object" && c.name
        ? String((c.name as { en?: string; ar?: string }).en || (c.name as { ar?: string }).ar || c.id)
        : String(c.name ?? c.id),
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
      </div>
      <CellPoliciesPanel
        policies={policies}
        cities={cityOptions}
        categories={categoryOptions}
      />
    </div>
  );
}
