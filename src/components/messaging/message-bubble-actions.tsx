"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Copy, Reply, Pencil, Trash2, Pin, PinOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  editChatMessageAction,
  pinChatMessageAction,
  softDeleteChatMessageAction,
} from "@/actions/chat.actions";
import { useRouter } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";

type Props = {
  messageId: string;
  conversationId: string;
  bodyText: string;
  mine: boolean;
  isPinned?: boolean;
  onReply?: (payload: { messageId: string; preview: string }) => void;
};

export function MessageBubbleActions({
  messageId,
  conversationId,
  bodyText,
  mine,
  isPinned,
  onReply,
}: Props) {
  const t = useTranslations("messaging.actions");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(bodyText);

  function copy() {
    void navigator.clipboard?.writeText(bodyText);
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-0.5 opacity-80">
      {editing ? (
        <form
          className="flex w-full flex-col gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              await editChatMessageAction({
                messageId,
                conversationId,
                bodyText: draft,
              });
              setEditing(false);
              router.refresh();
            });
          }}
        >
          <textarea
            className="min-h-16 w-full rounded-lg border bg-background px-2 py-1 text-xs text-foreground"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="flex gap-1">
            <Button type="submit" size="sm" disabled={pending}>
              {t("save")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setEditing(false)}
            >
              {t("cancel")}
            </Button>
          </div>
        </form>
      ) : (
        <>
          <IconBtn label={t("copy")} onClick={copy}>
            <Copy className="size-3" />
          </IconBtn>
          {onReply ? (
            <IconBtn
              label={t("reply")}
              onClick={() =>
                onReply({
                  messageId,
                  preview: bodyText.slice(0, 120),
                })
              }
            >
              <Reply className="size-3" />
            </IconBtn>
          ) : null}
          <IconBtn
            label={isPinned ? t("unpin") : t("pin")}
            onClick={() =>
              startTransition(async () => {
                await pinChatMessageAction({
                  messageId,
                  conversationId,
                  pinned: !isPinned,
                });
                router.refresh();
              })
            }
          >
            {isPinned ? <PinOff className="size-3" /> : <Pin className="size-3" />}
          </IconBtn>
          {mine ? (
            <>
              <IconBtn label={t("edit")} onClick={() => setEditing(true)}>
                <Pencil className="size-3" />
              </IconBtn>
              <IconBtn
                label={t("delete")}
                onClick={() =>
                  startTransition(async () => {
                    await softDeleteChatMessageAction(messageId);
                    router.refresh();
                  })
                }
              >
                <Trash2 className="size-3" />
              </IconBtn>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-md text-current/70 hover:bg-black/10 hover:text-current",
      )}
    >
      {children}
    </button>
  );
}
