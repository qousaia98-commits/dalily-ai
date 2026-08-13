"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, LifeBuoy, Loader2 } from "lucide-react";
import { submitSupportMessageAction } from "@/actions/support.actions";
import { runServerAction } from "@/lib/next/server-action-recovery";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ContactSupportForm() {
  const t = useTranslations("support");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      setError(t("errors.required"));
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await runServerAction(() =>
        submitSupportMessageAction({ subject, message }),
      );
      if (!result.success) {
        setError(t(`errors.${result.error ?? "submit_failed"}` as "errors.submit_failed"));
        return;
      }
      setSuccess(true);
    });
  }

  if (success) {
    return (
      <Card className="w-full max-w-md animate-fade-in-up border-border/80 shadow-sm">
        <CardContent className="space-y-4 pt-6 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-7" aria-hidden />
          </div>
          <div className="space-y-1.5">
            <p className="text-base font-semibold text-foreground">{t("successTitle")}</p>
            <p className="text-sm leading-relaxed text-muted-foreground">{t("successBody")}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md animate-fade-in-up border-border/80 shadow-sm">
      <CardHeader className="space-y-2">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-[color-mix(in_oklab,var(--dalily-gold)_16%,transparent)] text-[var(--dalily-gold)]">
          <LifeBuoy className="size-5" aria-hidden />
        </div>
        <CardTitle className="text-xl tracking-tight">{t("title")}</CardTitle>
        <CardDescription className="text-balance">{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="support-subject">{t("subjectLabel")}</Label>
            <Input
              id="support-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t("subjectPlaceholder")}
              disabled={pending}
              maxLength={150}
              className="min-h-11"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="support-message">{t("messageLabel")}</Label>
            <Textarea
              id="support-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("messagePlaceholder")}
              disabled={pending}
              maxLength={4000}
              rows={6}
              required
            />
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full min-h-11" size="lg" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {pending ? t("sending") : t("submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
