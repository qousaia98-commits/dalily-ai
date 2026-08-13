/**
 * Dual Marketplace — Sprint 4 Phase 1.
 */

export type {
  MarketplacePath,
  MarketplacePathRecommendation,
  DualMarketplaceChoice,
} from "./types";

export {
  recommendMarketplacePath,
  pathFromWorkflowStrategy,
} from "./recommend-path";

export const dualMarketplaceModule = {
  id: "dual_marketplace",
  status: "sprint4_phase1" as const,
  paths: ["publish", "find"] as const,
};
