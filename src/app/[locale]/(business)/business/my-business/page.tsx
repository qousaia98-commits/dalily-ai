import { isQualityCasesEnabled, isAiDynamicPricingEnabled, isAiDemandForecastingEnabled, isAiSchedulingEnabled, isAiBusinessAssistantEnabled } from "@/lib/config/feature-flags";
import { getTranslations } from "next-intl/server";
import { MobileHubLinks } from "@/components/layout/mobile-hub-links";
import {
  Brain,
  CalendarClock,
  Clock3,
  Images,
  LineChart,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  User,
  Wrench,
} from "lucide-react";

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
      href: "/business/media",
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
    ...(isQualityCasesEnabled()
      ? [
          {
            href: "/business/quality",
            title: t("links.quality"),
            description: t("links.qualityDesc"),
            icon: ShieldAlert,
          },
        ]
      : []),
    ...(isAiDynamicPricingEnabled()
      ? [
          {
            href: "/business/pricing",
            title: t("links.pricing"),
            description: t("links.pricingDesc"),
            icon: LineChart,
          },
        ]
      : []),
    ...(isAiDemandForecastingEnabled()
      ? [
          {
            href: "/business/forecast",
            title: t("links.forecast"),
            description: t("links.forecastDesc"),
            icon: Sparkles,
          },
        ]
      : []),
    ...(isAiSchedulingEnabled()
      ? [
          {
            href: "/business/scheduling",
            title: t("links.scheduling"),
            description: t("links.schedulingDesc"),
            icon: CalendarClock,
          },
        ]
      : []),
    ...(isAiBusinessAssistantEnabled()
      ? [
          {
            href: "/business/assistant",
            title: t("links.assistant"),
            description: t("links.assistantDesc"),
            icon: Brain,
          },
        ]
      : []),
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
