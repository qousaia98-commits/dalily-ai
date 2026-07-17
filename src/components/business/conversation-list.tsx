import { MessageCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import type { BusinessConversation } from "@/lib/business/conversations";
import { ConversationListClient } from "@/components/business/conversation-list-client";
import { Button } from "@/components/ui/button";

export async function ConversationList({
  conversations,
  activeId,
  compact = false,
}: {
  conversations: BusinessConversation[];
  activeId?: string;
  locale?: string;
  compact?: boolean;
}) {
  const t = await getTranslations("business.messages");

  if (conversations.length === 0 && !compact) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
        <MessageCircle className="mx-auto size-8 text-muted-foreground" aria-hidden />
        <p className="mt-3 text-sm font-medium text-foreground">{t("emptyTitle")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("emptyBody")}</p>
      </div>
    );
  }

  return (
    <ConversationListClient
      conversations={conversations}
      activeId={activeId}
      compact={compact}
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
  const preview = conversations.slice(0, 3);

  return (
    <section className="space-y-4" aria-labelledby="dash-chats-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="dash-chats-title" className="text-lg font-bold text-foreground">
          {t("previewTitle")}
        </h2>
        <Button asChild variant="outline" className="rounded-2xl">
          <Link href="/business/messages">{t("openMessages")}</Link>
        </Button>
      </div>
      <ConversationList conversations={preview} compact />
    </section>
  );
}
