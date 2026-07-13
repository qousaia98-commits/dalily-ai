import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { getProviderById, MOCK_PROVIDERS } from "@/lib/mock/data";
import { getLocalizedText } from "@/types/domain.types";
import type { Locale } from "@/lib/i18n/config";
import { ProviderProfileView } from "@/components/providers/provider-profile-view";

type ProviderPageProps = {
  params: Promise<{ id: string; locale: string }>;
};

export function generateStaticParams() {
  return MOCK_PROVIDERS.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: ProviderPageProps): Promise<Metadata> {
  const { id } = await params;
  const provider = getProviderById(id);
  const locale = (await getLocale()) as Locale;

  if (!provider) return { title: "Provider" };

  return {
    title: getLocalizedText(provider.name, locale),
    description: getLocalizedText(provider.about, locale),
  };
}

export default async function ProviderPage({ params }: ProviderPageProps) {
  const { id } = await params;
  const provider = getProviderById(id);
  if (!provider) notFound();

  return (
    <main className="flex flex-1 flex-col pb-16 pt-0">
      <ProviderProfileView providerId={id} />
    </main>
  );
}
