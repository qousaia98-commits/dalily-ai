import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/auth/login-form";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.login");
  return { title: t("title") };
}

export default function LoginPage() {
  return <LoginForm />;
}
