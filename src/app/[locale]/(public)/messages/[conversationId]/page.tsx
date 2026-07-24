import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/lib/i18n/routing";
import { getAuthUser } from "@/lib/auth/session";
import { findConversation } from "@/lib/customer/conversations";
import { loadCustomerConversations } from "@/lib/customer/load-conversations";
import { getRequestByConversationId } from "@/lib/service-requests/queries";
import { ConversationList } from "@/components/business/conversation-list";
import { ConversationThread } from "@/components/business/conversation-thread";

type PageProps = {
  params: Promise<{ conversationId: string }>;
};

export default async function CustomerConversationPage({ params }: PageProps) {
  const { conversationId } = await params;
  const t = await getTranslations("customer.messages");
  const locale = await getLocale();
  const authUser = await getAuthUser();
  if (!authUser) {
    redirect({ href: "/login", locale });
    return;
  }
  const { conversations } = await loadCustomerConversations(authUser.id);
  const conversation = findConversation(conversations, conversationId);

  if (!conversation) notFound();

  const request =
    conversationId === "dalily" ? null : await getRequestByConversationId(conversationId);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 overflow-x-hidden animate-fade-in px-4 py-6 sm:px-6">
      <h1 className="sr-only">{t("title")}</h1>

      <div className="grid gap-4 lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)]">
        <div className="hidden lg:block">
          <ConversationList
            conversations={conversations}
            activeId={conversation.id}
            locale={locale}
            messagesPath="/messages"
            namespace="customer.messages"
          />
        </div>
        <ConversationThread
          conversation={conversation}
          messagesPath="/messages"
          namespace="customer.messages"
          viewer="customer"
          request={request}
          userId={authUser.id}
        />
      </div>
    </div>
  );
}
