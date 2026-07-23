import { getTranslations } from "next-intl/server";
import { requireAdminUser } from "@/lib/auth/session";
import { listReviewsForModeration, spamDetectionReady } from "@/lib/admin/review-moderation";
import { AdminReviewModerationPanel } from "@/components/admin/admin-review-moderation";
import { Link } from "@/lib/i18n/routing";

type PageProps = {
  searchParams: Promise<{ filter?: string }>;
};

export default async function AdminReviewsPage({ searchParams }: PageProps) {
  await requireAdminUser();
  const t = await getTranslations("admin.reviewModeration");
  const params = await searchParams;
  const filters = ["newest", "low", "hidden", "pending"] as const;
  const filter =
    params.filter && filters.includes(params.filter as (typeof filters)[number])
      ? (params.filter as (typeof filters)[number])
      : "newest";

  const items = await listReviewsForModeration({ filter, limit: 50 });

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
        {filters.map((f) => (
          <Link
            key={f}
            href={f === "newest" ? "/admin/reviews" : `/admin/reviews?filter=${f}`}
            className="rounded-lg border px-3 py-1.5 text-sm hover:bg-muted"
          >
            {t(`filters.${f}`)}
          </Link>
        ))}
      </div>

      <AdminReviewModerationPanel items={items} spamReady={spamDetectionReady()} />
    </div>
  );
}
