import {
  CreditCard,
  Search,
  Tags,
  Users,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireAdminUser } from "@/lib/auth/session";
import { MobileHubLinks } from "@/components/layout/mobile-hub-links";

export default async function AdminSettingsPage() {
  await requireAdminUser();
  const t = await getTranslations("mobilePages.adminSettings");

  const links = [
    {
      href: "/admin/categories",
      title: t("links.categories"),
      description: t("links.categoriesDesc"),
      icon: Tags,
    },
    {
      href: "/admin/users",
      title: t("links.users"),
      description: t("links.usersDesc"),
      icon: Users,
    },
    {
      href: "/admin/searches",
      title: t("links.searches"),
      description: t("links.searchesDesc"),
      icon: Search,
    },
    {
      href: "/admin/subscriptions",
      title: t("links.subscriptions"),
      description: t("links.subscriptionsDesc"),
      icon: CreditCard,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 animate-fade-in">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>
      <MobileHubLinks links={links} />
    </div>
  );
}
