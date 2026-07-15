import { getTranslations } from "next-intl/server";
import type { GrowthNotification } from "@/lib/business/notifications";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";

export async function GrowthNotifications({ items }: { items: GrowthNotification[] }) {
  const t = await getTranslations("business.growth.notifications");

  return (
    <section className="rounded-3xl border border-[#E8ECF2] bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-2">
        <Bell className="size-5 text-[var(--dalily-gold)]" />
        <h2 className="text-xl font-bold tracking-tight text-[var(--dalily-navy)]">{t("title")}</h2>
      </div>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-[#5C6478]">{t("empty")}</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className={cn(
                "rounded-2xl px-4 py-3 text-sm leading-relaxed",
                item.tone === "success" && "bg-emerald-50 text-emerald-900",
                item.tone === "gold" && "bg-[linear-gradient(180deg,#fff_0%,#FBF8F0_100%)] text-[var(--dalily-navy)]",
                item.tone === "info" && "bg-[#F7F8FA] text-[var(--dalily-navy)]",
              )}
            >
              {t(item.messageKey, item.messageParams)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
