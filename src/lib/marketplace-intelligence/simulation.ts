/**
 * Digital twin simulations + knowledge graph (isolated / internal).
 */

import type { CollectedMarketplaceRaw } from "@/lib/marketplace-intelligence/collect";
import type {
  FutureAgentBlueprint,
  KnowledgeGraphNode,
  SimulationScenario,
} from "@/lib/marketplace-intelligence/types";
import { MARKET_KG_VERSION, MARKET_SIM_VERSION } from "@/lib/marketplace-intelligence/types";

export function runMarketplaceSimulation(input: {
  title: string;
  scenarioType: string;
  inputs: Record<string, unknown>;
  raw: CollectedMarketplaceRaw;
}): SimulationScenario {
  const deltaProviders = Number(input.inputs.providerDelta ?? 0);
  const responseDelta = Number(input.inputs.responseTimeDeltaPct ?? 0);
  const pricingWeight = Number(input.inputs.pricingWeight ?? 1);
  const matchingWeight = Number(input.inputs.matchingWeight ?? 1);
  const reputationWeight = Number(input.inputs.reputationWeight ?? 1);

  const liquidityDelta =
    deltaProviders * 0.01 -
    responseDelta * 0.002 +
    (matchingWeight - 1) * 0.04 +
    (reputationWeight - 1) * 0.02;
  const completionDelta = (matchingWeight - 1) * 0.03 - Math.abs(pricingWeight - 1) * 0.01;
  const trustDelta = (reputationWeight - 1) * 0.05 - Number(input.raw.openFraudCases) * 0.001;

  const projectedLiquidity = Math.max(
    0,
    Math.min(1, input.raw.marketplaceLiquidity + liquidityDelta),
  );
  const projectedHealth = Math.max(
    0,
    Math.min(1, input.raw.healthScore + liquidityDelta * 0.4 + completionDelta * 0.3),
  );

  return {
    title: input.title,
    scenarioType: input.scenarioType,
    inputs: input.inputs,
    results: {
      projectedLiquidity: Number(projectedLiquidity.toFixed(3)),
      projectedHealth: Number(projectedHealth.toFixed(3)),
      projectedCompletionDelta: Number(completionDelta.toFixed(3)),
      projectedTrustDelta: Number(trustDelta.toFixed(3)),
      baselineLiquidity: input.raw.marketplaceLiquidity,
      baselineHealth: input.raw.healthScore,
      isolated: true,
    },
    impactSummaryEn: `Simulation predicts liquidity ${Math.round(projectedLiquidity * 100)}% and health ${Math.round(projectedHealth * 100)}%. Production unchanged.`,
    impactSummaryAr: `المحاكاة تتوقع سيولة ${Math.round(projectedLiquidity * 100)}٪ وصحة ${Math.round(projectedHealth * 100)}٪. الإنتاج دون تغيير.`,
    affectsProduction: false,
    status: "completed",
  };
}

export function defaultSimulations(raw: CollectedMarketplaceRaw): SimulationScenario[] {
  return [
    runMarketplaceSimulation({
      title: "Increase provider count +15",
      scenarioType: "provider_count",
      inputs: { providerDelta: 15 },
      raw,
    }),
    runMarketplaceSimulation({
      title: "Reduce response time 20%",
      scenarioType: "response_time",
      inputs: { responseTimeDeltaPct: -20 },
      raw,
    }),
    runMarketplaceSimulation({
      title: "Adjust pricing weights +10%",
      scenarioType: "pricing_weights",
      inputs: { pricingWeight: 1.1 },
      raw,
    }),
    runMarketplaceSimulation({
      title: "Matching algorithm weight +15%",
      scenarioType: "matching_algorithm",
      inputs: { matchingWeight: 1.15 },
      raw,
    }),
    runMarketplaceSimulation({
      title: "Reputation weights +10%",
      scenarioType: "reputation_weights",
      inputs: { reputationWeight: 1.1 },
      raw,
    }),
    runMarketplaceSimulation({
      title: "Launch new category (plumbing)",
      scenarioType: "new_category",
      inputs: { category: "plumbing", providerDelta: 8 },
      raw,
    }),
    runMarketplaceSimulation({
      title: "Launch new city corridor",
      scenarioType: "new_city",
      inputs: { city: "aqaba", providerDelta: 12 },
      raw,
    }),
  ];
}

