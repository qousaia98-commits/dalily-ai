import Image from "next/image";
import { MapPin, Clock } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StarRating } from "@/components/providers/star-rating";
import { getLocalizedText } from "@/types/domain.types";
import type { ProviderListItem } from "@/types/search.types";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

type ProviderCardProps = {
  provider: ProviderListItem;
  className?: string;
  style?: React.CSSProperties;
};

export async function ProviderCard({ provider, className, style }: ProviderCardProps) {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("home.categories");
  const tProvider = await getTranslations("provider");

  return (
    <Link href={`/providers/${provider.id}`} className={cn("group block", className)} style={style}>
      <Card className="overflow-hidden py-0 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
        <div className="relative aspect-[16/9] overflow-hidden">
          <Image
            src={provider.coverImage}
            alt={getLocalizedText(provider.name, locale)}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
          {provider.verified ? (
            <Badge variant="success" className="absolute start-3 top-3">
              {tProvider("verified")}
            </Badge>
          ) : null}
        </div>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start gap-3">
            <div className="relative size-11 shrink-0 overflow-hidden rounded-full ring-2 ring-background">
              <Image
                src={provider.avatarImage}
                alt=""
                fill
                className="object-cover"
                sizes="44px"
              />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-semibold group-hover:text-primary">
                {getLocalizedText(provider.name, locale)}
              </h3>
              <p className="text-sm text-muted-foreground">{t(provider.category)}</p>
            </div>
            <div className="text-end">
              <p className="text-sm font-bold text-primary">{provider.trustScore}%</p>
              <p className="text-xs text-muted-foreground">{tProvider("trustScore")}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <StarRating rating={provider.rating} />
            <span>({provider.reviewCount})</span>
            <span className="flex items-center gap-1">
              <MapPin className="size-3.5" />
              {getLocalizedText(provider.city, locale)}
            </span>
            {provider.distanceKm != null ? (
              <span className="flex items-center gap-1">
                <Clock className="size-3.5" />
                {provider.distanceKm} {tProvider("km")}
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
