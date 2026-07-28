/**
 * API client error taxonomy (Sprint 9.5 Phase 6).
 */

export class ApiClientError extends Error {
  readonly code: "aborted" | "network" | "http" | "no_api_key";
  readonly status?: number;

  constructor(
    code: ApiClientError["code"],
    message: string,
    status?: number,
  ) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
  }
}
