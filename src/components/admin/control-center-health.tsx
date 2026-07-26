import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";
import {
  resolvePlatformHealth,
  type OpsAttentionCounts,
  type PlatformHealthLevel,
} from "@/lib/admin/ops-health";

const TONE: Record<
  PlatformHealthLevel,
  { dot: string; border: string; bg: string; text: string }
> = {
  healthy: {
    dot: "bg-emerald-500",
    border: "border-emerald-200/80 dark:border-emerald-900/50",
    bg: "bg-[linear-gradient(160deg,var(--card)_0%,rgba(16,185,129,0.08)_100%)]",
    text: "text-emerald-800 dark:text-emerald-300",
  },
  attention: {
    dot: "bg-amber-500",
    border: "border-amber-200/80 dark:border-amber-900/50",
    bg: "bg-[linear-gradient(160deg,var(--card)_0%,rgba(245,158,11,0.1)_100%)]",
    text: "text-amber-900 dark:text-amber-200",
  },
  critical: {
    dot: "bg-rose-500",
    border: "border-rose-200/80 dark:border-rose-900/50",
    bg: "bg-[linear-gradient(160deg,var(--card)_0%,rgba(244,63,94,0.08)_100%)]",
    text: "text-rose-900 dark:text-rose-200",
  },
};

export async function ControlCenterHealth({ counts }: { counts: OpsAttentionCounts }) {
  const t = await getTranslations("admin.controlCenter.health");
  const level = resolvePlatformHealth(counts);
  const tone = TONE[level];

  return (
    <section aria-labelledby="platform-health-title">
      <Link
        href={level === "critical" ? "/admin/issues" : level === "attention" ? "/admin/payments" : "/admin/health"}
        className={cn(
          "flex min-h-14 items-start gap-3 rounded-2xl border px-4 py-4 transition-colors",
          "hover:brightness-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)]",
          tone.border,
          tone.bg,
        )}
      >
        <span
          className={cn("mt-1.5 size-2.5 shrink-0 rounded-full ring-4 ring-background", tone.dot)}
          aria-hidden
        />
        <div className="min-w-0 space-y-0.5">
          <h2 id="platform-health-title" className="sr-only">
            {t("title")}
          </h2>
          <p className={cn("text-sm font-bold leading-snug sm:text-base", tone.text)}>
            {t(`status.${level}.label`)}
          </p>
          <p className="text-xs text-muted-foreground sm:text-sm">{t(`status.${level}.hint`)}</p>
        </div>
      </Link>
    </section>
  );
}
