/**
 * Pure forecast view / DTO types — no server-only imports.
 * Safe for `"use client"` props via `@/domains/forecast/client`.
 */

import type { ForecastWeight } from "@/lib/forecast-engine/types";

export type AdminForecastDashboard = {
  weights: ForecastWeight[];
  models: Array<{
    modelKey: string;
    title: string;
    algorithm: string;
    enabled: boolean;
    mlReady: boolean;
    isDefault: boolean;
  }>;
  recentHistory: Array<{
    id: string;
    categoryKey: string | null;
    horizon: string;
    expectedDemand: number;
    confidence: number;
    trend: string;
    algorithmVersion: string;
    latencyMs: number | null;
    createdAt: string;
  }>;
  accuracyStats: {
    total: number;
    avgAbsError: number | null;
    avgPctError: number | null;
  };
  marketSnapshots: Array<{
    categoryKey: string;
    regionKey: string;
    demandIndex: number;
    bookingVelocity: number;
    growing: boolean;
    declining: boolean;
    sampleCount: number;
    computedAt: string;
  }>;
  avgLatencyMs: number | null;
  experiment: {
    key: string;
    active: boolean;
    algorithmA: string;
    algorithmB: string;
    trafficBPct: number;
  } | null;
  modelVersion: string;
};
