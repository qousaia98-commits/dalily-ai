"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, User2, Loader2 } from "lucide-react";
import { updateProfileAction } from "@/actions/profile.actions";
import { runServerAction } from "@/lib/next/server-action-recovery";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  initialDisplayName: string;
  initialEmail: string;
};

export function EditProfileForm({ initialDisplayName, initialEmail }: Props) {
  const t = useTranslations("profile.edit");
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ emailChangePending: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim() || !email.trim()) {
      setError(t("errors.required"));
      return;
    }
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await runServerAction(() =>
        updateProfileAction({ displayName, email }),
      );
      if (!result.success) {
        setError(t(`errors.${result.error ?? "save_failed"}` as "errors.save_failed"));
        return;
      }
      setSuccess({ emailChangePending: Boolean(result.emailChangePending) });
    });
  }

  return (
    <Card className="w-full max-w-md animate-fade-in-up border-border/80 shadow-sm">
      <CardHeader className="space-y-2">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-[color-mix(in_oklab,var(--dalily-gold)_16%,transparent)] text-[var(--dalily-gold)]">
          <User2 className="size-5" aria-hidden />
        </div>
        <CardTitle className="text-xl tracking-tight">{t("title")}</CardTitle>
        <CardDescription className="text-balance">{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="profile-name">{t("nameLabel")}</Label>
            <Input
              id="profile-name"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                setSuccess(null);
              }}
              disabled={pending}
              maxLength={80}
              className="min-h-11"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-email">{t("emailLabel")}</Label>
            <Input
              id="profile-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setSuccess(null);
              }}
              disabled={pending}
              className="min-h-11"
              required
            />
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          {success ? (
            <div className="flex items-start gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
              <p className="text-sm text-foreground">
                {success.emailChangePending ? t("successEmailPending") : t("success")}
              </p>
            </div>
          ) : null}

          <Button type="submit" className="w-full min-h-11" size="lg" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {pending ? t("saving") : t("submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
