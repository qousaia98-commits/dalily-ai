import type { ServiceCategory } from "@/lib/constants/categories";
import type { ProblemId, ProblemPriority } from "@/lib/search/engine/types";
import type { Database } from "@/types/database.types";

type ProviderRow = Database["public"]["Tables"]["providers"]["Row"];

export type ProviderSearchContext = {
  categorySlug?: ServiceCategory;
  citySlug?: string;
  textTerms?: string;
  problemId?: ProblemId | null;
  priority?: ProblemPriority | null;
  verifiedOnly?: boolean;
  limit?: number;
};

export type ProviderSearchResult = {
  providers: ProviderRow[];
  metadata?: Record<string, unknown>;
};

/**
 * Pluggable provider search backends.
 * MVP: RelationalSearchProvider. Future: Hybrid, Vector, AI implementations.
 */
export interface SearchProvider {
  readonly kind: "relational" | "hybrid" | "vector" | "ai";
  search(context: ProviderSearchContext): Promise<ProviderSearchResult>;
}
