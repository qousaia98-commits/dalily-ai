"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import { markAllChatsReadAction } from "@/actions/chat.actions";
import { ChatSearchBar } from "@/components/messaging/chat-search-bar";
import { Button } from "@/components/ui/button";

type Props = {
  messagesBasePath?: string;
  showMarkAllRead?: boolean;
};

export function MessagesInboxTools({
  messagesBasePath = "/messages",
  showMarkAllRead = true,
}: Props) {
  const t = useTranslations("messaging.inbox");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <ChatSearchBar messagesBasePath={messagesBasePath} />
      {showMarkAllRead ? (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                await markAllChatsReadAction();
                router.refresh();
              });
            }}
          >
            {t("markAllRead")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
