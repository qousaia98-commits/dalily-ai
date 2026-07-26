/**
 * SAD AI domain facade.
 * Phase 1 foundation lives in src/lib/ai (memory, knowledge, learning, intent resolve).
 * Advisory modules remain behind product guardrails.
 */

export const AI_DOMAIN = {
  service: "ai",
  owns: [
    "ai_intent_memory",
    "ai_knowledge_phrases",
    "ai_intent_decisions",
    "ai_dispatch_predictions",
    "ai_provider_reputation",
    "ai_service_knowledge",
    "ai_job_analyses",
    "ai_vision_analyses",
    "ai_voice_transcripts",
    "ai_assistant_contexts",
    "ai_conversation_summaries",
    "ai_offer_comparisons",
    "ai_proactive_suggestions",
    "ai_demand_forecasts",
    "ai_availability_forecasts",
    "ai_wait_time_estimates",
    "ai_marketplace_balances",
    "ai_prediction_outcomes",
    "ai_predictive_notifications",
    "ai_automation_policies",
    "ai_provider_automation_settings",
    "ai_automation_actions",
    "ai_automation_approvals",
    "ai_automation_feedback",
    "learning_events",
    "suggestion_artifacts",
    "model_run_logs_scrubbed",
  ],
  impl: [
    "src/lib/ai",
    "src/lib/ai/dispatch",
    "src/lib/ai/jobs",
    "src/lib/ai/vision",
    "src/lib/ai/voice",
    "src/lib/ai/assistant",
    "src/lib/ai/predictive",
    "src/lib/ai/automation",
    "src/lib/vision",
    "src/lib/voice",
    "src/lib/diagnosis",
    "src/lib/search/problem-detection",
    "src/lib/search/learning",
  ],
  status: "phase9_autonomous_actions",
} as const;

/** Stable pointers for intake / vision / voice orchestration. */
export const AI_IMPL_PATHS = AI_DOMAIN.impl;
