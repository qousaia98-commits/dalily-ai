/**
 * Configurable risk rule weights — DB can override at runtime.
 */

import type { FraudAutoAction } from "@/lib/fraud/types";

export type RuleWeight = {
  ruleKey: string;
  category: string;
  weight: number;
  threshold: number;
  enabled: boolean;
  mlReady: boolean;
  autoActions: FraudAutoAction[];
};

export const DEFAULT_RISK_RULES: RuleWeight[] = [
  {
    ruleKey: "multiple_provider_accounts",
    category: "identity",
    weight: 1.4,
    threshold: 0.6,
    enabled: true,
    mlReady: false,
    autoActions: ["flag_account", "escalate_to_admin"],
  },
  {
    ruleKey: "multiple_customer_accounts",
    category: "identity",
    weight: 1.2,
    threshold: 0.6,
    enabled: true,
    mlReady: false,
    autoActions: ["flag_account", "require_manual_review"],
  },
  {
    ruleKey: "repeated_failed_payments",
    category: "payment",
    weight: 1.3,
    threshold: 0.55,
    enabled: true,
    mlReady: true,
    autoActions: ["require_manual_review", "temporary_feature_restriction"],
  },
  {
    ruleKey: "abnormal_refund_behaviour",
    category: "payment",
    weight: 1.5,
    threshold: 0.5,
    enabled: true,
    mlReady: true,
    autoActions: ["flag_account", "escalate_to_admin"],
  },
  {
    ruleKey: "fake_review_network",
    category: "review",
    weight: 1.6,
    threshold: 0.55,
    enabled: true,
    mlReady: true,
    autoActions: ["require_manual_review", "escalate_to_admin"],
  },
  {
    ruleKey: "rating_manipulation",
    category: "review",
    weight: 1.4,
    threshold: 0.55,
    enabled: true,
    mlReady: true,
    autoActions: ["require_manual_review"],
  },
  {
    ruleKey: "repeated_cancelled_bookings",
    category: "booking",
    weight: 1.1,
    threshold: 0.5,
    enabled: true,
    mlReady: false,
    autoActions: ["flag_account"],
  },
  {
    ruleKey: "no_show_patterns",
    category: "booking",
    weight: 1.2,
    threshold: 0.5,
    enabled: true,
    mlReady: false,
    autoActions: ["flag_account", "require_manual_review"],
  },
  {
    ruleKey: "suspicious_messaging",
    category: "messaging",
    weight: 1.0,
    threshold: 0.55,
    enabled: true,
    mlReady: true,
    autoActions: ["temporary_feature_restriction"],
  },
  {
    ruleKey: "rapid_account_creation",
    category: "identity",
    weight: 1.3,
    threshold: 0.6,
    enabled: true,
    mlReady: false,
    autoActions: ["require_manual_review", "require_identity_reverification"],
  },
  {
    ruleKey: "device_anomaly",
    category: "device",
    weight: 1.1,
    threshold: 0.6,
    enabled: true,
    mlReady: true,
    autoActions: ["require_manual_review"],
  },
  {
    ruleKey: "location_anomaly",
    category: "location",
    weight: 1.0,
    threshold: 0.65,
    enabled: true,
    mlReady: true,
    autoActions: ["require_manual_review"],
  },
  {
    ruleKey: "repeated_identity_changes",
    category: "identity",
    weight: 1.4,
    threshold: 0.55,
    enabled: true,
    mlReady: false,
    autoActions: ["require_identity_reverification", "escalate_to_admin"],
  },
  {
    ruleKey: "policy_violation",
    category: "policy",
    weight: 1.5,
    threshold: 0.4,
    enabled: true,
    mlReady: false,
    autoActions: ["flag_account", "escalate_to_admin"],
  },
];

export function mergeRuleWeights(
  defaults: RuleWeight[],
  overrides: Partial<RuleWeight>[],
): RuleWeight[] {
  const map = new Map(defaults.map((d) => [d.ruleKey, { ...d }]));
  for (const o of overrides) {
    if (!o.ruleKey) continue;
    const prev = map.get(o.ruleKey);
    if (prev) map.set(o.ruleKey, { ...prev, ...o });
    else map.set(o.ruleKey, { ...defaults[0], ...o } as RuleWeight);
  }
  return [...map.values()];
}
