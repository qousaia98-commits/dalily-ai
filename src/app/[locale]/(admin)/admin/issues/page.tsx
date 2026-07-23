import { getTranslations } from "next-intl/server";
import { requireAdminUser } from "@/lib/auth/session";
import { listAdminIssues } from "@/lib/admin/issue-center";
import { AdminIssueCenter } from "@/components/admin/admin-issue-center";
import { Link } from "@/lib/i18n/routing";

type PageProps = {
  searchParams: Promise<{ status?: string }>;
};

export default async function AdminIssuesPage({ searchParams }: PageProps) {
  await requireAdminUser();
  const t = await getTranslations("admin.issues");
  const params = await searchParams;
  const statusOptions = ["all", "open", "in_progress", "resolved", "closed"] as const;
  const status =
    params.status && statusOptions.includes(params.status as (typeof statusOptions)[number])
      ? (params.status as (typeof statusOptions)[number])
      : "open";

  const items = await listAdminIssues({
    status: status === "all" ? "all" : status,
    limit: 80,
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="space-y-2">
        <p className="text-xs font-bold tracking-[0.16em] text-[var(--dalily-gold)] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {statusOptions.map((s) => (
          <Link
            key={s}
            href={s === "open" ? "/admin/issues" : `/admin/issues?status=${s}`}
            className="rounded-lg border px-3 py-1.5 text-sm hover:bg-muted"
          >
            {t(`status.${s}`)}
          </Link>
        ))}
      </div>

      <AdminIssueCenter items={items} />
    </div>
  );
}
