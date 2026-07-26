/**
 * Fraud / abuse detection stub (future).
 * Keep signals aggregate; never store unnecessary PII.
 */
export const fraudModule = {
  id: "fraud",
  status: "planned" as const,
  future: [
    "duplicate request bursts",
    "payment receipt anomalies",
    "review spam signals",
  ],
};
