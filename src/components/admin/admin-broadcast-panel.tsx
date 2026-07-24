"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { sendAdminBroadcastAction } from "@/actions/admin-control-center.actions";
import type { AdminBroadcastItem, BroadcastTarget } from "@/lib/admin/broadcasts";
import type { BroadcastDeliveryDiagnostics } from "@/lib/notifications/deliver";
import { formatDateTime } from "@/lib/format/datetime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = { history: AdminBroadcastItem[] };

export function AdminBroadcastPanel({ history }: Props) {
  const t = useTranslations("admin.broadcasts");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [target, setTarget] = useState<BroadcastTarget>("all");
  const [targetUserId, setTargetUserId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [diagnostics, setDiagnostics] = useState<BroadcastDeliveryDiagnostics | null>(null);

  function send() {
    setMessage(null);
    setError(false);
    setDiagnostics(null);
    startTransition(async () => {
      const result = await sendAdminBroadcastAction({
        title,
        body,
        target,
        targetUserId: target === "single" ? targetUserId : undefined,
      });
      if (result.diagnostics) setDiagnostics(result.diagnostics);
      if (result.success) {
        setMessage(
          t("sentWithCount", { count: result.deliveryCount ?? result.diagnostics?.deliverySuccess ?? 0 }),
        );
        setTitle("");
        setBody("");
        router.refresh();
      } else {
        setError(true);
        setMessage(t(`errors.${result.error ?? "failed"}`));
      }
    });
  }

  return (
    <div className="space-y-8">
      <form
        className="space-y-4 rounded-2xl border bg-card p-4"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("fields.title")}
            required
            aria-label={t("fields.title")}
          />
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value as BroadcastTarget)}
            className="border-input flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            aria-label={t("fields.target")}
          >
            <option value="all">{t("targets.all")}</option>
            <option value="providers">{t("targets.providers")}</option>
            <option value="customers">{t("targets.customers")}</option>
            <option value="single">{t("targets.single")}</option>
          </select>
        </div>
        {target === "single" ? (
          <Input
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
            placeholder={t("fields.userId")}
            required
          />
        ) : null}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t("fields.body")}
          required
          rows={4}
          className="border-input w-full rounded-md border bg-transparent px-3 py-2 text-sm"
          aria-label={t("fields.body")}
        />
        <p className="text-xs text-muted-foreground">{t("scheduleReady")}</p>
        <Button type="submit" disabled={pending} className="min-h-11 gap-2">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {pending ? t("sending") : t("send")}
        </Button>
        {message ? (
          <p
            className={
              error ? "text-sm text-destructive" : "text-sm text-emerald-600 dark:text-emerald-400"
            }
            role={error ? "alert" : "status"}
          >
            {message}
          </p>
        ) : null}

        {diagnostics ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-3 font-mono text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">{t("diagnostics.title")}</p>
            <ul className="mt-2 space-y-0.5">
              <li>
                {t("diagnostics.recipients")}: {diagnostics.recipientsFound}
              </li>
              <li>
                {t("diagnostics.created")}: {diagnostics.notificationsCreated}
              </li>
              <li>
                {t("diagnostics.success")}: {diagnostics.deliverySuccess}
              </li>
              <li>
                {t("diagnostics.failures")}: {diagnostics.deliveryFailures}
              </li>
              <li>
                {t("diagnostics.skipped")}: {diagnostics.skippedUsers}
              </li>
            </ul>
          </div>
        ) : null}
      </form>

      <section aria-labelledby="broadcast-history">
        <h2 id="broadcast-history" className="text-lg font-semibold">
          {t("history")}
        </h2>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("emptyHistory")}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {history.map((item) => (
              <li key={item.id} className="rounded-xl border px-3 py-2 text-sm">
                <p className="font-medium">{item.title}</p>
                <p className="text-muted-foreground">
                  {t(`targets.${item.target}`)} · {item.status} · {item.deliveryCount} ·{" "}
                  {formatDateTime(item.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
