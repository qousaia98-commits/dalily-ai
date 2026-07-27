/**
 * Business assistant bridge — Sprint 8 Phase 5.
 */
import { isAiBusinessAssistantEnabled } from "@/lib/config/feature-flags";
import {
  getProviderBusinessAssistant,
  type ProviderBusinessAssistant,
} from "@/lib/business-assistant";

export const businessAssistantModule = {
  id: "ai-business-assistant",
  status: "sprint8-phase5" as const,
  impl: ["src/lib/business-assistant/", "src/lib/provider-success/insights.ts"],
  future: ["ML coaching", "personalized push briefings", "partnership matching"],
};

export async function getBusinessAssistantDashboard(
  providerId: string,
): Promise<ProviderBusinessAssistant | null> {
  if (!isAiBusinessAssistantEnabled()) return null;
  return getProviderBusinessAssistant({ providerId, persist: false });
}

export type { ProviderBusinessAssistant };
