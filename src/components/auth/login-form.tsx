"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { Loader2 } from "lucide-react";
import { loginAction, type AuthActionState } from "@/actions/auth.actions";
import { sanitizeAppRedirect } from "@/lib/auth/safe-redirect";
import { useClientFormValidation } from "@/hooks/use-client-form-validation";
import { FieldError } from "@/components/forms/field-error";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const initialState: AuthActionState = { success: false };

function resolveError(t: ReturnType<typeof useTranslations>, code?: string): string | null {
  if (!code) return null;
  const key = `errors.${code}` as "errors.invalid_credentials";
  try {
    return t(key);
  } catch {
    return t("errors.unknown");
  }
}

export function LoginForm() {
  const t = useTranslations("auth.login");
  const searchParams = useSearchParams();
  const redirectTo = sanitizeAppRedirect(searchParams.get("redirect"));
  const [state, formAction, isPending] = useActionState(loginAction, initialState);
  const { fieldErrors, guardSubmit, getFieldA11y, requiredAttr, clearFieldError } =
    useClientFormValidation({ formId: "login" });

  const errorMessage =
    resolveError(t, state.error) ??
    (searchParams.get("error") === "auth_callback_failed" ? t("errors.auth_callback_failed") : null) ??
    (state.fieldErrors?.email?.[0] ? t("errors.required") : null);

  return (
    <Card className="w-full max-w-md animate-fade-in-up border-border/80 shadow-sm">
      <CardHeader className="space-y-2 text-center">
        <CardTitle className="text-2xl tracking-tight">{t("title")}</CardTitle>
        <CardDescription className="text-balance">{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          action={formAction}
          className="space-y-4"
          noValidate
          onSubmit={guardSubmit}
        >
          {redirectTo ? <input type="hidden" name="redirect" value={redirectTo} /> : null}
          <div className="space-y-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              disabled={isPending}
              className="min-h-11"
              {...requiredAttr}
              {...getFieldA11y("email")}
              aria-invalid={Boolean(fieldErrors.email || state.fieldErrors?.email)}
              onChange={() => clearFieldError("email")}
            />
            <FieldError name="email" formId="login" message={fieldErrors.email} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("password")}</Label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="current-password"
              disabled={isPending}
              className="min-h-11"
              toggleLabelShow={t("showPassword")}
              toggleLabelHide={t("hidePassword")}
              {...requiredAttr}
              {...getFieldA11y("password")}
              aria-invalid={Boolean(fieldErrors.password || state.fieldErrors?.password)}
              onChange={() => clearFieldError("password")}
            />
            <FieldError name="password" formId="login" message={fieldErrors.password} />
            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-primary underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t("forgotPassword")}
              </Link>
            </div>
          </div>
          {errorMessage ? (
            <p className="text-sm text-destructive" role="alert">
              {errorMessage}
            </p>
          ) : null}
          <Button type="submit" className="w-full min-h-11" size="lg" disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("submit")}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          {t("noAccount")}{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            {t("register")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
