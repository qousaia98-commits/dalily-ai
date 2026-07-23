"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { sendAdminBroadcastAction } from "@/actions/admin-control-center.actions";
import type { AdminBroadcastItem, BroadcastTarget } from "@/lib/admin/broadcasts";
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

  function send() {
    startTransition(async () => {
      const result = await sendAdminBroadcastAction({
        title,
        body,
        target,
        targetUserId: target === "single" ? targetUserId : undefined,
      });
      setMessage(result.success ? t("sent") : t(`errors.${result.error ?? "failed"}`));
      if (result.success) {
        setTitle("");
        setBody("");
        router.refresh();
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
        <Button type="submit" disabled={pending}>
          {t("send")}
        </Button>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
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
                  {new Date(item.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
