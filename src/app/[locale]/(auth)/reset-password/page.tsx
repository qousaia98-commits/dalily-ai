import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { createClient } from "@/lib/supabase/server";
import { isPasswordRecoverySession } from "@/lib/auth/password-recovery";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.resetPassword");
  return { title: t("title") };
}

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let mode: "recovery" | "change" | "anonymous" = "anonymous";
  if (user) {
    const recovery = await isPasswordRecoverySession(supabase);
    mode = recovery ? "recovery" : "change";
  }

  return <ResetPasswordForm mode={mode} />;
}
