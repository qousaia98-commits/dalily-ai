/**
 * Fairness: exploration, cold-start, controlled rotation, boost decay.
 */

import {
  DEFAULT_FAIRNESS_PARAMS,
  type FairnessParams,
} from "@/lib/matching-engine/types";

export function computeFairnessBoost(input: {
  reviewCount: number;
  providerId: string;
  requestSalt?: string;
  explorationBoost?: number;
  coldStartBoost?: number;
  boostExpiresAt?: string | null;
  params?: FairnessParams;
}): number {
  const p = input.params ?? DEFAULT_FAIRNESS_PARAMS;
  let boost = 0;

  // Decay expired temporary boosts
  const expired =
    input.boostExpiresAt != null &&
    new Date(input.boostExpiresAt).getTime() < Date.now();
  const exploration = expired ? 0 : (input.explorationBoost ?? 0);
  const coldStored = expired ? 0 : (input.coldStartBoost ?? 0);

  if (input.reviewCount < p.coldStartReviewThreshold) {
    const cold =
      p.coldStartBoostMax *
      (1 - input.reviewCount / Math.max(1, p.coldStartReviewThreshold));
    boost += Math.max(cold, coldStored);
  } else {
    boost += Math.min(p.explorationBoostMax, exploration);
  }

  // Controlled rotation — deterministic jitter from provider + salt
  const salt = `${input.providerId}:${input.requestSalt ?? "default"}`;
  let hash = 0;
  for (let i = 0; i < salt.length; i++) {
    hash = (hash * 31 + salt.charCodeAt(i)) >>> 0;
  }
  const unit = (hash % 1000) / 1000; // 0..1
  boost += (unit - 0.5) * 2 * p.rotationAmplitude;

  return Math.round(boost * 10000) / 10000;
}

export function decayBoost(
  current: number,
  updatedAt: string,
  decayHours: number,
): number {
  const ageH =
    (Date.now() - new Date(updatedAt).getTime()) / 3_600_000;
  if (ageH <= 0) return current;
  const factor = Math.max(0, 1 - ageH / Math.max(1, decayHours));
  return Math.round(current * factor * 10000) / 10000;
}
