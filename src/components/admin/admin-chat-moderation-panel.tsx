"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  adminResolveChatReportAction,
  adminSuspendConversationAction,
} from "@/actions/chat-communication.actions";

type Report = {
  id: string;
  conversationId: string;
  reporterId: string;
  reasonCode: string;
  details: string | null;
  status: string;
  createdAt: string;
};

export function AdminChatModerationPanel({ reports }: { reports: Report[] }) {
  const t = useTranslations("admin.chatModeration");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      {reports.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li
              key={r.id}
              className="space-y-3 rounded-2xl border border-border bg-card p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{r.reasonCode}</Badge>
                <Badge variant="outline">{r.status}</Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(r.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="text-sm">
                <span className="text-muted-foreground">{t("conversation")}: </span>
                <code className="text-xs">{r.conversationId}</code>
              </p>
              {r.details ? (
                <p className="text-sm text-muted-foreground">{r.details}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="rounded-xl"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      await adminResolveChatReportAction({
                        reportId: r.id,
                        status: "resolved",
                      });
                      router.refresh();
                    });
                  }}
                >
                  {t("resolve")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-xl"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      await adminResolveChatReportAction({
                        reportId: r.id,
                        status: "dismissed",
                      });
                      router.refresh();
                    });
                  }}
                >
                  {t("dismiss")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="rounded-xl"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      await adminResolveChatReportAction({
                        reportId: r.id,
                        status: "resolved",
                        suspendConversationId: r.conversationId,
                      });
                      router.refresh();
                    });
                  }}
                >
                  {t("resolveAndSuspend")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="rounded-xl"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      await adminSuspendConversationAction({
                        conversationId: r.conversationId,
                        suspend: true,
                      });
                      router.refresh();
                    });
                  }}
                >
                  {t("suspendOnly")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
