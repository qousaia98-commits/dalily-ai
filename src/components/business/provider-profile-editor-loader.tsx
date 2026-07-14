import { getCategoryGroupsWithLeaves } from "@/lib/categories/queries";
import { categorySlugFromId, citySlugFromId } from "@/lib/providers/reference";
import { ProviderProfileEditor } from "@/components/business/provider-profile-editor";
import type { ManagedProvider } from "@/types/provider.types";

type ProviderProfileEditorLoaderProps = {
  provider: ManagedProvider;
};

export async function ProviderProfileEditorLoader({ provider }: ProviderProfileEditorLoaderProps) {
  const [categoryGroups, initialCategorySlug, initialCitySlug] = await Promise.all([
    getCategoryGroupsWithLeaves(),
    categorySlugFromId(provider.categoryId),
    Promise.resolve(citySlugFromId(provider.cityId)),
  ]);

  return (
    <ProviderProfileEditor
      provider={provider}
      categoryGroups={categoryGroups}
      initialCategorySlug={initialCategorySlug ?? ""}
      initialCitySlug={initialCitySlug ?? ""}
    />
  );
}
