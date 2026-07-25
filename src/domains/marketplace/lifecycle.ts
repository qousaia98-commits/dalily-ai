/**
 * Dalily 2.0 Marketplace lifecycle phases (SAD Marketplace ownership).
 * These are the *target* request states — not the legacy RFQ enum.
 * Sprint 1 only maps to/from legacy; Selection/Unlock phases activate in later sprints.
 */

export const MARKETPLACE_LIFECYCLE_PHASES = [
  "draft",
  "published",
  "matching",
  "offering",
  "selected",
  "unlock_pending",
  "unlocked",
  "in_progress",
  "completed",
  "reviewed",
  "withdrawn",
  "expired",
  "cancelled",
  "rejected",
  "disputed",
] as const;

export type MarketplaceLifecyclePhase = (typeof MARKETPLACE_LIFECYCLE_PHASES)[number];

/** Job checkpoint ids (light tracking — PSD Ch.2). Placeholders until Sprint 7+. */
export const JOB_CHECKPOINT_IDS = [
  "confirmed",
  "planned",
  "in_progress",
  "done_pending_customer",
  "closed",
] as const;

export type JobCheckpointId = (typeof JOB_CHECKPOINT_IDS)[number];
