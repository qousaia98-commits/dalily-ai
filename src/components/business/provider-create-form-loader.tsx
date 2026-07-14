import { getCategoryGroupsWithLeaves } from "@/lib/categories/queries";
import { ProviderCreateForm } from "@/components/business/provider-create-form";

export async function ProviderCreateFormLoader() {
  const categoryGroups = await getCategoryGroupsWithLeaves();
  return <ProviderCreateForm categoryGroups={categoryGroups} />;
}
