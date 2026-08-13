"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { Loader2 } from "lucide-react";
import {
  updatePasswordAction,
  type AuthActionState,
} from "@/actions/auth.actions";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const initialState: AuthActionState = { success: false };

export type ResetPasswordFormMode = "recovery" | "change" | "anonymous";

export function ResetPasswordForm({
  mode,
}: {
  mode: ResetPasswordFormMode;
}) {
  const t = useTranslations("auth.resetPassword");
  const [state, formAction, isPending] = useActionState(updatePasswordAction, initialState);

  const requireCurrentPassword =
    mode === "change" || state.error === "reauth_required";

  return (
    <Card className="w-full max-w-md animate-fade-in-up border-border/80 shadow-sm">
      <CardHeader className="space-y-2 text-center">
        <CardTitle className="text-2xl tracking-tight">
          {requireCurrentPassword ? t("changeTitle") : t("title")}
        </CardTitle>
        <CardDescription className="text-balance">
          {requireCurrentPassword ? t("changeSubtitle") : t("subtitle")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {mode === "anonymous" && !state.success ? (
          <div className="space-y-4 text-center">
            <p className="text-sm leading-relaxed text-muted-foreground" role="alert">
              {t("errors.session_required")}
            </p>
            <Button asChild className="w-full min-h-11" variant="outline">
              <Link href="/forgot-password">{t("toForgot")}</Link>
            </Button>
            <Button asChild className="w-full min-h-11">
              <Link href="/login">{t("toLogin")}</Link>
            </Button>
          </div>
        ) : state.success ? (
          <div className="space-y-4 text-center" role="status">
            <p className="text-sm leading-relaxed text-muted-foreground">{t("success")}</p>
            <Button asChild className="w-full min-h-11">
              <Link href="/login">{t("toLogin")}</Link>
            </Button>
          </div>
        ) : (
          <form action={formAction} className="space-y-4">
            {requireCurrentPassword ? (
              <div className="space-y-2">
                <Label htmlFor="currentPassword">{t("currentPassword")}</Label>
                <PasswordInput
                  id="currentPassword"
                  name="currentPassword"
                  autoComplete="current-password"
                  required
                  disabled={isPending}
                  className="min-h-11"
                  toggleLabelShow={t("showPassword")}
                  toggleLabelHide={t("hidePassword")}
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="password">{t("password")}</Label>
              <PasswordInput
                id="password"
                name="password"
                autoComplete="new-password"
                required
                minLength={6}
                disabled={isPending}
                className="min-h-11"
                toggleLabelShow={t("showPassword")}
                toggleLabelHide={t("hidePassword")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
              <PasswordInput
                id="confirmPassword"
                name="confirmPassword"
                autoComplete="new-password"
                required
                minLength={6}
                disabled={isPending}
                className="min-h-11"
                toggleLabelShow={t("showPassword")}
                toggleLabelHide={t("hidePassword")}
              />
            </div>
            {state.error ? (
              <p className="text-sm text-destructive" role="alert">
                {t(`errors.${state.error}` as "errors.unknown")}
              </p>
            ) : null}
            {state.error === "reauth_required" ? (
              <p className="text-sm text-muted-foreground">
                <Link href="/forgot-password" className="underline underline-offset-4">
                  {t("toForgot")}
                </Link>
              </p>
            ) : null}
            <Button type="submit" className="w-full min-h-11" size="lg" disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("submit")}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
