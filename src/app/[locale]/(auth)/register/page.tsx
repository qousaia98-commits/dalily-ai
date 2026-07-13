import { getTranslations } from "next-intl/server";
import { RegisterForm } from "@/components/auth/register-form";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.register");
  return { title: t("title") };
}

export default function RegisterPage() {
  return <RegisterForm />;
}
