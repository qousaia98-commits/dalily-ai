"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import type { BusinessConversation } from "@/lib/business/conversations";
import { filterConversations } from "@/lib/business/conversations";
import { formatConversationListTime } from "@/lib/messaging/format-conversation-time";
import { useMarketplaceRealtime } from "@/hooks/use-marketplace-realtime";
import { OfficialDalilyAvatar } from "@/components/messaging/official-dalily-avatar";
import { VerifiedBadge } from "@/components/messaging/verified-badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function ConversationListClient({
  conversations,
  activeId,
  compact = false,
  messagesPath = "/business/messages",
  namespace = "business.messages",
  realtimeUserId,
  realtimeProviderId,
}: {
  conversations: BusinessConversation[];
  activeId?: string;
  compact?: boolean;
  messagesPath?: string;
  namespace?: string;
  /** When set, list refreshes on new inbox activity. */
  realtimeUserId?: string;
  realtimeProviderId?: string | null;
}) {
  const t = useTranslations(namespace);
  const locale = useLocale();
  const [query, setQuery] = useState("");

  useMarketplaceRealtime({
    userId: realtimeUserId ?? "",
    providerId: realtimeProviderId,
    inboxAsCustomer: Boolean(realtimeUserId && !realtimeProviderId),
    inboxAsProviderId: realtimeProviderId ?? null,
  });

  const resolveName = (c: BusinessConversation) =>
    c.nameKey ? t(c.nameKey) : (c.name ?? "Chat");

  const filtered = useMemo(
    () => filterConversations(conversations, query, resolveName),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resolveName uses t
    [conversations, query, t],
  );

  const list = compact ? conversations.slice(0, 3) : filtered;

  return (
    <div className="space-y-3">
      {!compact ? (
        <div className="relative">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-11 rounded-2xl ps-9"
            aria-label={t("searchPlaceholder")}
          />
        </div>
      ) : null}

      {list.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {query ? t("searchEmpty") : t("emptyBody")}
        </p>
      ) : (
        <ul className="space-y-2" aria-label={t("listLabel")}>
          {list.map((c) => {
            const name = resolveName(c);
            const preview = c.previewText
              ? c.previewText
              : c.previewKey
                ? t(c.previewKey, c.previewParams ?? {})
                : "";
            const active = activeId === c.id;
            const timeLabel = formatConversationListTime(c.updatedAt, locale, {
              yesterday: t("yesterday"),
            });
            const isOfficial = c.kind === "dalily" || c.official;

            return (
              <li key={c.id}>
                <Link
                  href={`${messagesPath}/${c.id}`}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border px-3 py-3 transition",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)]",
                    active
                      ? "border-[var(--dalily-gold)]/40 bg-[color-mix(in_oklab,var(--dalily-gold)_10%,var(--card))]"
                      : isOfficial
                        ? "border-[var(--dalily-gold)]/20 bg-card hover:bg-muted/40"
                        : "border-border bg-card hover:bg-muted/40",
                  )}
                >
                  {isOfficial ? (
                    <OfficialDalilyAvatar size="md" />
                  ) : (
                    <span
                      className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-foreground"
                      aria-hidden
                    >
                      {(name.slice(0, 1) || "?").toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1">
                        <p className="truncate text-sm font-bold text-foreground">{name}</p>
                        {c.verified || isOfficial ? (
                          <VerifiedBadge size="sm" label={t("verifiedLabel")} />
                        ) : null}
                      </div>
                      {timeLabel ? (
                        <time
                          className="shrink-0 text-[0.65rem] text-muted-foreground"
                          dateTime={c.updatedAt ?? undefined}
                        >
                          {timeLabel}
                        </time>
                      ) : (
                        <span className="shrink-0 text-[0.65rem] text-muted-foreground">
                          {t("noMessagesYet")}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <p className="truncate text-sm text-muted-foreground">{preview}</p>
                      {c.unreadCount > 0 ? (
                        <span
                          className="ms-auto inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-[var(--dalily-gold)] px-1.5 py-0.5 text-[0.625rem] font-bold text-[var(--dalily-navy)]"
                          aria-label={t("unreadCount", { count: c.unreadCount })}
                        >
                          {c.unreadCount > 99 ? "99+" : c.unreadCount}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {!compact ? (
        <p className="px-1 text-xs text-muted-foreground">{t("customerHint")}</p>
      ) : null}
    </div>
  );
}
