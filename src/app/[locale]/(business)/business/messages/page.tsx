import { getLocale, getTranslations } from "next-intl/server";
import { requireAuthUser } from "@/lib/auth/session";
import { loadBusinessConversations } from "@/lib/business/load-conversations";
import { countUnreadConversations } from "@/lib/business/conversations";
import { ConversationList } from "@/components/business/conversation-list";
import { PlanBadge } from "@/components/shared/plan-badge";

export default async function BusinessMessagesPage() {
  const t = await getTranslations("business.messages");
  const locale = await getLocale();
  const authUser = await requireAuthUser();
  const { conversations, planSlug } = await loadBusinessConversations(authUser.id);
  const unread = countUnreadConversations(conversations);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 overflow-x-hidden animate-fade-in">
      <header className="space-y-2">
        <p className="text-xs font-bold tracking-[0.16em] text-[var(--dalily-gold)] uppercase">
          {t("eyebrow")}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t("title")}
          </h1>
          <PlanBadge planSlug={planSlug} />
          {unread > 0 ? (
            <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-[var(--dalily-gold)] px-2 py-0.5 text-xs font-bold text-[var(--dalily-navy)]">
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <ConversationList conversations={conversations} locale={locale} />
    </div>
  );
}
