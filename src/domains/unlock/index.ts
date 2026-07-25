/**
 * SAD Unlock domain skeleton (Sprint 0).
 * Does not exist in legacy product — Sprint 5.
 */

export const UNLOCK_DOMAIN = {
  service: "unlock",
  owns: ["unlock_sessions", "contact_release_grants"],
  impl: [],
  status: "skeleton",
  sprint: 5,
} as const;
