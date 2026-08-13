/**
 * Production release management — calendar, freeze, canary, staged rollouts.
 */

export type ReleaseStage =
  | 'feature_freeze'
  | 'release_candidate'
  | 'canary'
  | 'staged_rollout'
  | 'percentage_rollout'
  | 'production'
  | 'emergency'
  | 'lts';

export type ReleaseRecord = {
  version: string;
  stage: ReleaseStage;
  channel: 'preview' | 'production';
  percentage: number;
  notes: string;
  createdAt: string;
};

export const releaseCalendar = {
  cadence: 'bi-weekly',
  freezeWindowDays: 3,
  canaryPercent: 5,
  stagedSteps: [5, 25, 50, 100],
  hotFixSlaHours: 24,
  ltsPolicy: 'Maintain previous major for 90 days with critical security fixes only',
} as const;

export const currentReleasePlan: ReleaseRecord = {
  version: '1.0.0',
  stage: 'release_candidate',
  channel: 'preview',
  percentage: 0,
  notes: 'Sprint 9 Phase 5 — App Store / Play readiness',
  createdAt: new Date().toISOString().slice(0, 10),
};

export function nextStagedPercent(current: number): number {
  const next = releaseCalendar.stagedSteps.find((s) => s > current);
  return next ?? 100;
}

export const rollbackStrategy = {
  binary: 'Submit previous store build; halt rollout percentage to 0%',
  ota: 'eas update:rollback --channel production',
  hotFix: 'Cut hotfix branch from release tag → RC → canary 5% → staged',
  versionHistory: 'Tag every production binary as mobile-vX.Y.Z+build',
} as const;

export const deploymentTargets = {
  ios: ['TestFlight Internal', 'TestFlight External', 'App Store'],
  android: [
    'Google Play Internal Testing',
    'Google Play Closed Testing',
    'Google Play Open Testing',
    'Google Play Production',
  ],
} as const;
