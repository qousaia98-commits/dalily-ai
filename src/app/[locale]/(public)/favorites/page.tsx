import { Heart } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getAuthUser } from "@/lib/auth/session";
import { EmptyState } from "@/components/shared/empty-state";

export default async function FavoritesPage() {
  const t = await getTranslations("mobilePages.favorites");
  const authUser = await getAuthUser();

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-10 sm:px-6">
      <EmptyState
        icon={Heart}
        title={t("title")}
        body={t("subtitle")}
        primary={
          authUser
            ? { href: "/search", label: t("browseCta") }
            : { href: "/login", label: t("loginCta") }
        }
        secondary={authUser ? undefined : { href: "/search", label: t("browseCta") }}
      />
    </div>
  );
}
