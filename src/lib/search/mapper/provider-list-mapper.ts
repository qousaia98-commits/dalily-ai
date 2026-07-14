import { citySlugFromId } from "@/lib/providers/reference";
import { getStoragePublicUrl } from "@/lib/providers/storage";
import type { LocalizedText } from "@/types/domain.types";
import type { ProviderListItem } from "@/types/search.types";
import type { Database, LocalizedJson } from "@/types/database.types";

type ProviderRow = Database["public"]["Tables"]["providers"]["Row"];

const DEFAULT_COVER =
  "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80";
const DEFAULT_AVATAR =
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&q=80";

const CITY_LABELS: Record<string, LocalizedText> = {
  damascus: { ar: "دمشق", en: "Damascus" },
  aleppo: { ar: "حلب", en: "Aleppo" },
  homs: { ar: "حمص", en: "Homs" },
  latakia: { ar: "اللاذقية", en: "Latakia" },
};

function toLocalizedText(value: LocalizedJson): LocalizedText {
  return { ar: value.ar, en: value.en };
}

export function mapProviderRowsToListItems(
  rows: ProviderRow[],
  imagePathById: Map<string, string>,
  categorySlugById: Map<string, string>,
  categoryNameBySlug: Map<string, LocalizedJson>,
): ProviderListItem[] {
  const items: ProviderListItem[] = [];

  for (const row of rows) {
    const catSlug = categorySlugById.get(row.category_id);
    if (!catSlug) continue;

    const categoryName = categoryNameBySlug.get(catSlug);
    if (!categoryName) continue;

    const cityKey = citySlugFromId(row.city_id);
    const cityLabel =
      (cityKey && CITY_LABELS[cityKey]) ||
      ({ ar: cityKey ?? "", en: cityKey ?? "" } satisfies LocalizedText);

    const avatarPath = row.avatar_image_id ? imagePathById.get(row.avatar_image_id) : undefined;
    const coverPath = row.cover_image_id ? imagePathById.get(row.cover_image_id) : undefined;

    items.push({
      id: row.id,
      slug: row.slug,
      name: toLocalizedText(row.name),
      category: catSlug,
      categoryLabel: toLocalizedText(categoryName),
      city: cityLabel,
      rating: Number(row.rating_avg),
      reviewCount: row.review_count,
      trustScore: row.trust_score,
      verified: row.verification_status === "verified",
      coverImage: coverPath ? getStoragePublicUrl(coverPath) : DEFAULT_COVER,
      avatarImage: avatarPath ? getStoragePublicUrl(avatarPath) : DEFAULT_AVATAR,
      distanceKm: null,
    });
  }

  return items;
}
