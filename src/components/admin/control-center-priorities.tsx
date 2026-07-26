import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { ArrowRight, Target } from "lucide-react";
import { buildOpsPriorities, type OpsAttentionCounts } from "@/lib/admin/ops-health";
import { cn } from "@/lib/utils";

export async function ControlCenterPriorities({ counts }: { counts: OpsAttentionCounts }) {
  const t = await getTranslations("admin.controlCenter.priorities");
  const priorities = buildOpsPriorities(counts);

  return (
    <section className="space-y-4" aria-labelledby="ops-priorities-title">
      <div className="flex items-center gap-2">
        <Target className="size-5 text-[var(--dalily-gold)]" aria-hidden />
        <h2
          id="ops-priorities-title"
          className="text-lg font-bold tracking-tight text-foreground sm:text-xl"
        >
          {t("title")}
        </h2>
      </div>

      {priorities.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ul className="space-y-2">
          {priorities.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className={cn(
                  "group flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3",
                  "transition-colors hover:border-[var(--dalily-gold)]/40 hover:bg-muted/30",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)]",
                )}
              >
                <p className="text-sm font-medium text-foreground">
                  {t(`items.${item.messageKey}`, { count: item.count })}
                </p>
                <ArrowRight
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
