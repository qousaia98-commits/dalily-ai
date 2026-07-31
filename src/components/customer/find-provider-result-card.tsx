import Image from "next/image";
import { MapPin } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { PublicVerificationBadge } from "@/components/verification/public-verification-badge";
import { StarRating } from "@/components/providers/star-rating";
import { getLocalizedText } from "@/types/domain.types";
import type { FindProviderCard } from "@/domains/customer/find-providers";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

export async function FindProviderResultCard({
  provider,
  className,
}: {
  provider: FindProviderCard;
  className?: string;
}) {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("findFlow");
  const name = getLocalizedText(provider.name, locale);
  const category = getLocalizedText(provider.categoryLabel, locale);
  const city = getLocalizedText(provider.city, locale);

  return (
    <Link
      href={`/providers/${provider.id}`}
      className={cn("group block", className)}
    >
      <Card className="overflow-hidden py-0 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0">
        <div className="relative aspect-[16/9] overflow-hidden">
          <Image
            src={provider.coverImage}
            alt={name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
          {provider.verified ? (
            <div className="absolute start-3 top-3">
              <PublicVerificationBadge providerId={provider.id} verified stopLinkNavigation />
            </div>
          ) : null}
        </div>
        <CardContent className="space-y-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <h2 className="line-clamp-2 text-base font-semibold leading-snug">{name}</h2>
            <div className="relative size-10 shrink-0 overflow-hidden rounded-full border border-border">
              <Image src={provider.avatarImage} alt="" fill className="object-cover" sizes="40px" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{category}</p>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-1">
              <StarRating rating={provider.rating} size="sm" />
              <span className="text-muted-foreground">({provider.reviewCount})</span>
            </span>
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <MapPin className="size-3.5" aria-hidden />
              {city}
              {provider.distanceKm != null
                ? ` · ${t("distanceKm", { km: provider.distanceKm })}`
                : null}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
