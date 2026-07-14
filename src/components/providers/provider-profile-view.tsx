import Image from "next/image";
import { MapPin, Phone, MessageCircle, Clock } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { getLocalizedText } from "@/types/domain.types";
import type { Locale } from "@/lib/i18n/config";
import type { PublicProviderProfile } from "@/lib/providers/public-queries";
import { TrustScore } from "@/components/providers/trust-score";
import { StarRating } from "@/components/providers/star-rating";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type ProviderProfileViewProps = {
  provider: PublicProviderProfile;
};

export async function ProviderProfileView({ provider }: ProviderProfileViewProps) {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("provider");

  const districtLabel = provider.district ? getLocalizedText(provider.district, locale) : null;
  const cityLabel = getLocalizedText(provider.city, locale);
  const locationLabel = districtLabel ? `${cityLabel}, ${districtLabel}` : cityLabel;

  return (
    <div className="animate-fade-in">
      <div className="relative h-48 overflow-hidden sm:h-64 md:h-72">
        <Image
          src={provider.coverImage}
          alt={getLocalizedText(provider.name, locale)}
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
      </div>

      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="-mt-16 relative mb-8 flex flex-col gap-4 sm:-mt-20 sm:flex-row sm:items-end">
          <div className="relative size-24 shrink-0 overflow-hidden rounded-2xl border-4 border-background shadow-lg sm:size-32">
            <Image
              src={provider.avatarImage}
              alt={getLocalizedText(provider.name, locale)}
              fill
              className="object-cover"
              sizes="128px"
            />
          </div>
          <div className="flex flex-1 flex-col gap-3 sm:pb-2">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold sm:text-3xl">
                  {getLocalizedText(provider.name, locale)}
                </h1>
                {provider.verified ? (
                  <Badge variant="success">{t("verified")}</Badge>
                ) : null}
              </div>
              <p className="mt-1 text-muted-foreground">
                {getLocalizedText(provider.categoryLabel, locale)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <StarRating rating={provider.rating} size="md" />
              <span>
                {provider.reviewCount} {t("reviews")}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="size-4" />
                {locationLabel}
              </span>
              {provider.responseTimeHours != null ? (
                <span className="flex items-center gap-1">
                  <Clock className="size-4" />
                  {t("respondsIn", { hours: provider.responseTimeHours })}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            {provider.about ? (
              <section>
                <h2 className="mb-3 text-lg font-semibold">{t("about")}</h2>
                <p className="leading-relaxed text-muted-foreground">
                  {getLocalizedText(provider.about, locale)}
                </p>
              </section>
            ) : null}

            {provider.services.length > 0 ? (
              <section>
                <h2 className="mb-3 text-lg font-semibold">{t("services")}</h2>
                <div className="flex flex-wrap gap-2">
                  {provider.services.map((service) => (
                    <Badge key={service.ar + service.en} variant="secondary" className="px-3 py-1.5 text-sm">
                      {getLocalizedText(service, locale)}
                    </Badge>
                  ))}
                </div>
              </section>
            ) : null}

            {provider.gallery.length > 0 ? (
              <section>
                <h2 className="mb-3 text-lg font-semibold">{t("gallery")}</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {provider.gallery.map((image) => (
                    <div key={image} className="relative aspect-[4/3] overflow-hidden rounded-xl">
                      <Image
                        src={image}
                        alt={getLocalizedText(provider.name, locale)}
                        fill
                        className="object-cover transition-transform hover:scale-105"
                        sizes="(max-width: 640px) 50vw, 33vw"
                      />
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section>
              <h2 className="mb-4 text-lg font-semibold">{t("reviewsSection")}</h2>
              <p className="text-sm text-muted-foreground">{t("noReviews")}</p>
            </section>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t("trustScore")}</CardTitle>
              </CardHeader>
              <CardContent>
                <TrustScore
                  score={provider.trustScore}
                  verified={provider.verified}
                  size="lg"
                  showBar
                />
              </CardContent>
            </Card>

            {(provider.phone || provider.whatsapp) && (
              <Card>
                <CardHeader>
                  <CardTitle>{t("contact")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {provider.phone ? (
                    <Button className="w-full gap-2" size="lg" asChild>
                      <a href={`tel:${provider.phone}`}>
                        <Phone className="size-4" />
                        {t("call")}
                      </a>
                    </Button>
                  ) : null}
                  {provider.whatsapp ? (
                    <Button variant="outline" className="w-full gap-2" size="lg" asChild>
                      <a
                        href={`https://wa.me/${provider.whatsapp.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MessageCircle className="size-4" />
                        {t("whatsapp")}
                      </a>
                    </Button>
                  ) : null}
                  <Separator />
                  <p className="text-center text-xs text-muted-foreground">{t("contactNote")}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
