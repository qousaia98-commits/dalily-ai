import { cookies } from "next/headers";
import { getCategoryGroupsWithLeaves } from "@/lib/categories/queries";
import { SearchFilters } from "@/components/search/search-filters";
import {
  LOC_PREF_COOKIE,
  parseLocationPreference,
} from "@/lib/geo/location-preference";

type SearchFiltersPanelProps = {
  className?: string;
};

export async function SearchFiltersPanel({ className }: SearchFiltersPanelProps) {
  const groups = await getCategoryGroupsWithLeaves();
  const jar = await cookies();
  const nearbyAvailable =
    parseLocationPreference(jar.get(LOC_PREF_COOKIE)?.value) === "enabled";
  return (
    <SearchFilters
      groups={groups}
      className={className}
      nearbyAvailable={nearbyAvailable}
    />
  );
}
