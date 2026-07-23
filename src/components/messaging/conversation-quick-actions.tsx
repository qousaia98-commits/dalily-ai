"use client";

import { useTransition } from "react";
import { Archive, Pin } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import { updateConversationFlagsAction } from "@/actions/chat.actions";
import { Button } from "@/components/ui/button";

type Props = {
  conversationId: string;
  viewer: "customer" | "business";
  pinned?: boolean;
  archived?: boolean;
};

export function ConversationQuickActions({
  conversationId,
  viewer,
  pinned = false,
  archived = false,
}: Props) {
  const t = useTranslations("messaging.actions");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-10 rounded-xl"
        disabled={pending}
        aria-label={pinned ? t("unpin") : t("pin")}
        aria-pressed={pinned}
        onClick={() => {
          startTransition(async () => {
            await updateConversationFlagsAction({
              conversationId,
              viewer,
              pinned: !pinned,
            });
            router.refresh();
          });
        }}
      >
        <Pin className={pinned ? "size-4 fill-current" : "size-4"} aria-hidden />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-10 rounded-xl"
        disabled={pending}
        aria-label={archived ? t("unarchive") : t("archive")}
        aria-pressed={archived}
        onClick={() => {
          startTransition(async () => {
            await updateConversationFlagsAction({
              conversationId,
              viewer,
              archived: !archived,
            });
            router.refresh();
          });
        }}
      >
        <Archive className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
