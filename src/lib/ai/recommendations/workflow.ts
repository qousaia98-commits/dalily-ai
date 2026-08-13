import type {
  AiComplexity,
  AiServiceType,
  AiUrgencyLevel,
  AiWorkflowRecommendation,
} from "@/lib/ai/decision/types";
import { urgencyToMarketplace } from "@/lib/ai/urgency/detect";

/**
 * Dispatcher-style workflow recommendation.
 */
export function recommendWorkflow(input: {
  urgency: AiUrgencyLevel;
  complexity: AiComplexity;
  serviceType: AiServiceType;
  completenessScore: number;
}): AiWorkflowRecommendation {
  if (input.urgency === "critical" || input.urgency === "high") {
    return {
      strategy: "emergency_dispatch",
      reasonKey: "workflow.emergency",
      marketplaceUrgency: "emergency",
    };
  }

  if (input.completenessScore < 55 && input.serviceType !== "renovation") {
    return {
      strategy: "guided_diagnosis",
      reasonKey: "workflow.guided",
      marketplaceUrgency: urgencyToMarketplace(input.urgency),
    };
  }

  if (
    input.complexity === "complex" ||
    input.serviceType === "renovation" ||
    input.serviceType === "install"
  ) {
    return {
      strategy: "collect_offers",
      reasonKey: "workflow.collectOffers",
      marketplaceUrgency: "normal",
    };
  }

  if (input.complexity === "simple" && input.serviceType === "repair") {
    return {
      strategy: "direct_contact",
      reasonKey: "workflow.directContact",
      marketplaceUrgency: urgencyToMarketplace(input.urgency),
    };
  }

  return {
    strategy: "collect_offers",
    reasonKey: "workflow.collectOffers",
    marketplaceUrgency: urgencyToMarketplace(input.urgency),
  };
}
