/**
 * Public AI module descriptor for fraud (no scores exposed).
 */

export const fraudModule = {
  id: "fraud",
  status: "active" as const,
  layer: {
    rules: "fraud-rules-v1",
    ml: "fraud-ml-ready-v0",
  },
  capabilities: [
    "risk_scoring",
    "fraud_events",
    "investigations",
    "relationship_graph",
    "configurable_auto_actions",
  ],
  constraints: [
    "admin_only",
    "no_public_risk_levels",
    "no_automatic_permanent_suspend",
  ],
};
