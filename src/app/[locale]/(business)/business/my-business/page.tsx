import {
  Clock3,
  Images,
  ShieldCheck,
  User,
  Wrench,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { MobileHubLinks } from "@/components/layout/mobile-hub-links";

export default async function MyBusinessPage() {
  const t = await getTranslations("mobilePages.myBusiness");

  const links = [
    {
      href: "/business/profile",
      title: t("links.profile"),
      description: t("links.profileDesc"),
      icon: User,
    },
    {
      href: "/business/gallery",
      title: t("links.gallery"),
      description: t("links.galleryDesc"),
      icon: Images,
    },
    {
      href: "/business/services",
      title: t("links.services"),
      description: t("links.servicesDesc"),
      icon: Wrench,
    },
    {
      href: "/business/profile#hours",
      title: t("links.hours"),
      description: t("links.hoursDesc"),
      icon: Clock3,
    },
    {
      href: "/business/verification",
      title: t("links.verification"),
      description: t("links.verificationDesc"),
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 animate-fade-in">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>
      <MobileHubLinks links={links} />
    </div>
  );
}
