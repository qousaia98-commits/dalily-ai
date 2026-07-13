import { getTranslations } from "next-intl/server";
import { BusinessRegisterWizard } from "@/components/auth/business-register-wizard";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.businessWizard");
  return { title: t("title") };
}

export default function RegisterBusinessPage() {
  return <BusinessRegisterWizard />;
}
