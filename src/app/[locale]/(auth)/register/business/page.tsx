import { getTranslations } from "next-intl/server";
import { BusinessRegisterWizard } from "@/components/auth/business-register-wizard";
import { getCategoryGroupsWithLeaves } from "@/lib/categories/queries";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.businessWizard");
  return { title: t("title") };
}

export default async function RegisterBusinessPage() {
  const categoryGroups = await getCategoryGroupsWithLeaves();
  return <BusinessRegisterWizard categoryGroups={categoryGroups} />;
}