export function buildKnowledgeGraphSample(
  raw: CollectedMarketplaceRaw,
): KnowledgeGraphNode[] {
  const nodes: KnowledgeGraphNode[] = [
    {
      nodeType: "category",
      nodeKey: raw.categoryKeys[0] ?? "cleaning",
      label: "Category hub",
      properties: { demand: raw.demand },
      edges: [
        { toType: "region", toKey: raw.regionKeys[0] ?? "amman", relation: "served_in" },
        { toType: "forecast", toKey: "ensemble-v1", relation: "has_forecast" },
      ],
    },
    {
      nodeType: "region",
      nodeKey: raw.regionKeys[0] ?? "amman",
      label: "Region hub",
      properties: { supply: raw.supply },
      edges: [
        { toType: "pricing", toKey: "dynamic-v1", relation: "priced_by" },
        { toType: "scheduling", toKey: "capacity-v1", relation: "scheduled_by" },
      ],
    },
    {
      nodeType: "marketplace_event",
      nodeKey: `liquidity-${Date.now()}`,
      label: "Liquidity pulse",
      properties: { liquidity: raw.marketplaceLiquidity, version: MARKET_KG_VERSION },
      edges: [
        { toType: "business_metric", toKey: "health", relation: "influences" },
        { toType: "trust", toKey: "trust-dist", relation: "correlates" },
      ],
    },
    {
      nodeType: "fraud_investigation",
      nodeKey: "aggregate",
      label: "Fraud aggregate",
      properties: { open: raw.openFraudCases },
      edges: [{ toType: "trust", toKey: "trust-dist", relation: "impacts" }],
    },
    {
      nodeType: "quality_case",
      nodeKey: "aggregate",
      label: "Quality aggregate",
      properties: { open: raw.openQualityCases },
      edges: [{ toType: "business_metric", toKey: "health", relation: "impacts" }],
    },
  ];
  return nodes;
}

export const FUTURE_AI_AGENTS: FutureAgentBlueprint[] = [
  {
    id: "business-growth-agent",
    name: "Business Growth Agent",
    scope: "Provider growth recommendations",
    mayActIrreversibly: false,
    requiresAuthorization: true,
  },
  {
    id: "fraud-investigation-agent",
    name: "Fraud Investigation Agent",
    scope: "Prioritize fraud queues — no auto-ban",
    mayActIrreversibly: false,
    requiresAuthorization: true,
  },
  {
    id: "scheduling-agent",
    name: "Scheduling Agent",
    scope: "Advisory route/gap suggestions",
    mayActIrreversibly: false,
    requiresAuthorization: true,
  },
  {
    id: "pricing-agent",
    name: "Pricing Agent",
    scope: "Suggested ranges only",
    mayActIrreversibly: false,
    requiresAuthorization: true,
  },
  {
    id: "marketplace-strategy-agent",
    name: "Marketplace Strategy Agent",
    scope: "Executive strategic recommendations",
    mayActIrreversibly: false,
    requiresAuthorization: true,
  },
  {
    id: "provider-success-agent",
    name: "Provider Success Agent",
    scope: "Coaching and unlock guidance",
    mayActIrreversibly: false,
    requiresAuthorization: true,
  },
  {
    id: "customer-success-agent",
    name: "Customer Success Agent",
    scope: "Optional booking window tips",
    mayActIrreversibly: false,
    requiresAuthorization: true,
  },
];

export { MARKET_SIM_VERSION };
