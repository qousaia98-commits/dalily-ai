/**
 * Soft suggestions before sending a request — never blocking.
 */
export type RequestOptimizerSuggestionId =
  | "photo"
  | "brand"
  | "model"
  | "preferredTime"
  | "location";

export type RequestOptimizerSuggestion = {
  id: RequestOptimizerSuggestionId;
  /** i18n key under serviceRequest.optimizer.* */
  messageKey: string;
};

export type RequestOptimizerInput = {
  description: string;
  hasPhotos: boolean;
  hasPreferredDate: boolean;
  hasPreferredTime: boolean;
  hasLocation: boolean;
  /** Detected problem helps tailor suggestions */
  problemId?: string | null;
};

const APPLIANCE_PROBLEMS = new Set([
  "appliance_leak",
  "ac_not_cooling",
  "power_outage",
]);

/**
 * Returns optional tips when the request looks thin.
 * Empty array = enough info — show nothing.
 */
export function suggestRequestImprovements(
  input: RequestOptimizerInput,
): RequestOptimizerSuggestion[] {
  const suggestions: RequestOptimizerSuggestion[] = [];
  const desc = input.description.trim().toLowerCase();
  const thin = desc.length < 80;

  if (!input.hasPhotos && (thin || APPLIANCE_PROBLEMS.has(input.problemId ?? ""))) {
    suggestions.push({ id: "photo", messageKey: "photo" });
  }

  if (
    APPLIANCE_PROBLEMS.has(input.problemId ?? "") ||
    /\b(ac|air.?cond|washer|washing|fridge|refrigerat|appliance|غسالة|مكيف)\b/i.test(
      desc,
    )
  ) {
    if (!/\b(samsung|lg|bosch|whirlpool|carrier|gree|haier|marka|brand|ماركة)\b/i.test(desc)) {
      suggestions.push({ id: "brand", messageKey: "brand" });
    }
    if (!/\b(model|موديل|رقم)\b/i.test(desc)) {
      suggestions.push({ id: "model", messageKey: "model" });
    }
  }

  if (!input.hasPreferredDate && !input.hasPreferredTime) {
    suggestions.push({ id: "preferredTime", messageKey: "preferredTime" });
  }

  if (!input.hasLocation && thin) {
    suggestions.push({ id: "location", messageKey: "location" });
  }

  return suggestions.slice(0, 3);
}
