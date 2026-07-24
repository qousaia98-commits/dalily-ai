import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireAuthUser } from "@/lib/auth/session";
import { findConversation } from "@/lib/business/conversations";
import { loadBusinessConversations } from "@/lib/business/load-conversations";
import { getRequestByConversationId } from "@/lib/service-requests/queries";
import { ConversationList } from "@/components/business/conversation-list";
import { ConversationThread } from "@/components/business/conversation-thread";
import { PlanBadge } from "@/components/shared/plan-badge";

type PageProps = {
  params: Promise<{ conversationId: string }>;
};

export default async function BusinessConversationPage({ params }: PageProps) {
  const { conversationId } = await params;
  const t = await getTranslations("business.messages");
  const locale = await getLocale();
  const authUser = await requireAuthUser();
  const { conversations, planSlug } = await loadBusinessConversations(authUser.id);
  const conversation = findConversation(conversations, conversationId);

  if (!conversation) notFound();

  const request =
    conversationId === "dalily" ? null : await getRequestByConversationId(conversationId);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 overflow-x-hidden animate-fade-in">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="sr-only">{t("title")}</h1>
        <PlanBadge planSlug={planSlug} className="md:hidden" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)]">
        <div className="hidden lg:block">
          <ConversationList
            conversations={conversations}
            activeId={conversation.id}
            locale={locale}
          />
        </div>
        <ConversationThread
          conversation={conversation}
          request={request}
          userId={authUser.id}
        />
      </div>
    </div>
  );
}
