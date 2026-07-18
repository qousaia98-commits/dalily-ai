import { getLocale, getTranslations } from "next-intl/server";
import { getAuthUser } from "@/lib/auth/session";
import { loadCustomerConversations } from "@/lib/customer/load-conversations";
import { countUnreadConversations } from "@/lib/customer/conversations";
import { ConversationList } from "@/components/business/conversation-list";
import { CustomerMessagesGuest } from "@/components/customer/customer-messages-guest";

export default async function CustomerMessagesPage() {
  const t = await getTranslations("customer.messages");
  const locale = await getLocale();
  const authUser = await getAuthUser();

  if (!authUser) {
    return <CustomerMessagesGuest />;
  }

  const { conversations } = await loadCustomerConversations(authUser.id);
  const unread = countUnreadConversations(conversations);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 overflow-x-hidden animate-fade-in px-4 py-8 sm:px-6 sm:py-10">
      <header className="space-y-2">
        <p className="text-xs font-bold tracking-[0.16em] text-[var(--dalily-gold)] uppercase">
          {t("eyebrow")}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t("title")}
          </h1>
          {unread > 0 ? (
            <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-[var(--dalily-gold)] px-2 py-0.5 text-xs font-bold text-[var(--dalily-navy)]">
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <ConversationList
        conversations={conversations}
        locale={locale}
        messagesPath="/messages"
        namespace="customer.messages"
        realtimeUserId={authUser.id}
      />
    </div>
  );
}
