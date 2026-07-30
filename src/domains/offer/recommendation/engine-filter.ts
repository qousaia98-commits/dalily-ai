/**
 * Pure client-safe filter/sort for public decision boards.
 * No DB, no weights, no admin clients.
 */

import type { MarketplaceOfferView } from "@/domains/offer/types";
import type {
  OfferDecisionFilter,
  OfferDecisionSort,
  PublicOfferDecision,
  PublicOfferDecisionBoard,
} from "./types";

export function filterAndSortDecisions(input: {
  offers: MarketplaceOfferView[];
  board: PublicOfferDecisionBoard;
  sort: OfferDecisionSort;
  filters: OfferDecisionFilter[];
  shortlistedProviderIds: string[];
}): { offers: MarketplaceOfferView[]; decisions: PublicOfferDecision[] } {
  const byId = new Map(input.board.decisions.map((d) => [d.offerId, d]));
  let list = [...input.offers];

  if (input.filters.includes("verified_only")) {
    list = list.filter((o) => byId.get(o.id)?.compare.verified);
  }
  if (input.filters.includes("available_now")) {
    list = list.filter((o) => byId.get(o.id)?.compare.availableNow);
  }
  if (input.filters.includes("shortlisted")) {
    const set = new Set(input.shortlistedProviderIds);
    list = list.filter((o) => set.has(o.providerId));
  }

  const sort = input.sort;
  list.sort((a, b) => {
    const da = byId.get(a.id);
    const db = byId.get(b.id);
    switch (sort) {
      case "rating":
        return (db?.compare.ratingAvg ?? 0) - (da?.compare.ratingAvg ?? 0);
      case "trust":
        return (db?.compare.trustScorePct ?? 0) - (da?.compare.trustScorePct ?? 0);
      case "completed_jobs":
        return (db?.compare.completedJobs ?? 0) - (da?.compare.completedJobs ?? 0);
      case "response_time": {
        const ra = da?.compare.responseHoursAvg ?? 999;
        const rb = db?.compare.responseHoursAvg ?? 999;
        return ra - rb;
      }
      case "price":
        return a.price - b.price;
      case "newest":
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case "alphabetical":
        return (a.providerName ?? "").localeCompare(b.providerName ?? "");
      case "recommended":
      default:
        return (da?.rank ?? 999) - (db?.rank ?? 999);
    }
  });

  return {
    offers: list,
    decisions: list
      .map((o) => byId.get(o.id))
      .filter((d): d is PublicOfferDecision => Boolean(d)),
  };
}
