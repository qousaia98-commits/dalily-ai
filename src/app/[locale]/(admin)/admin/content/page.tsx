import { getTranslations } from "next-intl/server";
import { requireAdminUser } from "@/lib/auth/session";
import { Link } from "@/lib/i18n/routing";

export default async function AdminContentPage() {
  await requireAdminUser();
  const t = await getTranslations("admin.content");

  const links = [
    { href: "/admin/categories", key: "categories" },
    { href: "/admin/marketplace", key: "promotions" },
    { href: "/admin/providers?status=active", key: "featured" },
    { href: "/admin/searches", key: "cities" },
  ] as const;

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="space-y-2">
        <p className="text-xs font-bold tracking-[0.16em] text-[var(--dalily-gold)] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2">
        {links.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              className="block rounded-2xl border bg-card p-4 transition-colors hover:border-[var(--dalily-gold)]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <p className="font-semibold">{t(`cards.${item.key}.title`)}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t(`cards.${item.key}.body`)}</p>
            </Link>
          </li>
        ))}
      </ul>

      <p className="rounded-xl border border-dashed px-3 py-2 text-xs text-muted-foreground">
        {t("bannerSlotsReady")}
      </p>
    </div>
  );
}
