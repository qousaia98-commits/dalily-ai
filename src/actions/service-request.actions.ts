/**
 * Stable public entry for service-request server actions.
 * Implementation lives in `./service-request/*` (Sprint 9.5 Phase 7).
 *
 * Note: this barrel must NOT have `"use server"` — Next.js only allows
 * inline async exports in directive files. Each action module owns the directive.
 */

export type { ServiceRequestActionState } from "./service-request/types";

export { createServiceRequestAction } from "./service-request/create";
export { acceptServiceRequestAction } from "./service-request/assign";
export { rejectServiceRequestAction } from "./service-request/cancel";
export {
  sendQuoteAction,
  acceptQuoteAction,
  declineQuoteAction,
  requestQuoteChangesAction,
  completeServiceAction,
  confirmCompletionAction,
  reportProblemAction,
  submitReviewAction,
} from "./service-request/status";
export { saveProviderRequestSettingsAction } from "./service-request/update";
export {
  sendMessageAction,
  markNotificationReadAction,
} from "./service-request/notifications";
