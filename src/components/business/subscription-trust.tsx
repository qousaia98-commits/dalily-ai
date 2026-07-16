import { Check } from "lucide-react";
import { getTranslations } from "next-intl/server";

const TRUST_KEYS = ["secure", "noAuto", "transparent", "support"] as const;

export async function SubscriptionTrust() {
  const t = await getTranslations("business.subscription.trust");

  return (
    <section
      className="mx-auto w-full max-w-2xl rounded-3xl border border-[#E8ECF2] bg-[linear-gradient(180deg,#FFFFFF_0%,#F7F8FA_100%)] px-6 py-8 text-center shadow-[0_12px_36px_-22px_rgba(11,21,38,0.18)] sm:px-8"
      aria-labelledby="subscription-trust-title"
    >
      <h2 id="subscription-trust-title" className="text-lg font-bold tracking-tight text-[var(--dalily-navy)]">
        {t("title")}
      </h2>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {TRUST_KEYS.map((key) => (
          <li
            key={key}
            className="flex items-center justify-center gap-2 rounded-2xl bg-white/80 px-3 py-3 text-sm font-medium text-[var(--dalily-navy)] sm:justify-start"
          >
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--dalily-gold)]/15 text-[var(--dalily-gold)]">
              <Check className="size-3 stroke-[3]" aria-hidden />
            </span>
            {t(`items.${key}`)}
          </li>
        ))}
      </ul>
    </section>
  );
}
