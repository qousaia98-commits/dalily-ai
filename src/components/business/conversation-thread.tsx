import { ArrowLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import type { BusinessConversation } from "@/lib/business/conversations";
import type { ServiceRequestDetail } from "@/lib/service-requests/types";
import { MarkConversationRead } from "@/components/business/mark-conversation-read";
import { ChatThreadClientShell } from "@/components/messaging/chat-thread-client-shell";
import { ConversationQuickActions } from "@/components/messaging/conversation-quick-actions";
import { ReadReceiptIcon } from "@/components/messaging/read-receipt-icon";
import { MarketplaceRealtimeBridge } from "@/components/marketplace/realtime-bridge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { canChat } from "@/lib/service-requests/status-machine";
import {
  formatMessageTime,
  isValidMessageTimestamp,
  resolveLatestMessageAt,
} from "@/lib/messaging/format-conversation-time";

export async function ConversationThread({
  conversation,
  messagesPath = "/business/messages",
  namespace = "business.messages",
  viewer = "business",
  request = null,
  userId,
}: {
  conversation: BusinessConversation;
  messagesPath?: string;
  namespace?: string;
  viewer?: "business" | "customer";
  request?: ServiceRequestDetail | null;
  userId?: string;
}) {
  const t = await getTranslations(namespace);
  const tm = await getTranslations("marketplace");
  const locale = await getLocale();
  const name = conversation.nameKey ? t(conversation.nameKey) : (conversation.name ?? "Chat");
  const lastMessageAt = resolveLatestMessageAt(conversation.messages);

  const chatOpen = request ? canChat(request.status) : conversation.kind === "customer";

  return (
    <div className="flex min-h-[28rem] flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      {userId ? (
        <MarketplaceRealtimeBridge
          userId={userId}
          conversationId={conversation.id}
          requestId={request?.id ?? conversation.serviceRequestId}
        />
      ) : null}
      {lastMessageAt ? (
        <MarkConversationRead
          conversationId={conversation.id}
          lastMessageAt={lastMessageAt}
          unreadCount={conversation.unreadCount}
        />
      ) : null}
      <header className="space-y-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="shrink-0 md:hidden">
            <Link href={messagesPath} aria-label={t("back")}>
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
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-foreground">{name}</p>
            {request ? (
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <span className="truncate text-xs text-muted-foreground">{request.title}</span>
                <Badge variant="secondary" className="text-[0.65rem]">
                  {tm(`status.${request.status}`)}
                </Badge>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {conversation.kind === "dalily"
                  ? t("dalilySubtitle")
                  : viewer === "customer"
                    ? t("businessSubtitle")
                    : t("customerSubtitle")}
              </p>
            )}
          </div>
          {conversation.kind === "customer" ? (
            <ConversationQuickActions
              conversationId={conversation.id}
              viewer={viewer === "customer" ? "customer" : "business"}
              pinned={conversation.pinned}
              archived={conversation.archived || conversation.state === "archived"}
            />
          ) : null}
        </div>
        {request ? (
          <div className="rounded-2xl border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-medium text-foreground">{tm("pinnedSummary")}</p>
              <Link
                href={
                  viewer === "business"
                    ? `/business/requests/${request.id}`
                    : `/account/requests/${request.id}`
                }
                className="min-h-9 shrink-0 rounded-xl px-2 py-1 text-xs font-semibold text-[var(--dalily-gold)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)]"
              >
                {tm("viewRequest")}
              </Link>
            </div>
            <p className="mt-1 line-clamp-2">{request.description}</p>
            <div className="mt-1 flex flex-wrap gap-3">
              {request.budget != null ? (
                <span>
                  {tm("budget")}: {request.budget} {request.currency ?? "SYP"}
                </span>
              ) : null}
              {request.preferred_date ? (
                <span>
                  {tm("preferredDate")}: {request.preferred_date}
                </span>
              ) : null}
              {request.quote ? (
                <span>
                  {tm("quote.status")}: {request.quote.price} {request.quote.currency}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </header>

      <div
        className="flex flex-1 flex-col gap-3 overflow-y-auto bg-muted/20 p-4"
        role="log"
        aria-live="polite"
        aria-label={t("threadLabel", { name })}
      >
        {conversation.messages.map((msg) => {
          const isOfficialChat = Boolean(msg.bodyText) && msg.from === "dalily";
          const isSystem = !isOfficialChat && (msg.isSystem || msg.from === "dalily");
          const mine =
            !isSystem &&
            !isOfficialChat &&
            (viewer === "customer" ? msg.from === "customer" : msg.from === "business");
          const body = msg.bodyText ? msg.bodyText : t(msg.bodyKey, msg.bodyParams ?? {});
          const timeLabel = formatMessageTime(msg.createdAt, locale);

          if (isSystem) {
            return (
              <div key={msg.id} className="flex justify-center">
                <div className="max-w-[90%] rounded-2xl border border-[var(--dalily-gold)]/30 bg-[color-mix(in_oklab,var(--dalily-gold)_10%,var(--card))] px-3.5 py-2 text-center text-xs leading-relaxed text-foreground sm:max-w-[75%]">
                  <p className="font-medium whitespace-pre-wrap">{body}</p>
                  {timeLabel && isValidMessageTimestamp(msg.createdAt) ? (
                    <time
                      className="mt-1 block text-[0.6rem] text-muted-foreground"
                      dateTime={msg.createdAt}
                    >
                      {timeLabel}
                    </time>
                  ) : null}
                </div>
              </div>
            );
          }

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
                    : isOfficialChat
                      ? "rounded-es-md border border-[var(--dalily-gold)]/35 bg-[color-mix(in_oklab,var(--dalily-gold)_8%,var(--card))] text-foreground"
                      : "rounded-es-md border border-border bg-card text-foreground",
                )}
              >
                {isOfficialChat ? (
                  <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--dalily-gold)]">
                    {t("dalilySender")}
                  </p>
                ) : null}
                <p className="whitespace-pre-wrap">{body}</p>
                {msg.messageType === "location" && msg.locationLat != null && msg.locationLng != null ? (
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${msg.locationLat}&mlon=${msg.locationLng}#map=16/${msg.locationLat}/${msg.locationLng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "mt-1 block text-xs underline underline-offset-2",
                      mine ? "text-white/80" : "text-primary",
                    )}
                  >
                    {msg.locationLabel ?? `${msg.locationLat.toFixed(4)}, ${msg.locationLng.toFixed(4)}`}
                  </a>
                ) : null}
                {timeLabel ? (
                  <time
                    className={cn(
                      "mt-1 flex items-center gap-1 text-[0.65rem]",
                      mine ? "justify-end text-white/60" : "text-muted-foreground",
                    )}
                    dateTime={msg.createdAt}
                  >
                    {timeLabel}
                    {mine ? (
                      <ReadReceiptIcon status={msg.deliveryStatus ?? (msg.read ? "read" : "sent")} />
                    ) : null}
                  </time>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {conversation.kind === "customer" && userId ? (
        <ChatThreadClientShell
          conversationId={conversation.id}
          userId={userId}
          peerUserId={conversation.peerUserId}
          chatOpen={Boolean(chatOpen)}
          lockedLabel={tm("chatLocked")}
        />
      ) : conversation.kind === "customer" ? (
        <div className="border-t border-border px-4 py-3">
          <p className="text-center text-xs text-muted-foreground">{tm("chatLocked")}</p>
        </div>
      ) : (
        <div className="border-t border-border px-4 py-3">
          <p className="text-center text-xs text-muted-foreground">{t("composerHint")}</p>
        </div>
      )}
    </div>
  );
}
