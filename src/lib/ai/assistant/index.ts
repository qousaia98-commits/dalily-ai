/**
 * AI Engine Phase 7 — Personal AI Assistant & Continuous Intelligence.
 */

export type {
  AssistantAudience,
  AssistantJobPhase,
  AssistantContext,
  ConfirmedFacts,
  ConversationSummary,
  OfferComparisonResult,
  OfferCompareItem,
  AppointmentBriefing,
  AfterJobAssist,
  ProactiveSuggestion,
  CustomerAssistantView,
  ProviderAssistantView,
} from "./types";

export {
  loadAssistantContext,
  upsertAssistantContext,
  shouldAskQuestion,
} from "./context";
export { compareOffers, compareAndStoreOffers } from "./offers";
export {
  summarizeConversation,
  summarizeAndStoreConversation,
} from "./summarize";
export { buildAppointmentBriefing } from "./appointment";
export { buildAfterJobAssist } from "./after-job";
export {
  buildCustomerSuggestions,
  buildProviderSuggestions,
  resolveSuggestionFeedback,
  persistSuggestions,
} from "./suggestions";
export { buildCustomerAssistant } from "./customer";
export { buildProviderAssistant } from "./provider";

export const assistantModule = {
  id: "assistant",
  status: "phase7" as const,
  impl: [
    "src/lib/ai/assistant/customer.ts",
    "src/lib/ai/assistant/provider.ts",
    "src/lib/ai/assistant/offers.ts",
    "src/lib/ai/assistant/summarize.ts",
  ],
  future: ["push reminders", "live travel ETA", "multi-job day optimizer"],
};
