"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { Loader2 } from "lucide-react";
import {
  requestPasswordResetAction,
  type AuthActionState,
} from "@/actions/auth.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const initialState: AuthActionState = { success: false };

export function ForgotPasswordForm() {
  const t = useTranslations("auth.forgotPassword");
  const [state, formAction, isPending] = useActionState(requestPasswordResetAction, initialState);

  return (
    <Card className="w-full max-w-md animate-fade-in-up border-border/80 shadow-sm">
      <CardHeader className="space-y-2 text-center">
        <CardTitle className="text-2xl tracking-tight">{t("title")}</CardTitle>
        <CardDescription className="text-balance">{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        {state.success ? (
          <div className="space-y-4 text-center" role="status">
            <p className="text-sm leading-relaxed text-muted-foreground">{t("sent")}</p>
            <Button asChild variant="outline" className="w-full min-h-11">
              <Link href="/login">{t("backToLogin")}</Link>
            </Button>
          </div>
        ) : (
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                disabled={isPending}
                className="min-h-11"
              />
            </div>
            {state.error ? (
              <p className="text-sm text-destructive" role="alert">
                {t(`errors.${state.error}` as "errors.unknown")}
              </p>
            ) : null}
            <Button type="submit" className="w-full min-h-11" size="lg" disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("submit")}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              <Link href="/login" className="font-medium text-primary hover:underline">
                {t("backToLogin")}
              </Link>
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
