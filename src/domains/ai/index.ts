/**
 * SAD AI domain facade (Sprint 0).
 * Advisory only — guardrails enforced in later sprints.
 */

export const AI_DOMAIN = {
  service: "ai",
  owns: ["suggestion_artifacts", "model_run_logs_scrubbed"],
  impl: [
    "src/lib/vision",
    "src/lib/voice",
    "src/lib/diagnosis",
    "src/lib/search/problem-detection",
  ],
  status: "facade_barrel",
} as const;

/** Stable pointers for future intake orchestration (Sprint 2). */
export const AI_IMPL_PATHS = AI_DOMAIN.impl;
