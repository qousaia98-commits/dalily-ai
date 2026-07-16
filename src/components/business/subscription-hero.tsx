import { getTranslations } from "next-intl/server";
import { Sparkles } from "lucide-react";

export async function SubscriptionHero() {
  const t = await getTranslations("business.subscription.hero");

  return (
    <header className="relative overflow-hidden px-1 pb-2 pt-2 text-center sm:pt-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-8 mx-auto h-40 max-w-md rounded-full bg-[radial-gradient(circle,rgba(196,160,82,0.22),transparent_70%)] blur-2xl"
      />
      <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-5">
        <span className="flex size-16 items-center justify-center rounded-3xl bg-[linear-gradient(145deg,rgba(196,160,82,0.2),rgba(11,21,38,0.06))] text-[var(--dalily-gold)] shadow-[0_12px_30px_-16px_rgba(196,160,82,0.55)]">
          <Sparkles className="size-7" aria-hidden />
        </span>
        <div className="space-y-3">
          <h1 className="text-balance text-3xl font-bold tracking-tight text-[var(--dalily-navy)] sm:text-4xl md:text-5xl">
            {t("title")}
          </h1>
          <p className="text-pretty mx-auto max-w-xl text-base leading-relaxed text-[#5C6478] sm:text-lg">
            {t("subtitle")}
          </p>
        </div>
      </div>
    </header>
  );
}
