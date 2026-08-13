/**
 * Shared API client types (Sprint 9.5 Phase 6).
 */

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type FetchJsonOptions = {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: BodyInit | null;
  /** Abort after this many ms. Required for outbound LLM calls. */
  timeoutMs: number;
  signal?: AbortSignal;
};

export type FetchJsonResult =
  | { ok: true; response: Response; status: number }
  | { ok: false; error: "aborted" | "network" | "http"; status?: number; bodyPreview?: string };
