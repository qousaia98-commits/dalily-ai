"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { Loader2, CheckCircle2 } from "lucide-react";
import { registerAction, type AuthActionState } from "@/actions/auth.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Locale } from "@/lib/i18n/config";

const initialState: AuthActionState = { success: false };

function resolveError(t: ReturnType<typeof useTranslations>, code?: string): string | null {
  if (!code) return null;
  const key = `errors.${code}` as "errors.invalid";
  try {
    return t(key);
  } catch {
    return t("errors.unknown");
  }
}

export function RegisterForm() {
  const t = useTranslations("auth.register");
  const locale = useLocale() as Locale;
  const [state, formAction, isPending] = useActionState(registerAction, initialState);

  const errorMessage = resolveError(t, state.error);

  if (state.success && state.message === "verify_email") {
    return (
      <Card className="w-full max-w-md animate-fade-in-up">
        <CardContent className="flex flex-col items-center gap-4 pt-8 pb-8 text-center">
          <CheckCircle2 className="size-12 text-emerald-600" />
          <h2 className="text-xl font-semibold">{t("success.verifyTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("success.verifyDescription")}</p>
          <Button asChild variant="outline">
            <Link href="/login">{t("login")}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md animate-fade-in-up">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />
          <div className="space-y-2">
            <Label htmlFor="name">{t("name")}</Label>
            <Input id="name" name="name" required disabled={isPending} minLength={2} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input id="email" name="email" type="email" required disabled={isPending} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("password")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              disabled={isPending}
              minLength={6}
            />
          </div>
          {errorMessage ? (
            <p className="text-sm text-destructive" role="alert">
              {errorMessage}
            </p>
          ) : null}
          <Button type="submit" className="w-full" size="lg" disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("submit")}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {t("businessPrompt")}{" "}
          <Link href="/register/business" className="font-medium text-primary hover:underline">
            {t("businessLink")}
          </Link>
        </p>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {t("hasAccount")}{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            {t("login")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
