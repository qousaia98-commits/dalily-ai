/** Lightweight category-specific clarifying prompts (no LLM at render time). */
export const CLARIFY_BY_SLUG: Record<string, string[]> = {
  electrical: ["clarify.electrical.scope", "clarify.electrical.safety"],
  plumbing: ["clarify.plumbing.where", "clarify.plumbing.severity"],
  hvac: ["clarify.hvac.symptom", "clarify.hvac.age"],
  carpentry: ["clarify.carpentry.item", "clarify.carpentry.urgency"],
  painting: ["clarify.painting.indoor", "clarify.painting.size"],
  locksmith: ["clarify.locksmith.lockedOut", "clarify.locksmith.break"],
};

export const HIGH_CONFIDENCE = 0.45;
