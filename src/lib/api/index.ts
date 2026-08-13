/**
 * Canonical shared API client (Sprint 9.5 Phase 6).
 *
 * Use this for new outbound HTTP. Existing provider clients should migrate
 * gradually — behaviour must remain identical.
 */

export { withTimeout } from "./http";
export { fetchWithTimeout } from "./fetch";
export { withRetry } from "./retry";
export { bearerAuthHeaders, jsonContentHeaders } from "./auth";
export { ApiClientError } from "./errors";
export type {
  FetchJsonOptions,
  FetchJsonResult,
  HttpMethod,
} from "./types";
export type { RetryOptions } from "./retry";
