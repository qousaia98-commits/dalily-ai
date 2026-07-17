import { getTranslations } from "next-intl/server";
import type { ControlCenterOverview } from "@/lib/admin/control-center";

export async function ControlCenterHero({ overview }: { overview: ControlCenterOverview }) {
  const t = await getTranslations("admin.controlCenter.hero");
  const attention =
    overview.pendingBusinesses +
    overview.pendingPayments +
    overview.changesRequested +
    overview.unreadMessages;

  return (
    <header className="relative overflow-hidden rounded-[2rem] border border-[#E8ECF2] bg-[linear-gradient(145deg,#0B1526_0%,#1a2744_100%)] px-6 py-8 text-white shadow-[0_20px_50px_-24px_rgba(11,21,38,0.55)] sm:px-8 sm:py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -end-10 -top-10 size-48 rounded-full bg-[var(--dalily-gold)]/20 blur-3xl"
      />
      <div className="relative space-y-3">
        <p className="text-xs font-bold tracking-[0.18em] text-[var(--dalily-gold)] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">{t("title")}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-white/70 sm:text-base">
          {attention > 0 ? t("subtitleAttention", { count: attention }) : t("subtitleClear")}
        </p>
        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: t("pendingBusinesses"), value: overview.pendingBusinesses },
            { label: t("pendingPayments"), value: overview.pendingPayments },
            { label: t("changesRequested"), value: overview.changesRequested },
            { label: t("unreadMessages"), value: overview.unreadMessages },
            { label: t("approvalsToday"), value: overview.approvalsToday },
            { label: t("registrationsWeek"), value: overview.registrationsThisWeek },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl bg-white/8 px-3 py-3 backdrop-blur-sm">
              <dt className="text-[0.6875rem] font-medium text-white/55">{item.label}</dt>
              <dd className="mt-1 text-xl font-bold text-[var(--dalily-gold)]">{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </header>
  );
}
