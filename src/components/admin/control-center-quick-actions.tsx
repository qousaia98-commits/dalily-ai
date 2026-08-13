import { getTranslations } from "next-intl/server";
import {
  Banknote,
  ShieldCheck,
  Users,
  AlertTriangle,
  Settings,
} from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";

const ACTIONS = [
  { key: "payments", href: "/admin/payments", icon: Banknote },
  { key: "verification", href: "/admin/verification", icon: ShieldCheck },
  { key: "users", href: "/admin/users", icon: Users },
  { key: "issues", href: "/admin/issues", icon: AlertTriangle },
  { key: "settings", href: "/admin/settings", icon: Settings },
] as const;

export async function ControlCenterQuickActions() {
  const t = await getTranslations("admin.controlCenter.quickActions");

  return (
    <section className="space-y-4" aria-labelledby="ops-quick-title">
      <h2
        id="ops-quick-title"
        className="text-lg font-bold tracking-tight text-foreground sm:text-xl"
      >
        {t("title")}
      </h2>
      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.key}
              href={action.href}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 py-2",
                "text-sm font-medium text-foreground shadow-sm",
                "transition-colors hover:border-[var(--dalily-gold)]/50 hover:bg-muted/40",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)]",
              )}
            >
              <Icon className="size-4 text-[var(--dalily-gold)]" aria-hidden />
              {t(`items.${action.key}`)}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
