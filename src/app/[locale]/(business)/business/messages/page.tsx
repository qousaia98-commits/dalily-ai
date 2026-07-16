import { MessageCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function BusinessMessagesPage() {
  const t = await getTranslations("mobilePages.businessMessages");

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-5 px-2 py-12 text-center animate-fade-in">
      <span className="flex size-16 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--dalily-gold)_14%,transparent)] text-[var(--dalily-gold)]">
        <MessageCircle className="size-7" aria-hidden />
      </span>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>
      <p className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        {t("comingSoon")}
      </p>
    </div>
  );
}
