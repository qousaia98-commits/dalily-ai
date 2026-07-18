import { MessageCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import type { BusinessConversation } from "@/lib/business/conversations";
import { ConversationListClient } from "@/components/business/conversation-list-client";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export async function ConversationList({
  conversations,
  activeId,
  compact = false,
  messagesPath = "/business/messages",
  namespace = "business.messages",
}: {
  conversations: BusinessConversation[];
  activeId?: string;
  locale?: string;
  compact?: boolean;
  messagesPath?: string;
  namespace?: string;
}) {
  const t = await getTranslations(namespace);

  if (conversations.length === 0) {
    const isBusiness = messagesPath.includes("business");
    const primaryHref = isBusiness ? "/business/requests" : "/search";
    const ctaLabel = isBusiness ? t("viewAll") : t("browseCta");
    return (
      <EmptyState
        icon={MessageCircle}
        title={t("emptyTitle")}
        body={t("emptyBody")}
        primary={{ href: primaryHref, label: ctaLabel }}
        className={compact ? "py-8" : undefined}
      />
    );
  }

  return (
    <ConversationListClient
      conversations={conversations}
      activeId={activeId}
      compact={compact}
      messagesPath={messagesPath}
      namespace={namespace}
    />
  );
}

export async function DashboardConversationsPreview({
  conversations,
}: {
  conversations: BusinessConversation[];
  locale?: string;
}) {
  const t = await getTranslations("business.messages");
  const preview = conversations.slice(0, 2);

  return (
    <section className="space-y-4" aria-labelledby="dash-chats-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="dash-chats-title" className="text-lg font-bold text-foreground">
          {t("previewTitle")}
        </h2>
        <Button asChild variant="outline" className="min-h-11 rounded-2xl">
          <Link href="/business/messages">{t("openMessages")}</Link>
        </Button>
      </div>
      <ConversationList conversations={preview} compact />
    </section>
  );
}
