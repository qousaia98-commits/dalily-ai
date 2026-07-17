import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import type { BusinessConversation } from "@/lib/business/conversations";
import { MarkConversationRead } from "@/components/business/mark-conversation-read";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export async function ConversationThread({
  conversation,
}: {
  conversation: BusinessConversation;
}) {
  const t = await getTranslations("business.messages");
  const name = conversation.nameKey ? t(conversation.nameKey) : (conversation.name ?? "Chat");
  const lastMessageAt =
    conversation.messages[conversation.messages.length - 1]?.createdAt ??
    conversation.updatedAt;

  return (
    <div className="flex min-h-[28rem] flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      <MarkConversationRead
        conversationId={conversation.id}
        lastMessageAt={lastMessageAt}
        unreadCount={conversation.unreadCount}
      />
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Button asChild variant="ghost" size="icon" className="shrink-0 md:hidden">
          <Link href="/business/messages" aria-label={t("back")}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold",
            conversation.avatarTone === "dalily"
              ? "bg-[var(--dalily-navy)] text-[var(--dalily-gold)]"
              : "bg-muted text-foreground",
          )}
          aria-hidden
        >
          {conversation.avatarTone === "dalily" ? "D" : name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate font-bold text-foreground">{name}</p>
          <p className="text-xs text-muted-foreground">
            {conversation.kind === "dalily" ? t("dalilySubtitle") : t("customerSubtitle")}
          </p>
        </div>
      </header>

      <div
        className="flex flex-1 flex-col gap-3 overflow-y-auto bg-muted/20 p-4"
        role="log"
        aria-live="polite"
        aria-label={t("threadLabel", { name })}
      >
        {conversation.messages.map((msg) => {
          const mine = msg.from === "business";
          const body = msg.bodyText
            ? msg.bodyText
            : t(msg.bodyKey, msg.bodyParams ?? {});
          return (
            <div
              key={msg.id}
              className={cn("flex", mine ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm sm:max-w-[70%]",
                  mine
                    ? "rounded-ee-md bg-[var(--dalily-navy)] text-white"
                    : conversation.kind === "dalily"
                      ? "rounded-es-md border border-[var(--dalily-gold)]/25 bg-card text-foreground"
                      : "rounded-es-md bg-card text-foreground border border-border",
                )}
              >
                <p>{body}</p>
                <time
                  className={cn(
                    "mt-1 block text-[0.65rem]",
                    mine ? "text-white/60" : "text-muted-foreground",
                  )}
                  dateTime={msg.createdAt}
                >
                  {new Date(msg.createdAt).toLocaleString()}
                </time>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-border px-4 py-3">
        <p className="text-center text-xs text-muted-foreground">{t("composerHint")}</p>
      </div>
    </div>
  );
}
