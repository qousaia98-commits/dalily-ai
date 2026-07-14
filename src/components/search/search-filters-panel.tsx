import { getCategoryGroupsWithLeaves } from "@/lib/categories/queries";
import { SearchFilters } from "@/components/search/search-filters";

type SearchFiltersPanelProps = {
  className?: string;
};

export async function SearchFiltersPanel({ className }: SearchFiltersPanelProps) {
  const groups = await getCategoryGroupsWithLeaves();
  return <SearchFilters groups={groups} className={className} />;
}
