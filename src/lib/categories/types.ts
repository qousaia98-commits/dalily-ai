import type { LocalizedJson } from "@/types/database.types";

export type CategoryRecord = {
  id: string;
  module_id: string;
  parent_id: string | null;
  slug: string;
  name: LocalizedJson;
  description: LocalizedJson | null;
  icon: string | null;
  depth: number;
  sort_order: number;
  is_active: boolean;
};

export type CategoryGroupWithLeaves = {
  group: CategoryRecord;
  leaves: CategoryRecord[];
};

/** Dynamic category slug loaded from the database (leaf categories). */
export type CategorySlug = string;
