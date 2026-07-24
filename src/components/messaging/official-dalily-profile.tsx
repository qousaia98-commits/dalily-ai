import {
  Bell,
  Flag,
  Megaphone,
  VolumeX,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { OfficialDalilyAvatar } from "@/components/messaging/official-dalily-avatar";
import { VerifiedBadge } from "@/components/messaging/verified-badge";
import { Button } from "@/components/ui/button";
import { OFFICIAL_ACCOUNTS } from "@/lib/dalily-messages/official-account";

export async function OfficialDalilyProfile({
  messagesPath = "/business/messages",
  namespace = "business.messages",
}: {
  messagesPath?: string;
  namespace?: string;
}) {
  const t = await getTranslations(namespace);
  const account = OFFICIAL_ACCOUNTS.dalily;

  const actions = [
    {
      href: `${messagesPath}/dalily`,
      icon: Megaphone,
      label: t("profile.viewAnnouncements"),
    },
    {
      href: `${messagesPath}/dalily`,
      icon: VolumeX,
      label: t("profile.mute"),
    },
    {
      href: "/privacy",
      icon: Flag,
      label: t("profile.report"),
    },
    {
      href: messagesPath.includes("business") ? "/business/account" : "/account",
      icon: Bell,
      label: t("profile.notificationSettings"),
    },
  ] as const;

  return (
    <div className="mx-auto w-full max-w-lg space-y-8 overflow-x-hidden animate-fade-in px-4 py-8 sm:px-6">
      <header className="flex flex-col items-center gap-4 text-center">
        <OfficialDalilyAvatar size="xl" />
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {t(account.nameKey)}
            </h1>
            <VerifiedBadge size="lg" label={t("verifiedLabel")} />
          </div>
          <p className="text-sm font-medium text-muted-foreground">{t(account.subtitleKey)}</p>
        </div>
      </header>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <p className="text-sm leading-relaxed text-foreground/90">{t(account.descriptionKey)}</p>
        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex items-start justify-between gap-4 border-t border-border/70 pt-3">
            <dt className="text-muted-foreground">{t("profile.channel")}</dt>
            <dd className="font-medium text-end">{t("profile.officialChannel")}</dd>
          </div>
          <div className="flex items-start justify-between gap-4 border-t border-border/70 pt-3">
            <dt className="text-muted-foreground">{t("profile.accountType")}</dt>
            <dd className="font-medium text-end">{t("profile.systemAccount")}</dd>
          </div>
          <div className="flex items-start justify-between gap-4 border-t border-border/70 pt-3">
            <dt className="text-muted-foreground">{t("profile.status")}</dt>
            <dd className="flex items-center gap-1.5 font-medium text-end">
              {t("profile.verified")}
              <VerifiedBadge size="sm" label={t("verifiedLabel")} />
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4 border-t border-border/70 pt-3">
            <dt className="text-muted-foreground">{t("profile.since")}</dt>
            <dd className="font-medium text-end">{t(account.sinceLabelKey)}</dd>
          </div>
        </dl>
      </section>

      <section className="space-y-2" aria-label={t("profile.actions")}>
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Button
              key={action.label}
              asChild
              variant="outline"
              className="h-12 w-full justify-start gap-3 rounded-2xl px-4"
            >
              <Link href={action.href}>
                <Icon className="size-4 text-[var(--dalily-gold)]" aria-hidden />
                <span>{action.label}</span>
              </Link>
            </Button>
          );
        })}
      </section>

      <div className="text-center">
        <Button asChild variant="ghost" className="rounded-2xl">
          <Link href={`${messagesPath}/dalily`}>{t("back")}</Link>
        </Button>
      </div>
    </div>
  );
}
