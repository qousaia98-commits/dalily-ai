import Image from "next/image";
import { MapPin, Phone, MessageCircle, Clock } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { getProviderById, getReviewsForProvider } from "@/lib/mock/data";
import { getLocalizedText } from "@/types/domain.types";
import type { Locale } from "@/lib/i18n/config";
import { TrustScore } from "@/components/providers/trust-score";
import { StarRating } from "@/components/providers/star-rating";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type ProviderProfileProps = {
  providerId: string;
};

export async function ProviderProfileView({ providerId }: ProviderProfileProps) {
  const provider = getProviderById(providerId);
  if (!provider) notFound();

  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("provider");
  const tCategories = await getTranslations("home.categories");
  const reviews = getReviewsForProvider(provider.id);

  return (
    <div className="animate-fade-in">
      {/* Cover */}
      <div className="relative h-48 overflow-hidden sm:h-64 md:h-72">
        <Image
          src={provider.coverImage}
          alt=""
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
      </div>

      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        {/* Profile header */}
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
              <p className="mt-1 text-muted-foreground">{tCategories(provider.category)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <StarRating rating={provider.rating} size="md" />
              <span>
                {provider.reviewCount} {t("reviews")}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="size-4" />
                {getLocalizedText(provider.city, locale)}, {getLocalizedText(provider.district, locale)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="size-4" />
                {t("respondsIn", { hours: provider.responseTimeHours })}
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            {/* About */}
            <section>
              <h2 className="mb-3 text-lg font-semibold">{t("about")}</h2>
              <p className="leading-relaxed text-muted-foreground">
                {getLocalizedText(provider.about, locale)}
              </p>
            </section>

            {/* Services */}
            <section>
              <h2 className="mb-3 text-lg font-semibold">{t("services")}</h2>
              <div className="flex flex-wrap gap-2">
                {provider.services.map((service, i) => (
                  <Badge key={i} variant="secondary" className="px-3 py-1.5 text-sm">
                    {getLocalizedText(service, locale)}
                  </Badge>
                ))}
              </div>
            </section>

            {/* Gallery */}
            <section>
              <h2 className="mb-3 text-lg font-semibold">{t("gallery")}</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {provider.gallery.map((image, i) => (
                  <div
                    key={i}
                    className="relative aspect-[4/3] overflow-hidden rounded-xl"
                  >
                    <Image
                      src={image}
                      alt=""
                      fill
                      className="object-cover transition-transform hover:scale-105"
                      sizes="(max-width: 640px) 50vw, 33vw"
                    />
                  </div>
                ))}
              </div>
            </section>

            {/* Reviews */}
            <section>
              <h2 className="mb-4 text-lg font-semibold">{t("reviewsSection")}</h2>
              <div className="space-y-4">
                {reviews.length > 0 ? (
                  reviews.map((review) => (
                    <Card key={review.id} className="py-4">
                      <CardContent className="flex gap-4">
                        <Avatar>
                          <AvatarFallback>
                            {getLocalizedText(review.author, locale).charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium">{getLocalizedText(review.author, locale)}</p>
                            <StarRating rating={review.rating} />
                          </div>
                          <p className="text-sm text-muted-foreground">{review.date}</p>
                          <p className="text-sm leading-relaxed">
                            {getLocalizedText(review.comment, locale)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">{t("noReviews")}</p>
                )}
              </div>
            </section>
          </div>

          {/* Sidebar */}
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

            <Card>
              <CardHeader>
                <CardTitle>{t("contact")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full gap-2" size="lg" asChild>
                  <a href={`tel:${provider.phone}`}>
                    <Phone className="size-4" />
                    {t("call")}
                  </a>
                </Button>
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
                <Separator />
                <p className="text-center text-xs text-muted-foreground">{t("contactNote")}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
