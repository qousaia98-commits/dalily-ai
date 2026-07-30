"use client";

import { useState, useTransition } from "react";
import { Ban, BellOff, Bell, Flag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  muteConversationAction,
  blockPeerAction,
  reportConversationAction,
} from "@/actions/chat-communication.actions";
import type { ChatReportReason } from "@/domains/chat/communication";

const REASONS: ChatReportReason[] = [
  "spam",
  "harassment",
  "fraud",
  "inappropriate",
  "other",
];

export function ConversationSafetyMenu({
  conversationId,
  peerUserId,
  muted,
  blocked,
}: {
  conversationId: string;
  peerUserId: string | null;
  muted: boolean;
  blocked: boolean;
}) {
  const t = useTranslations("messaging.safety");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState<ChatReportReason>("spam");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-10 rounded-xl"
        disabled={pending}
        aria-label={muted ? t("unmute") : t("mute")}
        aria-pressed={muted}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const r = await muteConversationAction({
              conversationId,
              muted: !muted,
            });
            if (!r.success) setError(r.error ?? "failed");
            else router.refresh();
          });
        }}
      >
        {muted ? <BellOff className="size-4" /> : <Bell className="size-4" />}
      </Button>

      {peerUserId ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 rounded-xl"
          disabled={pending}
          aria-label={blocked ? t("unblock") : t("block")}
          aria-pressed={blocked}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const r = await blockPeerAction({
                conversationId,
                blockedId: peerUserId,
                block: !blocked,
              });
              if (!r.success) setError(r.error ?? "failed");
              else router.refresh();
            });
          }}
        >
          <Ban className="size-4" />
        </Button>
      ) : null}

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-10 rounded-xl"
        disabled={pending}
        aria-label={t("report")}
        onClick={() => setReportOpen((v) => !v)}
      >
        <Flag className="size-4" />
      </Button>

      {reportOpen ? (
        <form
          className="w-full rounded-xl border border-border bg-background p-3 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            startTransition(async () => {
              const r = await reportConversationAction({
                conversationId,
                reason,
              });
              if (!r.success) setError(r.error ?? "failed");
              else {
                setReportOpen(false);
                router.refresh();
              }
            });
          }}
        >
          <p className="mb-2 font-medium">{t("reportTitle")}</p>
          <select
            className="mb-2 w-full rounded-lg border border-border bg-background px-2 py-1.5"
            value={reason}
            onChange={(e) => setReason(e.target.value as ChatReportReason)}
            aria-label={t("reason")}
          >
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {t(`reasons.${r}`)}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button type="submit" size="sm" className="rounded-xl" disabled={pending}>
              {t("submitReport")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="rounded-xl"
              onClick={() => setReportOpen(false)}
            >
              {t("cancel")}
            </Button>
          </div>
        </form>
      ) : null}

      {error ? (
        <p className="w-full text-xs text-destructive" role="alert">
          {t(`errors.${error}` as "errors.failed")}
        </p>
      ) : null}
    </div>
  );
}
