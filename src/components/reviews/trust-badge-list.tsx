import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import type { TrustBadgeId } from "@/lib/reviews/trust-score";

type Props = {
  badges: TrustBadgeId[];
};

export async function TrustBadgeList({ badges }: Props) {
  if (badges.length === 0) return null;
  const t = await getTranslations("reviews.badges");

  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((id) => (
        <Badge key={id} variant={id === "verified" ? "success" : "outline"}>
          {t(id)}
        </Badge>
      ))}
    </div>
  );
}
