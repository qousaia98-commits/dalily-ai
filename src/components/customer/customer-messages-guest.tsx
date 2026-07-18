import { LogIn, MessageCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { Button } from "@/components/ui/button";

export async function CustomerMessagesGuest() {
  const t = await getTranslations("customer.messages");

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-6 px-4 py-16 text-center sm:px-6">
      <span className="flex size-16 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--dalily-gold)_14%,transparent)] text-[var(--dalily-gold)]">
        <MessageCircle className="size-7" aria-hidden />
      </span>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("guestSubtitle")}</p>
      </div>
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
        <Button asChild>
          <Link href="/login">
            <LogIn className="size-4" aria-hidden />
            {t("loginCta")}
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/search">{t("browseCta")}</Link>
        </Button>
      </div>
    </div>
  );
}
