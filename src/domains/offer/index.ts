/**
 * SAD Offer domain skeleton (Sprint 0).
 * Quotes remain under legacy service-requests until Sprint 4.
 */

export const OFFER_DOMAIN = {
  service: "offer",
  owns: ["offers", "offer_templates", "offer_quality_flags"],
  impl: ["quotes via service-requests/actions (legacy)"],
  status: "skeleton",
  sprint: 4,
} as const;
