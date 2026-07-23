import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import {
  CheckCircle2,
  Circle,
  Clock3,
  IdCard,
  ImageIcon,
  Images,
  Sparkles,
} from "lucide-react";
import type { ProfileStrength } from "@/lib/business/onboarding";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const ITEM_META = {
  identity: { href: "/business/verification", icon: IdCard },
  profile: { href: "/business/profile", icon: Sparkles },
  logo: { href: "/business/profile", icon: ImageIcon },
  gallery: { href: "/business/gallery", icon: Images },
  hours: { href: "/business/profile", icon: Clock3 },
} as const;

type Props = {
  strength: ProfileStrength;
};

export async function ProfileStrengthCard({ strength }: Props) {
  const t = await getTranslations("business.dashboard.profileStrength");

  if (strength.allDone) {
    return (
      <section
        className="rounded-3xl border border-emerald-500/25 bg-emerald-500/10 p-5 sm:p-6"
        aria-labelledby="profile-complete-title"
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-emerald-600" aria-hidden />
          <div>
            <h2
              id="profile-complete-title"
              className="text-lg font-bold text-[var(--dalily-navy)]"
            >
              {t("completeTitle")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("completeBody")}</p>
          </div>
        </div>
      </section>
    );
  }

  const nextIncomplete = strength.items.find((item) => !item.done);
  const nextHref = nextIncomplete ? ITEM_META[nextIncomplete.id].href : "/business/profile";

  return (
    <section
      className="rounded-3xl border border-[var(--dalily-gold)]/30 bg-[linear-gradient(165deg,#FFFFFF_0%,#FBF8F0_100%)] p-5 shadow-[0_16px_40px_-24px_rgba(196,160,82,0.45)] sm:p-6"
      aria-labelledby="profile-strength-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--dalily-gold)]">
            {t("eyebrow")}
          </p>
          <h2
            id="profile-strength-title"
            className="text-xl font-bold tracking-tight text-[var(--dalily-navy)]"
          >
            {t("title")}
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="rounded-2xl bg-[var(--dalily-navy)] px-3 py-2 text-center text-white">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-white/70">
            {t("label")}
          </p>
          <p className="text-2xl font-bold tabular-nums">{strength.percent}%</p>
        </div>
      </div>

      <div
        className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--dalily-navy)]/10"
        role="progressbar"
        aria-valuenow={strength.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t("progressAria", { percent: strength.percent })}
      >
        <div
          className="h-full rounded-full bg-[var(--dalily-gold)] transition-[width] duration-500"
          style={{ width: `${strength.percent}%` }}
        />
      </div>

      <ul className="mt-5 space-y-2">
        {strength.items.map((item) => {
          const meta = ITEM_META[item.id];
          const Icon = meta.icon;
          return (
            <li key={item.id}>
              <Link
                href={meta.href}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors",
                  item.done
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : "border-border/70 bg-white hover:bg-muted/40",
                )}
              >
                {item.done ? (
                  <CheckCircle2 className="size-5 shrink-0 text-emerald-600" aria-hidden />
                ) : (
                  <Circle className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <Icon className="size-4 shrink-0 text-[var(--dalily-gold)]" aria-hidden />
                <span
                  className={cn(
                    "flex-1 text-sm font-medium",
                    item.done ? "text-[var(--dalily-navy)]" : "text-foreground",
                  )}
                >
                  {t(`items.${item.id}`)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <Button
        asChild
        className="mt-5 h-11 w-full rounded-2xl bg-[var(--dalily-navy)] font-semibold text-white hover:bg-[var(--dalily-navy)]/90 sm:w-auto"
      >
        <Link href={nextHref}>{t("cta")}</Link>
      </Button>
    </section>
  );
}
