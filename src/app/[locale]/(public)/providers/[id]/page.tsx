import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { getPublicProviderById } from "@/lib/providers/database";
import { getAuthUser } from "@/lib/auth/session";
import { hasPendingRequest, getProviderRequestSettings } from "@/lib/service-requests/queries";
import { getLocalizedText } from "@/types/domain.types";
import type { Locale } from "@/lib/i18n/config";
import { ProviderProfileView } from "@/components/providers/provider-profile-view";

type ProviderPageProps = {
  params: Promise<{ id: string; locale: string }>;
};

export async function generateMetadata({ params }: ProviderPageProps): Promise<Metadata> {
  const { id } = await params;
  const provider = await getPublicProviderById(id);
  const locale = (await getLocale()) as Locale;

  if (!provider) return { title: "Provider" };

  return {
    title: getLocalizedText(provider.name, locale),
    description: provider.about ? getLocalizedText(provider.about, locale) : undefined,
  };
}

export default async function ProviderPage({ params }: ProviderPageProps) {
  const { id } = await params;
  const provider = await getPublicProviderById(id);
  if (!provider) notFound();

  const authUser = await getAuthUser();
  const pending =
    authUser != null ? await hasPendingRequest(authUser.id, provider.id) : false;
  const settings = await getProviderRequestSettings(provider.id);

  return (
    <main className="flex flex-1 flex-col pb-16 pt-0">
      <ProviderProfileView
        provider={provider}
        isLoggedIn={Boolean(authUser)}
        hasPendingRequest={pending}
        acceptingRequests={settings.accepting_requests && !settings.vacation_mode}
        estimatedResponseHours={settings.estimated_response_hours}
      />
    </main>
  );
}
