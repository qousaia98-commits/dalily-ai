import { getLocale, getTranslations } from "next-intl/server";
import { redirect, Link } from "@/lib/i18n/routing";
import { requireAuthUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/queries";
import { getApprovalReadiness } from "@/lib/providers/approval-readiness";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Circle,
  Images,
  ImageIcon,
  IdCard,
} from "lucide-react";

export default async function BusinessWelcomePage() {
  const t = await getTranslations("business.welcome");
  const locale = await getLocale();
  const authUser = await requireAuthUser();
  const ownedProvider = await getOwnedProvider(authUser.id);

  if (!ownedProvider) {
    redirect({ href: "/business", locale: locale as "ar" | "en" });
  }

  // Redirect never returns for the caller in practice; keep a definite provider for TS.
  const provider = ownedProvider!;

  if (provider.status === "active") {
    redirect({ href: "/business/subscription", locale: locale as "ar" | "en" });
  }

  const readiness = await getApprovalReadiness(provider);

  const checklist = [
    {
      key: "profile",
      done: provider.profileCompleteness >= 60,
      href: "/business/profile",
      icon: BadgeCheck,
      title: t("checklist.profile"),
    },
    {
      key: "logo",
      done: readiness.hasLogo,
      href: "/business/gallery",
      icon: ImageIcon,
      title: t("checklist.logo"),
    },
    {
      key: "cover",
      done: readiness.hasCover,
      href: "/business/gallery",
      icon: ImageIcon,
      title: t("checklist.cover"),
    },
    {
      key: "gallery",
      done: readiness.hasGallery,
      href: "/business/gallery",
      icon: Images,
      title: t("checklist.gallery"),
    },
    {
      key: "id",
      done: readiness.hasIdDocument,
      href: "/business/verification",
      icon: IdCard,
      title: t("checklist.id"),
    },
  ] as const;

  return (
    <div className="w-full max-w-full space-y-10 overflow-x-hidden animate-fade-in py-2">
      <div className="mx-auto max-w-2xl text-center">
        <div
          className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-[var(--dalily-gold)]/15 text-3xl"
          aria-hidden
        >
          🎉
        </div>
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-[var(--dalily-navy)] sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-[#5C6478] sm:text-lg">{t("subtitle")}</p>
      </div>

      <section className="mx-auto max-w-3xl rounded-3xl border border-[#E8ECF2] bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-xl font-bold text-[var(--dalily-navy)]">{t("checklistTitle")}</h2>
        <p className="mt-2 text-sm text-[#5C6478]">{t("checklistSubtitle")}</p>

        <ul className="mt-5 space-y-3">
          {checklist.map(({ key, done, href, icon: Icon, title }) => (
            <li key={key}>
              <Link
                href={href}
                className="flex min-h-12 items-center gap-3 rounded-2xl border border-border/70 px-3 py-2.5 transition-colors hover:bg-muted/50"
              >
                {done ? (
                  <CheckCircle2 className="size-5 shrink-0 text-emerald-600" aria-hidden />
                ) : (
                  <Circle className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <Icon className="size-4 shrink-0 text-[var(--dalily-gold)]" aria-hidden />
                <span className="flex-1 text-sm font-medium text-[var(--dalily-navy)]">{title}</span>
                <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>

        {provider.status === "pending_review" ? (
          <p className="mt-6 rounded-2xl bg-[var(--dalily-navy)]/5 px-4 py-3 text-sm text-[var(--dalily-navy)]">
            {t("pendingApproval")}
          </p>
        ) : (
          <Button
            asChild
            className="mt-6 h-12 w-full rounded-2xl bg-[var(--dalily-gold)] font-bold text-[var(--dalily-navy)] hover:bg-[var(--dalily-gold-light)] sm:w-auto"
          >
            <Link href="/business/verification" className="gap-2">
              {readiness.ready ? t("submitCta") : t("completeProfile")}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        )}
      </section>

      <p className="mx-auto max-w-2xl text-center text-sm text-muted-foreground">
        {t("plansAfterApproval")}
      </p>
    </div>
  );
}
