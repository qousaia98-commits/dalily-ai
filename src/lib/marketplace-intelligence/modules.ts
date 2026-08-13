/**
 * Modular intelligence engine registry — each module independent & toggleable.
 */

import type { EngineKind, IntelligenceModuleKey } from "@/lib/marketplace-intelligence/types";
import {
  MARKET_INTEL_VERSION,
  MARKET_KG_VERSION,
  MARKET_ML_VERSION,
  MARKET_SIM_VERSION,
} from "@/lib/marketplace-intelligence/types";

export type ModuleDefinition = {
  key: IntelligenceModuleKey;
  kind: EngineKind;
  version: string;
  defaultEnabled: boolean;
};

export const INTELLIGENCE_MODULES: ModuleDefinition[] = [
  { key: "global_analysis", kind: "rule", version: MARKET_INTEL_VERSION, defaultEnabled: true },
  { key: "category_intel", kind: "rule", version: MARKET_INTEL_VERSION, defaultEnabled: true },
  { key: "regional_intel", kind: "rule", version: MARKET_INTEL_VERSION, defaultEnabled: true },
  { key: "opportunity_engine", kind: "rule", version: MARKET_INTEL_VERSION, defaultEnabled: true },
  { key: "executive_reports", kind: "rule", version: MARKET_INTEL_VERSION, defaultEnabled: true },
  { key: "digital_twin", kind: "simulation", version: MARKET_SIM_VERSION, defaultEnabled: true },
  { key: "decision_support", kind: "rule", version: MARKET_INTEL_VERSION, defaultEnabled: true },
  { key: "knowledge_graph", kind: "rule", version: MARKET_KG_VERSION, defaultEnabled: true },
  { key: "provider_insights", kind: "rule", version: MARKET_INTEL_VERSION, defaultEnabled: true },
  { key: "customer_insights", kind: "rule", version: MARKET_INTEL_VERSION, defaultEnabled: true },
  { key: "ml_ensemble", kind: "ml", version: MARKET_ML_VERSION, defaultEnabled: false },
  { key: "strategy_agent", kind: "agent", version: "agent-v0", defaultEnabled: false },
];

/** In-memory enable map (Redis-ready: replace with distributed store). */
const moduleState = new Map<IntelligenceModuleKey, boolean>(
  INTELLIGENCE_MODULES.map((m) => [m.key, m.defaultEnabled]),
);

export function isModuleEnabled(key: IntelligenceModuleKey): boolean {
  return moduleState.get(key) ?? false;
}

export function setModuleEnabled(key: IntelligenceModuleKey, enabled: boolean): void {
  moduleState.set(key, enabled);
}

export function listModules(): Array<ModuleDefinition & { enabled: boolean }> {
  return INTELLIGENCE_MODULES.map((m) => ({
    ...m,
    enabled: isModuleEnabled(m.key),
  }));
}
